

## Building a Real-time Voice Assistant with ESP32

What was supposed to be a cool 2-day project turned into a 2-week struggle, filled with transistors and WebSocket nightmare. But the result is pretty exciting! Now I can talk with my AI Agent anytime, just by pressing a button.

## Disclaimers

1. I'm a complete beginner in C++, so feel free to improve the code
2. The ESP32 acts as a Mic/Speaker, but the WebSocket server runs on Node. While it's possible to use ESP32 as a server (which could be a great project), I wanted the Agent part on a Node server since I'm more comfortable with JavaScript/TypeScript than C++ or MicroPython
3. You'll likely encounter audio issues along the way, but solutions exist for each problem! The most frustrating, is when you don't even know if it's because your hardware is broker / soldering is shit, or if it's because your software setting are broken.

## Project Overview

This project creates a voice assistant using:
- ESP32 microcontroller for audio input/output and WIFI connexion
- WebSocket communication for real-time data transfer
- OpenAI's real-time API for voice processing
- Node.js server with Langchain for handling the AI agent logic

## Required Materials

### Hardware
- ESP32-S3 development board
- I²S Digital Microphone (INMP441 or similar)
- I²S Amplifier (MAX98357A or similar)
- Small speaker (3W, 4Ω)
- Push button
- Resistors (10kΩ for button pullup)
- Jumper wires
- Breadboard
- Soldering equipment

Here's a detailed article about the ESP32 implementation:

# ESP32 Voice Assistant Implementation Guide

## Core Components

### 1. Audio Management
The system manages both audio input (microphone) and output (speaker) using the I²S (Inter-IC Sound) protocol, which facilitates high-quality, synchronized audio data transfer between devices.

#### Microphone Handler (`mic.cpp`)
```cpp
void micTask(void *parameter) {
    while (true) {
        if (isRecording) {
            // Read audio data from the I2S microphone
            size_t bytesRead = 0;
            esp_err_t result = i2s_read(I2S_PORT_MIC, &soundBuffer, bufferLen, &bytesRead, portMAX_DELAY);
            
            if (result == ESP_OK) {
                // Analyze and transmit audio data
                detectSound(soundBuffer, bytesRead / sizeof(int16_t));
                if (isWebSocketConnected) {
                    sendBinaryData(soundBuffer, bytesRead);
                }
            }
        }
        // Yield to other tasks to maintain system responsiveness
        vTaskDelay(pdMS_TO_TICKS(1));
    }
}
```
**Key Features:**
- **Dedicated Core Execution:** Runs on Core 0, ensuring that audio processing does not interfere with other system tasks.
- **Real-time Sound Detection:** Continuously monitors incoming audio to detect and respond to specific sounds promptly.
- **Efficient Buffer Management:** Utilizes a buffer to store incoming audio data, enabling smooth streaming and processing.
- **WebSocket Integration:** Seamlessly transmits audio data over WebSocket connections for real-time communication with the server.

#### Speaker Handler (`lib_speaker.cpp`)
```cpp
void speaker_play(uint8_t *payload, uint32_t len) {
    const float volume = 0.2f; // Volume scaling factor
    const float pitch = 0.8f;  // Pitch adjustment factor
    
    // Cast payload to audio samples
    int16_t *samples = (int16_t *)payload;
    size_t numSamples = len / sizeof(int16_t);
    
    // Apply volume and pitch modifications
    size_t adjustedSamples = static_cast<size_t>(numSamples / pitch);
    int16_t *processedSamples = new int16_t[adjustedSamples];
    
    // Output the processed audio data to the I2S speaker
    i2s_write(I2S_PORT_SPEAKER, processedSamples, adjustedSamples * sizeof(int16_t),
              &bytes_written, portMAX_DELAY);
    
    // Clean up allocated memory to prevent leaks
    delete[] processedSamples;
}
```
**Features:**
- **Volume Control:** Allows dynamic adjustment of playback volume to suit different environments or user preferences.
- **Pitch Adjustment:** Modifies the pitch of the audio output, enabling effects like voice modulation or tone shifting.
- **Real-time Playback:** Ensures that audio is played back promptly without noticeable delays, maintaining a seamless user experience.
- **Memory-Efficient Processing:** Allocates and deallocates memory responsibly to manage resources effectively and prevent leaks.

