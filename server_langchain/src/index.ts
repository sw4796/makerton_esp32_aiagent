import "dotenv/config";
import { WebSocket } from "ws";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createNodeWebSocket } from "@hono/node-ws";
import { serveStatic } from "@hono/node-server/serve-static";

import { INSTRUCTIONS } from "./prompt";
import { TOOLS } from "./tools";
import { Tool } from "@langchain/core/tools";
import { createAsyncIterableFromWebSocket } from "./lib/utils";
import { OpenAIVoiceReactAgent } from "./lib/agent";
import { sessionManager, SessionData } from "./lib/session";
import { environmentalContextManager } from "./lib/environmental";
import { storyGenerationEngine } from "./lib/story";
import { sessionStorage } from "./lib/storage";

// 타입 정의
interface Context {
  req: {
    param: (key: string) => string;
    json: () => Promise<any>;
  };
  json: (data: any, status?: number) => Response;
}

interface WebSocketContext {
  raw: WebSocket;
}

const app = new Hono();
const WS_PORT = 8888;
const connectedClients = new Set<WebSocket>();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use("/", serveStatic({ path: "./static/test-client.html" }));
app.use("/static/*", serveStatic({ root: "./" }));
app.use("/test-client.html", serveStatic({ path: "./static/test-client.html" }));

// 세션 관리 API 엔드포인트
app.get("/api/sessions", (c: Context) => {
  const stats = sessionManager.getSessionStats();
  return c.json(stats);
});

app.get("/api/sessions/:sessionId", (c: Context) => {
  const sessionId = c.req.param("sessionId");
  const session = sessionManager.getSession(sessionId);
  
  if (!session) {
    return c.json({ error: "세션을 찾을 수 없습니다." }, 404);
  }
  
  return c.json(session);
});

app.post("/api/sessions", async (c: Context) => {
  const body = await c.req.json();
  const { userId, facilityId } = body || {};
  const session = await sessionManager.createSession(userId, facilityId);
  return c.json(session);
});

// 사용자 응답 추가 API
app.post("/api/sessions/:sessionId/responses", async (c: Context) => {
  const sessionId = c.req.param("sessionId");
  const body = await c.req.json();
  const { response, duration = 0 } = body;
  
  if (!response) {
    return c.json({ error: "응답 내용이 필요합니다." }, 400);
  }
  
  const success = await sessionManager.addResponse(sessionId, response, duration);
  
  if (!success) {
    return c.json({ error: "세션을 찾을 수 없습니다." }, 404);
  }
  
  return c.json({
    success: true,
    message: "응답이 성공적으로 저장되었습니다.",
    sessionId,
    timestamp: new Date().toISOString()
  });
});

// 센서 데이터 처리 API
app.post("/api/sensor-data", async (c: Context) => {
  const body = await c.req.json();
  const { temperature, humidity, lightLevel, sessionId } = body;
  
  if (!temperature || !humidity || !lightLevel) {
    return c.json({ error: "센서 데이터가 누락되었습니다." }, 400);
  }
  
  // 환경 컨텍스트 생성
  const context = environmentalContextManager.generateContext({
    temperature,
    humidity,
    lightLevel
  });
  
  // 세션에 센서 데이터 저장
  if (sessionId) {
    sessionManager.updateSensorData(sessionId, {
      temperature,
      humidity,
      lightLevel,
      timestamp: new Date().toISOString()
    });
  }
  
  // 오프닝 멘트 생성
  const openingMent = environmentalContextManager.generateOpeningMent(context);
  
  return c.json({
    success: true,
    context,
    openingMent,
    environmentalSummary: `${context.weatherData.description} ${context.timeContext.timeOfDay}의 ${context.mood.description} 분위기`
  });
});

// 환경 기반 질문 생성 API
app.post("/api/generate-question", async (c: Context) => {
  const body = await c.req.json();
  const { sessionId, previousResponse } = body;
  
  if (!sessionId) {
    return c.json({ error: "세션 ID가 필요합니다." }, 400);
  }
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return c.json({ error: "세션을 찾을 수 없습니다." }, 404);
  }
  
  // 세션의 센서 데이터를 사용하여 환경 컨텍스트 생성
  let context;
  if (session.sensorData) {
    context = environmentalContextManager.generateContext(session.sensorData);
  } else {
    // 기본 환경 컨텍스트 사용
    context = environmentalContextManager.generateContext({
      temperature: 22,
      humidity: 60,
      lightLevel: 500
    });
  }
  
  const question = environmentalContextManager.generateFollowUpQuestion(context, previousResponse);
  
  return c.json({
    success: true,
    question,
    context,
    timestamp: new Date().toISOString()
  });
});

