// ==========================================================================
// 📺 B站原生流纯净洗流中继服务 (Bilibili Clean Media Relay Server)
// 专为user小手机打造：将 B站 BV 视频直接洗为原生无广告、有声、可调音量的 MP4 串流
// ==========================================================================

const http = require('http');
const https = require('https');

const PORT = 3100;

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://127.0.0.1:' + PORT);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. 心跳检测
  if (parsedUrl.pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 0, status: 'ok', name: 'MomoBiliRelayEngine' }));
    return;
  }

  // 2. 解析 BV 号为 MP4 直链
  if (parsedUrl.pathname === '/play') {
    const bvid = parsedUrl.searchParams.get('bvid');
    let cid = parsedUrl.searchParams.get('cid');

    if (!bvid) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 400, message: 'Missing bvid' }));
      return;
    }

    // 辅助函数：根据 bvid 抓取 cid
    const getCidAndPlay = (targetCid) => {
      const apiUrl = 'https://api.bilibili.com/x/player/playurl?bvid=' + bvid + '&cid=' + targetCid + '&qn=64&fnval=0&fnver=0&fourk=1';
      https.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.bilibili.com'
        }
      }, (apiRes) => {
        let data = '';
        apiRes.on('data', c => data += c);
        apiRes.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.code === 0 && json.data && json.data.durl && json.data.durl[0]) {
              const videoStreamUrl = json.data.durl[0].url;
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                code: 0,
                format: json.data.format || 'mp4',
                duration: json.data.timelength,
                streamUrl: 'http://127.0.0.1:' + PORT + '/stream?url=' + encodeURIComponent(videoStreamUrl)
              }));
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ code: -1, message: '解析播放流失败', raw: json }));
            }
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: -1, message: e.message }));
          }
        });
      }).on('error', err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: -1, message: err.message }));
      });
    };

    if (cid) {
      getCidAndPlay(cid);
    } else {
      // 自动嗅探 cid
      https.get('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }, (viewRes) => {
        let vdata = '';
        viewRes.on('data', c => vdata += c);
        viewRes.on('end', () => {
          try {
            const vjson = JSON.parse(vdata);
            if (vjson.code === 0 && vjson.data && vjson.data.cid) {
              getCidAndPlay(vjson.data.cid);
            } else {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ code: 404, message: '未找到视频 cid' }));
            }
          } catch(e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: -1, message: e.message }));
          }
        });
      }).on('error', err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: -1, message: err.message }));
      });
    }
    return;
  }

  // 3. 原生视频流中继传输 (支持 Range 请求分片，倍速、快进、拖拽与精准寻道)
  if (parsedUrl.pathname === '/stream') {
    const targetUrl = parsedUrl.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400);
      res.end('Missing target url');
      return;
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.bilibili.com'
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    https.get(targetUrl, { headers }, (streamRes) => {
      res.writeHead(streamRes.statusCode, {
        'Content-Type': streamRes.headers['content-type'] || 'video/mp4',
        'Content-Length': streamRes.headers['content-length'],
        'Accept-Ranges': streamRes.headers['accept-ranges'] || 'bytes',
        'Content-Range': streamRes.headers['content-range'] || '',
        'Access-Control-Allow-Origin': '*'
      });
      streamRes.pipe(res);
    }).on('error', (err) => {
      if (!res.headersSent) res.writeHead(502);
      res.end(err.message);
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('📺 B站原生流纯净洗流中继服务已在 http://127.0.0.1:' + PORT + ' 启动就绪');
});