### 2. WebSocket Communication (`lib_websocket.cpp`)

The WebSocket module facilitates bi-directional communication between the ESP32 and the server, enabling real-time data exchange essential for responsive voice interactions.

```cpp
void connectToWebSocket() {
    // Assign callback functions for message and event handling
    client.onMessage(onMessageCallback);
    client.onEvent(onEventsCallback);
    
    // Attempt to establish a connection until successful
    while (!connected) {
        if (client.connect(websockets_server_host, websockets_server_port, "/device")) {
            connected = true;
            client.send("Hello Server"); // Initial handshake message
        } else {
            delay(2000); // Wait before retrying to prevent rapid reconnection attempts
        }
    }
}
```
**Key Features:**
- **Automatic Reconnection:** Continuously attempts to reconnect in case of connection drops, ensuring persistent communication.
- **Binary Data Support:** Capable of transmitting binary audio data efficiently, which is crucial for real-time audio streaming.
- **Event-Based Handling:** Utilizes event-driven callbacks to manage incoming messages and connection events, enhancing responsiveness.
- **Keep-Alive Mechanism:** Implements ping/pong frames to maintain active connections and detect disconnections promptly.

### 3. Button Management (`lib_button.cpp`)

A robust button management system ensures reliable user interactions by handling debouncing and accurately detecting button presses and releases.

```cpp
class ButtonChecker {
public:
    void loop() {
        lastTickState = currentState;
        currentState = !digitalRead(BUTTON_PIN); // Active-low configuration
    }

    bool justPressed() const {
        return currentState && !lastTickState;
    }

    bool justReleased() const {
        return !currentState && lastTickState;
    }

private:
    bool currentState = false;
    bool lastTickState = false;
};
```
**Features:**
- **Debouncing:** Filters out noise from rapid, unintended state changes, ensuring that only genuine button presses and releases are registered.
- **Edge Detection:** Accurately identifies the exact moments when the button is pressed or released, enabling precise control flow based on user input.
- **Minimal Resource Usage:** Designed to operate with a low memory footprint, making it suitable for embedded systems with limited resources.

### 4. Memory Management (`audioMemoryBuffer.cpp`)

Efficient memory management is critical for handling continuous audio data streams without overconsumption of resources. This module implements a custom circular buffer to manage audio samples effectively.

```cpp
class AudioMemoryBuffer {
public:
    bool write(const int16_t* data, int length) {
        if (samplesAvailable + length > BUFFER_SIZE) {
            return false; // Prevent buffer overflow
        }
        
        for (int i = 0; i < length; i++) {
            buffer[writeIndex] = data[i];
            writeIndex = (writeIndex + 1) % BUFFER_SIZE; // Circular increment
        }
        samplesAvailable += length;
        return true;
    }

private:
    static const int BUFFER_SIZE = 2048; // Define appropriate buffer size
    int16_t buffer[BUFFER_SIZE];
    int writeIndex = 0;
    int samplesAvailable = 0;
};
```
**Features:**
- **Circular Buffer Design:** Allows continuous writing and reading of audio samples without the need for shifting data, optimizing memory usage.
- **Overflow Protection:** Ensures that incoming data does not exceed the buffer capacity, preventing data loss or corruption.
- **Dynamic Sample Management:** Efficiently handles varying lengths of audio data, accommodating different audio stream requirements.
- **Memory Efficiency:** Designed to make optimal use of available memory, crucial for embedded applications with limited RAM.

## Main Program Flow (`main.cpp`)

The core of the system integrates all modules to deliver a cohesive voice assistant experience.

1. **Initialization**
   - **WiFi Setup:** Establishes a network connection to enable communication with the server.
   - **I2S Initialization:** Configures the I2S protocol for both microphone and speaker to handle audio input and output.
   - **WebSocket Connection:** Connects to the WebSocket server for real-time data exchange.
   - **GPIO Configuration:** Sets up General-Purpose Input/Output pins for the button and LEDs, enabling user interaction and status indication.

