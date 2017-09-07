var WebSocketServer = require('websocket').server;
var net = require('net');
var ejs = require('ejs');
var nameserver = net.createServer(function(socket) {
  console.log('connect data server.');
  
  socket.on('data', function(chunk){
    console.log('data sended from client: ', chunk.toString());
    if(chunk.toString() == 'first'){
      
    } else {
      
    }
  });

  socket.on('end', function(){
    console.log('data server disconnect.');
  });
});
var express = require('express');
var app = express();
var fs = require('fs');
var http = require('http');
var bodyParser = require('body-parser');
var mysql = require('mysql');
var mysqlconnection = mysql.createConnection({
  host : 'localhost',
  user : 'user01',
  password : '1234',
  port : 3306,
  database : 'test'
});

var writer = null;
process.setMaxListeners(0);


nameserver.on('listening', function(){
  console.log('Server is listening');
  mysqlconnection.connect();
});

nameserver.on('close', function(){
  console.log('Server close');
  mysqlconnection.end();
});

nameserver.listen(1111);

var server_down = http.createServer(app).listen(3303, function(){console.log('Server Running . ')});

var server = http.createServer(function (req, res) {
  console.log('Received request for ' + req.url);
  res.writeHead(404);
  res.end();
});

server.listen(8000, function () {
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

        if(msga.stat == 'upload'){
          mysqlconnection.query('select * from dataserver_info where size*1000000 > ? and is_alive = 1', [msga.size], function(error, results, fields){
            if(error){console.log('error: ', error.message);}
            else {
              
              var msg = {
                //client_ip: connection.remoteAddress,
                stat: "upload_start",
                upload_ip: results[0].ip
              }

              console.log('test: '+msg);
              connection.sendUTF(JSON.stringify(msg));
              
              mysqlconnection.query('insert into file_info values(?, ?, ?, ?, ?, ?)', [msga.name, msga.name, results[0].id, 0, 0, msga.size], function(error, rows, fields){
                if(error){console.log('error: ', error.message);}
              });
            }
          });
          
        }
        console.log('Received message: ' + msga.type+',  '+msga.stat);

        connection.sendUTF(message.utf8Data);
      } catch (e){
        console.log('is not json: '+message.utf8Data);
      }
    }
    else if (message.type === 'binary') {
      //if(writer) writer.write(message.binaryData);
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
  fs.readFile('name_index.html', 'utf8', function(error, data){
    if(error){ console.log('readFile Error'); }
    else {
      mysqlconnection.query('select name, stored_name from file_info', function(error, results, fields){
        if(error){console.log('error: ', error.message);}
        else {
          res.send(ejs.render(data, {
            fileList:results }
          ));

        }
      });
    }
    //res.writeHead(200, {'Content-Type': 'text/html'});
    //res.end(data);
  });
});

app.get('/downlaod/:id', function(req, res){
  var filename = req.params.id;
  filepath = __dirname + '/' + filename;
  res.download(filepath);
});
