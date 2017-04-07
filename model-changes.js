var _ = require('lodash');
var debug = require('debug')('loopback:mixin:model-changes');

var trackAgainst = {};

module.exports = function(Model, options) {
  Model.getApp(function(err, app) {
    if(err) {
      console.warn(err);
      return;
    }
    options = Object.assign({}, options);
    if(!options.changeModel || !options.idKeyName) {
      debug('No change model or id key name defined for ', Model.modelName, ' - ignoring...');
      return;
    }

    trackAgainst[options.changeModel] = Model.modelName;
    var actionKey = 'action';
    if(options.actionKey) {
      actionKey = options.actionKey;
    }

    debug('Init mixin with options', options);

    var strictAuditng = false;
    var deltas = !!options.deltas;
    var audit = {};
    if(options.whitelist && Array.isArray(options.whitelist)) {
      strictAuditng = true;
      options.whitelist.forEach(function(prop) {
        audit[prop] = true;
      });
    }

    if(options.blacklist && Array.isArray(options.blacklist)) {
      options.blacklist.forEach(function(prop) {
        audit[prop] = false;
      });
    }

    function beforeHandler(ctx, next) {
      if(ctx.Model && trackAgainst[ctx.Model.modelName]) {
        debug(ctx.Model.modelName + ' is being used to track changes against another model. Skipping to avoid infinite recursion');
        return next();
      }
      findPrevious(Model, ctx)
      .then(function(res) {
        if(Array.isArray(res)) {
          ctx.options.previousValues = res;
        } else {
          ctx.options.previousValue = res;
        }
        next();
      })
      .catch(next);
    }

    Model.observe('before save', beforeHandler);
    Model.observe('before delete', beforeHandler);

    var idKey = Model.getIdName();
    var relKey = options.idKeyName;
    var userKey = options.trackUsersAs;
    var remoteCtx = options.remotCtx || 'remoteCtx';
    var trackFrom = options.trackUsersFrom || 'userId';

    Model.observe('after save', function(ctx, next) {
      if(ctx.Model && trackAgainst[ctx.Model.modelName]) {
        debug(ctx.Model.modelName + ' is being used to track changes against another model. Skipping to avoid infinite recursion');
        return next();
      }
      var ChangeStreamModel = Model.app.models[options.changeModel];
      var opts = extractTxOpts(ctx);
      if (ctx.isNewInstance) {
        recordModelChange('create', ctx.instance, opts, next);
      } else {
        if(ctx.options.previousValue) {
          var change = ctx.instance;
          if(deltas) {
            change = extractDeltas(ctx.options.previousValue, change);
          }
          recordModelChange('update', change, opts, next);
        } else if(ctx.options.previousValues) {
          var idName = Model.dataSource.idName(Model.modelName);
          var ids = ctx.options.previousValues.map(function(inst) { return inst[idName]; });
          if(ids.length > 0) {
            var query = { where: {} };
            query.where[idName] = {
              inq: ids
            };
            Model.find(query, opts)
            .then(function(instances) {
              if(deltas) {
                var originals = {};
                ctx.options.previousValues.forEach(function(item) {
                  originals[item[idKey]] = item;
                });

                instances = instances.map(function(inst) {
                  if(originals[inst[idKey]]) {
                    return extractDeltas(originals[inst[idKey]], inst);
                  } else {
                    return inst;
                  }
                });
              }
              recordModelChange('update', instances, opts, next);
            })
            .catch(next);
          } else {
            next();
          }
        } else {
          next();
        }
      }
    });

    Model.observe('after delete', function(ctx, next) {
      var opts = extractTxOpts(ctx);
      if(ctx.options.previousValue) {
        recordModelChange('delete', ctx.instance, opts, next);
      } else if(ctx.options.previousValues) {
        recordModelChange('delete', ctx.options.previousValues, opts, next);
      } else {
        next();
      }
    });

    function recordModelChange(action, val, opts, next) {
      var ChangeStreamModel = Model.app.models[options.changeModel];
      if(Array.isArray(val)) {
        var mdls = val.map(function(old) {
          return buildModelPayload(action, old);
        });
        // Remove any null payloads
        mdls = mdls.filter(function(mdl) {
          return !!mdl;
        });
        mdls.forEach(function(inst) {
          if(userKey && opts[remoteCtx]) {
            inst[userKey] = opts[remoteCtx].req.accessToken[trackFrom];
          }
        })
        if(mdls.length) {
          debug(action + ' ' + mdls.length + ' models');
          return ChangeStreamModel.create(mdls, opts, next);
        } else {
          debug(action + 'SkipBulk models (no deltas)');
          next();
        }
      } else if(val) {
        var changeInstance = buildModelPayload(action, val);
        if(changeInstance) {
          if(userKey && opts[remoteCtx]) {
            changeInstance[userKey] = opts[remoteCtx].req.accessToken[trackFrom];
          }
          debug(action + ' ' + changeInstance[relKey]);
          ChangeStreamModel.create(changeInstance, opts, next);
        } else {
          debug(action + 'Skip (no deltas)');
          next();
        }
      } else {
        next();
      }
    }

    function extractDeltas(old, upd) {
      if(!old) {
        return upd;
      }
      if(!upd) {
        return {};
      }
      old = old.toJSON();
      upd = upd.toJSON();
      var deltaKeys = Object.keys(upd).filter(function(key) {
        return !_.isEqual(old[key], upd[key]);
      });
      deltaKeys.push(idKey);
      return _.pick(upd, deltaKeys);
    }

    function buildModelPayload(action, data) {
      var payload = {};
      Model.forEachProperty(function(prop) {
        if(strictAuditng && audit[prop] !== true) {
          if(prop !== idKey) {
            return;
          }
        } else if(audit[prop] === false) {
          return;
        }
        payload[prop] = data[prop];
      });
      var id = payload[idKey];
      payload[idKey] = undefined;
      if(action === 'update') {
        var deltas = Object.keys(payload).filter(function(key) { return payload[key] !== undefined; });
        if(!deltas.length) {
          return null;
        }
      }
      payload[actionKey] = action;
      payload[relKey] = id;
      return payload;
    }

    function findPrevious(Model, ctx) {
      var opts = extractTxOpts(ctx);
      if (typeof ctx.isNewInstance === 'undefined' || !ctx.isNewInstance) {
        var id = ctx.instance ? ctx.instance.id : null;
        if (!id) {
          id = ctx.data ? ctx.data.id : null;
        }
        if (!id && ctx.where) {
          id = ctx.where.id;
        }
        if (!id && ctx.options.remoteCtx) {
          id = ctx.options.remoteCtx.req && ctx.options.remoteCtx.req.args ?
            ctx.options.remoteCtx.req.args.id : null;
        }
        if (id) {
          return Model.findById(id, {}, opts);
        } else {
          var query = {where: ctx.where} || {};
          return Model.find(query, opts)
          .then(function(oldInstances) {
            return oldInstances;
          });
        }
      } else {
        return Promise.resolve();
      }
    }

    function extractTxOpts(ctx) {
      var opts = {};
      if(ctx.options) {
        if(ctx.options.transaction) {
          opts.transaction = ctx.options.transaction;
        }
        if(ctx.options[remoteCtx] && ctx.options[remoteCtx].req && ctx.options[remoteCtx].req.accessToken) {
          opts[remoteCtx] = ctx.options[remoteCtx];
        }
      }
      return opts;
    }
  })
};
