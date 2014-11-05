var TWO_WEEKS = 1000 * 60 * 60 * 24 * 14; // in milliseconds

var formatNumber = require('number-grouper'),
    Hapi = require('hapi'),
    log = require('bole')('company-homepage'),
    uuid = require('node-uuid'),
    metrics = require('newww-metrics')(),
    parseLanguageHeader = require('accept-language-parser').parse,
    fmt = require('util').format,
    moment = require('moment');

module.exports = function (request, reply) {
  var timer = { start: Date.now() };

  load(request, function (err, cached) {

    // Use commas, periods, or spaces depending on user language
    try {
      var lang = parseLanguageHeader(request.headers['accept-language'])[0].code
      if (lang === "en") lang = "en-gb" // numeral.js "bug"
      var sep = require(fmt("numeral/languages/%s", lang)).delimiters.thousands
    } catch(err) {
      var sep = " "
    }

    var opts = {
      user: request.auth.credentials,
      updated: cached.updated || [],
      depended: cached.depended || [],
      starred: cached.starred || [],
      authors: cached.authors || [],
      downloads: {
        day: formatNumber(cached.downloads.day, {sep: sep}),
        week: formatNumber(cached.downloads.week, {sep: sep}),
        month: formatNumber(cached.downloads.month, {sep: sep}),
      },
      totalPackages: formatNumber(cached.totalPackages, {sep: sep}),
      hiring: request.server.methods.hiring.getRandomWhosHiring(),
      explicit: require("../../lib/explicit-installs.json").slice(0,15).map(function(pkg) {
        pkg.installCommand = "npm install " + pkg.name + (pkg.preferGlobal ? " -g" : "")
        pkg.starCount = pkg.users ? Object.keys(pkg.users).length : 0

        pkg.version = pkg['dist-tags'].latest
        if (pkg.versions) {
          pkg.version = pkg.versions[pkg.version].version
          pkg.publishedBy = pkg.versions[pkg.version]._npmUser
        }
        pkg.lastPublished = moment(pkg.time[pkg.version]).fromNow()
        delete pkg.versions

        // Add logos
        logos = {
          browserify: "https://d21ii91i3y6o6h.cloudfront.net/gallery_images/from_proof/1647/small/1405586570/browserify-2-hexagon-sticker.png",
          dat: "https://d21ii91i3y6o6h.cloudfront.net/gallery_images/from_proof/1497/large/1403068242/dat-data.png",
          bower: "https://i.cloudup.com/Ka0R3QvWRs.png",
          gulp: "https://raw.githubusercontent.com/gulpjs/artwork/master/gulp-2x.png",
          grunt: "https://i.cloudup.com/bDkmXyEmr5.png",
          "grunt-cli": "https://i.cloudup.com/bDkmXyEmr5.png",
          less: "https://i.cloudup.com/LYSQDzsBKK.png",
          npm: "https://cldup.com/Rg6WLgqccB.svg",
          cordova: "https://cldup.com/q5Jmvu10tV.png",
          forever: "https://cldup.com/iSilAlBYLW.svg",
          "coffee-script": "https://cldup.com/kyDqUBuW3k.png",
          karma: "https://cldup.com/0286W-2y27.png",
          yo: "https://cldup.com/P3MQgWdDyG.png",
          "pm2": "https://cldup.com/PKpktytKH9.png"
        }

        for (name in logos) {
          if (name === pkg.name) {
            pkg.logo = logos[name]
          }
        }

        return pkg
      })
    };

    timer.end = Date.now();
    metrics.addPageLatencyMetric(timer, 'homepage');

    metrics.addMetric({name: 'homepage'});

    // Return raw context object if `json` query param is present
    if (String(process.env.NODE_ENV).match(/dev|staging/) &&  'json' in request.query) {
      return reply(opts);
    }

    return reply.view('company/index', opts);

  });
}

// ======= functions =======

function load (request, cb) {
  var registry = request.server.methods.registry,
      recentAuthors = registry.getRecentAuthors,
      addMetric = metrics.addMetric,
      downloads = request.server.methods.downloads.getAllDownloads;

  var n = 5,
      cached = {};

  // registry.getStarredPackages(false, 0, 12, next('starred'));
  registry.getDependedUpon(false, 0, 12, next('depended'));
  registry.getUpdated(0, 12, next('updated'));
  recentAuthors(TWO_WEEKS, 0, 12, next('authors'));
  downloads(next('downloads'));
  registry.packagesCreated(next('totalPackages'));

  function next (which) {
    return function (err, data) {

      if (err) {
        log.warn(uuid.v1() + ' ' + Hapi.error.internal('download error for ' + which), err);
      }

      cached[which] = data;
      if (--n === 0) {
        return cb(null, cached);
      }
    }
  }
}
