#ifndef MIC_H
#define MIC_H

#include <Arduino.h>

void detectSound(int16_t *buffer, size_t length);
void setupMicrophone();
void handleMicrophone();
void micTask(void *parameter);

#endif
