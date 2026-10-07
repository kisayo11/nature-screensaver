// api/google-slides.js - 구글 슬라이드 자동 파싱 및 이미지 고화질 추출 Vercel Serverless API
const https = require('https');

// 리다이렉트 추적 HTTP 바이너리 다운로더
function fetchBufferWithRedirect(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    }, async (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
        try {
          const redirected = await fetchBufferWithRedirect(res.headers.location, maxRedirects - 1);
          resolve(redirected);
        } catch (e) {
          reject(e);
        }
        return;
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

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

    // 1. Presentation ID 추출 (일반 /edit 및 웹게시 /pub/2PACX- 등 모두 지원)
    const match = url.match(/\/presentation\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
    const presentationId = match ? match[1] : (url.trim().length > 20 && !url.includes('/') ? url.trim() : null);

    if (!presentationId) {
      return sendJson(400, { error: '유효한 구글 슬라이드 URL 또는 프레젠테이션 ID를 찾을 수 없습니다.' });
    }

    // 2. 구글 슬라이드 편집 페이지 조회
    const editUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
    let html = '';
    let presentationTitle = '구글 슬라이드 프레젠테이션';

    try {
      const htmlBuf = await fetchBufferWithRedirect(editUrl);
      html = htmlBuf.toString('utf8');
    } catch (e) {
      // 만약 edit이 안 될 경우 원본 URL 직접 시도
      try {
        const fallbackBuf = await fetchBufferWithRedirect(url);
        html = fallbackBuf.toString('utf8');
      } catch (err2) {
        return sendJson(404, {
          error: '구글 슬라이드 문서를 불러올 수 없습니다. 구글 슬라이드의 [공유] 설정이 "링크가 있는 모든 사용자에게 공개(뷰어)"로 되어 있는지 확인해 주세요.'
        });
      }
    }

    // 문서 제목 파싱
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      presentationTitle = titleMatch[1].replace(/ - Google (프레젠테이션|Slides)/i, '').trim();
    }

    // 3. 슬라이드 페이지 ID 및 순서 파싱
    // 구글 슬라이드 내부 모델 청크의 슬라이드 정의 패턴: [12, "pageId", index, ...]
    const pageEntries = [];
    const m12 = [...html.matchAll(/\[12\s*,\s*"([a-zA-Z0-9_\-]+)"\s*,\s*(\d+)/g)];
    const seenPages = new Set();

    for (const m of m12) {
      const pageId = m[1];
      const idx = parseInt(m[2], 10);
      // 마스터 레이아웃 키워드 제외
      if (['geometric', 'gameday'].includes(pageId)) continue;
      // p 또는 g로 시작하는 유효 슬라이드만 포함
      if (/^(p\d+|g[a-zA-Z0-9_]+)$/.test(pageId)) {
        if (!seenPages.has(pageId)) {
          seenPages.add(pageId);
          pageEntries.push({ pageId, idx });
        }
      }
    }

    // idx 기준으로 오름차순 정렬
    pageEntries.sort((a, b) => a.idx - b.idx);
    let pageIds = pageEntries.map(p => p.pageId);

    // 만약 [12, ...] 패턴이 없을 경우, 대체 정규식 ("p1", "p2" 등 순차 번호 검색)
    if (pageIds.length === 0) {
      for (let i = 1; i <= 50; i++) {
        const candidate = `p${i}`;
        if (html.includes(`"${candidate}"`)) {
          pageIds.push(candidate);
        } else {
          break;
        }
      }
    }

    // 그래도 없으면 기본 'p' 포함
    if (pageIds.length === 0) {
      pageIds = ['p'];
    }

    // 4. 각 슬라이드의 고화질 PNG 이미지를 서버에서 직접 다운로드하여 Base64 Data URL 생성
    // (이를 통해 브라우저 CORS 문제 및 307 리다이렉트 문제를 100% 해결하고 미리보기 및 배포 지원)
    const slides = [];
    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i];
      const order = i + 1;
      const exportUrl = `https://docs.google.com/presentation/d/${presentationId}/export/png?id=${presentationId}&pageid=${pageId}`;
      const fileName = `gslide_${String(order).padStart(2, '0')}.png`;

      let dataUrl = '';
      try {
        const imgBuf = await fetchBufferWithRedirect(exportUrl);
        if (imgBuf && imgBuf.length > 500) {
          dataUrl = `data:image/png;base64,${imgBuf.toString('base64')}`;
        }
      } catch (imgErr) {
        console.warn(`[Google Slides] Image download failed for ${pageId}:`, imgErr.message);
      }

      slides.push({
        order,
        pageId,
        title: `${presentationTitle} - ${order}번 슬라이드`,
        fileName,
        url: exportUrl,
        localDataUrl: dataUrl // 브라우저 및 시뮬레이터에서 즉시 렌더링 가능한 Base64 이미지
      });
    }

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
