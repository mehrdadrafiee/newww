var sanitizer = require('sanitizer'),
    metrics = require('newww-metrics')();

var pageSize = 100;
var possibleTypes = ['all', 'keyword', 'author', 'updated', 'depended', 'star', 'userstar'];

module.exports = function (request, reply) {
  var opts = {
    user: request.auth.credentials,
    hiring: request.server.methods.hiring.getRandomWhosHiring(),
    namespace: 'registry-browse'
  };

  var getBrowseData = request.server.methods.registry.getBrowseData,
      generateError = request.server.methods.error.generateError,
      addMetric = metrics.addMetric,
      addLatencyMetric = metrics.addPageLatencyMetric,
      timer = { start: Date.now() };

  // the url will be something like /browse/{type?}/{arg?}/{page}
  var params = request.params.p || '',
      page, type, arg;

  // grab the page number, if it's in the url
  page = +request.query.page || 1;

  // now let's get the type and arg, if they're in there
  params = params.split('/');
  type = params.shift() || 'updated'; // grab the first one - that will be the type

  if (possibleTypes.indexOf(type) === -1) {
    opts.errorType = 'browseUrl';

    return generateError(opts, 'The requested url is invalid', 404, function (err) {

      return reply.view('errors/notfound', err).code(err.code);
    });
  }

  if (type !== 'all' && type !== 'updated') {
    arg = params.shift();
  }

  var browseby = type;
  if (arg) {
    arg = sanitizer.sanitize(arg).replace(/<[^\>]+>/g, '').trim();
  }
  if (arg) {
    browseby += '/' + encodeURIComponent(arg);
  }

  var sarg;
  if (arg) {
    sarg = encodeURIComponent(arg);
  }

  var start = (page - 1) * pageSize,
      limit = pageSize;

  var timer = { start: Date.now() };
  getBrowseData(type, arg, start, limit, function (err, items) {
    timer.end = Date.now();

    if (err) {
      opts.errorType = 'internal';

      return generateError(opts, 'There was an error when getting the browse data', 500, err, function (er) {

        return reply.view('errors/generic', er).code(er.code);
      });
    }

    var key = [type, arg, start, limit].join(', ');

    timer.end = Date.now();
    addLatencyMetric(timer, 'browse ' + key);

    addMetric({
      name: 'browse',
      value: key
    });

    opts.browse = {
      items: items,
      page: page,
      prevPage: page > 0 ? page - 1 : null,
      nextPage: items.length >= pageSize ? page + 1 : null,
      pageSize: pageSize,
      browseby: browseby,
      type: type,
      arg: type === 'keyword' ? JSON.stringify(sarg) : sarg
    };

    return reply.view('registry/browse', opts);
  });
}