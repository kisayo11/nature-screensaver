// api/deploy.js - 안전한 서버사이드 Git 배포 처리 Vercel Serverless API
const GITHUB_OWNER = process.env.GITHUB_OWNER || "kisayo11";
const GITHUB_REPO = process.env.GITHUB_REPO || "nature-screensaver";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { config, images, token: clientToken } = body;

    const token = process.env.GITHUB_TOKEN || clientToken;
    if (!token) {
      return res.status(401).json({ 
        error: 'GitHub Token이 필요합니다. Vercel 환경변수(GITHUB_TOKEN) 또는 요청에 token을 포함해주세요.' 
      });
    }

    if (!config || !Array.isArray(config.slides)) {
      return res.status(400).json({ error: '유효한 config 및 slides 목록이 필요합니다.' });
    }

    const ghHeaders = {
      "Accept": "application/vnd.github.v3+json",
      "Authorization": `Bearer ${token.trim()}`,
      "User-Agent": "Nature-Screensaver-Deployer/2.0"
    };

    // 1. 최신 커밋 조회
    const refRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_BRANCH}`, { headers: ghHeaders });
    if (!refRes.ok) {
      const err = await refRes.json().catch(() => ({}));
      return res.status(refRes.status).json({ error: `GitHub 브랜치 조회 실패: ${err.message || refRes.statusText}` });
    }
    const refData = await refRes.json();
    const currentCommitSha = refData.object.sha;

    // 2. Base Tree SHA 조회
    const commitRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits/${currentCommitSha}`, { headers: ghHeaders });
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. 신규 이미지 Blob 생성
    const uploadedBlobs = [];
    if (images && typeof images === 'object') {
      for (const [fileName, dataUrl] of Object.entries(images)) {
        if (!dataUrl) continue;
        const cleanBase64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const blobRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`, {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({ content: cleanBase64, encoding: 'base64' })
        });
        if (!blobRes.ok) {
          const err = await blobRes.json().catch(() => ({}));
          throw new Error(`이미지 Blob 생성 실패 (${fileName}): ${err.message}`);
        }
        const blobData = await blobRes.json();
        uploadedBlobs.push({
          path: `admin-web/slides/${fileName}`,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha
        });
      }
    }

    // 4. config.json Blob 생성
    const configStr = JSON.stringify(config, null, 2);
    const configBase64 = Buffer.from(configStr, 'utf8').toString('base64');
    const configBlobRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`, {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({ content: configBase64, encoding: 'base64' })
    });
    if (!configBlobRes.ok) {
      throw new Error('config.json Blob 생성 실패');
    }
    const configBlobData = await configBlobRes.json();

    // 5. Tree 생성
    const treeEntries = [
      { path: 'admin-web/config.json', mode: '100644', type: 'blob', sha: configBlobData.sha },
      { path: 'config.json', mode: '100644', type: 'blob', sha: configBlobData.sha },
      { path: 'published-config.json', mode: '100644', type: 'blob', sha: configBlobData.sha },
      ...uploadedBlobs
    ];

    const treeRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`, {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries })
    });
    const treeData = await treeRes.json();

    // 6. 커밋 생성
    const commitMsg = `Deploy screensaver version ${config.version} [via Vercel Serverless]`;
    const newCommitRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`, {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({
        message: commitMsg,
        tree: treeData.sha,
        parents: [currentCommitSha]
      })
    });
    const newCommitData = await newCommitRes.json();

    // 7. 브랜치 포인터 갱신 (Push)
    const updateRefRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`, {
      method: 'PATCH',
      headers: ghHeaders,
      body: JSON.stringify({ sha: newCommitData.sha, force: false })
    });

    if (!updateRefRes.ok) {
      throw new Error('GitHub main 브랜치 갱신(Push)에 실패했습니다.');
    }

    return res.status(200).json({
      status: 'success',
      version: config.version,
      commitSha: newCommitData.sha,
      uploadedImages: uploadedBlobs.length,
      message: '배포가 성공적으로 완료되었습니다.'
    });

  } catch (err) {
    console.error('Deploy error:', err);
    return res.status(500).json({ error: err.message });
  }
};