2. **Main Loop**
   - **Button Monitoring:** Continuously checks the state of the button to detect user interactions.
   - **Audio Recording Handling:** Initiates or stops audio recording based on button presses, managing the transition between listening and speaking states.
   - **WebSocket Communication Management:** Handles the sending and receiving of audio data to and from the server, ensuring seamless interaction.
   - **LED Control:** Updates LED indicators to reflect the current state of the system (e.g., recording, connected).

3. **Audio State Management**
   ```cpp
   if (button.justPressed()) {
       i2s_stop(I2S_PORT_SPEAKER);             // Halt speaker output to prevent interference
       i2s_zero_dma_buffer(I2S_PORT_SPEAKER);  // Clear speaker buffer for fresh audio playback
       i2s_start(I2S_PORT_MIC);                // Activate microphone input
       setRecording(true);                      // Update system state to recording mode
   }
   ```
   **Explanation:**
   - **Speaker Control:** Stops the speaker to avoid audio feedback or interference when starting a new recording session.
   - **Buffer Clearing:** Ensures that any residual audio data in the speaker buffer is cleared, providing a clean slate for new audio playback.
   - **Microphone Activation:** Begins audio capture from the microphone, enabling the system to record user input.
   - **State Update:** Flags the system as being in recording mode, triggering related processes and indicators.

## Technical Challenges and Solutions

1. **Audio Switching**
   - **Challenge:** Transitioning between microphone and speaker led to unwanted noise and audio artifacts.
   - **Solution:** Implemented thorough buffer clearing and introduced intentional delays between switching to stabilize the audio output and eliminate noise.
   - **My 2c:** You will crash your ESP, or the sound I/O will be broken if you try to get both sensors running at the same time. While probably there is a way to improve it, for me the solution was to switch on/off each sensor.

2. **Memory Management**
   - **Challenge:** Handling large audio buffers resulted in excessive RAM usage, jeopardizing system stability.
   - **Solution:** Leveraged external PSRAM where available and optimized buffer recycling mechanisms to maintain efficient memory usage without compromising performance.
   - **My 2c:** This has to be checked on both side, client and server, as ESP32 will reset if the packet send via Websocket is too big.

3. **Real-time Performance**
   - **Challenge:** Encountered audio glitches and latency issues during intensive audio processing tasks.
   - **Solution:** Prioritized critical audio processing tasks and assigned them to specific cores to ensure that real-time audio handling remained smooth and uninterrupted.
   - **My 2c:** Try with different audio quality, but remember that the audio must be properly formatted for openai specific rate.

## Future Improvements

1. **Audio Compression:** Integrate audio compression algorithms to reduce bandwidth usage, enhancing data transmission efficiency.
2. **Support for Multiple Audio Formats:** Expand compatibility to handle various audio encoding formats, increasing versatility.
3. **Enhanced Error Handling:** Develop more robust error detection and recovery mechanisms to improve system reliability.
4. **Local Wake Word Detection:** Implement on-device wake word recognition to enable hands-free activation of the voice assistant.
5. **Superior Audio Quality Controls:** Refine audio processing parameters to achieve higher fidelity and clearer sound reproduction.

This implementation establishes a robust foundation for developing voice-enabled IoT devices utilizing the ESP32 platform. Its modular architecture facilitates easy updates and expansions, ensuring reliable real-time audio processing and communication essential for effective voice assistant functionality.


Here's an analysis of the Node.js/TypeScript server implementation:

# Voice Assistant Server Implementation (Node.js/TypeScript)

## Core Components

### 1. Agent Management (`lib/agent.ts`)
The `OpenAIVoiceReactAgent` class handles the core voice assistant functionality:

```typescript
export class OpenAIVoiceReactAgent {
    protected connection: OpenAIWebSocketConnection;
    protected instructions?: string;
    protected tools: Tool[];
    private audioManager: AudioManager;
    private recording: boolean = false;
    
    // Main methods for audio handling
    public startRecordingSession(): void {
        if (this.recording) {
            this.audioManager.resetRecording();
        }
        this.recording = true;
        this.audioManager.startRecording();
    }

    public async stopRecordingAndProcessAudio(): Promise<void> {
        // Process recorded audio and send to OpenAI
    }
}
```

