#include <Arduino.h>
#include <ArduinoWebsockets.h>
#include "config.h"

using namespace websockets;

WebsocketsClient client;

void onMessageCallback(WebsocketsMessage message) {
    Serial.print("Got Message: ");
    Serial.println(message.data());
}

void onEventsCallback(WebsocketsEvent event, String data) {
    if (event == WebsocketsEvent::ConnectionOpened) {
        Serial.println("Connection Opened");
    }
    else if (event == WebsocketsEvent::ConnectionClosed) {
        Serial.println("Connection Closed"); 
    }
    else if (event == WebsocketsEvent::GotPing) {
        Serial.println("Got a Ping!");
    }
    else if (event == WebsocketsEvent::GotPong) {
        Serial.println("Got a Pong!");
    }
}

void connectToWebSocket() {
    // Configure WebSocket callbacks
    client.onMessage(onMessageCallback);
    client.onEvent(onEventsCallback);

    const char* websockets_server_host = WEBSOCKET_HOST;
    const uint16_t websockets_server_port = WEBSOCKET_PORT;

    // Try to connect to WebSocket server
    bool connected = false;
    while (!connected) {
        if (client.connect(websockets_server_host, websockets_server_port, "/device")) {
            connected = true;
            Serial.println("WebSocket Connected!");
            client.send("Hello Server");
            client.ping();
        }
        else {
            Serial.println("WebSocket Connection Failed! Retrying in 2 seconds...");
            delay(2000);
        }
    }
}

void checkWebSocketConnection() {
    if (!client.available()) {
        Serial.println("WebSocket connection lost. Reconnecting...");
        connectToWebSocket();
    }
    client.poll();
}

void sendMessage(const char* message) {
    if (client.available()) {
        client.send(message);
    } else {
        Serial.println("WebSocket not connected - cannot send message");
    }
}

void sendBinaryData(const int16_t* buffer, size_t bytesIn) {
    if (client.available()) {
        // Convert int16_t buffer to char buffer
        const char* charBuffer = reinterpret_cast<const char*>(buffer);
        client.sendBinary(charBuffer, bytesIn);
    } else {
        Serial.println("WebSocket not connected - cannot send binary data");
        delay(1000);
    }
}
void reconnectWSServer() {
    if (!client.available()) {
        Serial.println("WebSocket connection lost. Attempting to reconnect...");
        connectToWebSocket();
    }
}

void loopWebsocket()
{
  client.poll();
  static unsigned long lastReconnectAttempt = 0;
  unsigned long currentMillis = millis();

  if (currentMillis - lastReconnectAttempt >= 5000)
  {
    lastReconnectAttempt = currentMillis;
    reconnectWSServer();
  }

//   setButtonState();
//   delay(1);
}
