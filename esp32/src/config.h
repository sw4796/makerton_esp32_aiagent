#ifndef CONFIG_H
#define CONFIG_H

// WiFi credentials

const int WEBSOCKET_PORT = 8888;
extern const char* WIFI_SSID;
extern const char* WIFI_PASSWORD;
extern const char* WEBSOCKET_HOST;
// I2S Microphone pins

#define I2S_SD 32      // Serial Data
#define I2S_WS 25      // Word Select (LRCLK)
#define I2S_SCK 33     // Serial Clock

// Speaker pins
#define I2S_SPEAKER_BCLK 26 // Bit Clock
#define I2S_SPEAKER_LRC 27  // Left Right Clock (Word Select)
#define I2S_SPEAKER_DIN 14  // Data Input

// LED pins
#define LED_MIC 2      // RED LED for microphone activity (내장 LED)
#define LED_SPKR 4     // BLUE LED for speaker activity
// Button pin
#define BUTTON_PIN 15  // Button pin

// I2S Microphone configuration
// #define SAMPLE_RATE 44100
#define SAMPLE_RATE 16000
#define SAMPLE_BITS 32
#define CHANNELS 1

#define I2S_PORT_MIC I2S_NUM_0
#define I2S_PORT_SPEAKER I2S_NUM_1

// Buffer configuration
#define bufferCnt 4
#define bufferLen 256

// Audio detection thresholds
#define MIC_THRESHOLD 2300 // Adjust based on testing
#define LED_DELAY 1        // ms to keep LED on after sound stops

// Test tone configuration
#define TONE_FREQUENCY 440 // Hz (A4 note)
#define TONE_DURATION 2000 // ms
#define TONE_INTERVAL 5000 // ms
#define SAMPLES_PER_BUFFER 1024

struct LedThreshold
{
    int ledPin;
    int threshold;
};

const LedThreshold ledThresholds[] = {
    {LED_MIC, 100},
    // {LED_SPKR, 200},
};

enum AudioQuality
{
  LOW_DEFINITION = 16000,
  OPENAI_DEFINITION = 22050,
  MID_DEFINITION = 24000,
  HIGH_DEFINITION = 44100,
  ULTRA_HIGH_DEFINITION = 96000
};

const AudioQuality AUDIO_QUALITY_SPEAKER = AudioQuality::LOW_DEFINITION;
const AudioQuality AUDIO_QUALITY = AudioQuality::HIGH_DEFINITION;
const AudioQuality AUDIO_QUALITY_MIC = AudioQuality::HIGH_DEFINITION;


#endif