// 스토리 생성 API
app.post("/api/generate-story", async (c: Context) => {
  const body = await c.req.json();
  const { sessionId } = body;
  
  if (!sessionId) {
    return c.json({ error: "세션 ID가 필요합니다." }, 400);
  }
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return c.json({ error: "세션을 찾을 수 없습니다." }, 404);
  }
  
  if (session.responses.length === 0) {
    return c.json({ error: "스토리 생성을 위한 응답이 없습니다." }, 400);
  }
  
  try {
    // 응답 데이터를 스토리 생성 엔진 형식으로 변환
    const responses = session.responses.map(response => ({
      transcript: response.transcript,
      timestamp: response.timestamp
    }));
    
    // AI 기반 스토리 내러티브 생성 (async)
    const narrative = await storyGenerationEngine.generateNarrative(sessionId, responses);
    
    // 세션에 스토리 데이터 저장
    await sessionManager.saveStoryData(sessionId, narrative);
    
    return c.json({
      success: true,
      narrative,
      message: "AI가 생성한 감동적인 스토리가 완성되었습니다.",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("스토리 생성 오류:", error);
    return c.json({ error: "스토리 생성 중 오류가 발생했습니다." }, 500);
  }
});

// 토픽 분석 API
app.post("/api/analyze-topics", async (c: Context) => {
  const body = await c.req.json();
  const { sessionId } = body;
  
  if (!sessionId) {
    return c.json({ error: "세션 ID가 필요합니다." }, 400);
  }
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return c.json({ error: "세션을 찾을 수 없습니다." }, 404);
  }
  
  if (session.responses.length === 0) {
    return c.json({ error: "분석할 응답이 없습니다." }, 400);
  }
  
  try {
    // 응답 데이터를 스토리 생성 엔진 형식으로 변환
    const responses = session.responses.map(response => ({
      transcript: response.transcript,
      timestamp: response.timestamp
    }));
    
    // 토픽과 등장인물 분석
    const topics = storyGenerationEngine.extractTopics(responses);
    const characters = storyGenerationEngine.extractCharacters(responses);
    
    return c.json({
      success: true,
      topics,
      characters,
      analysis: {
        totalTopics: topics.length,
        totalCharacters: characters.length,
        mainTheme: topics[0]?.name || "일상의 추억",
        totalResponses: session.responses.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("토픽 분석 오류:", error);
    return c.json({ error: "토픽 분석 중 오류가 발생했습니다." }, 500);
  }
});

// 스토리 다운로드 API (PDF/EPUB 생성)
app.get("/api/download-story/:sessionId", async (c: Context) => {
  const sessionId = c.req.param("sessionId");
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return c.json({ error: "세션을 찾을 수 없습니다." }, 404);
  }
  
  if (!session.storyGenerated) {
    return c.json({ error: "생성된 스토리가 없습니다." }, 400);
  }
  
  try {
    // 실제 구현에서는 PDF/EPUB 생성 로직 구현
    const mockDownloadData = {
      sessionId,
      fileName: `remedio_story_${sessionId}.pdf`,
      downloadUrl: `/downloads/story_${sessionId}.pdf`,
      format: 'PDF',
      size: '2.3MB',
      generatedAt: new Date().toISOString()
    };
    
    return c.json({
      success: true,
      download: mockDownloadData,
      message: "스토리 다운로드 준비가 완료되었습니다."
    });
  } catch (error) {
    console.error("스토리 다운로드 오류:", error);
    return c.json({ error: "스토리 다운로드 중 오류가 발생했습니다." }, 500);
  }
});

// 관리자 대시보드 API
app.get("/api/admin/dashboard", (c: Context) => {
  const stats = sessionManager.getSessionStats();
  const activeSessions = sessionManager.getActiveSessions();
  
  return c.json({
    success: true,
    stats,
    activeSessions: activeSessions.map(session => ({
      sessionId: session.sessionId,
      userId: session.userId,
      facilityId: session.facilityId,
      startTime: session.startTime,
      responseCount: session.responses.length,
      hasSensorData: !!session.sensorData,
      storyGenerated: session.storyGenerated
    })),
    timestamp: new Date().toISOString()
  });
});

// 시설별 통계 API
app.get("/api/admin/facility-stats/:facilityId", (c: Context) => {
  const facilityId = c.req.param("facilityId");
  const allSessions = Array.from(sessionManager['sessions'].values());
  const facilitySessions = allSessions.filter(session => session.facilityId === facilityId);
  
  const stats = {
    totalSessions: facilitySessions.length,
    completedSessions: facilitySessions.filter(s => s.isComplete).length,
    storyGeneratedSessions: facilitySessions.filter(s => s.storyGenerated).length,
    totalResponses: facilitySessions.reduce((sum, s) => sum + s.responses.length, 0),
    averageResponseCount: facilitySessions.length > 0 
      ? facilitySessions.reduce((sum, s) => sum + s.responses.length, 0) / facilitySessions.length 
      : 0
  };
  
  return c.json({
    success: true,
    facilityId,
    stats,
    sessions: facilitySessions.map(session => ({
      sessionId: session.sessionId,
      userId: session.userId,
      startTime: session.startTime,
      endTime: session.endTime,
      responseCount: session.responses.length,
      storyGenerated: session.storyGenerated
    })),
    timestamp: new Date().toISOString()
  });
});

// 세션 완료 API
app.post("/api/sessions/:sessionId/complete", async (c: Context) => {
  const sessionId = c.req.param("sessionId");
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return c.json({ error: "세션을 찾을 수 없습니다." }, 404);
  }
  
  const completedSession = sessionManager.completeSession(sessionId);
  
  return c.json({
    success: true,
    session: completedSession,
    message: "세션이 성공적으로 완료되었습니다.",
    timestamp: new Date().toISOString()
  });
});

// 세션 삭제 API
app.delete("/api/sessions/:sessionId", (c: Context) => {
  const sessionId = c.req.param("sessionId");
  
  const success = sessionManager.deleteSession(sessionId);
  
  if (!success) {
    return c.json({ error: "세션을 찾을 수 없습니다." }, 404);
  }
  
  return c.json({
    success: true,
    message: "세션이 성공적으로 삭제되었습니다.",
    timestamp: new Date().toISOString()
  });
});

// 저장소 관리 API
app.get("/api/storage/stats", async (c: Context) => {
  try {
    const stats = await sessionStorage.getStorageStats();
    return c.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("저장소 통계 조회 실패:", error);
    return c.json({ error: "저장소 통계 조회 실패" }, 500);
  }
});

app.post("/api/storage/backup", async (c: Context) => {
  try {
    const backupPath = await sessionStorage.createBackup();
    return c.json({
      success: true,
      backupPath,
      message: "백업이 성공적으로 생성되었습니다.",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("백업 생성 실패:", error);
    return c.json({ error: "백업 생성 실패" }, 500);
  }
});

app.get(
  "/device",
  upgradeWebSocket((c: Context) => ({
    onOpen: async (c: Context, ws: WebSocketContext) => {
      if (!process.env.OPENAI_API_KEY) {
        return ws.raw.close();
      }

      const rawWs = ws.raw;
      connectedClients.add(rawWs);

      // 새 세션 생성
      const session = await sessionManager.createSession();
      console.log(`새 RemeDio 세션 시작: ${session.sessionId}`);

      const broadcastToClients = (data: string) => {
        connectedClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            // console.log('Broadcasting to client:', data);
            // Convert base64 to buffer if data is a base64 string
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "response.audio.delta" && parsed.delta) {
                const audioBuffer = Buffer.from(parsed.delta, 'base64');
                // Send audio data in chunks that ESP32 can handle
                const CHUNK_SIZE = 1024; // ESP32 friendly chunk size
                for (let i = 0; i < audioBuffer.length; i += CHUNK_SIZE) {
                    const chunk = audioBuffer.slice(i, i + CHUNK_SIZE);
                    client.send(chunk);
                }
                return;
              }
            } catch (e) {
              // If parsing fails, send original data
            }
            // client.send(data);
            // client.send(data);
          }
        });
      };

      const agent = new OpenAIVoiceReactAgent({
        instructions: INSTRUCTIONS,
        tools: TOOLS as Tool[],
        model: "gpt-4o-realtime-preview",
        audioConfig: {
          sampleRate: 24000,  // Match ESP32 sample rate
          channels: 1,
          bitDepth: 16
        }
      });

      // Wait 100ms before connecting to allow WebSocket setup
      await new Promise(resolve => setTimeout(resolve, 1000));
      await agent.connect(rawWs, broadcastToClients);
    },
    onClose: (c: Context, ws: WebSocketContext) => {
      const rawWs = ws.raw;
      connectedClients.delete(rawWs);
      console.log("Client disconnected");
    },
  }))
);

const server = serve({
  fetch: app.fetch,
  port: WS_PORT,
});

injectWebSocket(server);

console.log(`RemeDio 서버가 포트 ${WS_PORT}에서 실행 중입니다.`);