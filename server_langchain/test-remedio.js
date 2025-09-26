#!/usr/bin/env node

/**
 * RemeDio 테스트 스크립트
 * 서버가 정상적으로 작동하는지 확인하는 간단한 테스트
 */

const BASE_URL = 'http://localhost:8888';

// 테스트 함수들
async function testServerHealth() {
  console.log('🔍 서버 상태 확인...');
  try {
    const response = await fetch(`${BASE_URL}/api/sessions`);
    const data = await response.json();
    console.log('✅ 서버 정상 작동:', data);
    return true;
  } catch (error) {
    console.error('❌ 서버 연결 실패:', error.message);
    return false;
  }
}

async function testSessionCreation() {
  console.log('🔍 세션 생성 테스트...');
  try {
    const response = await fetch(`${BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test_user_001',
        facilityId: 'test_facility_001'
      })
    });
    const data = await response.json();
    console.log('✅ 세션 생성 성공:', data.sessionId);
    return data.sessionId;
  } catch (error) {
    console.error('❌ 세션 생성 실패:', error.message);
    return null;
  }
}

async function testSensorDataProcessing(sessionId) {
  console.log('🔍 센서 데이터 처리 테스트...');
  try {
    const response = await fetch(`${BASE_URL}/api/sensor-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        temperature: 22.5,
        humidity: 65.0,
        lightLevel: 500,
        sessionId: sessionId
      })
    });
    const data = await response.json();
    console.log('✅ 센서 데이터 처리 성공:', data.environmentalSummary);
    return true;
  } catch (error) {
    console.error('❌ 센서 데이터 처리 실패:', error.message);
    return false;
  }
}

async function testQuestionGeneration(sessionId) {
  console.log('🔍 질문 생성 테스트...');
  try {
    const response = await fetch(`${BASE_URL}/api/generate-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        previousResponse: '어릴 때 할머니와 함께 시장에 갔었어요.'
      })
    });
    const data = await response.json();
    console.log('✅ 질문 생성 성공:', data.question);
    return true;
  } catch (error) {
    console.error('❌ 질문 생성 실패:', error.message);
    return false;
  }
}

async function testAdminDashboard() {
  console.log('🔍 관리자 대시보드 테스트...');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/dashboard`);
    const data = await response.json();
    console.log('✅ 관리자 대시보드 접근 성공:', data.stats);
    return true;
  } catch (error) {
    console.error('❌ 관리자 대시보드 접근 실패:', error.message);
    return false;
  }
}

// 메인 테스트 실행
async function runTests() {
  console.log('🚀 RemeDio 테스트 시작...\n');
  
  const results = {
    serverHealth: false,
    sessionCreation: false,
    sensorData: false,
    questionGeneration: false,
    adminDashboard: false
  };
  
  // 1. 서버 상태 확인
  results.serverHealth = await testServerHealth();
  if (!results.serverHealth) {
    console.log('\n❌ 서버가 실행되지 않았습니다. 먼저 서버를 시작해주세요.');
    console.log('   npm run dev');
    return;
  }
  
  console.log('');
  
  // 2. 세션 생성
  const sessionId = await testSessionCreation();
  results.sessionCreation = !!sessionId;
  
  console.log('');
  
  // 3. 센서 데이터 처리
  if (sessionId) {
    results.sensorData = await testSensorDataProcessing(sessionId);
    console.log('');
    
    // 4. 질문 생성
    results.questionGeneration = await testQuestionGeneration(sessionId);
    console.log('');
  }
  
  // 5. 관리자 대시보드
  results.adminDashboard = await testAdminDashboard();
  
  // 결과 요약
  console.log('\n📊 테스트 결과 요약:');
  console.log('='.repeat(50));
  console.log(`서버 상태: ${results.serverHealth ? '✅' : '❌'}`);
  console.log(`세션 생성: ${results.sessionCreation ? '✅' : '❌'}`);
  console.log(`센서 데이터: ${results.sensorData ? '✅' : '❌'}`);
  console.log(`질문 생성: ${results.questionGeneration ? '✅' : '❌'}`);
  console.log(`관리자 대시보드: ${results.adminDashboard ? '✅' : '❌'}`);
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 통과한 테스트: ${passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('🎉 모든 테스트가 통과했습니다! RemeDio가 정상적으로 작동합니다.');
  } else {
    console.log('⚠️  일부 테스트가 실패했습니다. 로그를 확인해주세요.');
  }
}

// fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  try {
    global.fetch = require('node-fetch');
  } catch (e) {
    console.log('node-fetch가 설치되지 않았습니다. 설치하려면: npm install node-fetch');
    process.exit(1);
  }
}

// 테스트 실행
runTests().catch(console.error);

