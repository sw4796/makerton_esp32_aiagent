import { WebSocket } from 'ws';
import * as wav from 'wav';
import { Writable } from 'stream';
import * as fs from 'fs';

interface AudioConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
}

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
    private fileWriter: wav.FileWriter;

    private config = this.configLowDef;
    constructor() {
        // Create WAV file writer
        this.fileWriter = new wav.FileWriter('recording.wav', {
            sampleRate: this.config.sampleRate,
            channels: this.config.channels,
            bitDepth: this.config.bitDepth
        });
    }

    public handleAudioBuffer(buffer: Buffer, ws?: WebSocket): void {
        try {
            // Convert the incoming buffer to 16-bit PCM samples
            const samples = new Int16Array(buffer.length / 2);
            for (let i = 0; i < buffer.length; i += 2) {
                // Properly read 16-bit samples considering endianness
                samples[i / 2] = buffer.readInt16LE(i);
            }
    
            // Apply a simple noise gate (optional)
            const noiseThreshold = 100; // Adjust this value based on your needs
            for (let i = 0; i < samples.length; i++) {
                if (Math.abs(samples[i]) < noiseThreshold) {
                    samples[i] = 0;
                }
            }
    
            // Write the processed audio data
            this.fileWriter.write(Buffer.from(samples.buffer));
            
            console.log(`Processed audio buffer: ${buffer.length} bytes, ${samples.length} samples`);
        } catch (error) {
            console.error('Error processing audio buffer:', error);
        }
    }

    public closeFile(): void {
        console.log('Closing WAV file writer');
        if (this.fileWriter) {
            this.fileWriter.end();
        }
    }
}
