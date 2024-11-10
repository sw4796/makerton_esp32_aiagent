import { WebSocket } from 'ws';
import * as wav from 'wav';
import * as fs from 'fs';
import * as path from 'path';
import openai from 'openai';
import { createOpenAICompletion, openaiClient } from './openai';
// import { openai } from './config.cjs';
// import { audioToItemCreateEvent } from './audioUtils.cjs';
// import { sendResponseCreateEvent } from './websocketUtils.cjs';

interface AudioResponse {
  audioBuffer: Buffer;
  currentFileWriter: wav.FileWriter;
  lastSendTime: number;
  responseBuffer: Buffer | null;
}

// async function handleAudioData(
//   data: Buffer, 
//   audioBuffer: Buffer,
//   lastSendTime: number,
//   BUFFER_INTERVAL: number,
//   openAIWs: WebSocket,
//   currentFileWriter: wav.FileWriter,
//   triggerResponse: boolean
// ): Promise<AudioResponse> {
  
//   if (!currentFileWriter) {
//     return {
//       audioBuffer,
//       currentFileWriter,
//       lastSendTime,
//       responseBuffer: null
//     };
//   }

//   audioBuffer = Buffer.concat([audioBuffer, data]);
//   let responseBuffer: Buffer | null = null;

//   if (triggerResponse || Date.now() - lastSendTime >= BUFFER_INTERVAL) {
//     console.log(`Handling audio data: Buffer size ${audioBuffer.length} bytes, Time since last send: ${Date.now() - lastSendTime}ms`);
    
//     if (triggerResponse) {
//       console.log('Response triggered manually');
//     } else {
//       console.log('Buffer interval reached, processing audio');
//     }

//     responseBuffer = await processAudioWithOpenAI(currentFileWriter.path, openAIWs);
//     lastSendTime = Date.now();
//   }

//   return { audioBuffer, currentFileWriter, lastSendTime, responseBuffer };
// }

export async function processAudioWithOpenAI(audioFilePath: string): Promise<Buffer | null> {
  try {
    const fileBuffer = await readAudioFile(audioFilePath);
    if (!fileBuffer) return null;

    const response = await createOpenAICompletion(fileBuffer);
    if (!response) return null;

    if (!response.choices?.[0]?.message?.audio?.data) {
      console.error('Invalid response format from OpenAI');
      return null;
    }

    return base64ToWavBuffer(response.choices[0].message.audio.data);

  } catch (error) {
    console.error('Error processing audio with OpenAI:', error);
    return null;
  }
}


async function readAudioFile(audioFilePath: string): Promise<Buffer | null> {
  if (!fs.existsSync(audioFilePath)) {
    console.error(`Audio file does not exist: ${audioFilePath}`);
    return null;
  }
  
  const fileBuffer = fs.readFileSync(audioFilePath);
  console.log(`Successfully read audio file: ${audioFilePath}`);
  return fileBuffer;
}

function base64ToWavBuffer(base64String: string): Buffer | null {
  try {
    const buffer = Buffer.from(base64String, 'base64');
    const wavHeader = createWavHeader(buffer.length);
    return Buffer.concat([wavHeader, buffer]);
  } catch (error) {
    console.error('Error converting base64 to WAV buffer:', error);
    return null;
  }
}

function createWavHeader(dataLength: number): Buffer {
  const wavHeader = Buffer.alloc(44);
  
  // RIFF chunk descriptor
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + dataLength, 4);
  wavHeader.write('WAVE', 8);

  // Format chunk
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(1, 22);
  wavHeader.writeUInt32LE(44100, 24);
  wavHeader.writeUInt32LE(44100 * 2, 28);
  wavHeader.writeUInt16LE(2, 32);
  wavHeader.writeUInt16LE(16, 34);

  // Data chunk
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(dataLength, 40);

  return wavHeader;
}

async function sendBufferedAudio(audioBuffer: Buffer, openAIWs: WebSocket): Promise<void> {
  if (audioBuffer.length === 0) return;

//   try {
//     console.log(`Sending ${audioBuffer.length} bytes of buffered audio to OpenAI`);
//     const event = await audioToItemCreateEvent(audioBuffer);
//     openAIWs.send(JSON.stringify(event));
//     sendResponseCreateEvent(openAIWs);
//     console.log('Sent buffered audio data to OpenAI');
//   } catch (error) {
//     console.error('Error processing audio buffer:', error);
//   }
}

export {
  base64ToWavBuffer,
  createWavHeader,
  sendBufferedAudio
};

