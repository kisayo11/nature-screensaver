const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'admin-web');
const REPO_ROOT = path.join(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

let recentPcs = [];

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1. Heartbeat API
  if (req.url.startsWith('/api/heartbeat')) {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', totalActive: recentPcs.length, pcs: recentPcs }));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const machineName = data.machineName || 'Unknown-PC';
          const info = {
            machineName,
            userName: data.userName || '',
            version: data.version || 'unknown',
            screenCount: data.screenCount || 1,
            os: data.os || '',
            lastSeen: new Date().toISOString()
          };
          const idx = recentPcs.findIndex(p => p.machineName === machineName);
          if (idx >= 0) recentPcs[idx] = info;
          else recentPcs.unshift(info);
          if (recentPcs.length > 50) recentPcs.pop();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', timestamp: info.lastSeen }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid json' }));
        }
      });
      return;
    }
  }

  // 2. Deploy & Save API (POST /api/deploy 또는 POST /api/save-bundle)
  if (req.method === 'POST' && (req.url === '/api/deploy' || req.url === '/api/save-bundle')) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { config, images } = JSON.parse(body);
        const slidesDir = path.join(PUBLIC_DIR, 'slides');
        if (!fs.existsSync(slidesDir)) fs.mkdirSync(slidesDir, { recursive: true });

        // 전달받은 이미지 파일들을 slides 디렉토리에 실제 바이너리로 저장
        if (images && typeof images === 'object') {
          for (const [fileName, base64Data] of Object.entries(images)) {
            if (!base64Data) continue;
            const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(cleanBase64, 'base64');
            fs.writeFileSync(path.join(slidesDir, fileName), buffer);
          }
        }

        // config.json 저장 (admin-web, root, published-config.json 동기화)
        const formatted = JSON.stringify(config, null, 2);
        fs.writeFileSync(path.join(PUBLIC_DIR, 'config.json'), formatted, 'utf8');
        fs.writeFileSync(path.join(REPO_ROOT, 'config.json'), formatted, 'utf8');
        fs.writeFileSync(path.join(REPO_ROOT, 'published-config.json'), formatted, 'utf8');

        // Git 커밋 & 푸시
        const commitMsg = `Deploy screensaver version ${config.version || Date.now()}`;
        const gitCmd = `git add admin-web/slides admin-web/config.json config.json published-config.json && git commit -m "${commitMsg}" && git push origin main`;

        exec(gitCmd, { cwd: REPO_ROOT, shell: 'cmd.exe' }, (execErr, stdout, stderr) => {
          if (execErr) {
            console.warn('Git Push Warning:', stderr || execErr.message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: 'warning', 
              version: config.version,
              message: '로컬 파일 저장은 완료되었으나 Git Push 실패: ' + (stderr || execErr.message)
            }));
          } else {
            console.log('🚀 Git Push 및 Vercel 배포 트리거 성공!');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: 'success', 
              version: config.version,
              message: '로컬 저장 및 GitHub 커밋/푸시가 완료되었습니다.' 
            }));
          }
        });
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: err.message }));
      }
    });
    return;
  }

  // 3. 정적 파일 서빙
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, reqPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 Nature Screensaver Admin Dev Server Running!`);
  console.log(`👉 Local: http://localhost:${PORT}`);
  console.log(`👉 Root : ${PUBLIC_DIR}`);
  console.log(`=============================================`);
});
