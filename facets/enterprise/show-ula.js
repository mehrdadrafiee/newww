var NAMESPACE = 'enterprise-ula';

var Hoek = require('hoek'),
    Hapi = require('hapi'),
    log = require('bole')(NAMESPACE),
    uuid = require('node-uuid'),
    metrics = require('newww-metrics')();

var config = require('../../config').license;

module.exports = function createHubspotLead (request, reply) {
  var postToHubspot = request.server.methods.npme.sendData;

  var opts = {
    user: request.auth.credentials,
    
    namespace: NAMESPACE
  };

  var data = {
    hs_context: {
      pageName: "enterprise-signup"
    }
  };

  data = Hoek.applyToDefaults(data, request.payload);

  postToHubspot(config.hubspot.form_npme_signup, data, function (er) {
    if (er) {
      return request.server.methods.errors.showError(reply)(er, 500, 'Could not register details to hubspot', opts);
    }

    return getOrCreateCustomer(request, reply, data);
  })
}

function getOrCreateCustomer (request, reply, data) {
  var getCustomer = request.server.methods.npme.getCustomer,
      createCustomer = request.server.methods.npme.createCustomer,
      showError = request.server.methods.errors.showError(reply);

  var opts = {
    user: request.auth.credentials,
    
    namespace: NAMESPACE
  };

  getCustomer(data.email, function (err, customer) {

    if (err) {
      return showError(err, 500, "There was an unknown problem with the customer error", opts);
    }

    if (customer) {
      // they're already a customer
      return showClickThroughAgreement(reply, customer)
    }

    // new customer, needs to be created
    createCustomer(data, function (err, newCustomer) {
      if (err) {
        return showError(err, 500, "There was a problem creating the customer record", opts);
      }

      return showClickThroughAgreement(reply, newCustomer);
    });
  })
}

function showClickThroughAgreement (reply, customer) {
  // we use both email and ID so people can't just guess an ID to get a license

  var opts = {
    title: "Get started with npm Enterprise",
    customer_id: customer.id,
    customer_email: customer.email
  };

  return reply.view('enterprise/clickThroughAgreement', opts);
}