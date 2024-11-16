import { Tool, StructuredTool } from "@langchain/core/tools";
import path from "path";
import zodToJsonSchema from "zod-to-json-schema";
import { AudioManager } from "./audio";
import { createStreamFromWebsocket, base64EncodeAudio, mergeStreams, appendToBuffer, convertAudioToPCM16 } from "./utils";
import fs from 'fs';
import decodeAudio from 'audio-decode';
import WebSocket from "ws";
import { OpenAIWebSocketConnection } from "./connections";
import { VoiceToolExecutor } from "./executor";

const EVENTS_TO_IGNORE = [
    "response.function_call_arguments.delta",
    "rate_limits.updated",
    "response.audio_transcript.delta",
    "response.created",
    "response.content_part.added",
    "response.content_part.done",
    "conversation.item.created",
    "response.audio.done",
    "session.created",
    "session.updated",
    "response.done",
    "response.output_item.done",
  ];
  
  export interface AudioConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
  }
 export interface AudioHandler {
    buffer: Uint8Array;
    BUFFER_SIZE: number;
    ws: WebSocket;
  }
  export interface OpenAIVoiceReactAgentOptions {
    model: string;
    apiKey?: string;
    instructions?: string;
    tools?: Tool[];
    url?: string;
    audioConfig?: AudioConfig;
  }
  

  
export class OpenAIVoiceReactAgent {
    protected connection: OpenAIWebSocketConnection;
    protected instructions?: string;
    protected tools: Tool[];
    protected BUFFER_SIZE = 4800;
    public buffer = new Uint8Array();
  
    public audioBuffer: Buffer | undefined;
    private audioManager = new AudioManager();
  
    private recording: boolean = false;
    constructor(params: OpenAIVoiceReactAgentOptions) {
      this.connection = new OpenAIWebSocketConnection({
        url: params.url,
        apiKey: params.apiKey,
        model: params.model,
        audioConfig: params.audioConfig,
        audioManager: this.audioManager
      });
      this.instructions = params.instructions;
      this.tools = params.tools ?? [];
    }
  
    // private audioManager: AudioManager;
  
