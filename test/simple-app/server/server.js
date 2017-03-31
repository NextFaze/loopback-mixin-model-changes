var loopback = require('loopback');
var boot = require('loopback-boot');

var app = module.exports = loopback();

// app.use(function(req, res, next) {
//   console.log('%s %s %s', req.method, req.path, req.accessToken);
//   console.log(req.body);
//   console.log(req.headers);
//   next();
// })

app.use(loopback.token());

app.start = function() {
  // start the web server
  return app.listen(function() {
    console.log('Web server listening at: %s', app.get('url'));
    app.emit('started');
  });
};

app.stop = function() {
  process.exit(0);
}

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});
