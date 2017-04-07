var app = require('./simple-app/server/server');
var request = require('supertest');
var expect = require('chai').expect;
var helper = require('./helper');

describe('Remote Method Tracking', function() {
  afterEach(function() {
    return helper.cleanup(app);
  });

  it('should track the remote method used (test 1)', function() {
    return request(app)
      .post('/api/remotables')
      .send({
        description: 'start'
      })
      .expect(200)
      .then(function(res) {
        return app.models.remotableHistory.find()
      })
      .then(function(res) {
        expect(res).to.have.lengthOf(1);
        expect(res[0]).to.have.property('remoteMethod', 'create');
      });
  });

  it('should track the remote method used (test 2)', function() {
    return app.models.remotable.create({
      description: 'start'
    })
    .then(function(res) {
      return request(app)
        .put('/api/remotables/' + res.id)
        .send({
          description: 'end'
        })
        .expect(200);
    })
    .then(function(res) {
      return app.models.remotableHistory.find()
    })
    .then(function(res) {
      expect(res).to.have.lengthOf(1);
      expect(res[0]).to.have.property('remoteMethod', 'updateAttributes');
    });
  });

  it('should note track model actions if remoteOnly is used', function() {
    return request(app)
      .post('/api/remotables')
      .send({
        description: 'start'
      })
      .expect(200)
      .then(function(res) {
        return app.models.remotable.create({
          description: 'created by server'
        });
      })
      .then(function() {
        return app.models.remotableHistory.find()
      })
      .then(function(res) {
        expect(res).to.have.lengthOf(1);
        expect(res[0]).to.have.property('remoteMethod', 'create');
      });
  });
});