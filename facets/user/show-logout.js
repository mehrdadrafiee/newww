var metrics = require('newww-metrics')();

module.exports = function logout (request, reply) {
  var delSession = request.server.methods.user.delSession(request),
      user = request.auth.credentials,
      addMetric = metrics.addMetric,
      addLatencyMetric = metrics.addPageLatencyMetric,
      timer = { start: Date.now() };

  if (!user) return goHome();

  delSession(user, function (er) {
    if (er) {
      var opts = {namespace: 'user-logout'};
      return request.server.methods.error.generateError(opts, 'unable to delete session for logout for user ' + user ? user.name : '', 500, er, function (err) {

        return reply.view('errors/generic', err).code(err.code);
      });
    }

    return goHome();
  });

  function goHome () {
    timer.end = Date.now();
    addLatencyMetric(timer, 'logout');

    addMetric({ name: 'logout' });
    return reply.redirect('/');
  }
}