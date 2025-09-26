// 환경 컨텍스트 매니저
export interface WeatherData {
  temperature: number;
  humidity: number;
  description: string;
  location: string;
}

export interface TimeContext {
  timeOfDay: '오전' | '오후' | '저녁' | '밤';
  hour: number;
  greeting: string;
  season?: string;
}

export interface EnvironmentalContext {
  sensorData: {
    temperature: number;
    humidity: number;
    lightLevel: number;
    timestamp: string;
  };
  weatherData: WeatherData;
  timeContext: TimeContext;
  mood: {
    primary: string;
    secondary: string;
    description: string;
  };
}

export class EnvironmentalContextManager {
  
  // 센서 데이터를 기반으로 환경 컨텍스트 생성
  generateContext(sensorData: {
    temperature: number;
    humidity: number;
    lightLevel: number;
  }): EnvironmentalContext {
    const timeContext = this.getTimeContext();
    const weatherData = this.getWeatherData(sensorData);
    const mood = this.analyzeMood(sensorData, timeContext);
    
    return {
      sensorData: {
        ...sensorData,
        timestamp: new Date().toISOString()
      },
      weatherData,
      timeContext,
      mood
    };
  }
  
  // 시간대 컨텍스트 생성
  private getTimeContext(): TimeContext {
    const now = new Date();
    const hour = now.getHours();
    
    let timeOfDay: '오전' | '오후' | '저녁' | '밤';
    let greeting: string;
    
    if (hour >= 5 && hour < 12) {
      timeOfDay = '오전';
      greeting = '좋은 아침';
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = '오후';
      greeting = '좋은 오후';
    } else if (hour >= 17 && hour < 21) {
      timeOfDay = '저녁';
      greeting = '좋은 저녁';
    } else {
      timeOfDay = '밤';
      greeting = '안녕하세요';
    }
    
    return {
      timeOfDay,
      hour,
      greeting,
      season: this.getSeason(now)
    };
  }
  
  // 센서 데이터를 기반으로 날씨 데이터 생성
  private getWeatherData(sensorData: {
    temperature: number;
    humidity: number;
    lightLevel: number;
  }): WeatherData {
    let description = '';
    
    // 온도 기반 날씨 설명
    if (sensorData.temperature < 0) {
      description = '매우 추운';
    } else if (sensorData.temperature < 10) {
      description = '쌀쌀한';
    } else if (sensorData.temperature < 20) {
      description = '시원한';
    } else if (sensorData.temperature < 25) {
      description = '따뜻한';
    } else if (sensorData.temperature < 30) {
      description = '더운';
    } else {
      description = '무더운';
    }
    
    // 습도 기반 추가 설명
    if (sensorData.humidity > 80) {
      description += ' 습한';
    } else if (sensorData.humidity < 30) {
      description += ' 건조한';
    }
    
    // 조도 기반 추가 설명
    if (sensorData.lightLevel < 100) {
      description += ' 어두운';
    } else if (sensorData.lightLevel > 1000) {
      description += ' 밝은';
    }
    
    return {
      temperature: sensorData.temperature,
      humidity: sensorData.humidity,
      description: description.trim(),
      location: '현재 공간'
    };
  }
  
  // 환경 데이터를 기반으로 분위기 분석
  private analyzeMood(sensorData: {
    temperature: number;
    humidity: number;
    lightLevel: number;
  }, timeContext: TimeContext): {
    primary: string;
    secondary: string;
    description: string;
  } {
    let primary = '평온한';
    let secondary = '편안한';
    let description = '따뜻하고 조용한';
    
    // 온도 기반 분위기
    if (sensorData.temperature < 15) {
      primary = '시원한';
      secondary = '상쾌한';
      description = '선선하고 깨끗한';
    } else if (sensorData.temperature > 28) {
      primary = '따뜻한';
      secondary = '포근한';
      description = '따뜻하고 아늑한';
    }
    
    // 조도 기반 분위기
    if (sensorData.lightLevel < 200) {
      description += ' 조용한';
      secondary = '차분한';
    } else if (sensorData.lightLevel > 800) {
      description += ' 밝은';
      secondary = '활기찬';
    }
    
    // 시간대 기반 분위기 조정
    if (timeContext.timeOfDay === '저녁' || timeContext.timeOfDay === '밤') {
      description += ' 고요한';
      secondary = '평화로운';
    }
    
    return {
      primary,
      secondary,
      description: description.trim()
    };
  }
  
