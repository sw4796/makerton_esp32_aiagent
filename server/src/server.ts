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
import { AudioManager, SampleRate } from './audio';
import { createOpenAICompletion } from './openai';
import { base64ToWavBuffer } from './speech';

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
let recording: boolean = false;

const audioManager = new AudioManager();

async function handleButtonStateChange(ws: WebSocket, buttonState: boolean) {
  console.log(`Button ${buttonState ? "pressed" : "released"}`);
  ws.send(JSON.stringify({
    type: "button_state_change",
    state: buttonState ? "pressed" : "released"
  }));

  if (buttonState) {
    recording = true;
    audioManager.startRecording();
  } else {
    if (recording) {
      audioManager.closeFile();
      recording = false;

      const buffer = audioManager.getCurrentBuffer();
      let res;
      try {
        res = await createOpenAICompletion(buffer);
      } catch (error) {
        console.error('Error creating OpenAI completion:', error);
        return;
      }
      console.log('OpenAI completion response:', JSON.stringify(res, null, 2));
      const bufferReceived = base64ToWavBuffer(res.choices[0]?.message?.audio?.data ?? '', SampleRate.RATE_22050);
      console.log('Received audio buffer from OpenAI:', bufferReceived?.length, 'bytes');
      if (bufferReceived) {
        broadcastAudioToClients(bufferReceived);
      }
    }
  }
}

function handleAudioData(data: Buffer) {
  if (recording) {
    audioManager.handleAudioBuffer(data);
  }
}

function broadcastAudioToClients(buffer: Buffer) {
  const CHUNK_SIZE = 2048; // Send 1KB chunks
  const DELAY_MS = 0; // 50ms delay between chunks

  deviceClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      // client.send(buffer);
      // Split buffer into chunks and send with delay
      for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
        const chunk = buffer.slice(i, i + CHUNK_SIZE);
        setTimeout(() => {
          client.send(chunk);
        }, (i / CHUNK_SIZE) * DELAY_MS);
      }
    }
  });
}

wsServer.on("connection", (ws: WebSocket, req) => {
  console.log("Device Connected");
  deviceClients.push(ws);

  ws.on("message", async (data) => {
    if (data instanceof Buffer) {
      if (data.length === 1) {
        // Handle button state change - 0 means released, 1 means pressed
        const buttonState = data.readUInt8(0) === 1;
        handleButtonStateChange(ws, buttonState);
      } else if (recording) {
        // Only process audio data if we're recording
        handleAudioData(data);
      }
    } else {
      // Handle text/JSON messages
      try {
        const message = JSON.parse(data.toString());
        console.log("Received message:", message);
      } catch (err) {
        console.error("Error parsing message:", err);
      }
    }

    // Clean up disconnected clients
    deviceClients = deviceClients.filter(client => {
      if (client.readyState === WebSocket.OPEN) {
        return true;
      }
      console.log('Client disconnected, removing from device clients');
      return false;
    });
  });

  // Close file when connection ends
  ws.on("close", () => {
    if (recording) {
      audioManager.closeFile();
      recording = false;
    }
  });
});

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