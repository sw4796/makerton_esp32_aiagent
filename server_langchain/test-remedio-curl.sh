#!/bin/bash

# RemeDio 서버 테스트 스크립트 (curl 기반)
# 사용법: ./test-remedio-curl.sh

BASE_URL="http://localhost:8888"
SESSION_ID=""
FACILITY_ID="test_facility_001"

echo "🚀 RemeDio 서버 테스트 시작..."
echo "=================================="

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 결과 출력 함수
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# 1. 서버 상태 확인
echo -e "\n${YELLOW}1. 서버 상태 확인${NC}"
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/sessions")
if [ "$response" = "200" ]; then
    print_result 0 "서버 정상 작동"
    curl -s "$BASE_URL/api/sessions" | jq '.' 2>/dev/null || curl -s "$BASE_URL/api/sessions"
else
    print_result 1 "서버 연결 실패 (HTTP $response)"
    echo "서버가 실행 중인지 확인하세요: yarn dev"
    exit 1
fi

# 2. 세션 생성
echo -e "\n${YELLOW}2. 세션 생성${NC}"
session_response=$(curl -s -X POST "$BASE_URL/api/sessions" \
    -H "Content-Type: application/json" \
    -d "{\"userId\": \"test_user_001\", \"facilityId\": \"$FACILITY_ID\"}")

if echo "$session_response" | grep -q "sessionId"; then
    SESSION_ID=$(echo "$session_response" | jq -r '.sessionId' 2>/dev/null || echo "$session_response" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
    print_result 0 "세션 생성 성공 (ID: $SESSION_ID)"
else
    print_result 1 "세션 생성 실패"
    echo "$session_response"
    exit 1
fi

# 3. 센서 데이터 전송
echo -e "\n${YELLOW}3. 센서 데이터 전송${NC}"
sensor_response=$(curl -s -X POST "$BASE_URL/api/sensor-data" \
    -H "Content-Type: application/json" \
    -d "{
        \"temperature\": 22.5,
        \"humidity\": 65.0,
        \"lightLevel\": 500,
        \"sessionId\": \"$SESSION_ID\"
    }")

if echo "$sensor_response" | grep -q "success"; then
    print_result 0 "센서 데이터 처리 성공"
    echo "$sensor_response" | jq '.environmentalSummary' 2>/dev/null || echo "환경 분석 완료"
else
    print_result 1 "센서 데이터 처리 실패"
    echo "$sensor_response"
fi

# 4. 질문 생성
echo -e "\n${YELLOW}4. 질문 생성${NC}"
question_response=$(curl -s -X POST "$BASE_URL/api/generate-question" \
    -H "Content-Type: application/json" \
    -d "{
        \"sessionId\": \"$SESSION_ID\",
        \"previousResponse\": \"어릴 때 할머니와 함께 시장에 갔었어요.\"
    }")

if echo "$question_response" | grep -q "success"; then
    print_result 0 "질문 생성 성공"
    echo "$question_response" | jq '.question' 2>/dev/null || echo "질문 생성 완료"
else
    print_result 1 "질문 생성 실패"
    echo "$question_response"
fi

# 5. 토픽 분석
echo -e "\n${YELLOW}5. 토픽 분석${NC}"
topic_response=$(curl -s -X POST "$BASE_URL/api/analyze-topics" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"$SESSION_ID\"}")

if echo "$topic_response" | grep -q "success"; then
    print_result 0 "토픽 분석 성공"
    echo "$topic_response" | jq '.analysis' 2>/dev/null || echo "토픽 분석 완료"
else
    print_result 1 "토픽 분석 실패"
    echo "$topic_response"
fi

# 6. 스토리 생성
echo -e "\n${YELLOW}6. 스토리 생성${NC}"
story_response=$(curl -s -X POST "$BASE_URL/api/generate-story" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"$SESSION_ID\"}")

if echo "$story_response" | grep -q "success"; then
    print_result 0 "스토리 생성 성공"
    echo "$story_response" | jq '.narrative.title' 2>/dev/null || echo "스토리 생성 완료"
else
    print_result 1 "스토리 생성 실패"
    echo "$story_response"
fi

# 7. 관리자 대시보드
echo -e "\n${YELLOW}7. 관리자 대시보드${NC}"
dashboard_response=$(curl -s "$BASE_URL/api/admin/dashboard")

if echo "$dashboard_response" | grep -q "success"; then
    print_result 0 "대시보드 조회 성공"
    echo "$dashboard_response" | jq '.stats' 2>/dev/null || echo "통계 조회 완료"
else
    print_result 1 "대시보드 조회 실패"
    echo "$dashboard_response"
fi

# 8. 시설별 통계
echo -e "\n${YELLOW}8. 시설별 통계${NC}"
facility_response=$(curl -s "$BASE_URL/api/admin/facility-stats/$FACILITY_ID")

if echo "$facility_response" | grep -q "success"; then
    print_result 0 "시설별 통계 조회 성공"
    echo "$facility_response" | jq '.stats' 2>/dev/null || echo "시설 통계 조회 완료"
else
    print_result 1 "시설별 통계 조회 실패"
    echo "$facility_response"
fi

echo -e "\n${GREEN}🎉 테스트 완료!${NC}"
echo "=================================="
echo "테스트된 세션 ID: $SESSION_ID"
echo "테스트된 시설 ID: $FACILITY_ID"
echo ""
echo "웹 브라우저에서 다음 URL로 접속하여 GUI 테스트도 가능합니다:"
echo "http://localhost:8888/test-client.html"