Key features:
- WebSocket connection management
- Audio recording session control
- Tool execution handling
- Event stream processing

### 2. Audio Management (`lib/audio.ts`)
The `AudioManager` class handles audio processing and buffering:

```typescript
export class AudioManager {
    private configHighDef: AudioConfig = {
        sampleRate: 44100,
        channels: 1,
        bitDepth: 16
    };

    private fileWriter: wav.FileWriter | undefined;
    private audioBuffer: Buffer = Buffer.alloc(0);

    public handleAudioBuffer(buffer: Buffer): void {
        // Buffer management and processing
    }

    private processAndWriteBuffer(): void {
        // Audio processing pipeline
    }
}
```

Features:
- WAV file handling
- Buffer management
- Audio quality configurations
- Real-time processing

### 3. Tool Execution (`lib/executor.ts`)
The `VoiceToolExecutor` manages function calling and tool execution:

```typescript
class VoiceToolExecutor {
    protected toolsByName: Record<string, StructuredTool>;
    
    async addToolCall(toolCall: any): Promise<void> {
        // Handle tool execution
    }

    async *outputIterator(): AsyncGenerator<any, void, unknown> {
        // Generate tool outputs
    }
}
```

Features:
- Asynchronous tool execution
- Error handling
- Result streaming
- Tool call queuing

### 4. Utility Functions (`lib/utils.ts`)
Various utility functions for audio and stream handling:

```typescript
export async function* mergeStreams<T>(
    streams: Record<string, AsyncGenerator<T>>
): AsyncGenerator<[string, T]> {
    // Merge multiple async streams
}

export function convertAudioToPCM16(
    audioFile: Buffer, 
    sourceRate: number = 44100, 
    targetRate: number = 24000
): string {
    // Convert audio format
}
```

Key utilities:
- Stream merging
- Audio format conversion
- WebSocket stream creation
- Buffer handling

## System Architecture

### 1. Data Flow
1. Audio Input → WebSocket → Server
2. Server → Audio Processing → OpenAI API
3. OpenAI Response → Audio Generation → Client
4. Tool Execution → Response Integration → Client

### 2. Tool Integration
```typescript
const TOOLS = [
    add,
    tavilyTool
];
```

Features:
- Extensible tool system
- Structured schema validation
- Async tool execution
- Result streaming

### 3. Prompt Management
```typescript
export const INSTRUCTIONS = SEDUCTION_COACH_INSTRUCTIONS + "\n\n" + GLOBAL_PROMPT;
```

Features:
- Role-based instructions
- Conversation style guidelines
- Behavioral parameters
- Context management

## Technical Highlights

1. **Real-time Audio Processing**
   - Buffer management
   - Format conversion
   - Quality control
   - Streaming optimization

2. **WebSocket Management**
   - Bi-directional communication
   - Binary data handling
   - Connection resilience
   - Event streaming

3. **Tool Execution System**
   - Async execution
   - Error handling
   - Result streaming
   - Schema validation

4. **Memory Management**
   - Buffer optimization
   - Stream handling
   - Resource cleanup
   - Memory limits

## Future Improvements

1. **Audio Processing**
   - Implement noise reduction
   - Add audio compression
   - Optimize buffer sizes
   - Add format auto-detection

2. **Tool System**
   - Add tool categories
   - Implement tool chaining
   - Add result caching
   - Improve error handling

3. **Performance**
   - Implement audio chunking
   - Add request batching
   - Optimize memory usage
   - Add performance metrics

4. **User Experience**
   - Add connection status
   - Improve error messages
   - Add debug logging
   - Implement retry logic

This implementation provides a robust foundation for a voice-based AI assistant, with room for expansion and optimization based on specific use cases and requirements.





### Software Dependencies
The server uses several key packages as shown in the package.json:


