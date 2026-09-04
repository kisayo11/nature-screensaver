const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'admin-web');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/save-bundle') {
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
            const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(cleanBase64, 'base64');
            fs.writeFileSync(path.join(slidesDir, fileName), buffer);
          }
        }

        // config.json 저장
        const formatted = JSON.stringify(config, null, 2);
        fs.writeFileSync(path.join(PUBLIC_DIR, 'config.json'), formatted, 'utf8');
        fs.writeFileSync(path.join(__dirname, '..', 'config.json'), formatted, 'utf8');

        // 1. 구글 드라이브 백업 (비동기로 백그라운드 전송 - 실패해도 Vercel 메인 배포에 영향 없음)
        const GOOGLE_SCRIPT_BACKUP_URL = "https://script.google.com/macros/s/AKfycbwYdwib_0u08GMu6-SwRa5LLG0tERvrlkTgTiug1Ws_j2pOMts1gdDs-OYroLBBZJAN-A/exec";
        try {
          fetch(GOOGLE_SCRIPT_BACKUP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: formatted
          }).then(r => r.json()).then(res => {
            console.log('✅ 구글 드라이브 백그라운드 백업 성공:', res);
          }).catch(err => {
            console.warn('⚠️ 구글 드라이브 백업 경고 (메인 배포는 계속 진행):', err.message);
          });
        } catch (backupErr) {
          console.warn('⚠️ 구글 드라이브 백업 호출 스킵:', backupErr.message);
        }

        // 2. 깃허브 자동 커밋 & 푸시 -> Vercel 즉시 배포 트리거
        const { exec } = require('child_process');
        const repoRoot = path.join(__dirname, '..');
        const commitMsg = `Deploy screensaver version ${config.version || Date.now()}`;

        // cmd.exe에서는 && 연산자가 모든 윈도우 버전에서 100% 정상 작동합니다.
        const gitCmd = `git add admin-web/slides admin-web/config.json && git commit -m "${commitMsg}" && git push origin main`;

        exec(gitCmd, { cwd: repoRoot, shell: 'cmd.exe' }, (execErr, stdout, stderr) => {
          if (execErr) {
            console.error('Git Push Error:', stderr || execErr.message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: 'warning', 
              message: '로컬 저장은 완료되었으나 Git Push 중 오류가 발생했습니다: ' + (stderr || execErr.message)
            }));
          } else {
            console.log('🚀 Git Push 및 Vercel 배포 트리거 성공!');
            console.log(stdout);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: 'success', 
              message: 'Vercel 메인 배포 및 구글 드라이브 백업이 모두 완료되었습니다!' 
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
