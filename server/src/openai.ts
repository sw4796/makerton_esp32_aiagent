import OpenAI from 'openai';
import WebSocket from 'ws';

export function createOpenAIWebSocket() {
    return new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-10-01", {
        headers: {
            "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
            "OpenAI-Beta": "realtime=v1",
        },
    });
}

export const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


export async function createOpenAICompletion(fileBuffer: Buffer) {
    const base64str = fileBuffer.toString('base64');

    return await openaiClient.chat.completions.create({
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
}
export async function createOpenAICompletionStream(fileBuffer: Buffer) {
    const base64str = fileBuffer.toString('base64');

    return await openaiClient.chat.completions.create({
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
}
export function handleOpenAIConnection() {
    console.log("Connected to OpenAI server.");
}

export function handleOpenAIMessage(message: WebSocket.Data, clientWs: WebSocket, connectedClients: WebSocket[]) {
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

function handleResponseComplete(parsedMessage: any, clientWs: WebSocket) {
    console.log("Response completed", JSON.stringify(parsedMessage, null, 2));
    clientWs.send(JSON.stringify({
        type: "response_complete",
        data: "OpenAI response finished"
    }));
}

function handleAudioDelta(parsedMessage: any, connectedClients: WebSocket[]) {
    console.log("Received audio delta from OpenAI");
    const audioBuffer = Buffer.from(parsedMessage.delta, 'base64');
    const resampledAudioBuffer = resampleAudio(audioBuffer);
    broadcastAudioToClients(resampledAudioBuffer, connectedClients);
}

function resampleAudio(audioBuffer: Buffer, originalSampleRate = 24000, targetSampleRate = 32000): Buffer {
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

function broadcastAudioToClients(audioBuffer: Buffer, clients: WebSocket[]) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(audioBuffer);
        }
    });
}
