var WebSocketServer = require('websocket').server;
var express = require('express');
var app = express();
var fs = require('fs');
var http = require('http');
var writer = null;
process.setMaxListeners(0);

var server_down = http.createServer(app).listen(3304, function(){console.log('Server Running . ')});

var server = http.createServer(function (req, res) {
  console.log('Received request for ' + req.url);
  res.writeHead(404);
  res.end();
});

server.listen(8001, function () {
  console.log('Server is listening on port 8000');
});

wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});

wsServer.on('request', function (request) {
  var connection = request.accept('example-echo', request.origin);
  
  connection.on('message', function (message) {
    if (message.type === 'utf8') {
      try{
        var msga = JSON.parse(message.utf8Data);

        if(msga.stat == 'start'){
          if(writer) writer.end;
          writer = fs.createWriteStream(msga.name);
        } else if(writer && msga.stat == 'end'){
          writer.end();
          writer = null;
        }
        console.log('Received message: ' + msga.type+',  '+msga.stat);

        connection.sendUTF(message.utf8Data);
      } catch (e){
        console.log('is not json: '+message.utf8Data);
      }
    }
    else if (message.type === 'binary') {
      if(writer) writer.write(message.binaryData);
      //else console.log('wirter is null');
      //console.log('Received binary message');

      //connection.sendBytes(message.binaryData);
    }

  });
    connection.on('close', function (reasonCode, description) {
      console.log('Peer ' + connection.remoteAddress + ' disconnected.');
      writer = null;
    });
});

app.get('/', function(req, res){
  fs.readFile('data_index.html', function(error, data){
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(data);
  });
});

app.get('/downlaod/:id', function(req, res){
  var filename = req.params.id;
  filepath = __dirname + '/' + filename;
  res.download(filepath);
});
