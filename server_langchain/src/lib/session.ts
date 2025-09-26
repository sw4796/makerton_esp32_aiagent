// 세션 관리 시스템
import { sessionStorage, SessionStorage } from './storage';

export interface SessionData {
  sessionId: string;
  userId?: string;
  facilityId?: string;
  startTime: string;
  endTime?: string;
  responses: UserResponse[];
  sensorData?: SensorData;
  isComplete: boolean;
  storyGenerated?: boolean;
  storyData?: {
    narrative?: any;
    topics?: any[];
    characters?: any[];
    generatedAt?: string;
  };
}

export interface UserResponse {
  timestamp: string;
  transcript: string;
  topics?: string[];
  emotions?: string[];
  duration: number;
}

export interface SensorData {
  temperature: number;
  humidity: number;
  lightLevel: number;
  timestamp: string;
}

export class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private storage: SessionStorage;
  
  constructor(storage?: SessionStorage) {
    this.storage = storage || sessionStorage;
    this.loadAllSessionsFromStorage();
  }
  
  // 저장소에서 모든 세션 로드
  private async loadAllSessionsFromStorage(): Promise<void> {
    try {
      const sessions = await this.storage.loadAllSessions();
      for (const session of sessions) {
        this.sessions.set(session.sessionId, session);
      }
      console.log(`저장소에서 ${sessions.length}개 세션 로드 완료`);
    } catch (error) {
      console.error('저장소에서 세션 로드 실패:', error);
    }
  }
  
  // 새 세션 생성
  async createSession(userId?: string, facilityId?: string): Promise<SessionData> {
    const sessionId = this.generateSessionId();
    const session: SessionData = {
      sessionId,
      userId,
      facilityId,
      startTime: new Date().toISOString(),
      responses: [],
      isComplete: false
    };
    
    this.sessions.set(sessionId, session);
    
    // 파일에 저장
    await this.storage.saveSession(sessionId, session);
    
    console.log(`새 세션 생성: ${sessionId}`);
    return session;
  }
  
  // 세션에 응답 추가
  async addResponse(sessionId: string, transcript: string, duration: number = 0): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`세션을 찾을 수 없습니다: ${sessionId}`);
      return false;
    }
    
    const response: UserResponse = {
      timestamp: new Date().toISOString(),
      transcript,
      duration
    };
    
    session.responses.push(response);
    
    // 파일에 저장
    await this.storage.saveSession(sessionId, session);
    
    console.log(`세션 ${sessionId}에 응답 추가: ${transcript.substring(0, 50)}...`);
    return true;
  }
  
  // 센서 데이터 업데이트
  updateSensorData(sessionId: string, sensorData: SensorData): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`세션을 찾을 수 없습니다: ${sessionId}`);
      return false;
    }
    
    session.sensorData = sensorData;
    console.log(`세션 ${sessionId} 센서 데이터 업데이트`);
    return true;
  }
  
  // 세션 완료 처리
  completeSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`세션을 찾을 수 없습니다: ${sessionId}`);
      return null;
    }
    
    session.endTime = new Date().toISOString();
    session.isComplete = true;
    
    console.log(`세션 완료: ${sessionId}`);
    return session;
  }
  
  // 스토리 데이터 저장
  saveStoryData(sessionId: string, storyData: {
    narrative?: any;
    topics?: any[];
    characters?: any[];
  }): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`세션을 찾을 수 없습니다: ${sessionId}`);
      return false;
    }
    
    session.storyData = {
      ...storyData,
      generatedAt: new Date().toISOString()
    };
    session.storyGenerated = true;
    
    console.log(`세션 ${sessionId}에 스토리 데이터 저장 완료`);
    return true;
  }
  
  // 세션 통계 (업데이트됨)
  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    storyGeneratedSessions: number;
    averageResponseCount: number;
    averageSessionDuration: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const completedSessions = sessions.filter(s => s.isComplete);
    const storyGeneratedSessions = sessions.filter(s => s.storyGenerated);
    
    const totalResponses = sessions.reduce((sum, s) => sum + s.responses.length, 0);
    const averageResponseCount = sessions.length > 0 ? totalResponses / sessions.length : 0;
    
    // 평균 세션 시간 계산
    const sessionsWithDuration = completedSessions.filter(s => s.endTime);
    const totalDuration = sessionsWithDuration.reduce((sum, s) => {
      const start = new Date(s.startTime).getTime();
      const end = new Date(s.endTime!).getTime();
      return sum + (end - start);
    }, 0);
    const averageSessionDuration = sessionsWithDuration.length > 0 
      ? totalDuration / sessionsWithDuration.length / (1000 * 60) // 분 단위
      : 0;
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.length - completedSessions.length,
      completedSessions: completedSessions.length,
      storyGeneratedSessions: storyGeneratedSessions.length,
      averageResponseCount: Math.round(averageResponseCount * 100) / 100,
      averageSessionDuration: Math.round(averageSessionDuration * 100) / 100
    };
  }
  
  // 세션 조회
  getSession(sessionId: string): SessionData | null {
    return this.sessions.get(sessionId) || null;
  }
  
  // 활성 세션 목록 조회
  getActiveSessions(): SessionData[] {
    return Array.from(this.sessions.values()).filter(session => !session.isComplete);
  }
  
  // 세션 삭제
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
  
  // 세션 ID 생성
  private generateSessionId(): string {
    return `remedio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // 스토리 데이터 저장
  async saveStoryData(sessionId: string, storyData: any): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`세션을 찾을 수 없습니다: ${sessionId}`);
      return false;
    }

    try {
      session.storyData = {
        narrative: storyData,
        generatedAt: new Date().toISOString()
      };
      session.storyGenerated = true;
      
      // 세션 데이터 저장
      await this.storage.saveSession(sessionId, session);
      
      // 별도 스토리 파일로도 저장
      try {
        const storyFilePath = await (this.storage as any).saveStoryFile(sessionId, storyData);
        console.log(`스토리 파일 저장 완료: ${storyFilePath}`);
      } catch (storyFileError) {
        console.warn(`스토리 파일 저장 실패 (계속 진행):`, storyFileError);
      }
      
      console.log(`스토리 데이터 저장 완료: ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`스토리 데이터 저장 실패 (${sessionId}):`, error);
      return false;
    }
  }
}

// 전역 세션 매니저 인스턴스
export const sessionManager = new SessionManager();
