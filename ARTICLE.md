
# Building a Real-time Voice Assistant with ESP32: Hardware and C++ Implementation

In this two-part series, we'll dive into the exciting world of creating a real-time voice assistant using an ESP32 microcontroller and cutting-edge AI technologies. Part one will focus on the hardware setup and C++ implementation for the ESP32, while part two will explore the Node.js server and Langchain integration that bring the assistant to life.

## The Journey Begins

What started as an ambitious 2-day experiment quickly evolved into a thrilling 2-week adventure, filled with challenges, learning opportunities, and a deep sense of accomplishment. From navigating the intricacies of transistors to untangling the complexities of WebSocket communication, this project has been an incredible journey of growth and discovery.

## Disclaimers and Considerations

Before we embark on this project, let's address a few important points:

1. **Beginner's Perspective:** As a newcomer to the world of C++, I welcome any suggestions and feedback to enhance the code and improve the overall implementation.
2. **System Architecture:** In this setup, the ESP32 serves as the hub for audio input and output, while a Node.js server handles the WebSocket communication. Although running the server directly on the ESP32 is an intriguing possibility, leveraging the familiarity of JavaScript/TypeScript for the server-side logic proved to be a more practical choice.
3. **Audio Challenges:** Brace yourself for a few audio-related hurdles along the way. Diagnosing whether issues stem from hardware mishaps (like faulty soldering) or software misconfigurations can be the trickiest part of the process.

## Project Overview

This voice assistant seamlessly merges the realms of embedded systems and modern AI, creating a responsive and intuitive user experience. The key components that power this project include:

- **ESP32 Microcontroller:** The brain of the operation, handling audio input/output and Wi-Fi connectivity.
- **WebSocket Communication:** Enabling real-time data transfer between the ESP32 and the server.
- **I²S Protocol:** Ensuring high-quality, synchronized audio data transfer between devices.
- **C++ Implementation:** Optimizing performance and resource utilization on the ESP32.

## Required Materials

To bring this project to life, you'll need the following hardware components:

- ESP32-S3 Development Board
- I²S Digital Microphone (e.g., INMP441)
- I²S Amplifier (e.g., MAX98357A)
- Small Speaker (3W, 4Ω)
- Push Button
- Resistors (10kΩ for button pull-up)
- Jumper Wires
- Breadboard
- Soldering Equipment

With these materials in hand, you're ready to embark on the hardware setup and dive into the ESP32 implementation.

## ESP32 Voice Assistant Implementation

### Audio Management: Microphone and Speaker Handlers

At the heart of the voice assistant lies the audio management system, responsible for seamlessly handling both audio input (microphone) and output (speaker) through the I²S protocol.

The `micTask` function in `mic.cpp` runs on a dedicated core, ensuring that audio processing doesn't interfere with other system tasks. It continuously reads audio data from the I²S microphone, performs real-time sound detection, and transmits the data over WebSocket when a connection is established.


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

At the heart of the system lies an integration of all modules, orchestrating a fluid voice assistant experience.

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
   - **My 2c:** Attempting to run both sensors simultaneously can crash your ESP or disrupt sound I/O. The workaround I found was to toggle each sensor on and off as needed, though there might be more elegant solutions out there.

2. **Memory Management**
   - **Challenge:** Handling large audio buffers resulted in excessive RAM usage, jeopardizing system stability.
   - **Solution:** Leveraged external PSRAM where available and optimized buffer recycling mechanisms to maintain efficient memory usage without compromising performance.
   - **My 2c:** It's crucial to monitor both the client and server sides, as the ESP32 will reset if WebSocket packets become too large.

3. **Real-time Performance**
   - **Challenge:** Encountered audio glitches and latency issues during intensive audio processing tasks.
   - **Solution:** Prioritized critical audio processing tasks and assigned them to specific cores to ensure that real-time audio handling remained smooth and uninterrupted.
   - **My 2c:** Experiment with different audio quality settings, but always ensure the audio is properly formatted to meet OpenAI's specific requirements.

## Future Improvements

1. **Audio Compression:** Integrate audio compression algorithms to reduce bandwidth usage, enhancing data transmission efficiency.
2. **Support for Multiple Audio Formats:** Expand compatibility to handle various audio encoding formats, increasing versatility.
3. **Enhanced Error Handling:** Develop more robust error detection and recovery mechanisms to improve system reliability.
4. **Local Wake Word Detection:** Implement on-device wake word recognition to enable hands-free activation of the voice assistant.
5. **Superior Audio Quality Controls:** Refine audio processing parameters to achieve higher fidelity and clearer sound reproduction.

This implementation lays a solid groundwork for developing sophisticated voice-enabled IoT devices using the ESP32 platform. Its modular architecture not only ensures reliable real-time audio processing and communication but also paves the way for easy updates and future expansions, making it an effective foundation for any aspiring voice assistant project.


## Conclusion and Next Steps

With the hardware configured and the ESP32's firmware capable of capturing voice input and playing back responses, we've established a solid foundation for our voice assistant. The challenges we've overcome provide valuable insights into real-time audio processing and IoT device management.

But capturing and playing audio is just the beginning. To transform our ESP32 into a truly intelligent assistant, we need to give it the ability to understand and generate natural language responses. This is where the power of AI and cloud computing come into play.

In [Part Two](ARTICLE_2.md), we'll dive into building the "brain" of our voice assistant. We'll explore how to integrate a Node.js server powered by **LangChain** and **OpenAI**, enabling our device to process voice commands, interpret user intents, and respond intelligently.

Stay tuned as we bridge the gap between hardware and artificial intelligence, taking our ESP32 voice assistant to the next level!