  // 계절 정보 생성
  private getSeason(date: Date): string {
    const month = date.getMonth() + 1;
    
    if (month >= 3 && month <= 5) return '봄';
    if (month >= 6 && month <= 8) return '여름';
    if (month >= 9 && month <= 11) return '가을';
    return '겨울';
  }
  
  // 환경 컨텍스트를 기반으로 오프닝 멘트 생성
  generateOpeningMent(context: EnvironmentalContext): string {
    const { weatherData, timeContext, mood } = context;
    
    const openingTemplates = [
      `${timeContext.greeting}입니다. 오늘은 ${weatherData.description} 날씨네요. ${mood.description} 분위기에서 어르신께서는 어떤 기억이 가장 먼저 떠오르시나요?`,
      `${timeContext.greeting}입니다. ${weatherData.description} 오늘 같은 날에 어르신께서는 어떤 추억이 있으신가요?`,
      `${timeContext.greeting}입니다. ${mood.description}한 이 시간에 어르신께서는 어떤 이야기를 들려주고 싶으신가요?`,
      `${timeContext.greeting}입니다. ${weatherData.description} 오늘, 어르신께서는 어떤 소중한 기억을 가지고 계신가요?`
    ];
    
    // 랜덤하게 템플릿 선택
    const randomIndex = Math.floor(Math.random() * openingTemplates.length);
    return openingTemplates[randomIndex];
  }
  
  // 환경 컨텍스트를 기반으로 후속 질문 생성 (개선된 버전)
  generateFollowUpQuestion(context: EnvironmentalContext, previousResponse?: string): string {
    const { weatherData, timeContext, mood } = context;
    
    // 이전 응답을 분석하여 더 구체적이고 깊이 있는 질문 생성
    const deepFollowUpTemplates = [
      `그때의 구체적인 상황을 더 자세히 말씀해주실 수 있을까요? 예를 들어, 어떤 옷을 입고 계셨는지, 주변에는 어떤 사람들이 있었는지, 어떤 소리가 들렸는지 등등...`,
      `그 순간을 지금 다시 떠올려보시면, 가장 먼저 떠오르는 것은 무엇인가요? 색깔, 냄새, 소리, 감촉 중에서요.`,
      `그 경험 이후에 당신의 삶에 어떤 변화가 있었나요? 그때의 기억이 지금의 당신에게 어떤 의미로 남아있나요?`,
      `그 이야기 속에서 가장 인상 깊었던 사람이 있다면, 그 사람에 대해 더 자세히 말씀해주실 수 있을까요?`,
      `그때의 감정을 한 단어로 표현한다면 무엇일까요? 그리고 그 감정이 지금까지 어떻게 변해왔는지 궁금해요.`,
      `그 경험을 통해 배운 것이 있다면 무엇인가요? 지금의 젊은 세대에게 전하고 싶은 말씀이 있으신가요?`,
      `그때와 지금을 비교해보시면, 가장 크게 달라진 것은 무엇이라고 생각하시나요?`,
      `그 이야기의 뒷이야기가 있다면, 그 후에 어떤 일들이 일어났나요?`,
      `그때의 당신과 지금의 당신이 만난다면, 어떤 이야기를 나누고 싶으신가요?`,
      `그 경험을 다시 한번 살 수 있다면, 무엇을 다르게 하고 싶으신가요?`,
      `${weatherData.description}한 날씨와 함께 떠오르는 다른 기억들도 있으신가요? 그때는 어떤 마음이셨나요?`,
      `${timeContext.timeOfDay}의 그 시간대에 특별한 의미가 있으신가요? 그 시간을 어떻게 보내셨는지 궁금해요.`,
      `그 추억 속에서 가장 소중하게 여기시는 부분은 무엇인가요? 왜 그 부분이 특별한가요?`,
      `그때의 당신이 지금의 당신에게 한마디 한다면, 어떤 말을 하고 싶으실까요?`,
      `그 경험을 통해 얻은 가장 큰 깨달음은 무엇인가요? 그것이 지금의 삶에 어떤 영향을 주고 있나요?`
    ];
    
    // 랜덤하게 템플릿 선택
    const randomIndex = Math.floor(Math.random() * deepFollowUpTemplates.length);
    return deepFollowUpTemplates[randomIndex];
  }
}

// 전역 환경 컨텍스트 매니저 인스턴스
export const environmentalContextManager = new EnvironmentalContextManager();

