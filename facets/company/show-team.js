var metrics = require('../../adapters/metrics')();

module.exports = function Team (request, reply) {
  var timer = { start: Date.now() };

  var opts = {
    // user: request.auth.credentials,
    // hiring: request.server.methods.hiring.getRandomWhosHiring(),
    title: "the npm team"
  };

  timer.end = Date.now();
  metrics.addPageLatencyMetric(timer, 'team');

  metrics.addMetric({name: 'team'});
  return reply.view('team', opts);
}