```1:7:esp32-ai-assistant/server_langchain/src/lib/agent.ts
import { Tool, StructuredTool } from "@langchain/core/tools";
import path from "path";
import zodToJsonSchema from "zod-to-json-schema";
import { AudioManager } from "./audio";
import { createStreamFromWebsocket, base64EncodeAudio, mergeStreams, appendToBuffer, convertAudioToPCM16 } from "./utils";
import fs from 'fs';
import decodeAudio from 'audio-decode';
```


## The Architecture

The system consists of three main components:

1. **ESP32 Client**: Handles audio capture and playback
2. **Node.js Server**: Manages WebSocket connections and audio processing
3. **OpenAI Integration**: Processes voice input and generates responses

### Server Implementation

The server uses a WebSocket connection to communicate with the ESP32. Here's how it handles the audio streaming:


```23:37:esp32-ai-assistant/server/src/server.ts
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
```


The server processes incoming audio data and sends it to OpenAI:


```39:64:esp32-ai-assistant/server/src/openai.ts
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
```


### Audio Processing

The system includes sophisticated audio management:


```19:47:esp32-ai-assistant/server/src/audio.ts
export class AudioManager {
    private configMediumDef: AudioConfig = {
        sampleRate: 24000, // Match ESP32 sample rate from audioConfig[44100]
        channels: 1,       // Mono audio from audioConfig
        bitDepth: 16      // 16-bit audio for Int16 codec
    };

    private configLowDef: AudioConfig = {
        sampleRate: 16000, // Match ESP32 sample rate from audioConfig[16000]
        channels: 1,       // Mono audio from audioConfig
        bitDepth: 16      // 16-bit audio for Int16 codec
    };

    private configHighDef: AudioConfig = {
        sampleRate: 44100, // High definition sample rate
        channels: 1,       // Mono audio
        bitDepth: 16      // 16-bit audio for Int16 codec
    };
    private configUltraHighDef: AudioConfig = {
        sampleRate: 96000, // Ultra high definition sample rate
        channels: 1,       // Mono audio
        bitDepth: 16      // 16-bit audio for Int16 codec
    };
    private fileWriter: wav.FileWriter | undefined;
    private writeTimeout: NodeJS.Timeout | null = null;
    private isProcessing: boolean = false;

    private config = this.configHighDef;
    constructor() {
```


### Web Interface

A simple web interface allows monitoring and testing:


```1:34:esp32-ai-assistant/server_langchain/static/index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Microphone to Speaker</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f0f0f0;
        }
        #toggleAudio {
            font-size: 18px;
            padding: 10px 20px;
            cursor: pointer;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            transition: background-color 0.3s;
        }
        #toggleAudio:hover {
            background-color: #45a049;
        }
    </style>
</head>
<body>
    <button id="toggleAudio">Start Audio</button>

```


## Setting Up the Project

1. Clone the repository
2. Install server dependencies:
```bash
cd server
npm install
```

3. Configure your environment variables:
- Copy `.env.example` to `.env`
- Add your OpenAI API key

4. Start the server:
```bash
npm run dev
```

## Usage

1. Power up your ESP32
2. Press the button to start recording
3. Speak your query
4. Release the button to get the AI response
5. The response will play through the connected speaker

## Common Issues and Solutions

1. **Audio Quality Issues**
   - Ensure proper grounding of the microphone
   - Check sample rate matching between ESP32 and server
   - Verify the audio buffer sizes

2. **WebSocket Connection Problems**
   - Check your network connectivity
   - Verify the WebSocket server address in ESP32 code
   - Monitor the connection status in browser console

## Future Improvements

- [ ] Add voice activity detection
- [ ] Implement local wake word detection
- [ ] Add support for multiple languages
- [ ] Improve error handling and recovery
- [ ] Add authentication for secure communication

## Conclusion

While this project took longer than expected, it demonstrates the potential of combining embedded systems with modern AI capabilities. The real-time voice interaction opens up numerous possibilities for home automation, personal assistance, and educational applications.

Feel free to contribute to the project or adapt it for your specific needs!

[Would you like me to continue with any specific section in more detail?]