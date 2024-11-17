import { AudioConfig, AudioManager } from "./audio";
import { convertAudioToPCM16, createStreamFromWebsocket } from "./utils";
import WebSocket from "ws";

const DEFAULT_MODEL = "gpt-4o-realtime-preview";
const DEFAULT_URL = "wss://api.openai.com/v1/realtime";
const DEFAULT_AUDIO_CONFIG: AudioConfig = {
    sampleRate: 44100,  // ESP32 default sample rate
    channels: 1,        // Mono audio
    bitDepth: 16        // 16-bit PCM
};

class OpenAIWebSocketConnection {
    ws?: WebSocket;
    url: string;
    apiKey?: string;
    model: string;
    audioConfig: AudioConfig;
    private isRecording: boolean = true;
    private audioManager: AudioManager;

    constructor(params: {
        url?: string;
        apiKey?: string;
        model?: string;
        audioConfig?: AudioConfig;
        audioManager: AudioManager;
    }) {
        this.url = params.url ?? DEFAULT_URL;
        this.model = params.model ?? DEFAULT_MODEL;
        this.apiKey = params.apiKey ?? process.env.OPENAI_API_KEY;
        this.audioConfig = params.audioConfig ?? DEFAULT_AUDIO_CONFIG;
        this.audioManager = params.audioManager;
    }

    async connect() {
        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
            "OpenAI-Beta": "realtime=v1",
        };

        const finalUrl = `${this.url}?model=${this.model}`;
        this.ws = new WebSocket(finalUrl, { headers });
        await new Promise<void>((resolve, reject) => {
            if (!this.ws) {
                reject(new Error("WebSocket was not initialized"));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error("Connection timed out after 10 seconds."));
            }, 10000);

            const onOpen = () => {
                clearTimeout(timeout);
                resolve();
            };

            const onError = (error: Error) => {
                clearTimeout(timeout);
                reject(error);
            };

            if (this.ws.readyState === WebSocket.OPEN) {
                onOpen();
            } else {
                this.ws.once("open", onOpen);
                this.ws.once("error", onError);
            }
        });
    }

    sendEvent(event: Record<string, unknown>) {
        const formattedEvent = JSON.stringify(event);
        if (this.ws === undefined) {
            throw new Error("Socket connection is not active, call .connect() first");
        }
        this.ws?.send(formattedEvent);
    }

    async *eventStream() {
        if (!this.ws) {
            throw new Error("Socket connection is not active, call .connect() first");
        }
        yield* createStreamFromWebsocket(this.ws);
    }


    handleButtonState(buttonState: boolean) {
        this.isRecording = buttonState;
        if (buttonState) {
            console.log('Started recording');
            // Optionally send a start recording event to OpenAI
            // this.sendEvent({
            //     type: "session.update",
            //     session: {
            //         recording_started: true
            //     }
            // });
        } else {
            console.log('Stopped recording');
            // Send end of audio stream marker
            // this.sendEvent({
            //   type: "input_audio_buffer.commit"
            // });
        }
    }

    async handleIncomingAudio(data: Buffer) {
        // Log incoming audio data details
        console.log('Received audio data length:', data.length);
        if (data.length > 0) {
            // console.log('First byte:', data[0]);
            // console.log('Last byte:', data[data.length - 1]);
        }
        // Only process audio when recording is active
        if (!this.isRecording) {
            console.log('Skipping audio processing - recording is not active');
            // return;
        }

        if (data.length === 1) {
            // Handle button state change
            const buttonState = data[0] === 1;
            this.handleButtonState(buttonState);
            return;
        }

        if (data.length === 2) {
            // Handle ESP32 control messages (e.g., button state)
            const view = new Int16Array(data.buffer);
            if (view[0] === 2) {
                console.log('Received PING from ESP32');
                return;
            }
        }


        const buffer = Buffer.from(data);
        const b64 = convertAudioToPCM16(data);
        this.audioManager.handleAudioBuffer(data);
        // // Process audio data
        // Ensure data buffer length is even before creating Int16Array
        // const alignedBuffer = data.length % 2 === 0 ? data : Buffer.concat([data, Buffer.alloc(1)]);
        // const processedBuffer = processAudioBuffer(alignedBuffer);
        // Send to OpenAI
        // this.sendEvent({
        //     type: "input_audio_buffer.append",
        //     audio: b64
        // });
    }
}

export { OpenAIWebSocketConnection };