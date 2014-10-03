var murmurhash = require('murmurhash'),
    url = require('url'),
    metrics = require('newww-metrics')();

module.exports = function login (request, reply) {
  var loginUser = request.server.methods.user.loginUser,
      setSession = request.server.methods.user.setSession(request),
      generateError = request.server.methods.error.generateError,
      addMetric = metrics.addMetric,
      addLatencyMetric = metrics.addPageLatencyMetric,
      timer = { start: Date.now() };

  if (request.auth.isAuthenticated) {
    timer.end = Date.now();
    addLatencyMetric(timer, 'login-redirect-to-home');

    return reply().redirect('/');
  }

  var opts = {
    hiring: request.server.methods.hiring.getRandomWhosHiring(),
    namespace: 'user-login'
  };

  if (request.method === 'post') {

    if (!request.payload.name || !request.payload.password) {
      opts.errorType = 'missing';
    } else {

      loginUser(request.payload, function (er, user) {
        if (er || !user) {
          opts.errorType = 'invalid';

          return generateError(opts, 'Invalid username or password', 400, request.payload.name, function (err) {

            return reply.view('user/login', opts).code(400);
          });
        }

        setSession(user, function (er) {
          if (er) {
            return generateError(opts, 'Session could not be set for ' + user.name, 500, er, function (err) {

              return reply.view('errors/generic', err).code(err.code);
            });
          }

          if (user && user.mustChangePass) {
            timer.end = Date.now();
            addLatencyMetric(timer, 'login-must-change-pass');

            addMetric({name: 'login-must-change-pass'})
            return reply.redirect('/password');
          }

          var donePath = '/';
          if (request.query.done) {
            // Make sure that we don't ever leave this domain after login
            // resolve against a fqdn, and take the resulting pathname
            var done = url.resolveObject('https://example.com/login', request.query.done.replace(/\\/g, '/'))
            donePath = done.pathname
          }

          timer.end = Date.now();
          addLatencyMetric(timer, 'login-complete');

          addMetric({name: 'login-complete'})
          return reply.redirect(donePath);
        });
      });
    }
  }

  if (request.method === 'get' || opts.error) {
    timer.end = Date.now();
    addLatencyMetric(timer, 'login');

    addMetric({name: 'login'})
    return reply.view('user/login', opts).code(opts.errorType ? 400 : 200)
  }
}