var app = require('./simple-app/server/server');
var chai = require('chai');
var chaiSubset = require('chai-subset');
chai.use(chaiSubset);
var expect = chai.expect;
var helper = require('./helper');

var mixin = require('../model-changes');

describe('Track Actions', function() {
  afterEach(function() {
    return helper.cleanup(app);
  });

  describe('Whitelist', function() {
    before(function() {
      var memDs = app.dataSource('mem', {
        connector: 'memory'
      });
      var widget = helper.defineWidgetModel(app);
      var widgetAudit = helper.defineTrackerModel(app);
      mixin(widget, { changeModel: 'widgetAudit', idKeyName: 'modelId', whitelistActions: ['update'] });
    });

    it('should support whitlisting certain actions', function() {
      var mdl;
      return app.models.widget.create({
        name: 'Widg'
      })
      .then(function(res) {
        mdl = res;
        return app.models.widgetAudit.find()
      })
      .then(function(res) {
        expect(res).to.have.lengthOf(0);
        return mdl.updateAttributes({
          name: 'Widgedit'
        });
      })
      .then(function() {
        return app.models.widgetAudit.find();
      })
      .then(function(res) {
        expect(res).to.have.lengthOf(1);
        expect(res[0]).to.have.property('action', 'update');
      });
    });
  
    it('should support whitlisting certain actions in bulk', function(done) {
      var mdl;
      return app.models.widget.create([{
        name: 'Widg1'
      }, {
        name: 'Widg2'
      }], function(err, res) {
        if(err) {
          return done(err);
        }
        return app.models.widgetAudit.find()
        .then(function(res) {
          expect(res).to.have.lengthOf(0);
          return app.models.widget.updateAll({}, {
            name: 'Widgedit'
          });
        })
        .then(function() {
          return app.models.widgetAudit.find();
        })
        .then(function(res) {
          expect(res).to.have.lengthOf(2);
          expect(res[0]).to.have.property('action', 'update');
          expect(res[1]).to.have.property('action', 'update');
          done();
        });
      });
    });
  });
});