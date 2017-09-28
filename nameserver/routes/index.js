var WebSocketServer = require('websocket').server;
var net = require('net'), JsonSocket = require('json-socket');
var ejs = require('ejs');
var express = require('express');
var router = express.Router();
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
require('date-utils');
var sockets = [];
var count = 0;
var writer = null;
process.setMaxListeners(0);

var nameserver = net.createServer(function(socket) {
  console.log('connect data server.');
  //sockets.push(socket);
  var dataserver_id=-1;


  

  socket.on('data', function(chunk){
    
    try{
      var sinfo = JSON.parse(chunk);
    } catch (e){
      console.log('is not json: '+chunk.toString());
      console.log('is not json: '+chunk.stat);
      return;
    }
      var remoteAddress = socket.remoteAddress.replace(/::*\s*\S*::*/g,'');
      console.log(remoteAddress , 'data sended from client: ', chunk.toString());

      if(sinfo.stat == 'first'){
        //id, ip, size, is_alive, time
        mysqlconnection.query('insert into dataserver_info values(NULL, ?, ?, ?, NULL)', [remoteAddress, sinfo.size, 1], function(error, rows, fields){
              if(error){console.log('error: ', error.message);}
              else {
                mysqlconnection.query('select id from dataserver_info where ip = ? order by time desc', [ remoteAddress ], function(error, results, fields){
                  if(error){console.log('error: ', error.message);}
                  else if(results.length==0){ console.log('not found');}
                  else{
                    var msg = {
                      stat: 'first ok',
                      server_id: results[0].id
                    }
                  sockets[results[0].id*1] = socket;
                  sockets[results[0].id*1].write(JSON.stringify(msg));
                  dataserver_id=results[0].id;
                  }
                });
              }
        });
        
      } else if(sinfo.stat == 'not first'){
        mysqlconnection.query('update dataserver_info set is_alive = 1, size = ?, ip = ? where id = ?',[sinfo.size, remoteAddress, sinfo.server_id] , function(error, rows, fields){
          if(error){console.log('error: ', error.message);}
          else {
            dataserver_id = sinfo.server_id*1;
            sockets[dataserver_id] = socket;
          }
        });
      } else if(sinfo.stat = 'upload complete'){
//name, stored name, server_id, size, id, hash, owner
          mysqlconnection.query('select * from file_info where size = ? and hash = ?', [sinfo.size, sinfo.hash], function(error, results, fields){
            if(error){console.log('error: ', error.message);}
            else if(results.length == 0){
//name, stored name, server_id, size, id, hash, owner
              mysqlconnection.query('insert into file_info values(?, ?, ?, ?, NULL, ?, ?)', [sinfo.name, sinfo.stored_name, sinfo.id, sinfo.size, sinfo.hash, sinfo.username], function(error, rows, fields){
                if(error){//console.log('error: ', error.message);}
                  console.log('error: ', error.message);
                }
                else { 

                  mysqlconnection.query('update dataserver_info set size = size - ?/1000 where id = ?',[sinfo.size, sinfo.id] , function(error, rows, fields){
                    if(error){console.log('error: ', error.message);}
                    else {
                      dataserver_id = sinfo.server_id*1;
                    }
                  });
                }
              });
            } else{
                
//name, stored name, server_id, size, id, hash, owner
              mysqlconnection.query('insert into file_info values(?, ?, ?, ?, NULL, ?, ?)', [sinfo.name, results[0].stored_name, results[0].server_id, sinfo.size, sinfo.hash, sinfo.username], function(error, rows, fields){
                if(error){//console.log('error: ', error.message);}
                  console.log('error: ', error.message);
                }
                else { 
                  var msg = {
                    stat: 'remove',
                    stored_name: sinfo.stored_name,
                  };
                  sockets[sinfo.id].write(JSON.stringify(msg));
                }
              });
            }
          });  
      }
  });

  socket.on('end', function(){
    console.log('data server disconnect.');
    mysqlconnection.query('update dataserver_info set is_alive = 0 where id = ?',[dataserver_id*1] , function(error, rows, fields){
      if(error){console.log('error(disable): ', error.message);}
    });
  });
  socket.on('error', function(){
    console.log('data server disconnect(error).');
    mysqlconnection.query('update dataserver_info set is_alive = 0 where id = ?',[dataserver_id*1] , function(error, rows, fields){
      if(error){console.log('error(disable): ', error.message);}
    });
  });
});

