// Daily wellness topic research: Perplexity web search -> Claude topic curation -> JSON output.
// Replaces the Make.com "일일 자동 리서치" scenario (Org 2208951 / Scenario 6339499).

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY is not set');
if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');

const CATEGORIES = ['BODY', 'ENERGY', 'RITUAL', 'TREND', 'MIND'];

const RESEARCH_QUERY = `최근 3개월 이내 화제가 된 웰니스/건강/저속노화 관련 트렌드를 찾아줘.
범위: 뇌건강, 노화, 수면, 스트레스, 식습관, 멘탈, 운동, 호르몬, 면역, 장건강, 기능성 성분.
해외(특히 미국) 연구/저널/매체와 국내 매체를 모두 포함해서, 각 항목마다 출처(기관명/저널명/매체명, 발행일 또는 URL)를 명확히 알 수 있게 정리해줘.
찬반이 갈리거나 상식을 깨는 주제, 또는 4050 세대가 민감하게 반응할 만한 주제를 우선해줘.`;

const STEP1_SYSTEM_PROMPT = `[POZA 브랜드 컨텍스트]
브랜드명: 포자(POZA), 버섯커피 브랜드. 슬로건: 건강을 퍼뜨리는 하나의 포자. 타겟: 40대 이상 메인, 30대 서브. 톤: ~임/~함 단언체.

[STEP 1 - 주제 발굴]
당신은 포자(POZA) 매거진의 콘텐츠 디렉터입니다. 아래 리서치 자료를 참고해서 이번 주 인스타 캐러셀 주제 5개를 발굴해주세요. 주제 범위는 웰니스·건강·저속노화 전반이며, 포자 브랜드나 버섯과 억지로 연결할 필요는 없습니다.

[주제 선정 기준]
1. 최신성: 최근 3개월 이내 화제된 웰니스 트렌드
2. 논쟁성: 찬반이 갈리거나 상식을 깨는 주제
3. 공포/불안: 4050 타겟이 민감하게 반응할 주제
4. 실용성: 당장 적용 가능한 꿀팁
5. 바이럴성: 저장/공유 욕구를 자극하는 주제

[주제 범위]
뇌건강/노화/수면/스트레스/식습관/멘탈/운동/호르몬/면역/장건강/기능성 성분

[제외 기준]
너무 일반적이거나 이미 식상한 주제

[출처 표기 규칙]
아래 리서치 자료 안에 실제 URL이나 출처 정보가 있으면 그걸 정확히 활용해서 각 주제에 출처를 표기할 것. 리서치 자료에 명확한 출처가 없으면 '출처 불명확 - 추가 확인 필요'라고 표기할 것. 출처를 임의로 지어내지 말 것.

[카테고리 태깅 규칙 - 엄격 적용]
카테고리는 주제 내용과 직접 관련된 것만 선택할 것.
- BODY: 장건강/면역/호르몬/혈관/소화 등 신체 시스템 관련 주제
- ENERGY: 피로/집중력/수면 관련 주제
- RITUAL: 루틴/라이프스타일/식습관 관련 주제
- TREND: 최신 트렌드/해외 연구 관련 주제
- MIND: 멘탈/심리/스트레스/뇌건강 관련 주제

[출력 제한 - 중요]
아래 [출력 형식]에 명시된 주제 1~5 항목만 작성하세요. 포자 연결 전략, 브랜드 연관성 분석, 검증 결과, 요약 등 그 외 어떤 추가 섹션도 절대 작성하지 마세요.

[출력 형식] 아래 형식으로 5개만 작성:
주제 N: [주제명]
한줄요약: [왜 지금 이 주제인지]
출처: [기관명/저널명/매체명, 발행일 또는 URL - 리서치 자료 기반]
카테고리: [BODY/ENERGY/RITUAL/TREND/MIND 중 하나]
포맷유형: [기억력/생체나이/공포유발/트렌드/해외짜집기/꿀팁 중 하나]
바이럴포인트: [저장/공유/댓글 중 노릴 반응]`;

async function callPerplexity(query) {
  const res = await fetch('https://api.perplexity.ai/v1/agent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'perplexity/sonar',
      input: query,
      tools: [{ type: 'web_search', search_context_size: 'high' }]
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Perplexity API error (${res.status}): ${JSON.stringify(data)}`);
  }

  const output = data.output || [];
  const citations = [];
  for (const block of output) {
    if (block.type === 'search_results') {
      for (const r of block.results || []) {
        citations.push(`- ${r.title || '(제목 없음)'} (${r.date || r.last_updated || '날짜 불명'}) ${r.url || ''}`);
      }
    }
  }
  const messageBlock = output.find(b => b.type === 'message');
  const answerText = messageBlock
    ? (messageBlock.content || []).map(c => c.text).filter(Boolean).join('\n')
    : '';

  if (!answerText) {
    throw new Error(`Perplexity response had no message text: ${JSON.stringify(data)}`);
  }

  return `${answerText}\n\n[검색된 출처 목록]\n${citations.join('\n')}`;
}

async function callClaude(systemPrompt, userContent) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Anthropic API error (${res.status}): ${JSON.stringify(data)}`);
  }
  const textPart = (data.content || []).find(c => c.type === 'text');
  if (!textPart) throw new Error(`Anthropic response had no text: ${JSON.stringify(data)}`);
  return textPart.text;
}

function parseTopics(raw) {
  const topics = [];
  const blocks = raw.split(/(?=주제\s*\d+\s*[:：])/).map(b => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const get = (label) => {
      const re = new RegExp(`${label}\\s*[:：]\\s*(.+)`);
      const m = block.match(re);
      return m ? m[1].trim() : '';
    };
    const topic = get('주제\\s*\\d+');
    if (!topic) continue;
    const category = get('카테고리');
    topics.push({
      topic,
      summary: get('한줄요약'),
      source: get('출처'),
      category: CATEGORIES.includes(category) ? category : category || '미분류',
      formatType: get('포맷유형'),
      viralPoint: get('바이럴포인트')
    });
  }
  return topics;
}

async function main() {
  const research = await callPerplexity(RESEARCH_QUERY);
  const rawTopics = await callClaude(STEP1_SYSTEM_PROMPT, research);
  const topics = parseTopics(rawTopics);

  if (topics.length === 0) {
    throw new Error(`Failed to parse any topics from Claude output:\n${rawTopics}`);
  }

  const now = new Date();
  const kstDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now); // YYYY-MM-DD

  const result = {
    date: kstDate,
    generatedAt: now.toISOString(),
    topics,
    rawResponse: rawTopics
  };

  const fs = await import('node:fs/promises');
  await fs.mkdir('data/topics', { recursive: true });
  await fs.writeFile(`data/topics/${kstDate}.json`, JSON.stringify(result, null, 2) + '\n');
  await fs.writeFile('data/topics/latest.json', JSON.stringify(result, null, 2) + '\n');

  console.log(`Saved ${topics.length} topics for ${kstDate}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
