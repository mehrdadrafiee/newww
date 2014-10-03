var transform = require('./presenters/profile').transform,
    murmurhash = require('murmurhash'),
    metrics = require('newww-metrics')();

module.exports = function (options) {
  return function (request, reply) {
    var saveProfile = request.server.methods.user.saveProfile,
        setSession = request.server.methods.user.setSession(request),
        generateError = request.server.methods.error.generateError,
        addMetric = metrics.addMetric,
        addLatencyMetric = metrics.addPageLatencyMetric,
        timer = { start: Date.now() };

    var opts = {
      user: transform(request.auth.credentials, options),
      hiring: request.server.methods.hiring.getRandomWhosHiring(),
      namespace: 'user-profile-edit'
    };

    if (request.method === 'post' || request.method === 'put') {

      if (!request.payload.name) {
        opts.error = 'Name is required';
      } else {

        opts.user = applyChanges(opts.user, request.payload);
        opts.user = transform(opts.user, options);

        saveProfile(opts.user, function (er, data) {
          if (er) {
            return generateError(opts, 'Unable to save profile for user ' + opts.user.name, 500, er, function (err) {

              return reply.view('errors/generic', err).code(err.code);
            });
          }

          setSession(opts.user, function (er) {
            if (er) {
              return generateError(opts, 'Unable to set the session for user ' + opts.user.name, 500, er, function (err) {

                return reply.view('errors/generic', err).code(err.code);
              });
            }

            timer.end = Date.now();
            addLatencyMetric(timer, 'saveProfile');

            addMetric({ name: 'saveProfile' });
            return reply.redirect('/profile');
          });

        });
      }
    }

    if (request.method === 'head' || request.method === 'get' || opts.error) {
      timer.end = Date.now();
      addLatencyMetric(timer, 'profile-edit');

      opts.title = 'Edit Profile';
      return reply.view('user/profile-edit', opts);
    }
  }
}

function applyChanges (user, profileChanges) {
  for (var i in profileChanges) {
    user[i] = profileChanges[i];
  }
  return user;
}