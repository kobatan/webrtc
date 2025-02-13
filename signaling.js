"use strict";
 
let WebSocketServer = require('ws').Server;
let port = 3001;
let wsServer = new WebSocketServer({ port: port });
console.log('websocket server start. port=' + port);
 
wsServer.on("connection", function (ws) {
  console.log("-- websocket connected --");
  ws.on("message", function (message, isBinary) {
      wsServer.clients.forEach(function each(client) {
          if (ws === client) {
              console.log("- skip sender -");
          } else {
              client.send(message, { binary: isBinary });
          }
      });
  });
});

wsServer.on('close', function() {
  consolejson.log('-- websocket closed --');
});