nameserver.on('listening', function(){
  console.log('Server is listening');
  mysqlconnection.connect();
  mysqlconnection.query('update dataserver_info set is_alive = 0', function(error, rows, fields){
    if(error){console.log('error: ', error.message);}
  });
});

nameserver.on('close', function(){
  console.log('Server close');
  mysqlconnection.end();
});

nameserver.listen(1111);

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
          mysqlconnection.query('select * from dataserver_info where size*1000 > ? and is_alive = 1 order by size asc', [msga.size], function(error, results, fields){
            if(error){
              console.log('error: test');}
            else if(results.length==0){ console.log('not found');}
            else {
              var date = new Date();
              var date_time = date.toFormat('YYYY-MM-DD_HH24:MI:SS');

                  var msg = {
                    //client_ip: connection.remoteAddress,
                    stat: "upload_start",
                    name: msga.name,
                    size: msga.size,
                    stored_name: date_time+msga.name,
                    upload_ip: results[0].ip+':8001'
                  }
                  connection.sendUTF(JSON.stringify(msg));
            }
          });
          
        } else if(msga.stat == 'remove file'){
//name, stored name, server_id, backup_id, parend_directory, size, id, hash, owner, link
          console.log('remove file: ', msga.file_id);
          mysqlconnection.query('select stored_name, server_id from file_info where id = ? ', [msga.file_id], function(error, results, fields){
            if(error){console.log(error.message);}
            else if(results.length == 0) { return; }
            else {
              mysqlconnection.query('select is_alive from dataserver_info where is_alive = 1 and id = ?',[results[0].server_id] ,function(error, temps, fields){ 
                if(error){console.log(error.message);}
                else if(temps.length == 0){ 
                  var msg ={stat:'error', message:'can not delete this file.'} 
                  connection.sendUTF(JSON.stringify(msg));
                } else{
                  mysqlconnection.query('select * from file_info where stored_name = ? and server_id = ?',[results[0].stored_name, results[0].server_id] ,function(error, rows, fields){ 
                    if(error){console.log(error.message)}
                    else if(rows.length == 0){ return; }
                    else if(rows.length == 1){
                      var msg = {
                        stat: 'remove',
                        stored_name: results[0].stored_name,
                      };
                      sockets[results[0].server_id].write(JSON.stringify(msg));
                      mysqlconnection.query('delete from file_info where id = ?', [msga.file_id], function(error, rows, fields){
                        if(error){console.log(error.message);}
                      });
                    } else {
                      mysqlconnection.query('delete from file_info where id = ?', [msga.file_id], function(error, rows, fields){
                        if(error){console.log(error.message);}
                      });
                    }
                  });
                }
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
    }

  });
    connection.on('close', function (reasonCode, description) {
      console.log('Peer ' + connection.remoteAddress.replace(/::*\s*\S*::*/g,'') + ' disconnected.');
      writer = null;
    });
});

router.get('/', function(req, res){
  sess = req.session;
  if (typeof sess.username == 'undefined') {
    res.render('index', { title: 'Express' });
  } else {
    fs.readFile('views/main.html', 'utf8', function(error, data){
      if(error){ console.log('readFile Error'); }
      else {
//name, stored name, server_id, backup_id, parend_directory, size, id, hash, owner, link
        mysqlconnection.query('select file_info.id as file_id, dataserver_info.id as server_id, ip, name, stored_name, owner, file_info.size, is_alive from file_info join dataserver_info on file_info.server_id = dataserver_info.id where owner = ?',[sess.username], function(error, results, fields){
          if(error){console.log('error: ', error.message);}
          else {
            mysqlconnection.query('select id, size, is_alive from dataserver_info', function(error, rows, fields){
              if(error){console.log('error: ', error.message);}
              else {
                res.send(ejs.render(data, {
                  username:sess.username,
                  fileList:results,
                  dataserver:rows}
                ));
              }
            });
          }
        });
      }
      //res.writeHead(200, {'Content-Type': 'text/html'});
      //res.end(data);
    });
  }
});

//app.use('/bootstrap', express.static(__dirname+'/bootstrap'));
//router.use('/bootstrap', express.static(__dirname+'../bootstrap'));
//app.use('/bootstrap', express.static(__dirname+'/views/bootstrap'));
//app.set('views', express.static(__dirname+'/views'));
router.get('/auth/logout', function(req, res){
  delete req.session.username;
  res.redirect('/');
});


module.exports = router;
