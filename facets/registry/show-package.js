var presentPackage = require('./presenters/package'),
    commaIt = require('number-grouper'),
    metrics = require('newww-metrics')();


module.exports = function (request, reply) {
  var getPackage = request.server.methods.registry.getPackage,
      getBrowseData = request.server.methods.registry.getBrowseData,
      getDownloadsForPackage = request.server.methods.downloads.getDownloadsForPackage,
      getAllDownloadsForPackage = request.server.methods.downloads.getAllDownloadsForPackage,
      generateError = request.server.methods.error.generateError,
      addMetric = metrics.addMetric,
      addLatencyMetric = metrics.addPageLatencyMetric;

  var timer = { start: Date.now() };

  if (request.params.version) {
    return reply.redirect('/package/' + request.params.package)
  }

  var opts = {
    user: request.auth.credentials,
    hiring: request.server.methods.hiring.getRandomWhosHiring(),
    namespace: 'registry-package'
  }

  opts.name = request.params.package

  if (opts.name !== encodeURIComponent(opts.name)) {
    opts.errorType = 'invalid';

    return generateError(opts, 'Invalid Package Name', 400, opts.name, function (err) {

      return reply.view('errors/generic', err).code(err.code)
    });
  }

  getPackage(opts.name, function (er, pkg) {

    if (er || pkg.error) {
      opts.errorType = 'notFound';

      return generateError(opts, 'Package Not Found ' + opts.name, 404, er || pkg.error, function (err) {
        return reply.view('errors/generic', err).code(err.code)
      });
    }

    if (pkg.time && pkg.time.unpublished) {
      // reply with unpublished package page
      var t = pkg.time.unpublished.time
      pkg.unpubFromNow = require('moment')(t).format('ddd MMM DD YYYY HH:mm:ss Z');

      opts.package = pkg;

      timer.end = Date.now();
      addLatencyMetric(timer, 'showUnpublishedPackage');

      addMetric({ name: 'showPackage', package: request.params.package });
      return reply.view('registry/unpublished-package-page', opts);
    }

    timer.start = Date.now();
    getBrowseData('depended', opts.name, 0, 1000, function (er, dependents) {
      timer.end = Date.now();
      addMetric({
        name: 'latency',
        value: timer.end - timer.start,
        type: 'couchdb',
        browse: ['depended', opts.name, 0, 1000].join(', ')
      });

      if (er) {
        opts.errorType = 'internal';
        return generateError(opts, 'Unable to get depended data from couch for ' + opts.name, 500, er, function (err) {
          return reply.view('errors/generic', err).code(err.code);
        });
      }

      pkg.dependents = dependents;

      presentPackage(pkg, function (er, pkg) {
        if (er) {
          opts.errorType = 'internal';

          return generateError(opts, 'An error occurred with presenting package ' + opts.name, 500, er, function (err) {
            return reply.view('errors/generic', err).code(err.code);
          });
        }

        pkg.isStarred = opts.user && pkg.users && pkg.users[opts.user.name] || false;

        opts.package = pkg;
        opts.title = pkg.name;

        // Show download count for the last day, week, and month
        if (opts.user) {
          return getDownloadsForPackage('last-month', 'range', pkg.name, handleDownloads);
        } else {
          return getAllDownloadsForPackage(pkg.name, handleDownloads);
        }

        function handleDownloads(er, downloadData) {
          if (er) {
            opts.errorType = 'internal';
            return generateError(opts, 'An error occurred with getting download counts for ' + opts.name, 500, er, function (err) {

              return reply.view('errors/generic', err).code(err.code);
            });
          }

          if (Array.isArray(downloadData)) {
            opts.downloads = {
              data: JSON.stringify(downloadData),
              count: commaIt(downloadData[downloadData.length - 1].downloads, {sep: ' '})
            };
          } else {
            opts.downloads = {
              day: commaIt(downloadData.day, {sep: ' '}),
              week: commaIt(downloadData.week, {sep: ' '}),
              month: commaIt(downloadData.month, {sep: ' '}),
            };
          }

          timer.end = Date.now();
          addLatencyMetric(timer, 'showPackage');

          addMetric({ name: 'showPackage', package: request.params.package });

          // Return raw context object if `json` query param is present
          if (process.env.NODE_ENV === "dev" && Object.keys(request.query).indexOf('json') > -1) {
            return reply(opts);
          }

          return reply.view('registry/package-page', opts);
        }
      })
    })
  })
}
