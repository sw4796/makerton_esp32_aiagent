/////////////////////////////////////////////////////////////////
/*
IA Assistant
*/
/////////////////////////////////////////////////////////////////

import path from 'path';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
const app = express();
  // Create WAV file writer
  import fs from 'fs';
import { AudioManager } from './audio';
 
const WS_PORT = parseInt(process.env.WS_PORT || "8888");
const MONITOR_WS_PORT = parseInt(process.env.MONITOR_WS_PORT || "8899");
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "8000");

// Device WebSocket server
const wsServer = new WebSocketServer({ 
  port: WS_PORT,
  path: '/device'
}, () =>
  console.log(`Device WS server is listening at ws://localhost:${WS_PORT}/device`)
);

// Monitor WebSocket server
const monitorWsServer = new WebSocketServer({
  port: MONITOR_WS_PORT,
  path: '/monitor'
}, () => 
  console.log(`Monitor WS server is listening at ws://localhost:${MONITOR_WS_PORT}/monitor`)
);

// arrays of connected websocket clients
let deviceClients: WebSocket[] = [];
let monitorClients: WebSocket[] = [];
const audioManager = new AudioManager();
wsServer.on("connection", (ws: WebSocket, req) => {
  console.log("Device Connected");
  deviceClients.push(ws);

  // listen for messages from the streamer
  ws.on("message", (data) => {
    // Write audio data to WAV file if it's binary data
    // if (data instanceof Buffer) {
    //   try {
    //   } catch (err:any) {
    //     if (err.message === 'write after end') {
    //       console.error('Attempted to write to closed WAV file');
    //     } else {
    //       throw err;
    //     }
    //   }
    // }

    // Forward data to device clients
    deviceClients.forEach((client, i) => {
      if (client.readyState === WebSocket.OPEN) {
        audioManager.handleAudioBuffer(data as Buffer)
        // if (audioTimeout) {
        //   clearTimeout(audioTimeout);
        // }
      
        // Set new timeout
        // audioTimeout = setTimeout(() => {
        //   console.log('5 seconds elapsed with no data, closing WAV file');
        //   audioManager.closeFile();
        //   deviceClients.splice(i, 1);

        // }, 5000);
        // client.send(data);
      } else {
        // audioManager.closeFile()
        deviceClients.splice(i, 1);
      }
    });

    // Forward data to monitor clients
    monitorClients.forEach((client, i) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      } else {
        monitorClients.splice(i, 1);
      }
    });
  });

  // Close file when connection ends
  // ws.on("close", () => {
  //   audioManager.closeFile()
  // });
});
// Set timeout to close file after 5 seconds of inactivity
let audioTimeout: NodeJS.Timeout;



monitorWsServer.on("connection", (ws: WebSocket) => {
  console.log("Monitor Connected");
  monitorClients.push(ws);
});

// HTTP stuff
app.use("/image", express.static("image"));
app.use("/js", express.static(path.join(__dirname, "js")));
app.get("/audio", (req, res) =>
  res.sendFile(path.resolve(__dirname, "./audio_client.html"))
);
app.listen(HTTP_PORT, () =>
  console.log(`HTTP server listening at http://localhost:${HTTP_PORT}`)
);


/*

import path from 'path';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
const app = express();

const WS_PORT = parseInt(process.env.WS_PORT || "8888");
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "8000");

// Create HTTP server
// const httpServer = app.listen(HTTP_PORT, () =>
//   console.log(`HTTP server listening at http://localhost:${HTTP_PORT}`)
// );
// Create HTTP server
const wsServer = app.listen(WS_PORT, () =>
  console.log(`WS server listening at http://localhost:${WS_PORT}`)
);

// Create WebSocket servers
const monitorWsServer = new WebSocketServer({ server: wsServer, path: "/monitor" });
console.log(`Monitor WS server is listening at ws://localhost:${WS_PORT}/monitor`);

const deviceWsServer = new WebSocketServer({ server: wsServer, path: "/device" });
console.log(`AI WS server is listening at ws://localhost:${WS_PORT}/device`);

// Arrays of connected websocket clients
let monitorClients: WebSocket[] = [];
let aiClients: WebSocket[] = [];

monitorWsServer.on("connection", (ws: WebSocket, req) => {
  console.log("Monitor client connected");
  monitorClients.push(ws);
  
  ws.on("message", (data) => {
    // Forward data to all monitor clients
    monitorClients.forEach((client, i) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      } else {
        monitorClients.splice(i, 1);
      }
    });
  });
});

deviceWsServer.on("connection", (ws: WebSocket, req) => {
  console.log("AI client connected");
  aiClients.push(ws);

  ws.on("message", (data) => {
    // Handle AI-specific logic here
    // For now just forward to other AI clients
    aiClients.forEach((client, i) => {
      if (client.readyState === WebSocket.OPEN) {
        // client.send(data);
      } else {
        aiClients.splice(i, 1);
      }
    });
  });
});

// HTTP stuff
app.use("/image", express.static("image"));
app.use("/js", express.static(path.join(__dirname, "js")));
app.get("/audio", (req, res) =>
  res.sendFile(path.resolve(__dirname, "./audio_client.html"))
);

*/