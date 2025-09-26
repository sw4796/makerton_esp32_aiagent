# RemeDio - 기억을 깨우는 라디오

RemeDio는 환경 센서 데이터와 AI를 활용하여 어르신들의 소중한 추억을 이끌어내고 개인화된 스토리로 만들어주는 통합 솔루션입니다.

## 🎯 주요 기능

### 하드웨어 (ESP32)
- **라디오형 AI 스피커**: 대형 물리 버튼, 고출력 스피커, 내장 마이크로폰
- **환경 센서**: 온도, 습도, 조도 센서로 실시간 환경 측정
- **접근성 최적화**: 고대비 라벨, 돌출 그립, 큰 버튼으로 고령층 친화적 설계
- **네트워크**: Wi-Fi 연결, 오프라인 저장 모드, 12시간 이상 배터리

### 클라우드 플랫폼 (LangChain + OpenAI)
- **STT (음성→텍스트)**: 한국어 고정밀 음성 인식
- **PII 마스킹**: 개인정보 자동 탐지 및 마스킹
- **AI 스토리 엔진**: 개별 발화를 연속된 내러티브로 편집
- **전자책 생성**: PDF/EPUB 자동 변환
- **환경 기반 대화**: 센서 데이터를 활용한 동적 오프닝 멘트 생성

## 🏗️ 아키텍처

```
ESP32 Device ←→ LangChain Server ←→ OpenAI API
     ↓              ↓                    ↓
센서 데이터    환경 컨텍스트 분석    스토리 생성
음성 입력     세션 관리          전자책 출력
```

## 📁 프로젝트 구조

```
server_langchain/
├── src/
│   ├── lib/
│   │   ├── agent.ts          # OpenAI Voice React Agent
│   │   ├── session.ts        # 세션 관리 시스템
│   │   ├── environmental.ts  # 환경 컨텍스트 매니저
│   │   └── story.ts         # 스토리 생성 엔진
│   ├── prompt.ts            # RemeDio 전용 프롬프트
│   ├── tools.ts             # LangChain 도구들
│   └── index.ts             # 메인 서버
└── static/
    └── index.html           # 관리자 대시보드
```

## 🚀 시작하기

### 1. 환경 설정

```bash
cd server_langchain
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 추가:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. 서버 실행

```bash
npm run dev
```

서버가 `http://localhost:8888`에서 실행됩니다.

## 📡 API 엔드포인트

### 세션 관리
- `GET /api/sessions` - 세션 통계 조회
- `POST /api/sessions` - 새 세션 생성
- `GET /api/sessions/:sessionId` - 특정 세션 조회
- `POST /api/sessions/:sessionId/complete` - 세션 완료
- `DELETE /api/sessions/:sessionId` - 세션 삭제

### 센서 데이터
- `POST /api/sensor-data` - 센서 데이터 처리 및 환경 컨텍스트 생성
- `POST /api/generate-question` - 환경 기반 질문 생성

### 스토리 생성
- `POST /api/generate-story` - 스토리 내러티브 생성
- `POST /api/analyze-topics` - 토픽 및 등장인물 분석
- `GET /api/download-story/:sessionId` - 스토리 다운로드

### 관리자 대시보드
- `GET /api/admin/dashboard` - 전체 통계 및 활성 세션
- `GET /api/admin/facility-stats/:facilityId` - 시설별 통계

### WebSocket
- `GET /device` - ESP32 디바이스 연결

## 🔧 핵심 컴포넌트

### 1. 환경 컨텍스트 매니저
센서 데이터를 분석하여 대화 컨텍스트를 생성하고 환경에 맞는 오프닝 멘트를 제공합니다.

```typescript
const context = environmentalContextManager.generateContext({
  temperature: 22,
  humidity: 60,
  lightLevel: 500
});
```

### 2. 스토리 생성 엔진
사용자의 응답을 분석하여 토픽, 등장인물, 장면을 추출하고 연속된 내러티브를 생성합니다.

```typescript
const narrative = storyGenerationEngine.generateNarrative(sessionId, responses);
```

### 3. 세션 관리 시스템
세션별 데이터를 관리하고 통계를 제공합니다.

```typescript
const session = sessionManager.createSession(userId, facilityId);
sessionManager.addResponse(sessionId, transcript, duration);
```

## 🎨 사용 예시

### 환경 기반 오프닝 멘트 생성

```typescript
// 센서 데이터 전송
const response = await fetch('/api/sensor-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    temperature: 24,
    humidity: 65,
    lightLevel: 600,
    sessionId: 'session_123'
  })
});

const { openingMent } = await response.json();
// "좋은 오후입니다. 따뜻하고 편안한 분위기에서 어르신께서는 어떤 기억이 가장 먼저 떠오르시나요?"
```

### 스토리 생성

```typescript
// 스토리 생성 요청
const storyResponse = await fetch('/api/generate-story', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: 'session_123' })
});

const { narrative } = await storyResponse.json();
// 개인화된 스토리 내러티브 반환
```

## 🔮 향후 개발 계획

1. **PII 마스킹 강화**: 더 정교한 개인정보 보호
2. **정서 분석**: 음성 톤 기반 우울/인지 저하 선별
3. **전자책 생성**: 실제 PDF/EPUB 파일 생성
4. **커뮤니티 공유**: 익명 커뮤니티 업로드 기능
5. **다국어 지원**: 다양한 언어로 확장

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해 주세요.