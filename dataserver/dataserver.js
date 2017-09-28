var exec = require('child_process').exec;
var crypto = require('crypto');
var WebSocketServer = require('websocket').server;
var net = require('net');
var express = require('express');
var app = express();
var fs = require('fs');
var http = require('http');
//var mime = require('mime');
var dataserver_id = -1;
var re_msg, size=0;
process.setMaxListeners(0);

var ip = '192.168.0.6';
var port = 1111;

var socket = new net.Socket();

var server_down = http.createServer(app).listen(3304, function(){console.log('Server Running . ')});

var server = http.createServer(function (req, res) {
  console.log('Received request for ' + req.url);
  res.writeHead(404);
  res.end();
});


server.listen(8001, function () {
  exec("df . -k", function(error, stdout, stderr){
    size = stdout.split(/\s\s*/g)[10]*1;
    fs.exists('dataserver_id.txt', function(exists){
      if(exists){
        var data = fs.readFileSync('dataserver_id.txt', 'utf8');
        console.log('data: '+data);
        dataserver_id = data*1;

        re_msg = {
          stat: 'not first',
          server_id: dataserver_id*1,
          size: size
        };
          //socket.connect({},function(){
          //});
      } else {
        console.log('dataserver_id is not exist');
        re_msg = {
          stat: 'first',
          size: size
        };
      }
    
      var connectFunc = function() {
        socket = new net.Socket();

        socket.connect({host:ip, port:port}, function(){
          console.log('connect request');
        });
        socket.on('data', function(chunk){
          try{
            var sinfo = JSON.parse(chunk);
            console.log('Received message: ' + chunk);
            
            if(sinfo.stat == 'first ok'){
              fs.writeFileSync('dataserver_id.txt', sinfo.server_id ,'utf8');
                            dataserver_id = sinfo.server_id*1;
            } else if(sinfo.stat = 'remove'){
             exec("rm 'files/"+sinfo.stored_name+"'" ,function(error, stdout, stderr){
		if(error){console.log(error.message);}
                else
                  console.log('remove ' + sinfo.stored_name);
              });
            }
          } catch (e){
            console.log('is not json(nameserver): '+chunk.toString());
          }
        });
      
        socket.on('connect', function(){
          socket.write(JSON.stringify(re_msg));
          console.log('net connection: '+JSON.stringify(re_msg));
        });
        socket.on('end', function(){
        });
        socket.on('error', function(){
        });
        socket.on('close', function(){
          console.log('disconnect(end)');
          setTimeout(connectFunc, 4000);
        });
      }
      connectFunc();
    });
  });
  console.log('Server is listening on port 8000');
});

wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});

wsServer.on('request', function (request) {
  var connection = request.accept('example-echo', request.origin);
  var hash = null;
  var file_name = '';
  var writer = null;
  
  connection.on('message', function (message) {
    if (message.type === 'utf8') {
      try{
        var msga = JSON.parse(message.utf8Data);
      } catch (e){
        console.log('is not json(client): '+message.utf8Data);
        if(file_name != ''){
          exec("rm 'files/"+file_name+"'" ,function(error, stdout, stderr){
            if(error){console.log(error.message);}
            else
              console.log('cancel ' + file_name);
          });
          file_name = null;
          hash= null;
          writer= null;
        }
        return;
      }

        if(msga.stat == 'start'){
          if(writer){
            writer.end();
          }
          writer = fs.createWriteStream('files/'+msga.stored_name);
          hash = crypto.createHash('md5');
          file_name = msga.stored_name;
        } else if(writer && msga.stat == 'end'){
          if(writer) writer.end();
          var end_msg = {
            stat: 'upload complete',
            stored_name: msga.stored_name,
            name: msga.name,
            size: msga.size,
            id: dataserver_id*1,
            hash: hash.digest('hex'),
            username: msga.username
          };
          console.log(JSON.stringify(end_msg));
          socket.write(JSON.stringify(end_msg));
          writer = null;
          hash=null;
          file_name='';
          
          var cli_msg={stat:'upload complete'};
          connection.send(JSON.stringify(cli_msg));
        }
        console.log('Received message: ' + msga.type+',  '+msga.stat);

        //connection.sendUTF(message.utf8Data);
    }
    else if (message.type === 'binary') {
      if(writer) {
        hash.update(message.binaryData, 'utf8');
        writer.write(message.binaryData);
      }
      //else console.log('wirter is null');
      //console.log('Received binary message');

      //connection.sendBytes(message.binaryData);
    }

  });
    connection.on('close', function (reasonCode, description) {
      console.log('Peer ' + connection.remoteAddress + ' disconnected.');
      if(writer){
        writer = null;
        hash = null;
        exec("rm 'files/"+file_name+"'" ,function(error, stdout, stderr){
          if(error){console.log(error.message);}
          else
            console.log('cancel ' + file_name);
        });
      }
    });
});

app.get('/', function(req, res){
  fs.readFile('index.html', function(error, data){
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(data);
  });
});

app.get('/download/:id', function(req, res){
  var filename = req.params.id;
  var origFileName = req.query.name;
  if(!origFileName) filename.substring(19, filename.length);
  filepath = __dirname + '/files/' + filename;
  fs.exists(filepath, function(exists){
    if(exists){
      //mimetype = mime.getType(origFileName);
      //res.download(filepath);

      res.setHeader('Content-disposition', 'attachment; filename='+origFileName);
      //res.setHeader('Content-type', mimetype);
      var filestream=fs.createReadStream(filepath);
      filestream.pipe(res);
    } else {
      res.send('<script type="text/javascript">alert("can not download"); location.redirect('+ip+'+"/3000");</script>');
    }
  });
});
