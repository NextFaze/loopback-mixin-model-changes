var app = require('./simple-app/server/server');
var request = require('supertest');
var expect = require('chai').expect;

var token, user;

describe('User Tracking', function() {

  beforeEach(function() {
    var userData = {
      email: 'user@example.com',
      password: 'password123'
    };
    return app.models.User.create(userData)
    .then(function(res) {
      user = res;
      return request(app)
        .post('/api/Users/login')
        .send(userData)
        .expect(200)
    })
    .then(function(res) {
      token = res.body;
    });
  })

  afterEach(function() {
    return Promise.all([
      app.models.User.destroyAll(),
      app.models.AccessToken.destroyAll(),
      app.models.remotable.destroyAll(),
    ])
    .then(function() {
      // needs to be separate to clean up the deletes
      return app.models.remotableHistory.destroyAll();
    })
  })

  it('should not store user id if user is not authenticated', function() {
    return request(app)
      .post('/api/remotables')
      .send({
        description: 'start'
      })
      .then(function(res) {
        return app.models.remotableHistory.find()
      })
      .then(function(res) {
        expect(res).to.have.lengthOf(1);
        expect(res[0]).to.have.property('userId', undefined);
      });
  });

  it('should store user id if user is authenticated', function() {
    return request(app)
      .post('/api/remotables')
      .send({
        description: 'start'
      })
      .set('Authorization', token.id)
      .then(function(res) {
        return app.models.remotableHistory.find()
      })
      .then(function(res) {
        expect(res).to.have.lengthOf(1);
        expect(res[0]).to.have.property('userId', user.id);
      });
  });

  it('should store user id for bulk actions if user is authenticated', function() {
    return request(app)
      .post('/api/remotables')
      .send([{
        description: 'first'
      }, {
        description: 'second'
      }])
      .set('Authorization', token.id)
      .then(function(res) {
        return app.models.remotableHistory.find()
      })
      .then(function(res) {
        expect(res).to.have.lengthOf(2);
        res.forEach(function(r) {
          expect(r).to.have.property('userId', user.id);
        })
      });
  });
})