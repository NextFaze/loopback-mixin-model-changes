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
    debug('Init mixin with options', options);

    // Store the model we're tracking against to avoid infinite recursion when using `base` models
    trackAgainst[options.changeModel] = Model.modelName;

    if(!options.changeModel || !options.idKeyName) {
      debug('No change model or id key name defined for ', Model.modelName, ' - ignoring...');
      return;
    }

    var actions = {
      CREATE: options.createActionName || 'create',
      UPDATE: options.updateActionName || 'update',
      DELETE: options.deleteActionName || 'delete'
    };

    var actionKey = options.actionKey || 'action';
    var audit = {};
    var deltas = !!options.deltas;
    var idKey = Model.getIdName();
    var relKey = options.idKeyName;
    var remoteCtx = options.remotCtx || 'remoteCtx';
    var remoteTracker = options.remoteMethod;
    var strictAuditng = false;
    var trackFrom = options.trackUsersFrom || 'userId';
    var userKey = options.trackUsersAs;
    var whitelistActions = (options.whitelistActions && Array.isArray(options.whitelistActions)) ? options.whitelistActions : false;

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

    Model.observe('before save', beforeHandler);
    Model.observe('before delete', beforeHandler);
    Model.observe('after save', afterSaveHandler);
    Model.observe('after delete', afterDeleteHandler);

    function beforeHandler(ctx, next) {
      if(shouldFilterAction(ctx, next)) {
       return next(); 
      }
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

    function afterSaveHandler(ctx, next) {
      if(ctx.Model && trackAgainst[ctx.Model.modelName]) {
        debug(ctx.Model.modelName + ' is being used to track changes against another model. Skipping to avoid infinite recursion');
        return next();
      }
      if(shouldFilterAction(ctx, next)) {
       return next(); 
      }
      var ChangeStreamModel = Model.app.models[options.changeModel];
      var opts = extractCtxOpts(ctx);
      if (ctx.isNewInstance) {
        recordModelChange(actions.CREATE, ctx.instance, opts, next);
      } else {
        if(ctx.options.previousValue) {
          var change = ctx.instance;
          if(deltas) {
            change = extractDeltas(ctx.options.previousValue, change);
          }
          recordModelChange(actions.UPDATE, change, opts, next);
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
              recordModelChange(actions.UPDATE, instances, opts, next);
            })
            .catch(next);
          } else {
            next();
          }
        } else {
          next();
        }
      }
    }

    function afterDeleteHandler(ctx, next) {
      var opts = extractCtxOpts(ctx);
      if(ctx.options.previousValue) {
        recordModelChange(actions.DELETE, ctx.instance, opts, next);
      } else if(ctx.options.previousValues) {
        recordModelChange(actions.DELETE, ctx.options.previousValues, opts, next);
      } else {
        next();
      }
    }

    function shouldFilterAction(ctx, next) {
      if(whitelistActions) {
        var actionType = extractActionType(ctx);
        if(whitelistActions.indexOf(actionType) < 0) {
          debug('Ignoring action not on whitelist ', actionType);
          return true;
        }
      }
      if(options.remoteOnly && !remoteMethodName(ctx.options)) {
        return true;
      }
      return false;
    }

    function remoteMethodName(opts) {
      try {
        var methodName = opts[remoteCtx].method.name;
        return methodName;
      } catch(ex) {
        return null;
      }
    }

    function extractActionType(ctx) {
      if(ctx.isNewInstance) {
        return actions.CREATE;
      } else if(ctx.data || ctx.instance) {
        return actions.UPDATE;
      } else {
        return actions.DELETE;
      }
    }

    function recordModelChange(action, val, opts, next) {
      var ChangeStreamModel = Model.app.models[options.changeModel];
      if(Array.isArray(val)) {
        var mdls = val.map(function(old) {
          return buildModelPayload(action, old, opts);
        });
        // Remove any null payloads
        mdls = mdls.filter(function(mdl) {
          return !!mdl;
        });
        if(mdls.length) {
          debug(action + ' ' + mdls.length + ' models');
          return ChangeStreamModel.create(mdls, opts, next);
        } else {
          debug(action + 'SkipBulk models (no deltas)');
          next();
        }
      } else if(val) {
        var changeInstance = buildModelPayload(action, val, opts);
        if(changeInstance) {
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

    function buildModelPayload(action, data, opts) {
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
      if(userKey && opts[remoteCtx]) {
        try {
          payload[userKey] = opts[remoteCtx].req.accessToken[trackFrom];
        } catch(ex) {}
      }
      if(remoteTracker) {
        var remoteName = remoteMethodName(opts);
        if(remoteName) {
          payload[remoteTracker] = remoteName;
        }
      }
      if(action === actions.UPDATE) {
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
      var opts = extractCtxOpts(ctx);
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
            ctx.options.remoteCtx.req.args.id :
            null;
        }
        if (id) {
          return Model.findById(id, {}, opts);
        } else {
          var query = { where: ctx.where } || {};
          return Model.find(query, opts)
          .then(function(oldInstances) {
            return oldInstances;
          });
        }
      } else {
        return Promise.resolve();
      }
    }

    function extractCtxOpts(ctx) {
      var opts = {};
      if(ctx.options) {
        // We want to use a transaction if it exists to avoid creating ophaned action records or deadlock
        if(ctx.options.transaction) {
          opts.transaction = ctx.options.transaction;
        }
        if(ctx.options[remoteCtx]) {
          opts[remoteCtx] = ctx.options[remoteCtx];
        }
      }
      return opts;
    }
  });
};
