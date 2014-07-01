var request = require('request')
, github2es = require('github2es')
, config = require('../../config');

request('http://localhost:15984/registry/_all_docs', function(err, res, body){ 
  if (err){
    console.log('error getting all docs'); 
    return
  }
  body = JSON.parse(body); 
  var worker = new github2es(body.rows, config.search.url, '03259061f0f5d7190e00e4d45e5b997014c3be2c');
  worker.groupPackages();
});
/*var opt =  {
  method: 'GET',
  url: 'https://api.github.com/repos/mikeal/request',
  headers: {
  'User-Agent': 'request',
  "Authorization": "token " + '03259061f0f5d7190e00e4d45e5b997014c3be2c'   }
}

request(opt, function(err, body, res) { 
  console.log(body)
});*/
