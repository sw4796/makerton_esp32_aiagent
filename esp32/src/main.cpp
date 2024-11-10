#include <Arduino.h>
#include <Audio.h>
#include <WiFi.h>
#include <ArduinoWebsockets.h>
#include <driver/i2s.h>
// #include <audioBuffer.h>
#include <math.h>
#include "mic.h"
#include "config.h"
#include "lib_wifi.h"
#include "utils.h"
#include "lib_speaker.h"
#include "lib_button.h"
#include "lib_websocket.h"

int16_t sBuffer[bufferLen];
ButtonChecker button;

// Function declarations
void setupLEDs();

void setupLEDs()
{
  pinMode(LED_MIC, OUTPUT);
  pinMode(LED_SPKR, OUTPUT);
  digitalWrite(LED_MIC, LOW);
  digitalWrite(LED_SPKR, LOW);
}

void setup()
{
  Serial.begin(115200);
  setupLEDs();
  connectToWiFi();
  // setupSpeaker();
  // setupSpeakerI2S();
  // setupAudio();
  connectToWebSocket();
  delay(100); // Add a small delay

  setupMicrophone();
  delay(100); // Add a small delay
  // i2s_start(I2S_PORT_SPEAKER);
  i2s_start(I2S_PORT_MIC);
  delay(1000); // Add a small delay

  // setupAudio();
  delay(1000); // Add a small delay

  xTaskCreatePinnedToCore(micTask, "micTask", 10000, NULL, 2, NULL, 0);
}

// void checkConnections()
// {
//   // Check WiFi connection and reconnect if needed
//   if (WiFi.status() != WL_CONNECTED)
//   {
//     Serial.println("WiFi connection lost. Reconnecting...");
//     connectToWiFi();
//     connectToWebSocket();
//   }

//   // Check WebSocket connection and reconnect if needed
//   // if (!client.available())
//   // {
//   //   Serial.println("WebSocket connection lost. Reconnecting...");
//   //   connectToWebSocket();
//   // }
// }

// void handleMicrophone()
// {
//   // Read microphone data
//   size_t bytes_read = 0;
//   const size_t bufferSize = bufferLen;
//   int16_t *buffer = (int16_t *)audio_malloc(bufferSize * sizeof(int16_t));

//   if (!buffer)
//   {
//     Serial.println("Failed to allocate memory for audio buffer");
//     vTaskDelete(NULL);
//     return;
//   }

//   esp_err_t result = i2s_read(I2S_PORT_MIC, buffer, bufferSize * sizeof(int16_t), &bytes_read, portMAX_DELAY);
//   if (result == ESP_OK && bytes_read > 0)
//   {
//     detectSound(buffer, bytes_read / sizeof(int16_t));
//   }

//   // Free the buffer after use
//   // free(buffer);
// }

void loop()
{
  // static unsigned long lastSwitch = 0;
  // static bool isMicActive = true;
  // const unsigned long SWITCH_INTERVAL = 10000; // 10 seconds

  // unsigned long currentTime = millis();

  // if (currentTime - lastSwitch >= SWITCH_INTERVAL)
  // {
  //   isMicActive = !isMicActive;
  //   lastSwitch = currentTime;
  // }
  // handleSpeaker();
  // handleMicrophone();

  button.loop();
  if (button.justPressed())
  {
    Serial.println("Recording...");
    sendMessage("START_RECORD");
    // webSocket.sendTXT("{\"role\": \"user\", \"type\": \"audio\", \"format\": \"bytes.raw\", \"start\": true}");
    // InitI2SSpeakerOrMic(MODE_MIC);
    // recording = true;
       sendButtonState(1);
 // data_offset = 0;
    Serial.println("Recording ready.");
  }
  else if (button.justReleased())
  {
    Serial.println("Stopped recording.");
    // webSocket.sendTXT("{\"role\": \"user\", \"type\": \"audio\", \"format\": \"bytes.raw\", \"end\": true}");
    // flush_microphone();
    // recording = false;
    // data_offset = 0;
    sendButtonState(0);
    sendMessage("STOP_RECORD");
  }

  loopWebsocket();
  // if (isMicActive) {
  //   handleMicrophone();
  // } else {
  //   handleSpeaker();
  // }
}