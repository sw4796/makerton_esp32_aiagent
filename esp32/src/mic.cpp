#include <Arduino.h>
#include <driver/i2s.h>
#include "lib_speaker.h"
#include "lib_websocket.h"
#include "utils.h"
#include "config.h"


// Global flags for system state
bool isSpeakerBusy = false;
bool isWebSocketConnected = true;

void detectSound(int16_t *buffer, size_t length) 
{
    if (!buffer || length == 0) {
        return;
    }

    for (const auto &lt : ledThresholds)
    {
        bool soundDetected = false;
        int16_t maxAmplitude = 0;

        // Find maximum amplitude in buffer
        for (size_t i = 0; i < length; i++) {
            int16_t amplitude = abs(buffer[i]);
            maxAmplitude = max(maxAmplitude, amplitude);
            
            if (amplitude > lt.threshold) {
                soundDetected = true;
                break;
            }
        }

        // Update LED state
        digitalWrite(lt.ledPin, soundDetected ? HIGH : LOW);

        // Only log and send data if sound detected
        if (soundDetected) {
            Serial.print("Peak amplitude: ");
            Serial.println(maxAmplitude);
            
            // Send the actual buffer length, not 0
            // sendMessage("Hello");
        }
    }
                sendBinaryData(buffer, length * sizeof(int16_t));

}

void setupMicrophone()
{
    // First uninstall any existing driver
    i2s_driver_uninstall(I2S_PORT_MIC);

    i2s_config_t i2s_config = {
        .mode = i2s_mode_t(I2S_MODE_MASTER | I2S_MODE_RX),  // Make sure this is RX only
        .sample_rate = AUDIO_QUALITY_SPEAKER,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = i2s_comm_format_t(I2S_COMM_FORMAT_STAND_I2S),
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = bufferCnt,
        .dma_buf_len = bufferLen,
        .use_apll = false,
        .tx_desc_auto_clear = false,
        .fixed_mclk = 0
    };

    i2s_pin_config_t pin_config = {
        .bck_io_num = I2S_SCK,
        .ws_io_num = I2S_WS,
        .data_out_num = I2S_PIN_NO_CHANGE,
        .data_in_num = I2S_SD
    };

    // Validate I2S port
    if (I2S_PORT_MIC < I2S_NUM_0 || I2S_PORT_MIC >= I2S_NUM_MAX) {
        Serial.println("Invalid I2S port number");
        return;
    }

    esp_err_t result = i2s_driver_install(I2S_PORT_MIC, &i2s_config, 0, NULL);
    if (result != ESP_OK)
    {
        Serial.printf("Error installing I2S driver: %s\n", esp_err_to_name(result));
        return;
    }

    result = i2s_set_pin(I2S_PORT_MIC, &pin_config);
    if (result != ESP_OK)
    {
        Serial.printf("Error setting I2S pins: %s\n", esp_err_to_name(result));
        // Clean up if pin config fails
        i2s_driver_uninstall(I2S_PORT_MIC);
        return;
    }

    Serial.println("I2S microphone initialized successfully");
}

void handleMicrophone()
{
    size_t bytes_read = 0;
    const size_t bufferSize = bufferLen;
    int16_t *buffer = (int16_t *)audio_malloc(bufferSize * sizeof(int16_t));

    if (!buffer)
    {
        Serial.println("Failed to allocate memory for audio buffer");
        vTaskDelete(NULL);
        return;
    }
    // return;

    esp_err_t result = i2s_read(I2S_PORT_MIC, buffer, bufferSize * sizeof(int16_t), &bytes_read, portMAX_DELAY);
    if (result == ESP_OK && bytes_read > 0)
    {
        detectSound(buffer, bytes_read / sizeof(int16_t));
    }

    free(buffer);
}

void micTask(void *parameter)
{
  size_t bytesIn = 0;
  const size_t bufferSize = bufferLen;
  int16_t *buffer = (int16_t *)audio_malloc(bufferSize * sizeof(int16_t));

  if (!buffer)
  {
    Serial.println("Failed to allocate memory for audio buffer");
    vTaskDelete(NULL);
    return;
  }

  while (1)
  {
    if (isSpeakerBusy)
    {
      vTaskDelay(pdMS_TO_TICKS(10)); // Short delay to prevent busy-waiting
      continue;
    }
    esp_err_t result = i2s_read(I2S_PORT_MIC, buffer, bufferSize * sizeof(int16_t), &bytesIn, portMAX_DELAY);
    if (result == ESP_OK && bytesIn > 0)
    {
      detectSound(buffer, bytesIn / sizeof(int16_t));
      if (isWebSocketConnected)
      {
        client.sendBinary((const char *)buffer, bytesIn);
      }
    }
    else if (result != ESP_OK)
    {
      Serial.printf("Error reading from I2S: %d\n", result);
      vTaskDelay(pdMS_TO_TICKS(10));
    }
    taskYIELD(); // Allow other tasks to run
  }

  free(buffer);
  vTaskDelete(NULL);
}
