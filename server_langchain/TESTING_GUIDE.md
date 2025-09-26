# 🧪 RemeDio 서버 테스트 가이드

ESP32 하드웨어 없이도 RemeDio 서버의 모든 기능을 테스트할 수 있는 다양한 방법들을 제공합니다.

## 🚀 빠른 시작

### 1. 서버 실행
```bash
cd server_langchain
yarn dev
```

### 2. 테스트 실행
다음 중 하나의 방법을 선택하세요:

## 📋 테스트 방법들

### 방법 1: 웹 브라우저 테스트 클라이언트 (추천)

**가장 사용하기 쉬운 방법입니다!**

1. 서버 실행 후 브라우저에서 접속:
   ```
   http://localhost:8888/test-client.html
   ```

2. 제공되는 기능들:
   - ✅ 서버 상태 확인
   - ✅ WebSocket 연결 테스트
   - ✅ 세션 생성 및 관리
   - ✅ 센서 데이터 시뮬레이션
   - ✅ 질문 생성 테스트
   - ✅ 음성 시뮬레이션
   - ✅ 스토리 생성 테스트
   - ✅ 관리자 대시보드
   - ✅ 전체 플로우 자동 테스트

3. 사용법:
   - "서버 상태 확인" 버튼으로 연결 확인
   - "새 세션 생성" 버튼으로 테스트 세션 생성
   - "센서 데이터 전송" 버튼으로 환경 데이터 시뮬레이션
   - "전체 테스트" 버튼으로 모든 기능 자동 테스트

### 방법 2: 명령줄 테스트 스크립트

**Node.js 기반 자동화된 테스트**

```bash
# 의존성 설치 (한 번만)
npm install node-fetch

# 테스트 실행
yarn test
# 또는
node test-remedio.js
```

**기능:**
- 서버 상태 확인
- 세션 생성
- 센서 데이터 처리
- 질문 생성
- 관리자 대시보드

### 방법 3: curl 기반 테스트

**bash 스크립트로 단계별 테스트**

```bash
# 실행 권한 부여 (한 번만)
chmod +x test-remedio-curl.sh

# 테스트 실행
./test-remedio-curl.sh
```

**기능:**
- 모든 API 엔드포인트 순차 테스트
- 색상으로 결과 표시
- 상세한 오류 메시지

### 방법 4: Postman 컬렉션

**API 개발자용 고급 테스트**

1. Postman 설치
2. 컬렉션 가져오기:
   ```
   File → Import → RemeDio-API-Tests.postman_collection.json
   ```

3. 환경 변수 설정:
   - `baseUrl`: `http://localhost:8888`
   - `sessionId`: (자동 생성됨)
   - `facilityId`: `test_facility_001`

**기능:**
- 개별 API 테스트
- 환경 변수 관리
- 테스트 자동화
- 결과 저장 및 공유

### 방법 5: 수동 curl 명령어

**개별 API 테스트**

```bash
# 1. 서버 상태 확인
curl http://localhost:8888/api/sessions

# 2. 세션 생성
curl -X POST http://localhost:8888/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId": "test_user_001", "facilityId": "test_facility_001"}'

# 3. 센서 데이터 전송 (sessionId는 위에서 받은 값 사용)
curl -X POST http://localhost:8888/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 22.5,
    "humidity": 65.0,
    "lightLevel": 500,
    "sessionId": "YOUR_SESSION_ID"
  }'

# 4. 질문 생성
curl -X POST http://localhost:8888/api/generate-question \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "YOUR_SESSION_ID",
    "previousResponse": "어릴 때 할머니와 함께 시장에 갔었어요."
  }'

# 5. 스토리 생성
curl -X POST http://localhost:8888/api/generate-story \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "YOUR_SESSION_ID"}'

# 6. 관리자 대시보드
curl http://localhost:8888/api/admin/dashboard
```

## 🔍 테스트 시나리오

### 기본 플로우 테스트
1. **서버 연결** → 서버 상태 확인
2. **세션 생성** → 새 대화 세션 시작
3. **환경 감지** → 센서 데이터 시뮬레이션
4. **대화 시작** → AI 오프닝 멘트 생성
5. **응답 수집** → 사용자 응답 시뮬레이션
6. **스토리 생성** → 개인화된 내러티브 생성
7. **결과 확인** → 관리자 대시보드에서 확인

