var request = require('request')
, github2es = require('github2es')
, path = require('path') 
, config = require('../../config');

request('http://localhost:15984/registry/_all_docs', function(err, res, body){ 
  if (err){
    console.log('error getting all docs'); 
    return
  }
  body = JSON.parse(body); 
  var worker = new github2es(body.rows, config.search.url, '03713dc81ae441b677ebc8cee892e95586cd670', path.join(__dirname, 'sequence.seq'), function (){ console.log('done'); });
});
