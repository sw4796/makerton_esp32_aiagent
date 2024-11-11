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
  connectToWebSocket();
  delay(100); // Add a small delay

  setupMicrophone();
  delay(100); // Add a small delay
  
  i2s_start(I2S_PORT_MIC);
  delay(1000); // Add a small delay

  xTaskCreatePinnedToCore(micTask, "micTask", 10000, NULL, 2, NULL, 0);
}

void loop()
{
  button.loop();
  if (button.justPressed())
  {
    Serial.println("Recording...");
    sendMessage("START_RECORD");
    // setupMicrophone();
    // i2s_start(I2S_PORT_MIC);
    sendButtonState(1);
    Serial.println("Recording ready.");
  }
  else if (button.justReleased())
  {
    Serial.println("Stopped recording.");
    sendButtonState(0);
    sendMessage("STOP_RECORD");
  }

  loopWebsocket();
}