    public startRecordingSession(): void {
      this.recording = true;
      this.audioManager.startRecording();
    }
    public async stopRecordingAndProcessAudio() {
        this.audioManager.closeFile();
        this.recording = false; // This line was commented out but should be enabled
        
        const buffer = this.audioManager.getCurrentBuffer();
        const base64 = convertAudioToPCM16(buffer);
      
        const eventAudio = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{
              type: 'input_audio',
              audio: base64
            }]
          }
        };
        
        this.connection.sendEvent(eventAudio);
        
        // Clear/reset the audio buffer after sending
        // this.audioManager.closeFile(); // Add this method to AudioManager
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.connection.sendEvent({
          type: 'response.create'
        });
      }
      
  /*
    public processMicData(data: ArrayBuffer) {
      const buffer = Buffer.from(data);
      this.audioManager.handleAudioBuffer(buffer);
      console.log('Received audio data:', {
        byteLength: buffer.byteLength,
        bufferType: buffer.constructor.name,
        firstFewBytes: buffer.slice(0, 4),
        lastFewBytes: buffer.slice(-4),
        isBuffer: Buffer.isBuffer(buffer)
      });
      this.audioBuffer = this.audioBuffer || Buffer.alloc(0);
      this.audioBuffer = Buffer.concat([this.audioBuffer, Buffer.from(data)]);
  
      // Test record buffer length
      if (this.audioBuffer.length > 0) {
        console.log('Current audio buffer length:', this.audioBuffer.length);
      }
      const BUFFER_SIZE = 3200; // Match client-side buffer size
  
      if (this.audioBuffer.length >= BUFFER_SIZE) {
        // Send buffered chunk and reset
        const chunk = this.audioBuffer.subarray(0, BUFFER_SIZE);
        const base64 = convertAudioToPCM16(chunk);
        // const base64Chunk = Buffer.from(chunk).toString('base64');
        this.connection.sendEvent({
          type: 'input_audio_buffer.append',
          audio: base64
        });
  
  
        this.connection.sendEvent({
          type: 'input_audio_buffer.commit'
        });
  
        // Keep remaining data
        this.audioBuffer = this.audioBuffer.subarray(BUFFER_SIZE);
      }
    }
  */
    /**
     * Connect to the OpenAI API and send and receive messages.
     * @param websocketOrStream WebSocket connection or AsyncGenerator for audio input
     * @param sendOutputChunk Callback function to send audio output chunks
     */
    async connect(
      websocketOrStream: AsyncGenerator<string> | WebSocket,
      sendOutputChunk: (chunk: string) => void | Promise<void>
    ) {
      let inputStream;
      let isRtWsOpened = false;
      console.log('Attempting to establish WebSocket connection...');
      // Wait for WebSocket to be opened if it's a WebSocket connection
      if (websocketOrStream instanceof WebSocket) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("WebSocket connection timed out after 10 seconds"));
          }, 10000);
  
          if (websocketOrStream.readyState === WebSocket.OPEN) {
            clearTimeout(timeout);
            resolve();
          } else {
            websocketOrStream.once("connect", () => {
              clearTimeout(timeout);
              isRtWsOpened = true;
              resolve();
            });
  
            websocketOrStream.once("error", (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          }
        });
      }
      // if(!isRtWsOpened){
      //   console.log('WebSocket connection not established');
      //   // return;
      // }
      console.log('WebSocket connection established successfully');
  
      if ("next" in websocketOrStream) {
        inputStream = websocketOrStream;
        console.log('Using AsyncGenerator input stream');
      } else {
        // Configure WebSocket for binary data
        websocketOrStream.binaryType = 'arraybuffer';
  
        // Create input stream that handles both text and binary messages
        inputStream = createStreamFromWebsocket(websocketOrStream);
  
        // Add binary message handler for ESP32 audio data
        websocketOrStream.on('message', async (data) => {
          // Log message details
          console.log('WebSocket message received:', {
            isBuffer: data instanceof Buffer,
            isArrayBuffer: data instanceof ArrayBuffer,
            type: typeof data,
            // length: data?.length || undefined,
            constructor: data?.constructor?.name
          });
          if (data instanceof Buffer || data instanceof ArrayBuffer) {
            // Log incoming binary data details
            const buffer = data instanceof ArrayBuffer ? Buffer.from(data) : data;
            console.log('Received binary data:', {
              length: buffer.length,
              type: data instanceof Buffer ? 'Buffer' : 'ArrayBuffer',
              firstBytes: buffer.slice(0, 4),
              lastBytes: buffer.slice(-4)
            });
            await this.connection.handleIncomingAudio(buffer);
          }
        });
      }
  
      const toolsByName = this.tools.reduce(
        (toolsByName: Record<string, StructuredTool>, tool) => {
          toolsByName[tool.name] = tool;
          return toolsByName;
        },
        {}
      );
  
      const toolExecutor = new VoiceToolExecutor(toolsByName);
      await this.connection.connect();
      const modelReceiveStream = this.connection.eventStream();
      const files = [
        "../../test-how.mp3"
        // "../../male.wav"
        // "../../recording-test.wav"
      ];
      async function audioToItemCreateEvent(audioFile: Buffer) {
        const base64str = audioFile.toString('base64');
        const audioBuffer = await decodeAudio(audioFile);
        // Realtime API only acceps mono, get one channel only
        const channelData = audioBuffer.getChannelData(0);
        const base64AudioData = base64EncodeAudio(channelData);
        return {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{
              type: 'input_audio',
              audio: base64AudioData
            }]
          }
        };
      }
  
      const handleAudioData = (data: ArrayBuffer, handler: AudioHandler): void => {
        const uint8Array = new Uint8Array(data);
        appendToBuffer(uint8Array, handler);
  
        if (handler.buffer.length >= handler.BUFFER_SIZE) {
          const toSend = new Uint8Array(handler.buffer.slice(0, handler.BUFFER_SIZE));
          handler.buffer = new Uint8Array(handler.buffer.slice(handler.BUFFER_SIZE));
  
          const regularArray = String.fromCharCode(...toSend);
          const base64 = btoa(regularArray);
          this.connection.sendEvent({
            type: 'input_audio_buffer.append',
            audio: base64
          });
          // handler.ws.send(JSON.stringify({type: 'input_audio_buffer.append', audio: base64}));
        }
      };
      // Send tools and instructions with initial chunk
      const toolDefs = Object.values(toolsByName).map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.schema),
      }));
  
      this.connection.sendEvent({
        type: "session.update",
        session: {
          instructions: this.instructions,
          input_audio_transcription: {
            model: "whisper-1",
          },
          tools: toolDefs,
          "input_audio_format": "pcm16",
          "output_audio_format": "pcm16",
        },
      });
      // message: "Invalid 'item.content[0].audio'. Expected base64-encoded audio bytes (mono PCM16 at 24kHz) but got an invalid value.",
      const audioFile = fs.readFileSync(path.join(__dirname, "../../recording-test.wav"));
      // const audioFile = fs.readFileSync(path.join(__dirname, "../../test-how.mp3"));
      const eventAudio1 = await audioToItemCreateEvent(audioFile);
      const eventAudio2 = await audioToItemCreateEvent(audioFile);
  
  
  
      const base64 = convertAudioToPCM16(audioFile);
  
      const eventAudio = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_audio',
              audio: base64
            }
          ]
        }
      };
      const eventText = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Hello, my name is Jeremy. WHat is my name ?'
            }
          ]
        }
      };
  
      // this.connection.sendEvent(eventText);
      // this.connection.sendEvent(eventAudio);
      // await new Promise(resolve => setTimeout(resolve, 2000));
  
      // this.connection.sendEvent({
      //   type: 'response.create'
      // });
      for await (const [streamKey, dataRaw] of mergeStreams({
        input_mic: inputStream,
        output_speaker: modelReceiveStream,
        tool_outputs: toolExecutor.outputIterator(),
      })) {
        let data: any;
        try {
          data = typeof dataRaw === "string" ? dataRaw : dataRaw;
          // data = typeof dataRaw === "string" ? JSON.parse(dataRaw) : dataRaw;
        } catch (error) {
          console.error("Error decoding data:", dataRaw);
          continue;
        }
        // console.log('Stream key:', streamKey);
        // console.log('Data:', data?.transcript);
        // continue;
        if (data === "START_RECORD") {
          console.log('Received START_RECORD event');
          this.startRecordingSession()
          // this.connection.sendEvent({
          //   type: 'input_audio_buffer.commit'
          // });
          // this.connection.sendEvent({
          //   type: 'response.create'
          // });
          try {
            // const audioFile = fs.readFileSync(path.join(__dirname, "../../test-how.mp3"));
            // const event = await audioToItemCreateEvent(audioFile);
            // this.connection.sendEvent(event);
            // this.connection.sendEvent({
            //   type: 'input_audio_buffer.commit'
            // });
            // Wait 1 second before committing buffer
            // await new Promise(resolve => setTimeout(resolve, 2000));
  
            // this.connection.sendEvent({
            //   type: 'response.create'
            // });
  
            /*
                      for (const filename of files) {
                        const audioFile = fs.readFileSync(path.join(__dirname, filename));
                        console.log('Reading audio file:', filename);
                        console.log('Audio file size:', audioFile.length, 'bytes');
                        console.log('Audio file size:', audioFile.buffer, 'bytes');
            
                        const audioBuffer = await decodeAudio(audioFile);
                        const channelData = audioBuffer.getChannelData(0);
                        const base64Chunk = base64EncodeAudio(channelData);
                        // const pBuffer = processAudioBuffer(audioFile);
                        const base64ChunkF = Buffer.from(audioFile).toString('base64');
                        // Copy base64 audio chunk to clipboard
                        try {
                         
                          clipboardy.writeSync(base64ChunkF);
                          console.log('Base64 audio chunk copied to clipboard');
                        } catch (error) {
                          console.error('Error copying to clipboard:', error);
                        }
                        const event = {
                          type: 'conversation.item.create',
                          item: {
                            type: 'message',
                            role: 'user',
                            content: [
                              {
                                type: 'input_audio',
                                audio: base64ChunkF
                              }
                            ]
                          }
                        };
                         this.connection.sendEvent(event);
                        // Send audio data in chunks
                        // const CHUNK_SIZE = 4800; // Match client-side buffer size
                        // for (let i = 0; i < channelData.length; i += CHUNK_SIZE) {
                        //     const chunk = channelData.slice(i, i + CHUNK_SIZE);
                        //     const base64Chunk = base64EncodeAudio(chunk);
                        //     this.connection.sendEvent({
                        //         type: 'input_audio_buffer.append', 
                        //         audio: base64Chunk
                        //     });
                        // }
                        // this.connection.sendEvent({
                        //   type: 'input_audio_buffer.append',
                        //   audio: base64Chunk
                        // });
                        // handleAudioData()
                        // this.connection.handleIncomingAudio(audioFile.buffer);
                        // const base64Chunk = Buffer.from(audioFile).toString('base64');
                        // this.connection.sendEvent({
                        //   type: 'input_audio_buffer.append',
                        //   audio: base64Chunk
                        // });
                      }
                      */
          } catch (error) {
            console.error('Error processing audio files:', error);
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        // continue;
        if (data === "STOP_RECORD") {
          console.log('Received STOP_RECORD signal');
          // await new Promise(resolve => setTimeout(resolve, 2000));
          await this.stopRecordingAndProcessAudio()
  
  
        //   const buffer = this.audioManager.getCurrentBuffer();
        //   const base64Chunk = Buffer.from(buffer).toString('base64');
        //   // this.connection.sendEvent({
        //   //   type: 'input_audio_buffer.append',
        //   //   audio: base64Chunk
        //   // });
        //   // this.connection.sendEvent({
        //   //   type: 'input_audio_buffer.commit'
        //   // });
  
        //   const base64 = convertAudioToPCM16(buffer);
  
        //   const eventAudioE = {
        //     type: 'conversation.item.create',
        //     item: {
        //       type: 'message',
        //       role: 'user',
        //       content: [
        //         {
        //           type: 'input_audio',
        //           audio: base64
        //         }
        //       ]
        //     }
        //   };
        //   // // Wait 1 second before committing buffer
        //   // await new Promise(resolve => setTimeout(resolve, 2000));
          
        //   this.connection.sendEvent(eventAudioE);
          
        //   await new Promise(resolve => setTimeout(resolve, 2000));
        //   this.connection.sendEvent({
        //     type: 'response.create'
        //   });
  
        //   continue;
  
        }
  
        if (streamKey === "input_mic") {
          // const base64Chunk = Buffer.from(data).toString('base64');
          // Append to buffer until we reach target size
          // Log buffer info
          console.log("Processing microphone input data:", {
            dataType: typeof data,
            dataLength: data.length,
            isArrayBuffer: data instanceof ArrayBuffer,
            bufferState: {
              current: this.audioBuffer ? this.audioBuffer.length : 0,
              target: this.BUFFER_SIZE
            }
          });
        //   continue;
  
          // this.connection.sendEvent(data);
  
        } else if (streamKey === "tool_outputs") {
          console.log("tool output", data);
          this.connection.sendEvent(data);
          this.connection.sendEvent({ type: "response.create", response: {} });
        } else if (streamKey === "output_speaker") {
          const { type } = data;
          if (type === "response.audio.delta") {
            sendOutputChunk(JSON.stringify(data));
          } else if (type === "response.audio_buffer.speech_started") {
            console.log("interrupt");
            sendOutputChunk(JSON.stringify(data));
          } else if (type === "error") {
            console.error("error:", data);
          } else if (type === "response.function_call_arguments.done") {
            console.log("tool call", data);
            toolExecutor.addToolCall(data);
          } else if (type === "response.audio_transcript.done") {
            console.log("model:", data.transcript);
          } else if (
            type === "conversation.item.input_audio_transcription.completed"
          ) {
            console.log("user:", data.transcript);
          } else if (!EVENTS_TO_IGNORE.includes(type)) {
            console.log(type);
          }
        }
      }
    }
  }
  