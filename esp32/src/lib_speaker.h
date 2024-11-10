#ifndef LIB_SPEAKER_H
#define LIB_SPEAKER_H

#include <Audio.h>
#include <Arduino.h>
// #include "audioBuffer.h"

void setupSpeakerI2S();
void setupSpeaker();
void loopAudio();
void setupAudio();
void generateTone(int16_t *buffer, size_t samples);
void writeToAudioBuffer(int16_t *buffer, size_t samples);
void playBuffer(int16_t *buffer, size_t samples);
void handleSpeaker();

extern unsigned long lastMicActivity;
extern unsigned long lastSpkrActivity; 
extern unsigned long lastToneTime;
extern bool isPlayingTone;
extern unsigned long toneStartTime;

#endif
