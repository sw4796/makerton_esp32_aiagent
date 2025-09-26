import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { environmentalContextManager, EnvironmentalContext } from "./lib/environmental";
import { storyGenerationEngine, StoryNarrative } from "./lib/story";

// 환경 센서 데이터 처리 도구 (업데이트됨)
const processSensorData = tool(
  async (input: any) => {
    const { temperature, humidity, lightLevel, timeOfDay, weather } = input;
    // 환경 컨텍스트 매니저를 사용하여 종합적인 분석 수행
    const context = environmentalContextManager.generateContext({
      temperature,
      humidity,
      lightLevel
    });
    
    // 오프닝 멘트와 후속 질문 생성
    const openingMent = environmentalContextManager.generateOpeningMent(context);
    const followUpQuestion = environmentalContextManager.generateFollowUpQuestion(context);
    
    return {
      context,
      mood: context.mood,
      openingMent,
      followUpQuestion,
      environmentalSummary: `${context.weatherData.description} ${context.timeContext.timeOfDay}의 ${context.mood.description} 분위기`
    };
  },
  {
    name: "processSensorData",
    description: "환경 센서 데이터를 종합적으로 분석하여 대화 컨텍스트와 오프닝 멘트를 생성합니다.",
    schema: z.object({
      temperature: z.number().describe("온도 (섭씨)"),
      humidity: z.number().describe("습도 (%)"),
      lightLevel: z.number().describe("조도 (lux)"),
      timeOfDay: z.string().describe("시간대 (오전/오후/저녁)"),
      weather: z.string().describe("날씨 상태")
    }),
  }
);

// 환경 기반 후속 질문 생성 도구
const generateContextualQuestion = tool(
  async (input: any) => {
    const { sessionId, previousResponse } = input;
    // 세션에서 환경 컨텍스트 가져오기 (실제 구현에서는 세션 매니저에서 가져옴)
    const mockContext = {
      sensorData: { temperature: 22, humidity: 60, lightLevel: 500, timestamp: new Date().toISOString() },
      weatherData: { temperature: 22, humidity: 60, description: "따뜻한", location: "현재 공간" },
      timeContext: { timeOfDay: "오후" as const, hour: 14, greeting: "좋은 오후", season: "가을" },
      mood: { primary: "따뜻한", secondary: "편안한", description: "따뜻하고 편안한" }
    };
    
    const question = environmentalContextManager.generateFollowUpQuestion(mockContext, previousResponse);
    
    return {
      question,
      context: mockContext,
      timestamp: new Date().toISOString()
    };
  },
  {
    name: "generateContextualQuestion",
    description: "이전 응답과 환경 컨텍스트를 기반으로 자연스러운 후속 질문을 생성합니다.",
    schema: z.object({
      sessionId: z.string().describe("세션 ID"),
      previousResponse: z.string().optional().describe("이전 사용자 응답")
    }),
  }
);

// 사용자 응답 저장 도구
const saveUserResponse = tool(
  async (input: any) => {
    const { sessionId, response, timestamp } = input;
    // 실제 구현에서는 데이터베이스에 저장
    console.log(`세션 ${sessionId}에 응답 저장:`, response);
    return {
      success: true,
      message: "응답이 성공적으로 저장되었습니다.",
      sessionId,
      timestamp
    };
  },
  {
    name: "saveUserResponse",
    description: "사용자의 응답을 세션에 저장합니다.",
    schema: z.object({
      sessionId: z.string().describe("세션 ID"),
      response: z.string().describe("사용자 응답 텍스트"),
      timestamp: z.string().describe("응답 시간")
    }),
  }
);

// 세션 상태 확인 도구
const checkSessionStatus = tool(
  async (input: any) => {
    const { sessionId } = input;
    // 실제 구현에서는 데이터베이스에서 세션 상태 확인
    const mockSessionData = {
      sessionId,
      startTime: new Date().toISOString(),
      responses: [],
      isComplete: false,
      estimatedDuration: 15 // 분
    };
    
    return mockSessionData;
  },
  {
    name: "checkSessionStatus",
    description: "현재 세션의 상태를 확인합니다.",
    schema: z.object({
      sessionId: z.string().describe("세션 ID")
    }),
  }
);

// 스토리 생성 도구
const generateStory = tool(
  async (input: any) => {
    const { sessionId } = input;
    // 실제 구현에서는 세션 매니저에서 응답 데이터 가져오기
    const mockResponses = [
      { transcript: "어릴 때 할머니와 함께 시장에 갔었어요. 정말 즐거웠어요.", timestamp: new Date().toISOString() },
      { transcript: "할머니가 사주신 과자를 먹으며 집에 돌아왔어요.", timestamp: new Date().toISOString() }
    ];
    
    const narrative = await storyGenerationEngine.generateNarrative(sessionId, mockResponses);
    
    return {
      success: true,
      narrative,
      message: "스토리가 성공적으로 생성되었습니다.",
      timestamp: new Date().toISOString()
    };
  },
  {
    name: "generateStory",
    description: "사용자의 응답들을 기반으로 개인화된 스토리 내러티브를 생성합니다.",
    schema: z.object({
      sessionId: z.string().describe("세션 ID")
    }),
  }
);

// 토픽 분석 도구
const analyzeTopics = tool(
  async (input: any) => {
    const { sessionId } = input;
    // 실제 구현에서는 세션 매니저에서 응답 데이터 가져오기
    const mockResponses = [
      { transcript: "어릴 때 할머니와 함께 시장에 갔었어요.", timestamp: new Date().toISOString() },
      { transcript: "학교에서 친구들과 놀았어요.", timestamp: new Date().toISOString() }
    ];
    
    const topics = storyGenerationEngine.extractTopics(mockResponses);
    const characters = storyGenerationEngine.extractCharacters(mockResponses);
    
    return {
      success: true,
      topics,
      characters,
      analysis: {
        totalTopics: topics.length,
        totalCharacters: characters.length,
        mainTheme: topics[0]?.name || "일상의 추억"
      },
      timestamp: new Date().toISOString()
    };
  },
  {
    name: "analyzeTopics",
    description: "사용자의 응답을 분석하여 주요 토픽과 등장인물을 추출합니다.",
    schema: z.object({
      sessionId: z.string().describe("세션 ID")
    }),
  }
);

export const TOOLS = [processSensorData, generateContextualQuestion, saveUserResponse, checkSessionStatus, generateStory, analyzeTopics];
