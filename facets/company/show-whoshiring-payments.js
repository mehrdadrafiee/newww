var Joi = require('joi'),
    Hapi = require('hapi'),
    uuid = require('node-uuid'),
    metrics = require('newww-metrics')();

module.exports = function (options) {
  var stripe = require('stripe')(options.secretkey),
      VALID_CHARGE_AMOUNTS = [35000, 100000];

  return function (request, reply) {
    var addMetric = metrics.addMetric,
        addLatencyMetric = metrics.addPageLatencyMetric,
        timer = { start: Date.now() };

    var opts = {
      user: request.auth.credentials,
      hiring: request.server.methods.hiring.getRandomWhosHiring(),
      title: "Join the Who's Hiring Page",
      namespace: 'company-whoshiring-payments'
    }

    if (request.method === 'get') {
      opts.stripeKey = options.publickey;

      timer.end = Date.now();
      addLatencyMetric(timer, 'whoshiring-payments');

      addMetric({name: 'whoshiring-payments'});
      return reply.view('company/payments', opts);
    }

    var schema = Joi.object().keys({
      email: Joi.string().regex(/^.+@.+\..+$/), // email default accepts "boom@boom", which is kinda no bueno atm
      id: Joi.string().token(),
      amount: Joi.number(),
      livemode: Joi.string(),
      created: Joi.string(),
      used: Joi.string(),
      object: Joi.string(),
      type: Joi.string(),
      card: Joi.object()
    });

    Joi.validate(request.payload, schema, function (err, token) {
      if (err) {
        request.server.methods.error.generateError(opts, 'there was a validation error', 400, err, function (er) {

          return reply('validation error: ' + er.errId).code(er.code);
        });
      }

      if (VALID_CHARGE_AMOUNTS.indexOf(token.amount) === -1) {
        request.server.methods.error.generateError(opts, 'the charge amount of ' + token.amount + ' is invalid', 400, err, function (er) {

          return reply('invalid charge amount error: ' + er.errId).code(er.code);
        });
      }

      var stripeStart = Date.now();
      stripe.charges.create({
        amount: token.amount,
        currency: "usd",
        card: token.id, // obtained with Stripe.js
        description: "Charge for " + token.email
      }, function(err, charge) {
        if (err) {
          request.server.methods.error.generateError(opts, 'something went wrong with the stripe charge', 500, err, function (er) {

            return reply('internal stripe error - ' + er.errId).code(er.code);
          });
        }

        timer.end = Date.now();
        addMetric({
          name: 'latency',
          value: timer.end - stripeStart,
          type: 'stripe'
        });

        addLatencyMetric(timer, 'whoshiring-paymentProcessed');

        addMetric({name: 'whoshiring-paymentProcessed'});
        return reply('Stripe charge successful').code(200);
      });
    });
  };
}