# 🚀 RemeDio 시작 가이드

## 📋 사전 준비사항

### 1. OpenAI API 키 준비
- [OpenAI Platform](https://platform.openai.com/)에서 API 키 발급
- GPT-4o Realtime 모델 사용 권한 확인

### 2. Node.js 환경 확인
```bash
node --version  # v18 이상 권장
npm --version   # v8 이상 권장
```

## 🔧 설치 및 설정

### 1단계: 의존성 설치
```bash
# server_langchain 디렉토리로 이동
cd esp32-realtime-voice-assistant/server_langchain

# 의존성 설치 (npm 또는 yarn 사용)
npm install
# 또는
yarn install
```

### 2단계: 환경 변수 설정
```bash
# .env 파일 생성
cp env.example .env

# .env 파일 편집하여 OpenAI API 키 설정
# OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3단계: 서버 실행
```bash
# 개발 모드로 실행
npm run dev
# 또는
yarn dev
```

서버가 `http://localhost:8888`에서 실행됩니다.

## 🧪 테스트 방법

### 1. 기본 연결 테스트
```bash
# 서버 상태 확인
curl http://localhost:8888/api/sessions
```

### 2. 센서 데이터 테스트
```bash
curl -X POST http://localhost:8888/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 22,
    "humidity": 60,
    "lightLevel": 500,
    "sessionId": "test_session_001"
  }'
```

### 3. 세션 생성 테스트
```bash
curl -X POST http://localhost:8888/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "facilityId": "facility_001"
  }'
```

## 📱 ESP32 연동 방법

### 1. ESP32 설정
ESP32 디바이스에서 다음 설정이 필요합니다:

```cpp
// WiFi 설정
const char* ssid = "your_wifi_ssid";
const char* password = "your_wifi_password";

// 서버 주소
const char* serverUrl = "ws://your-server-ip:8888/device";
```

### 2. 센서 데이터 전송
```cpp
// 센서 데이터 구조
struct SensorData {
  float temperature;
  float humidity;
  int lightLevel;
  String timestamp;
};

// 서버로 데이터 전송
void sendSensorData(SensorData data) {
  String json = "{\"temperature\":" + String(data.temperature) + 
                ",\"humidity\":" + String(data.humidity) + 
                ",\"lightLevel\":" + String(data.lightLevel) + 
                ",\"sessionId\":\"" + currentSessionId + "\"}";
  
  webSocket.sendTXT(json);
}
```

## 🔄 전체 워크플로우

### 1. 디바이스 시작
1. ESP32가 WiFi에 연결
2. WebSocket으로 서버 연결 (`ws://localhost:8888/device`)
3. 새 세션 자동 생성

### 2. 환경 감지
1. 센서에서 온도, 습도, 조도 측정
2. 센서 데이터를 서버로 전송
3. 환경 컨텍스트 매니저가 분위기 분석
4. AI가 환경에 맞는 오프닝 멘트 생성

### 3. 대화 진행
1. AI가 오프닝 멘트를 음성으로 출력
2. 사용자가 음성으로 응답
3. ESP32가 음성을 서버로 전송
4. STT로 텍스트 변환
5. 응답을 세션에 저장
6. 환경 기반 후속 질문 생성

### 4. 스토리 생성
1. 충분한 응답이 수집되면 스토리 생성 시작
2. 토픽 및 등장인물 추출
3. 장면 구성 및 감정 분석
4. 개인화된 스토리 내러티브 생성
5. 전자책 형태로 출력

## 🛠️ 개발 도구

### API 테스트 도구
- **Postman**: API 엔드포인트 테스트
- **WebSocket King**: WebSocket 연결 테스트
- **curl**: 명령줄에서 빠른 테스트

### 디버깅
```bash
# 로그 확인
tail -f logs/remedio.log

# 세션 상태 확인
curl http://localhost:8888/api/admin/dashboard
```

## 🚨 문제 해결

### 자주 발생하는 문제

1. **OpenAI API 키 오류**
   ```
   Error: OpenAI API key not found
   ```
   → `.env` 파일에 올바른 API 키 설정 확인

2. **WebSocket 연결 실패**
   ```
   WebSocket connection failed
   ```
   → 방화벽 설정 및 포트 확인

3. **센서 데이터 오류**
   ```
   Sensor data validation failed
   ```
   → 센서 데이터 형식 확인 (온도: number, 습도: number, 조도: number)

### 로그 확인
```bash
# 실시간 로그 모니터링
npm run dev | grep "ERROR\|WARN"
```

## 📊 모니터링

### 관리자 대시보드
브라우저에서 `http://localhost:8888/api/admin/dashboard` 접속하여:
- 전체 세션 통계
- 활성 세션 현황
- 스토리 생성 현황

### 시설별 통계
`http://localhost:8888/api/admin/facility-stats/{facilityId}` 접속하여:
- 시설별 세션 통계
- 사용자별 활동 현황
- 스토리 생성 성과

## 🔮 다음 단계

1. **실제 데이터베이스 연동** (Redis, PostgreSQL)
2. **전자책 생성 기능** (PDF, EPUB)
3. **프론트엔드 대시보드** 개발
4. **PII 마스킹 강화**
5. **정서 분석 기능** 추가

## 📞 지원

문제가 발생하면:
1. 로그 파일 확인
2. API 응답 상태 확인
3. GitHub Issues에 문제 보고
