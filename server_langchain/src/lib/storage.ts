// 파일 기반 세션 저장소
import fs from 'fs';
import path from 'path';

export interface SessionStorage {
  saveSession(sessionId: string, sessionData: SessionData): Promise<boolean>;
  loadSession(sessionId: string): Promise<SessionData | null>;
  loadAllSessions(): Promise<SessionData[]>;
  deleteSession(sessionId: string): Promise<boolean>;
  sessionExists(sessionId: string): Promise<boolean>;
}

export class FileSessionStorage implements SessionStorage {
  private storageDir: string;
  
  constructor(storageDir: string = './data/sessions') {
    this.storageDir = storageDir;
    this.ensureStorageDir();
  }
  
  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      console.log(`저장소 디렉토리 생성: ${this.storageDir}`);
    }
  }
  
  private getSessionFilePath(sessionId: string): string {
    return path.join(this.storageDir, `${sessionId}.json`);
  }
  
  async saveSession(sessionId: string, sessionData: SessionData): Promise<boolean> {
    try {
      const filePath = this.getSessionFilePath(sessionId);
      const jsonData = JSON.stringify(sessionData, null, 2);
      fs.writeFileSync(filePath, jsonData, 'utf8');
      console.log(`세션 저장 완료: ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`세션 저장 실패 (${sessionId}):`, error);
      return false;
    }
  }
  
  async loadSession(sessionId: string): Promise<SessionData | null> {
    try {
      const filePath = this.getSessionFilePath(sessionId);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const jsonData = fs.readFileSync(filePath, 'utf8');
      const sessionData = JSON.parse(jsonData) as SessionData;
      console.log(`세션 로드 완료: ${sessionId}`);
      return sessionData;
    } catch (error) {
      console.error(`세션 로드 실패 (${sessionId}):`, error);
      return null;
    }
  }
  
  async loadAllSessions(): Promise<SessionData[]> {
    try {
      const sessions: SessionData[] = [];
      
      if (!fs.existsSync(this.storageDir)) {
        return sessions;
      }
      
      const files = fs.readdirSync(this.storageDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionId = file.replace('.json', '');
          const sessionData = await this.loadSession(sessionId);
          if (sessionData) {
            sessions.push(sessionData);
          }
        }
      }
      
      console.log(`전체 세션 로드 완료: ${sessions.length}개`);
      return sessions;
    } catch (error) {
      console.error('전체 세션 로드 실패:', error);
      return [];
    }
  }
  
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const filePath = this.getSessionFilePath(sessionId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`세션 삭제 완료: ${sessionId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`세션 삭제 실패 (${sessionId}):`, error);
      return false;
    }
  }
  
  async sessionExists(sessionId: string): Promise<boolean> {
    const filePath = this.getSessionFilePath(sessionId);
    return fs.existsSync(filePath);
  }
  
  // 세션 백업 생성
  async createBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(this.storageDir, 'backups');
      
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const backupPath = path.join(backupDir, `sessions-backup-${timestamp}.json`);
      const sessions = await this.loadAllSessions();
      
      fs.writeFileSync(backupPath, JSON.stringify(sessions, null, 2), 'utf8');
      console.log(`백업 생성 완료: ${backupPath}`);
      
      return backupPath;
    } catch (error) {
      console.error('백업 생성 실패:', error);
      throw error;
    }
  }
  
  // 스토리 파일 저장
  async saveStoryFile(sessionId: string, storyData: any): Promise<string> {
    try {
      const storiesDir = path.join(this.storageDir, '..', 'stories');
      if (!fs.existsSync(storiesDir)) {
        fs.mkdirSync(storiesDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const storyFileName = `story_${sessionId}_${timestamp}.json`;
      const storyFilePath = path.join(storiesDir, storyFileName);
      
      const storyFileData = {
        sessionId,
        title: storyData.title || '무제',
        summary: storyData.summary || '',
        chapters: storyData.chapters || [],
        themes: storyData.themes || [],
        characters: storyData.characters || [],
        timeline: storyData.timeline || '',
        emotionalArc: storyData.emotionalArc || [],
        generatedAt: new Date().toISOString(),
        metadata: {
          totalChapters: storyData.chapters?.length || 0,
          totalWords: storyData.chapters?.reduce((sum: number, ch: any) => sum + (ch.wordCount || 0), 0) || 0
        }
      };
      
      fs.writeFileSync(storyFilePath, JSON.stringify(storyFileData, null, 2), 'utf8');
      console.log(`스토리 파일 저장 완료: ${storyFilePath}`);
      
      return storyFilePath;
    } catch (error) {
      console.error(`스토리 파일 저장 실패 (${sessionId}):`, error);
      throw error;
    }
  }
  
  // 저장소 통계
  async getStorageStats(): Promise<{
    totalSessions: number;
    totalSize: number;
    oldestSession?: string;
    newestSession?: string;
  }> {
    try {
      const sessions = await this.loadAllSessions();
      let totalSize = 0;
      let oldestTime = Infinity;
      let newestTime = 0;
      let oldestSession: string | undefined;
      let newestSession: string | undefined;
      
      for (const session of sessions) {
        const filePath = this.getSessionFilePath(session.sessionId);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
          
          const startTime = new Date(session.startTime).getTime();
          if (startTime < oldestTime) {
            oldestTime = startTime;
            oldestSession = session.sessionId;
          }
          if (startTime > newestTime) {
            newestTime = startTime;
            newestSession = session.sessionId;
          }
        }
      }
      
      return {
        totalSessions: sessions.length,
        totalSize,
        oldestSession,
        newestSession
      };
    } catch (error) {
      console.error('저장소 통계 생성 실패:', error);
      return {
        totalSessions: 0,
        totalSize: 0
      };
    }
  }
}

// 전역 저장소 인스턴스
export const sessionStorage = new FileSessionStorage();
