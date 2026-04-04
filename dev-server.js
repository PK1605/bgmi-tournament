const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load .env
try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envFile.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const [key, ...val] = line.split('=');
    process.env[key.trim()] = val.join('=').trim();
  });
} catch (e) {}

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const apiHandlers = {};
fs.readdirSync(path.join(__dirname, 'api')).forEach(file => {
  if (file.startsWith('_') || !file.endsWith('.js')) return;
  const name = file.replace('.js', '');
  apiHandlers[name] = require('./api/' + file);
});

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // API routes
  if (pathname.startsWith('/api/')) {
    const apiName = pathname.replace('/api/', '').replace(/\/$/, '');
    const handler = apiHandlers[apiName];
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'API not found: ' + apiName }));
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = {}; }
      req.query = parsed.query || {};

      const fakeRes = {
        statusCode: 200,
        headers: {},
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(data) {
          res.writeHead(this.statusCode, { ...this.headers, 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(data));
        },
      };

      try { await handler(req, fakeRes); }
      catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  // Static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404); res.end('Not Found');
    }
  } catch {
    res.writeHead(404); res.end('Not Found');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  Malwa Esports Dev Server running!\n`);
  console.log(`  Player Page:  http://localhost:${PORT}/`);
  console.log(`  Admin Panel:  http://localhost:${PORT}/admin.html`);
  console.log(`  API Base:     http://localhost:${PORT}/api/\n`);
  console.log(`  Mock Mode: ON (Razorpay test mode)\n`);
});
