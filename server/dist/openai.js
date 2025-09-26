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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openaiClient = void 0;
exports.createOpenAIWebSocket = createOpenAIWebSocket;
exports.createOpenAICompletion = createOpenAICompletion;
exports.createOpenAICompletionStream = createOpenAICompletionStream;
exports.handleOpenAIConnection = handleOpenAIConnection;
exports.handleOpenAIMessage = handleOpenAIMessage;
const openai_1 = __importDefault(require("openai"));
const ws_1 = __importDefault(require("ws"));
function createOpenAIWebSocket() {
    return new ws_1.default("wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-10-01", {
        headers: {
            "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
            "OpenAI-Beta": "realtime=v1",
        },
    });
}
exports.openaiClient = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
function createOpenAICompletion(fileBuffer) {
    return __awaiter(this, void 0, void 0, function* () {
        const base64str = fileBuffer.toString('base64');
        return yield exports.openaiClient.chat.completions.create({
            model: "gpt-4o-audio-preview",
            modalities: ["text", "audio"],
            audio: { voice: "alloy", format: "wav" },
            messages: [
                {
                    role: "system",
                    content: "You are a helpful AI assistant. Your task is to listen to the audio input, transcribe it, and provide a relevant and concise response. If the audio is unclear or there's no speech detected, kindly ask for clarification."
                },
                {
                    role: "user",
                    content: [
                        { type: "input_audio", input_audio: { data: base64str, format: "wav" } }
                    ]
                }
            ]
        });
    });
}
function createOpenAICompletionStream(fileBuffer) {
    return __awaiter(this, void 0, void 0, function* () {
        const base64str = fileBuffer.toString('base64');
        return yield exports.openaiClient.chat.completions.create({
            model: "gpt-4o-audio-preview",
            modalities: ["text", "audio"],
            audio: {
                voice: "alloy",
                format: "pcm16"
            },
            messages: [
                {
                    role: "system",
                    content: "You are a helpful AI assistant. Your task is to listen to the audio input, transcribe it, and provide a relevant and concise response. If the audio is unclear or there's no speech detected, kindly ask for clarification."
                },
                {
                    role: "user",
                    content: [
                        { type: "input_audio", input_audio: { data: base64str, format: "wav" } }
                    ]
                }
            ],
            stream: true
        });
    });
}
function handleOpenAIConnection() {
    console.log("Connected to OpenAI server.");
}
function handleOpenAIMessage(message, clientWs, connectedClients) {
    const parsedMessage = JSON.parse(message.toString());
    console.log("Received from OpenAI:", parsedMessage.type);
    switch (parsedMessage.type) {
        case 'conversation.item.created':
            console.log("Conversation item created:", parsedMessage.item.content);
            break;
        case 'response.output_item.done':
            handleResponseComplete(parsedMessage, clientWs);
            break;
        case 'response.audio.delta':
            handleAudioDelta(parsedMessage, connectedClients);
            break;
        case 'response.audio_transcript.delta':
            console.log("Received audio transcript delta:", parsedMessage.delta);
            break;
        default:
            console.log("Unhandled message type:", parsedMessage.type);
    }
}
function handleResponseComplete(parsedMessage, clientWs) {
    console.log("Response completed", JSON.stringify(parsedMessage, null, 2));
    clientWs.send(JSON.stringify({
        type: "response_complete",
        data: "OpenAI response finished"
    }));
}
function handleAudioDelta(parsedMessage, connectedClients) {
    console.log("Received audio delta from OpenAI");
    const audioBuffer = Buffer.from(parsedMessage.delta, 'base64');
    const resampledAudioBuffer = resampleAudio(audioBuffer);
    broadcastAudioToClients(resampledAudioBuffer, connectedClients);
}
function resampleAudio(audioBuffer, originalSampleRate = 24000, targetSampleRate = 32000) {
    const resampleRatio = originalSampleRate / targetSampleRate;
    // Ensure the input buffer is aligned to 4 bytes
    const alignedBuffer = Buffer.alloc(Math.ceil(audioBuffer.length / 4) * 4);
    audioBuffer.copy(alignedBuffer);
    const audioFloat32 = new Float32Array(alignedBuffer.buffer);
    const newLength = Math.floor(audioFloat32.length / resampleRatio);
    const resampledBuffer = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
        const index = i * resampleRatio;
        const indexFloor = Math.floor(index);
        const indexCeil = Math.min(Math.ceil(index), audioFloat32.length - 1);
        const fraction = index - indexFloor;
        resampledBuffer[i] = (1 - fraction) * audioFloat32[indexFloor] + fraction * audioFloat32[indexCeil];
    }
    // Ensure the output buffer is aligned to 4 bytes
    const alignedResampledBuffer = Buffer.alloc(Math.ceil(resampledBuffer.length * 4 / 4) * 4);
    Buffer.from(resampledBuffer.buffer).copy(alignedResampledBuffer);
    return alignedResampledBuffer;
}
function broadcastAudioToClients(audioBuffer, clients) {
    clients.forEach(client => {
        if (client.readyState === ws_1.default.OPEN) {
            client.send(audioBuffer);
        }
    });
}
