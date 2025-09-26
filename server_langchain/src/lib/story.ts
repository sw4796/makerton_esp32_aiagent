// 스토리 생성 엔진
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface StoryTopic {
  id: string;
  name: string;
  keywords: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

export interface StoryCharacter {
  name: string;
  role: string;
  description: string;
  relationships: string[];
}

export interface StoryScene {
  id: string;
  setting: string;
  time: string;
  characters: StoryCharacter[];
  events: string[];
  emotions: string[];
  significance: string;
}

export interface StoryNarrative {
  id: string;
  title: string;
  summary: string;
  chapters: StoryChapter[];
  themes: string[];
  characters: StoryCharacter[];
  timeline: string;
  emotionalArc: string[];
}

export interface StoryChapter {
  id: string;
  title: string;
  content: string;
  scene: StoryScene;
  wordCount: number;
  order: number;
}

export class StoryGenerationEngine {
  
  // 사용자 응답들을 분석하여 토픽 추출
  extractTopics(responses: Array<{ transcript: string; timestamp: string }>): StoryTopic[] {
    const topics: StoryTopic[] = [];
    const keywordMap = new Map<string, number>();
    
    responses.forEach(response => {
      const words = response.transcript.toLowerCase().split(/\s+/);
      
      // 키워드 빈도 계산 (간단한 구현)
      words.forEach(word => {
        if (word.length > 2) { // 2글자 이상만 고려
          keywordMap.set(word, (keywordMap.get(word) || 0) + 1);
        }
      });
    });
    
    // 상위 키워드들을 토픽으로 변환
    const sortedKeywords = Array.from(keywordMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    sortedKeywords.forEach(([keyword, count], index) => {
      topics.push({
        id: `topic_${index}`,
        name: keyword,
        keywords: [keyword],
        sentiment: this.analyzeSentiment(keyword),
        confidence: Math.min(count / responses.length, 1)
      });
    });
    
    return topics;
  }
  
  // 감정 분석 (간단한 구현)
  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['좋은', '행복한', '즐거운', '사랑', '기쁜', '웃음', '따뜻한'];
    const negativeWords = ['슬픈', '힘든', '어려운', '아픈', '우울한', '걱정', '두려운'];
    
    const lowerText = text.toLowerCase();
    
    if (positiveWords.some(word => lowerText.includes(word))) {
      return 'positive';
    } else if (negativeWords.some(word => lowerText.includes(word))) {
      return 'negative';
    }
    
    return 'neutral';
  }
  
  // 등장인물 추출
  extractCharacters(responses: Array<{ transcript: string; timestamp: string }>): StoryCharacter[] {
    const characters: StoryCharacter[] = [];
    const namePattern = /[가-힣]{2,4}(?:씨|님|아버지|어머니|할머니|할아버지|형|누나|언니|동생)/g;
    
    responses.forEach(response => {
      const matches = response.transcript.match(namePattern);
      if (matches) {
        matches.forEach(name => {
          if (!characters.find(c => c.name === name)) {
            characters.push({
              name,
              role: this.inferRole(name),
              description: `${name}과의 소중한 추억`,
              relationships: []
            });
          }
        });
      }
    });
    
    return characters;
  }
  
  // 역할 추론
  private inferRole(name: string): string {
    if (name.includes('할머니') || name.includes('할아버지')) return '가족';
    if (name.includes('아버지') || name.includes('어머니')) return '부모';
    if (name.includes('형') || name.includes('누나') || name.includes('언니') || name.includes('동생')) return '형제자매';
    if (name.includes('씨') || name.includes('님')) return '지인';
    return '기타';
  }
  
  // 장면 구성
  createScenes(responses: Array<{ transcript: string; timestamp: string }>, topics: StoryTopic[]): StoryScene[] {
    const scenes: StoryScene[] = [];
    
    // 응답을 시간순으로 그룹화
    const groupedResponses = this.groupResponsesByTime(responses);
    
    groupedResponses.forEach((group, index) => {
      const scene: StoryScene = {
        id: `scene_${index}`,
        setting: this.inferSetting(group.transcripts.join(' ')),
        time: group.timeRange,
        characters: this.extractCharacters(group.responses),
        events: this.extractEvents(group.transcripts),
        emotions: this.extractEmotions(group.transcripts),
        significance: this.assessSignificance(group.transcripts)
      };
      
      scenes.push(scene);
    });
    
    return scenes;
  }
  
  // 시간별 응답 그룹화
  private groupResponsesByTime(responses: Array<{ transcript: string; timestamp: string }>) {
    const groups: Array<{
      responses: Array<{ transcript: string; timestamp: string }>;
      transcripts: string[];
      timeRange: string;
    }> = [];
    
    let currentGroup: typeof groups[0] = {
      responses: [],
      transcripts: [],
      timeRange: ''
    };
    
    responses.forEach(response => {
      const responseTime = new Date(response.timestamp);
      
      if (currentGroup.responses.length === 0) {
        currentGroup.responses.push(response);
        currentGroup.transcripts.push(response.transcript);
        currentGroup.timeRange = responseTime.toLocaleTimeString();
      } else {
        const lastTime = new Date(currentGroup.responses[currentGroup.responses.length - 1].timestamp);
        const timeDiff = responseTime.getTime() - lastTime.getTime();
        
        // 5분 이내면 같은 그룹으로
        if (timeDiff < 5 * 60 * 1000) {
          currentGroup.responses.push(response);
          currentGroup.transcripts.push(response.transcript);
        } else {
          // 새로운 그룹 시작
          groups.push(currentGroup);
          currentGroup = {
            responses: [response],
            transcripts: [response.transcript],
            timeRange: responseTime.toLocaleTimeString()
          };
        }
      }
    });
    
    if (currentGroup.responses.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }
  
  // 장소 추론
  private inferSetting(text: string): string {
    const placeKeywords = {
      '집': ['집', '방', '거실', '부엌', '마당'],
      '학교': ['학교', '교실', '운동장', '도서관'],
      '시장': ['시장', '가게', '상점', '마트'],
      '놀이터': ['놀이터', '공원', '산', '강'],
      '교회': ['교회', '절', '성당']
    };
    
    for (const [place, keywords] of Object.entries(placeKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return place;
      }
    }
    
    return '기억 속의 장소';
  }
  
  // 사건 추출
  private extractEvents(transcripts: string[]): string[] {
    const events: string[] = [];
    const eventKeywords = ['했어', '했었어', '갔어', '왔어', '만났어', '놀았어', '일했어'];
    
    transcripts.forEach(transcript => {
      eventKeywords.forEach(keyword => {
        if (transcript.includes(keyword)) {
          // 간단한 사건 추출
          const sentences = transcript.split(/[.!?]/);
          sentences.forEach(sentence => {
            if (sentence.includes(keyword) && sentence.length > 10) {
              events.push(sentence.trim());
            }
          });
        }
      });
    });
    
    return events.slice(0, 5); // 최대 5개 사건
  }
  
  // 감정 추출
  private extractEmotions(transcripts: string[]): string[] {
    const emotions: string[] = [];
    const emotionKeywords = {
      '기쁨': ['기뻤어', '즐거웠어', '행복했어', '웃었어'],
      '슬픔': ['슬펐어', '울었어', '힘들었어'],
      '사랑': ['사랑했어', '좋아했어', '따뜻했어'],
      '그리움': ['그리웠어', '보고 싶었어', '생각났어'],
      '감사': ['고마웠어', '감사했어', '은혜']
    };
    
    const text = transcripts.join(' ');
    
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        emotions.push(emotion);
      }
    }
    
    return emotions.length > 0 ? emotions : ['평온함'];
  }
  
  // 의미 평가
  private assessSignificance(transcripts: string[]): string {
    const text = transcripts.join(' ');
    
    if (text.includes('처음') || text.includes('첫')) {
      return '첫 번째 경험';
    } else if (text.includes('마지막') || text.includes('끝')) {
      return '마지막 순간';
    } else if (text.includes('생일') || text.includes('축하')) {
      return '특별한 날';
    } else if (text.includes('여행') || text.includes('갔어')) {
      return '여행의 추억';
    }
    
    return '소중한 순간';
  }
  
  // AI 기반 스토리 내러티브 생성
  async generateNarrative(sessionId: string, responses: Array<{ transcript: string; timestamp: string }>): Promise<StoryNarrative> {
    try {
      // AI 기반 스토리 생성 시도
      return await this.generateAIStory(sessionId, responses);
    } catch (error) {
      console.error('AI 스토리 생성 실패, 폴백 사용:', error);
      // 폴백: 기존 템플릿 기반 스토리 생성
      return this.generateFallbackStory(sessionId, responses);
    }
  }

  // AI 기반 스토리 생성
  private async generateAIStory(sessionId: string, responses: Array<{ transcript: string; timestamp: string }>): Promise<StoryNarrative> {
    const combinedResponses = responses
      .map(r => r.transcript)
      .join('\n\n');
    
    const storyPrompt = `
다음은 어르신이 들려준 소중한 추억들입니다. 이를 바탕으로 감동적이고 완성도 높은 개인 서사를 작성해주세요.

**사용자의 추억:**
${combinedResponses}

**요구사항:**
1. 제목: 감동적이고 의미 있는 제목
2. 요약: 2-3문장으로 스토리의 핵심을 요약
3. 챕터들: 각 추억을 하나의 챕터로 구성 (최소 1개, 최대 5개)
4. 각 챕터는 200-500단어의 완성된 줄글로 작성
5. 테마: 스토리의 중심 테마들 (3-5개)
6. 등장인물: 주요 인물들과 그들의 역할
7. 감정 아크: 시간순 감정 변화

**작성 스타일:**
- 따뜻하고 감동적인 톤
- 구체적이고 생생한 묘사
- 감정이 잘 드러나는 문장
- 실제 책처럼 읽을 수 있는 완성도
- 어르신의 진솔한 목소리가 느껴지는 문체

JSON 형태로 응답해주세요:
{
  "title": "제목",
  "summary": "요약",
  "chapters": [
    {
      "title": "챕터 제목",
      "content": "챕터 내용 (200-500단어)",
      "wordCount": 단어수
    }
  ],
  "themes": ["테마1", "테마2", "테마3"],
  "characters": [
    {
      "name": "이름",
      "role": "역할",
      "description": "설명"
    }
  ],
  "timeline": "시간순 정리",
  "emotionalArc": ["감정1", "감정2", "감정3"]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "당신은 전문적인 스토리 작가입니다. 어르신들의 소중한 추억을 바탕으로 감동적이고 완성도 높은 개인 서사(자서전, 수필)를 작성합니다. 단 주어진 내용 외에 허구의 내용을 추가하지 않습니다."
        },
        {
          role: "user",
          content: storyPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });
    
    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error('AI 응답을 받지 못했습니다.');
    }
    
    return this.parseAIResponse(sessionId, aiResponse);
  }

  // AI 응답을 파싱하여 구조화된 스토리로 변환
  private parseAIResponse(sessionId: string, aiResponse: string): StoryNarrative {
    try {
      // JSON 부분만 추출
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                       aiResponse.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('JSON 형식을 찾을 수 없습니다.');
      }
      
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      // 챕터에 order 추가
      const chapters: StoryChapter[] = parsed.chapters.map((chapter: any, index: number) => ({
        id: `chapter_${index}`,
        title: chapter.title || `챕터 ${index + 1}`,
        content: chapter.content || '',
        wordCount: chapter.wordCount || this.countWords(chapter.content || ''),
        order: index,
        scene: {
          id: `scene_${index}`,
          setting: 'AI 생성',
          time: new Date().toISOString(),
          characters: [],
          events: [],
          emotions: [],
          significance: 'AI가 생성한 감동적인 이야기'
        }
      }));
      
      return {
        id: sessionId,
        title: parsed.title || '소중한 추억',
        summary: parsed.summary || '감동적인 이야기가 담겨있습니다.',
        chapters,
        themes: parsed.themes || ['추억', '가족'],
        characters: parsed.characters || [],
        timeline: parsed.timeline || '시간순으로 정리된 추억들',
        emotionalArc: parsed.emotionalArc || ['따뜻함', '그리움']
      };
      
    } catch (error) {
      console.error('AI 응답 파싱 실패:', error);
      throw new Error('AI 응답을 파싱할 수 없습니다.');
    }
  }

  // 폴백: 기존 템플릿 기반 스토리 생성
  private generateFallbackStory(sessionId: string, responses: Array<{ transcript: string; timestamp: string }>): StoryNarrative {
    const topics = this.extractTopics(responses);
    const characters = this.extractCharacters(responses);
    const scenes = this.createScenes(responses, topics);
    
    const chapters: StoryChapter[] = scenes.map((scene, index) => ({
      id: `chapter_${index}`,
      title: `${scene.setting}에서의 ${scene.significance}`,
      content: this.generateRichChapterContent(scene, index, scenes.length),
      scene,
      wordCount: this.countWords(this.generateRichChapterContent(scene, index, scenes.length)),
      order: index
    }));
    
    return {
      id: sessionId,
      title: this.generateTitle(topics, characters),
      summary: this.generateRichSummary(chapters, this.extractThemes(topics, characters, scenes)),
      chapters,
      themes: this.extractThemes(topics, characters, scenes),
      characters,
      timeline: this.createTimeline(scenes),
      emotionalArc: this.createEmotionalArc(scenes)
    };
  }
  
  // 챕터 내용 생성 (개선된 버전 - 실제 책처럼 읽을 수 있는 줄글)
  private generateChapterContent(scene: StoryScene): string {
    // 등장인물들을 자연스럽게 연결
    const characterIntro = scene.characters.length > 1 
      ? `${scene.characters.map(char => char.name).join('과 ')}이 함께한`
      : `${scene.characters[0]?.name || '주인공'}의`;
    
    // 감정을 자연스럽게 표현
    const emotionText = scene.emotions.length > 1 
      ? `${scene.emotions.slice(0, -1).join(', ')}과 ${scene.emotions[scene.emotions.length - 1]}`
      : scene.emotions[0] || '평온한';
    
    // 이벤트들을 자연스러운 문장으로 연결
    const eventNarrative = this.createEventNarrative(scene.events);
    
    const content = `
${scene.setting}에서 펼쳐진 ${characterIntro} 소중한 순간이었다. 

${eventNarrative}

그 순간의 마음은 ${emotionText}한 감정으로 가득했다. ${scene.significance}으로 기억되는 이 추억은 지금도 마음 한편에 따뜻하게 간직되어 있다. 

시간이 흘러도 변하지 않는 것은 그때의 순수한 마음과 진실한 감정이었다. 그것이야말로 인생에서 가장 소중한 보물이 아닐까.
    `.trim();
    
    return content;
  }
  
  // 이벤트들을 자연스러운 내러티브로 변환
  private createEventNarrative(events: string[]): string {
    if (events.length === 0) return '';
    if (events.length === 1) return events[0];
    
    // 이벤트들을 시간순으로 연결하여 자연스러운 문장 생성
    let narrative = events[0];
    
    for (let i = 1; i < events.length; i++) {
      if (i === events.length - 1) {
        // 마지막 이벤트
        narrative += ` 그리고 ${events[i]}`;
      } else {
        // 중간 이벤트들
        narrative += ` 그러던 중 ${events[i]}`;
      }
    }
    
    return narrative;
  }
  
  // 단어 수 계산
  private countWords(text: string): number {
    return text.split(/\s+/).length;
  }
  
  // 풍부한 챕터 내용 생성 (실제 책처럼 읽을 수 있는 형태)
  private generateRichChapterContent(scene: StoryScene, chapterIndex: number, totalChapters: number): string {
    // 등장인물들을 자연스럽게 연결
    const characterIntro = scene.characters.length > 1 
      ? `${scene.characters.map(char => char.name).join('과 ')}이 함께한`
      : `${scene.characters[0]?.name || '주인공'}의`;
    
    // 감정을 자연스럽게 표현
    const emotionText = scene.emotions.length > 1 
      ? `${scene.emotions.slice(0, -1).join(', ')}과 ${scene.emotions[scene.emotions.length - 1]}`
      : scene.emotions[0] || '평온한';
    
    // 이벤트들을 자연스러운 문장으로 연결
    const eventNarrative = this.createRichEventNarrative(scene.events);
    
    // 챕터별로 다른 문체와 분위기 적용
    const chapterStyle = this.getChapterStyle(chapterIndex, totalChapters);
    
    const content = `
${chapterStyle.opening}

${scene.setting}에서 펼쳐진 ${characterIntro} 소중한 순간이었다. 

${eventNarrative}

${chapterStyle.middle}

그 순간의 마음은 ${emotionText}한 감정으로 가득했다. ${scene.significance}으로 기억되는 이 추억은 지금도 마음 한편에 따뜻하게 간직되어 있다. 

${chapterStyle.ending}

시간이 흘러도 변하지 않는 것은 그때의 순수한 마음과 진실한 감정이었다. 그것이야말로 인생에서 가장 소중한 보물이 아닐까.
    `.trim();
    
    return content;
  }
  
  // 챕터별 문체와 분위기 설정
  private getChapterStyle(chapterIndex: number, totalChapters: number): {
    opening: string;
    middle: string;
    ending: string;
  } {
    if (chapterIndex === 0) {
      // 첫 번째 챕터 - 시작
      return {
        opening: "옛날 옛적, 그리운 기억 속으로 떠나보자.",
        middle: "그때는 정말 순수했던 시절이었다.",
        ending: "이렇게 시작된 이야기는 아직 끝나지 않았다."
      };
    } else if (chapterIndex === totalChapters - 1) {
      // 마지막 챕터 - 마무리
      return {
        opening: "마지막으로 남은 이야기가 있다.",
        middle: "이제 모든 이야기가 하나로 연결되는 순간이다.",
        ending: "이렇게 해서 하나의 완성된 이야기가 되었다."
      };
    } else {
      // 중간 챕터들
      return {
        opening: "그리고 또 다른 이야기가 이어졌다.",
        middle: "그때의 감정이 지금도 생생하게 떠오른다.",
        ending: "이 이야기도 마음속에 깊이 새겨져 있다."
      };
    }
  }
  
  // 풍부한 이벤트 내러티브 생성
  private createRichEventNarrative(events: string[]): string {
    if (events.length === 0) return '';
    if (events.length === 1) return events[0];
    
    // 이벤트들을 시간순으로 연결하여 자연스러운 문장 생성
    let narrative = events[0];
    
    for (let i = 1; i < events.length; i++) {
      if (i === events.length - 1) {
        // 마지막 이벤트
        narrative += ` 그리고 마침내 ${events[i]}`;
      } else {
        // 중간 이벤트들
        narrative += ` 그러던 중 ${events[i]}`;
      }
    }
    
    return narrative;
  }
  
  // 풍부한 요약 생성
  private generateRichSummary(chapters: StoryChapter[], themes: string[]): string {
    const totalWords = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
    const chapterCount = chapters.length;
    
    return `총 ${chapterCount}개의 챕터로 구성된 감동적인 이야기입니다. ${totalWords}단어의 따뜻한 추억들이 담겨있으며, ${themes.join(', ')}의 테마로 일관되게 이어집니다. 각 챕터마다 독특한 감정과 경험이 담겨있어 마치 한 권의 완성된 책을 읽는 듯한 느낌을 줍니다.`;
  }
  
  // 테마 추출
  private extractThemes(topics: StoryTopic[], characters: StoryCharacter[], scenes: StoryScene[]): string[] {
    const themes: string[] = [];
    
    // 가족 테마
    if (characters.some(char => char.role === '가족' || char.role === '부모')) {
      themes.push('가족의 사랑');
    }
    
    // 우정 테마
    if (characters.some(char => char.role === '지인')) {
      themes.push('우정과 인연');
    }
    
    // 성장 테마
    if (scenes.some(scene => scene.emotions.includes('기쁨'))) {
      themes.push('성장과 기쁨');
    }
    
    // 그리움 테마
    if (scenes.some(scene => scene.emotions.includes('그리움'))) {
      themes.push('그리움과 추억');
    }
    
    return themes.length > 0 ? themes : ['소중한 추억'];
  }
  
  // 감정 아크 생성
  private createEmotionalArc(scenes: StoryScene[]): string[] {
    return scenes.map(scene => {
      if (scene.emotions.includes('기쁨')) return '기쁨';
      if (scene.emotions.includes('슬픔')) return '슬픔';
      if (scene.emotions.includes('사랑')) return '사랑';
      if (scene.emotions.includes('그리움')) return '그리움';
      return '평온함';
    });
  }
  
  // 제목 생성
  private generateTitle(topics: StoryTopic[], characters: StoryCharacter[]): string {
    const mainCharacter = characters[0];
    const mainTopic = topics[0];
    
    if (mainCharacter && mainTopic) {
      return `${mainCharacter.name}과의 ${mainTopic.name} 이야기`;
    } else if (mainCharacter) {
      return `${mainCharacter.name}과의 소중한 추억`;
    } else if (mainTopic) {
      return `${mainTopic.name}에 대한 이야기`;
    }
    
    return '소중한 추억의 이야기';
  }
  
  // 요약 생성
  private generateSummary(chapters: StoryChapter[]): string {
    const totalChapters = chapters.length;
    const totalWords = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
    
    return `총 ${totalChapters}개의 챕터로 구성된 이야기입니다. ${totalWords}단어의 따뜻한 추억들이 담겨있습니다.`;
  }
  
  // 타임라인 생성
  private createTimeline(scenes: StoryScene[]): string {
    return scenes.map(scene => `${scene.time}: ${scene.setting}에서의 ${scene.significance}`).join('\n');
  }
}

// 전역 스토리 생성 엔진 인스턴스
export const storyGenerationEngine = new StoryGenerationEngine();

