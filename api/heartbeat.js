// api/heartbeat.js - 병원 PC 화면보호기 상태 수신용 Vercel Serverless API
// 인메모리 최근 접속 캐시 (서버리스 인스턴스 라이프사이클 동안 유지)
let recentPcs = [];

module.exports = async (req, res) => {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // GET: 관리자 웹에서 최근 접속한 PC 목록 조회
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      totalActive: recentPcs.length,
      pcs: recentPcs
    });
  }

  // POST: 화면보호기 클라이언트에서 하트비트 전송
  if (req.method === 'POST') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const machineName = data.machineName || 'Unknown-PC';
      const version = data.version || 'unknown';
      const screenCount = data.screenCount || 1;
      const os = data.os || '';
      const now = new Date().toISOString();

      const existingIndex = recentPcs.findIndex(p => p.machineName === machineName);
      const info = {
        machineName,
        userName: data.userName || '',
        version,
        screenCount,
        os,
        lastSeen: now
      };

      if (existingIndex >= 0) {
        recentPcs[existingIndex] = info;
      } else {
        recentPcs.unshift(info);
        if (recentPcs.length > 100) recentPcs.pop();
      }

      return res.status(200).json({ status: 'ok', timestamp: now });
    } catch (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