### 고급 테스트 시나리오

#### 시나리오 1: 다양한 환경 조건 테스트
```javascript
// 웹 클라이언트에서 다음 값들로 테스트
const testCases = [
  { temp: 15, humidity: 30, light: 100, expected: "시원하고 건조한" },
  { temp: 28, humidity: 80, light: 1000, expected: "따뜻하고 습한" },
  { temp: 22, humidity: 60, light: 500, expected: "따뜻하고 편안한" }
];
```

#### 시나리오 2: 다중 세션 테스트
```bash
# 여러 세션을 동시에 생성하여 테스트
for i in {1..5}; do
  curl -X POST http://localhost:8888/api/sessions \
    -H "Content-Type: application/json" \
    -d "{\"userId\": \"user_$i\", \"facilityId\": \"facility_001\"}"
done
```

#### 시나리오 3: 스토리 생성 품질 테스트
```bash
# 다양한 응답 패턴으로 스토리 생성 테스트
responses=(
  "어릴 때 할머니와 함께 시장에 갔었어요."
  "할머니가 사주신 과자를 먹으며 집에 돌아왔어요."
  "그때가 가장 행복했던 시간이었어요."
)
```

## 🚨 문제 해결

### 자주 발생하는 오류

#### 1. 서버 연결 실패
```
❌ 서버 연결 실패: ECONNREFUSED
```
**해결방법:**
- 서버가 실행 중인지 확인: `yarn dev`
- 포트 8888이 사용 중인지 확인: `netstat -an | grep 8888`

#### 2. OpenAI API 키 오류
```
❌ OpenAI API key not found
```
**해결방법:**
- `.env` 파일에 올바른 API 키 설정
- API 키에 충분한 크레딧 확인

#### 3. 세션 생성 실패
```
❌ 세션 생성 실패: 400 Bad Request
```
**해결방법:**
- JSON 형식 확인
- 필수 필드 누락 확인

#### 4. WebSocket 연결 실패
```
❌ WebSocket 연결 실패
```
**해결방법:**
- 방화벽 설정 확인
- 브라우저 콘솔에서 오류 메시지 확인

### 디버깅 팁

#### 1. 로그 확인
```bash
# 서버 실행 시 상세 로그 확인
yarn dev | grep -E "(ERROR|WARN|INFO)"
```

#### 2. 네트워크 확인
```bash
# 포트 사용 확인
netstat -tulpn | grep 8888

# 연결 테스트
telnet localhost 8888
```

#### 3. API 응답 확인
```bash
# 상세한 HTTP 응답 확인
curl -v http://localhost:8888/api/sessions
```

## 📊 테스트 결과 해석

### 성공적인 응답 예시

#### 센서 데이터 처리 성공
```json
{
  "success": true,
  "context": {
    "sensorData": { "temperature": 22.5, "humidity": 65.0, "lightLevel": 500 },
    "weatherData": { "description": "따뜻한" },
    "timeContext": { "timeOfDay": "오후", "greeting": "좋은 오후" },
    "mood": { "description": "따뜻하고 편안한" }
  },
  "openingMent": "좋은 오후입니다. 오늘은 따뜻한 날씨네요...",
  "environmentalSummary": "따뜻한 오후의 따뜻하고 편안한 분위기"
}
```

#### 스토리 생성 성공
```json
{
  "success": true,
  "narrative": {
    "id": "session_123",
    "title": "할머니와의 소중한 추억",
    "summary": "총 3개의 챕터로 구성된 이야기입니다.",
    "chapters": [...],
    "themes": ["가족의 사랑", "소중한 추억"],
    "characters": [...]
  }
}
```

## 🎯 다음 단계

테스트가 성공적으로 완료되면:

1. **ESP32 하드웨어 연동** 시작
2. **실제 데이터베이스** 연동 (Redis, PostgreSQL)
3. **프론트엔드 대시보드** 개발
4. **전자책 생성** 기능 구현
5. **PII 마스킹** 강화

## 📞 지원

테스트 중 문제가 발생하면:
1. 로그 파일 확인
2. 브라우저 개발자 도구 확인
3. GitHub Issues에 문제 보고
4. 팀 채널에서 문의
