var util = require('util'),
    metrics = require('newww-metrics')();

module.exports = function (request, reply) {
  var getPackage = request.server.methods.registry.getPackage,
      star = request.server.methods.registry.star,
      unstar = request.server.methods.registry.unstar,
      generateError = request.server.methods.error.generateError,
      addMetric = metrics.addMetric,
      addLatencyMetric = metrics.addPageLatencyMetric,
      timer = { start: Date.now() };

  var opts = {
    user: request.auth.credentials,
    hiring: request.server.methods.hiring.getRandomWhosHiring(),
    namespace: 'registry-star'
  };

  if (request.method === 'get') {
    return reply.redirect('browse/userstar/' + opts.user.name);
  }

  if (typeof opts.user === 'undefined') {
    return generateError(opts, 'user isn\'t logged in', 403, function (err) {
      return reply('user isn\'t logged in').code(err.code);
    });
  }

  var username = opts.user.name,
      body = request.payload,
      pkg = body.name,
      starIt = !!body.isStarred.match(/true/i)

  if (starIt) {

    star(pkg, username, function (err, data) {

      if (er) {
        return generateError(opts, util.format("%s was unable to star %s", username, pkg), 500, er, function (err) {

          return reply('not ok - ' + err.errId).code(err.code);
        });
      }

      getPackage.cache.drop(pkg, function (er, resp) {
        if (er) {
          return generateError(opts, util.format("unable to drop cache for %s", pkg), 500, er, function (err) {

            return reply('not ok - ' + err.errId).code(err.code);
          });
        }

        timer.end = Date.now();
        addLatencyMetric(timer, 'star');

        addMetric({ name: 'star', package: pkg });
        return reply(username + ' starred ' + pkg).code(200);
      });
    });
  } else {

    unstar(pkg, username, function (err, data) {

      if (er) {
        return generateError(opts, util.format("%s was unable to unstar %s", username, pkg), 500, er, function (err) {

          return reply('not ok - ' + err.errId).code(err.code);
        });
      }

      getPackage.cache.drop(pkg, function (er, resp) {
        if (er) {
          return generateError(opts, util.format("unable to drop cache for %s", pkg), 500, er, function (err) {

            return reply('not ok - ' + err.errId).code(err.code);
          });
        }

        timer.end = Date.now();
        addLatencyMetric(timer, 'unstar');

        addMetric({ name: 'unstar', package: pkg });
        return reply(username + ' unstarred ' + pkg).code(200);
      });
    });
  }
}
