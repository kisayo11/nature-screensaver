// api/google-slides.js - 구글 슬라이드 프레젠테이션 자동 파싱 및 이미지 추출 Vercel Serverless API
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const sendJson = (statusCode, data) => {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(statusCode).json(data);
    }
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  if (req.method === 'OPTIONS') {
    res.writeHead ? res.writeHead(200).end() : res.status(200).end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return sendJson(405, { error: 'Method not allowed' });
  }

  try {
    let url = '';
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      url = body?.url || '';
    } else {
      url = req.query?.url || '';
    }

    if (!url) {
      return sendJson(400, { error: '구글 슬라이드 URL이 필요합니다.' });
    }

    // 1. Presentation ID 추출
    const match = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    const presentationId = match ? match[1] : (url.trim().length > 20 && !url.includes('/') ? url.trim() : null);

    if (!presentationId) {
      return sendJson(400, { error: '유효한 구글 슬라이드 URL 또는 프레젠테이션 ID를 찾을 수 없습니다.' });
    }

    // 2. 구글 슬라이드 웹 문서 조회 (edit 및 htmlpresent 시도)
    const targetUrls = [
      `https://docs.google.com/presentation/d/${presentationId}/edit`,
      `https://docs.google.com/presentation/d/${presentationId}/htmlpresent`,
      `https://docs.google.com/presentation/d/${presentationId}/pub?start=false&loop=false&delayms=3000`
    ];

    let html = '';
    let presentationTitle = '구글 슬라이드 프레젠테이션';

    for (const testUrl of targetUrls) {
      try {
        const resp = await fetch(testUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ko,en-US;q=0.9,en;q=0.8'
          }
        });
        if (resp.ok) {
          const text = await resp.text();
          if (text.length > 500) {
            html = text;
            break;
          }
        }
      } catch (fetchErr) {
        // 다음 URL 시도
      }
    }

    if (!html) {
      return sendJson(404, {
        error: '구글 슬라이드 문서를 불러올 수 없습니다. 구글 슬라이드의 [공유] 설정이 "링크가 있는 모든 사용자에게 공개(뷰어)"로 되어 있는지 확인해 주세요.'
      });
    }

    // 제목 파싱
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      presentationTitle = titleMatch[1].replace(/ - Google (프레젠테이션|Slides)/i, '').trim();
    }

    // 3. Page ID 파싱
    // 구글 슬라이드 내부의 페이지 ID는 p1, p2 또는 g로 시작하는 해시(g12345678_0_0 등)로 정의됩니다.
    const pageIdSet = new Set();

    // 패턴 1: JSON 형태 "id":"...", "slide"
    const jsonMatches = [...html.matchAll(/"id"\s*:\s*"([a-zA-Z0-9_\-]+)"/g)];
    for (const m of jsonMatches) {
      const id = m[1];
      if (/^(p|p\d+|g[a-zA-Z0-9_]+|slide_[a-zA-Z0-9_]+)$/.test(id) && id.length >= 2 && id.length <= 40) {
        pageIdSet.add(id);
      }
    }

    // 패턴 2: pageid= 파라미터
    const pageIdParams = [...html.matchAll(/pageid=([a-zA-Z0-9_\-]+)/gi)];
    for (const m of pageIdParams) {
      if (m[1]) pageIdSet.add(m[1]);
    }

    // 패턴 3: id="slide-..."
    const slideIdMatches = [...html.matchAll(/id="slide-([a-zA-Z0-9_\-]+)"/gi)];
    for (const m of slideIdMatches) {
      if (m[1]) pageIdSet.add(m[1]);
    }

    // 만약 파싱된 pageId가 없거나 적을 경우 기본 첫 장 (p) 포함
    if (pageIdSet.size === 0) {
      pageIdSet.add('p');
    }

    const pageIds = Array.from(pageIdSet);

    // 4. 각 슬라이드의 이미지 URL 생성
    // 구글 슬라이드 개별 PNG 내보내기 엔드포인트:
    // https://docs.google.com/presentation/d/{ID}/export/png?id={ID}&pageid={PAGE_ID}
    const slides = pageIds.map((pageId, idx) => {
      const order = idx + 1;
      const exportUrl = `https://docs.google.com/presentation/d/${presentationId}/export/png?id=${presentationId}&pageid=${pageId}`;
      const fileName = `gslide_${String(order).padStart(2, '0')}.png`;
      return {
        order,
        pageId,
        title: `${presentationTitle} - ${order}번 슬라이드`,
        fileName,
        url: exportUrl
      };
    });

    return sendJson(200, {
      status: 'success',
      presentationId,
      title: presentationTitle,
      totalSlides: slides.length,
      slides
    });

  } catch (err) {
    console.error('Google Slides parser error:', err);
    return sendJson(500, { error: '구글 슬라이드 파싱 중 오류: ' + err.message });
  }
};
