// OpenAI API 키 테스트
require('dotenv').config();
const OpenAI = require('openai');

async function testOpenAI() {
  console.log('🔍 OpenAI API 키 테스트 시작...\n');
  
  // API 키 확인
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
    console.log('💡 .env 파일에 OPENAI_API_KEY=your-api-key 를 추가하세요.');
    return;
  }
  
  console.log('✅ API 키 발견:', apiKey.substring(0, 10) + '...');
  
  try {
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    console.log('🚀 OpenAI API 호출 테스트 중...\n');
    
    // 간단한 채팅 완성 테스트
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: "안녕하세요! 간단한 인사말을 해주세요."
        }
      ],
      max_tokens: 50,
      temperature: 0.7
    });
    
    const response = completion.choices[0]?.message?.content;
    
    if (response) {
      console.log('✅ OpenAI API 정상 작동!');
      console.log('📝 응답:', response);
      console.log('\n🎉 API 키가 정상적으로 작동합니다!');
    } else {
      console.log('❌ 응답을 받지 못했습니다.');
    }
    
  } catch (error) {
    console.error('❌ OpenAI API 호출 실패:');
    
    if (error.status === 401) {
      console.log('🔑 API 키가 유효하지 않습니다. 올바른 키를 확인해주세요.');
    } else if (error.status === 429) {
      console.log('⏰ API 할당량을 초과했습니다. 잠시 후 다시 시도해주세요.');
    } else if (error.status === 403) {
      console.log('🚫 API 접근이 거부되었습니다. 계정 상태를 확인해주세요.');
    } else {
      console.log('🔧 기타 오류:', error.message);
    }
    
    console.log('\n📊 에러 상세 정보:');
    console.log('- 상태 코드:', error.status);
    console.log('- 에러 타입:', error.type);
    console.log('- 에러 코드:', error.code);
  }
}

// 테스트 실행
testOpenAI().catch(console.error);
