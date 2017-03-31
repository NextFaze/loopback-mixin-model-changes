var app = require('./simple-app/server/server');
var chai = require('chai');
var chaiSubset = require('chai-subset');
chai.use(chaiSubset);
var expect = chai.expect;

var mixin = require('../');

describe('ChangeStream Mixin', function() {
  afterEach(function() {
    return app.models.widget.destroyAll()
    .then(function() {
      return app.models.widgetAudit.destroyAll();
    });
  });

  describe('Basic usage', function() {
    before(function() {
      var memDs = app.dataSource('mem', {
        connector: 'memory'
      });
      var widget = app.model('widget', {
        properties: {
          id: {
            type: 'string',
            id: true,
            defaultFn: 'guid'
          },
          name: 'string',
          description: 'string'
        },
        dataSource: 'mem'
      });
      var widgetAudit = app.model('widgetAudit', {
        properties: {
          id: {
            type: 'string',
            id: true,
            defaultFn: 'guid'
          },
          name: 'string',
          description: 'string',
          modelId: 'string'
        },
        dataSource: 'mem'
      });
      mixin(widget, { changeModel: 'widgetAudit', idKeyName: 'modelId' });
    });

    it('should work for creates', function() {
      var id;
      return app.models.widget.create({
        name: 'Widg'
      })
      .then(function(mdl) {
        id = mdl.id;
        return app.models.widgetAudit.find({
          where: {
            action: 'create'
          }
        });
      })
      .then(function(res) {
        expect(res).to.have.lengthOf(1);
        expect(res[0].toJSON()).to.containSubset({
          name: 'Widg',
          description: undefined,
          modelId: id,
          action: 'create'
        });
      });
    });

    it('should work for bulk creates', function(done) {
      var id1, id2;
      app.models.widget.create([{
        name: 'Widg'
      }, {
        name: 'Widg2',
        description: 'someDesc'
      }], function(err, res) {
        if(err) return done(err);
        id1 = res[0].id;
        id2 = res[1].id;
        return app.models.widgetAudit.find({
          where: {
            action: 'create'
          }
        })
        .then(function(res) {
          expect(res).to.have.lengthOf(2);
          expect(res[0].toJSON()).to.containSubset({
            name: 'Widg',
            description: undefined,
            modelId: id1,
            action: 'create'
          });
          expect(res[1].toJSON()).to.containSubset({
            name: 'Widg2',
            description: 'someDesc',
            modelId: id2,
            action: 'create'
          });
          done();
        })
        .catch(done);
      });
    });

    it('should work for updates', function() {
      var id;
      return app.models.widget.create({
        name: 'Widg2'
      })
      .then(function(w) {
        id = w.id;
        return w.updateAttributes({ description: 'It has a desc' });
      })
      .then(function() {
        return app.models.widgetAudit.find({
          where: {
            action: 'update'
          }
        });
      })
      .then(function(res) {
        expect(res).to.have.lengthOf(1);
        expect(res[0].toJSON()).to.containSubset({
          modelId: id,
          action: 'update',
          description: 'It has a desc',
          name: 'Widg2',
        });
      });
    });

    it('should work for bulk updates', function(done) {
      var id1, id2;
      app.models.widget.create([{
        name: 'Widg'
      }, {
        name: 'Widg2'
      }], function(err, res) {
        if(err) return done(err);
        id1 = res[0].id;
        id2 = res[1].id;
        return app.models.widget.updateAll({
          description: null
        }, {
          description: 'defaultval'
        })
        .then(function() {
          return app.models.widgetAudit.find({
            where: {
              action: 'update'
            }
          });
        })
        .then(function(res) {
          expect(res).to.have.lengthOf(2);
          expect(res[0].toJSON()).to.containSubset({
            name: 'Widg',
            action: 'update',
            description: 'defaultval'
          });
          expect(res[1].toJSON()).to.containSubset({
            name: 'Widg2',
            action: 'update',
            description: 'defaultval'
          });
          done();
        })
        .catch(done);
      });
    });

    it('should work for deletes', function() {
      var id;
      return app.models.widget.create({
        name: 'Widg2'
      })
      .then(function(w) {
        id = w.id;
        return w.destroy();
      })
      .then(function() {
        return app.models.widgetAudit.find({
          where: {
            action: 'delete'
          }
        });
      })
      .then(function(res) {
        expect(res).to.have.lengthOf(1);
        expect(res[0].toJSON()).to.containSubset({
          modelId: id,
          action: 'delete',
          name: 'Widg2',
        });
      });
    });

    it('should work for bulk deletes', function(done) {
      var id1, id2;
      app.models.widget.create([{
        name: 'Widg'
      }, {
        name: 'Widg2'
      }], function(err, res) {
        if(err) return done(err);
        id1 = res[0].id;
        id2 = res[1].id;
        return app.models.widget.destroyAll({})
        .then(function() {
          return app.models.widgetAudit.find({
            where: {
              action: 'delete'
            }
          });
        })
        .then(function(res) {
          expect(res).to.have.lengthOf(2);
          expect(res[0].toJSON()).to.containSubset({
            name: 'Widg',
            action: 'delete'
          });
          expect(res[1].toJSON()).to.containSubset({
            name: 'Widg2',
            action: 'delete'
          });
          done();
        })
        .catch(done);
      });
    });
  });

  describe('Customization', function() {
    describe('Deltas', function() {
      before(function() {
        var memDs = app.dataSource('mem', {
          connector: 'memory'
        });
        var widget = app.model('widget', {
          properties: {
            id: {
              type: 'string',
              id: true,
              defaultFn: 'guid'
            },
            name: 'string',
            description: 'string'
          },
          dataSource: 'mem'
        });
        var widgetAudit = app.model('widgetAudit', {
          properties: {
            id: {
              type: 'string',
              id: true,
              defaultFn: 'guid'
            },
            name: 'string',
            description: 'string',
            modelId: 'string'
          },
          dataSource: 'mem'
        });
        mixin(widget, { changeModel: 'widgetAudit', idKeyName: 'modelId', deltas: true });
      });

      it('should only log deltas', function() {
        var id;
        return app.models.widget.create({
          name: 'Widg2',
          description: 'SomeDescr'
        })
        .then(function(w) {
          id = w.id;
          return w.updateAttributes({ description: 'AltDescr' });
        })
        .then(function() {
          return app.models.widgetAudit.find({
            where: {
              action: 'update'
            }
          });
        })
        .then(function(res) {
          expect(res).to.have.lengthOf(1);
          expect(res[0]).to.have.property('description', 'AltDescr');
          expect(res[0].name).to.not.be.ok;
        });
      });

      it('should only log deltas for updates in bulk', function(done) {
        var id1, id2;
        app.models.widget.create([{
          name: 'Widg',
          description: 'First'
        }, {
          name: 'Widg2',
          description: 'Second'
        }], function(err, res) {
          if(err) return done(err);
          id1 = res[0].id;
          id2 = res[1].id;
          return app.models.widget.updateAll({}, {
            name: 'Widg2'
          })
          .then(function() {
            return app.models.widgetAudit.find({
              where: {
                action: 'update'
              }
            });
          })
          .then(function(res) {
            expect(res).to.have.lengthOf(1);
            expect(res[0].toJSON()).to.containSubset({
              name: 'Widg2',
              action: 'update',
              modelId: id1,
              description: undefined
            });
            done();
          })
          .catch(done);
        });
      });

      it('should skip updates with no deltas', function() {
        var id;
        return app.models.widget.create({
          name: 'Widg2'
        })
        .then(function(w) {
          id = w.id;
          return w.updateAttributes({});
        })
        .then(function() {
          return app.models.widgetAudit.find({
            where: {
              action: 'update'
            }
          });
        })
        .then(function(res) {
          expect(res).to.have.lengthOf(0);
        });
      });
    });

    describe('Blacklist', function() {
      before(function() {
        var memDs = app.dataSource('mem', {
          connector: 'memory'
        });
        var widget = app.model('widget', {
          properties: {
            id: {
              type: 'string',
              id: true,
              defaultFn: 'guid'
            },
            name: 'string',
            secret: 'string'
          },
          dataSource: 'mem'
        });
        var widgetAudit = app.model('widgetAudit', {
          properties: {
            id: {
              type: 'string',
              id: true,
              defaultFn: 'guid'
            },
            name: 'string',
            modelId: 'string'
          },
          dataSource: 'mem'
        });
        mixin(widget, { changeModel: 'widgetAudit', idKeyName: 'modelId', blacklist: ['secret'] });
      });

      it('should not audit blacklisted properties', function() {
        var id;
        return app.models.widget.create({
          name: 'Widg',
          secret: 'password123'
        })
        .then(function(mdl) {
          id = mdl.id;
          return app.models.widgetAudit.find({
            where: {
              action: 'create'
            }
          });
        })
        .then(function(res) {
          expect(res).to.have.lengthOf(1);
          expect(res[0].toJSON()).to.containSubset({
            name: 'Widg',
            modelId: id,
            action: 'create'
          });
          expect(res[0].secret).to.not.be.ok;
        });
      });
    });

    describe('Whitelist', function() {
      before(function() {
        var memDs = app.dataSource('mem', {
          connector: 'memory'
        });
        var widget = app.model('widget', {
          properties: {
            id: {
              type: 'string',
              id: true,
              defaultFn: 'guid'
            },
            name: 'string',
            secret: 'string'
          },
          dataSource: 'mem'
        });
        var widgetAudit = app.model('widgetAudit', {
          properties: {
            id: {
              type: 'string',
              id: true,
              defaultFn: 'guid'
            },
            name: 'string',
            secret: 'string'
          },
          dataSource: 'mem'
        });
        mixin(widget, { changeModel: 'widgetAudit', idKeyName: 'modelId', whitelist: ['name'] });
      });

      it('should not only whitelisted properties', function() {
        var id;
        return app.models.widget.create({
          name: 'Widg',
          secret: 'password123'
        })
        .then(function(mdl) {
          id = mdl.id;
          return app.models.widgetAudit.find({
            where: {
              action: 'create'
            }
          });
        })
        .then(function(res) {
          expect(res).to.have.lengthOf(1);
          expect(res[0].toJSON()).to.containSubset({
            name: 'Widg',
            modelId: id,
            action: 'create'
          });
          expect(res[0].secret).to.not.be.ok;
        });
      });
    });

    describe('Action property', function() {
      before(function() {
        var memDs = app.dataSource('mem', {
          connector: 'memory'
        });
        var widget = app.model('widget', {
          properties: {
            id: {
              type: 'string',
              id: true,
            },
            name: 'string'
          },
          dataSource: 'mem'
        });
        var widgetAudit = app.model('widgetAudit', {
          properties: {
            id: {
              type: 'string',
              id: true,
              defaultFn: 'guid'
            },
            name: 'string'
          },
          dataSource: 'mem'
        });
        mixin(widget, { changeModel: 'widgetAudit', idKeyName: 'modelId', actionKey: 'model_action' });
      });

      it('should allow setting a custom action key', function() {
        var id;
        return app.models.widget.create({
          name: 'Widg',
          secret: 'password123'
        })
        .then(function(mdl) {
          id = mdl.id;
          return app.models.widgetAudit.find({
            where: {
              model_action: 'create'
            }
          });
        })
        .then(function(res) {
          expect(res).to.have.lengthOf(1);
          expect(res[0].toJSON()).to.containSubset({
            name: 'Widg',
            modelId: id,
            model_action: 'create'
          });
        });
      });
    });
  });
});