'use strict';

var fs = require('fs'),
    url = require('url'),
    http = require('http'),
    https = require('https');

module.exports = function (bot, opt) {

  var token = '/' + bot.token;

  var host = opt.host || '0.0.0.0',
      port = opt.port || 443,
      key = opt.key && fs.readFileSync(opt.key),
      cert = opt.cert && fs.readFileSync(opt.cert);

  // Create server
  var server = key && cert ? https.createServer({ key: key, cert: cert }, listener) : http.createServer(listener);

  // Start server
  server.listen(port, host, function (x) {
    console.log('[bot.webhook] started' + (key ? ' secure' : '') + ' server on "' + host + ':' + port + '"');
  });

  // Request listener
  function listener(req, res) {
    if (req.url == token && req.method == 'POST') {
      var json = '';
      req.on('data', function (data) {
        return json += data;
      });
      req.on('end', function (x) {
        res.end();
        bot.receiveUpdates([JSON.parse(json)], true);
      });
    }
  }
};