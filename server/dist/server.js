"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/////////////////////////////////////////////////////////////////
/*
IA Assistant
*/
/////////////////////////////////////////////////////////////////
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const app = (0, express_1.default)();
const audio_1 = require("./audio");
const openai_1 = require("./openai");
const speech_1 = require("./speech");
const WS_PORT = parseInt(process.env.WS_PORT || "8888");
const MONITOR_WS_PORT = parseInt(process.env.MONITOR_WS_PORT || "8899");
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "8000");
// Device WebSocket server
const wsServer = new ws_1.WebSocketServer({
    port: WS_PORT,
    path: '/device'
}, () => console.log(`Device WS server is listening at ws://localhost:${WS_PORT}/device`));
// Monitor WebSocket server
const monitorWsServer = new ws_1.WebSocketServer({
    port: MONITOR_WS_PORT,
    path: '/monitor'
}, () => console.log(`Monitor WS server is listening at ws://localhost:${MONITOR_WS_PORT}/monitor`));
// arrays of connected websocket clients
let deviceClients = [];
let monitorClients = [];
let recording = false;
const audioManager = new audio_1.AudioManager();
function handleButtonStateChange(ws, buttonState) {
    return __awaiter(this, void 0, void 0, function* () {
        notifyButtonStateChange(ws, buttonState);
        if (buttonState) {
            startRecordingSession();
        }
        else {
            if (recording) {
                yield stopRecordingAndProcessAudioAsStream();
                // await stopRecordingAndProcessAudio();
            }
        }
    });
}
function notifyButtonStateChange(ws, buttonState) {
    console.log(`Button ${buttonState ? "pressed" : "released"}`);
    ws.send(JSON.stringify({
        type: "button_state_change",
        state: buttonState ? "pressed" : "released"
    }));
}
function startRecordingSession() {
    recording = true;
    audioManager.startRecording();
}
function stopRecordingAndProcessAudio() {
    return __awaiter(this, void 0, void 0, function* () {
        audioManager.closeFile();
        recording = false;
        const buffer = audioManager.getCurrentBuffer();
        const response = yield processAudioWithOpenAI(buffer);
        if (response) {
            broadcastAudioToClients(response);
        }
    });
}
function stopRecordingAndProcessAudioAsStream() {
    return __awaiter(this, void 0, void 0, function* () {
        audioManager.closeFile();
        recording = false;
        const buffer = audioManager.getCurrentBuffer();
        yield processAudioWithOpenAIStream(buffer);
        // No need to broadcast here since processAudioWithOpenAIStream handles it
    });
}
function processAudioWithOpenAI(buffer) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            const res = yield (0, openai_1.createOpenAICompletion)(buffer);
            console.log('OpenAI completion response:', JSON.stringify(res, null, 2));
            const audioBuffer = (0, speech_1.base64ToWavBuffer)((_d = (_c = (_b = (_a = res.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.audio) === null || _c === void 0 ? void 0 : _c.data) !== null && _d !== void 0 ? _d : '', audio_1.SampleRate.RATE_22050);
            console.log('Received audio buffer from OpenAI:', audioBuffer === null || audioBuffer === void 0 ? void 0 : audioBuffer.length, 'bytes');
            return audioBuffer || null;
        }
        catch (error) {
            console.error('Error creating OpenAI completion:', error);
            return null;
        }
    });
}
function processAudioWithOpenAIStream(buffer) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        try {
            const stream = yield (0, openai_1.createOpenAICompletionStream)(buffer);
            console.log('Starting to process audio stream from OpenAI');
            try {
                for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _d = true) {
                    _c = stream_1_1.value;
                    _d = false;
                    const chunk = _c;
                    const audioData = extractAudioFromChunk(chunk);
                    if (audioData) {
                        broadcastStreamAudioToClients(audioData);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = stream_1.return)) yield _b.call(stream_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return null; // Streaming mode - no buffer return needed
        }
        catch (error) {
            console.error('Error creating OpenAI completion stream:', error);
            return null;
        }
    });
}
function extractAudioFromChunk(chunk) {
    var _a, _b;
    const delta = (_a = chunk.choices[0]) === null || _a === void 0 ? void 0 : _a.delta;
    if (!((_b = delta === null || delta === void 0 ? void 0 : delta.audio) === null || _b === void 0 ? void 0 : _b.data)) {
        return null;
    }
    console.log('Received audio chunk:', delta.audio.data.length, 'bytes');
    return Buffer.from(delta.audio.data, 'base64');
}
function handleAudioData(data) {
    if (recording) {
        audioManager.handleAudioBuffer(data);
    }
}
function broadcastAudioToClients(buffer) {
    const CHUNK_SIZE = 2048; // Send 1KB chunks
    const DELAY_MS = 10; // 50ms delay between chunks
    deviceClients.forEach(client => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
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
function broadcastStreamAudioToClients(buffer) {
    const CHUNK_SIZE = 2048; // Send 1KB chunks
    const DELAY_MS = 10; // 50ms delay between chunks
    deviceClients.forEach(client => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(buffer);
            // Split buffer into chunks and send with delay
            // for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
            //   const chunk = buffer.slice(i, i + CHUNK_SIZE);
            //   setTimeout(() => {
            //     client.send(chunk);
            //   }, (i / CHUNK_SIZE) * DELAY_MS);
            // }
        }
    });
}
wsServer.on("connection", (ws, req) => {
    console.log("Device Connected");
    deviceClients.push(ws);
    ws.on("message", (data) => __awaiter(void 0, void 0, void 0, function* () {
        if (data instanceof Buffer) {
            if (data.length === 1) {
                // Handle button state change - 0 means released, 1 means pressed
                const buttonState = data.readUInt8(0) === 1;
                handleButtonStateChange(ws, buttonState);
            }
            else if (recording) {
                // Only process audio data if we're recording
                handleAudioData(data);
            }
        }
        else {
            // Handle text/JSON messages
            try {
                const message = JSON.parse(data.toString());
                console.log("Received message:", message);
            }
            catch (err) {
                console.error("Error parsing message:", err);
            }
        }
        // Clean up disconnected clients
        deviceClients = deviceClients.filter(client => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                return true;
            }
            console.log('Client disconnected, removing from device clients');
            return false;
        });
    }));
    // Close file when connection ends
    ws.on("close", () => {
        if (recording) {
            audioManager.closeFile();
            recording = false;
        }
    });
});
monitorWsServer.on("connection", (ws) => {
    console.log("Monitor Connected");
    monitorClients.push(ws);
});
// HTTP stuff
app.use("/image", express_1.default.static("image"));
app.use("/js", express_1.default.static(path_1.default.join(__dirname, "js")));
app.get("/audio", (req, res) => res.sendFile(path_1.default.resolve(__dirname, "./audio_client.html")));
app.listen(HTTP_PORT, () => console.log(`HTTP server listening at http://localhost:${HTTP_PORT}`));
