// Zero-dependency static file server for the built site. Node only.
// Usage: node scripts/serve.mjs   (PORT env overrides, default 5500)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT) || 5500;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

async function sendFile(res, filePath, status = 200) {
  const body = await readFile(filePath);
  res.writeHead(status, {
    'content-type': TYPES[extname(filePath)] || 'application/octet-stream',
    'cache-control': 'no-store', // always serve fresh — no stale app.js after a rebuild
  });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    if (pathname === '/' || pathname === '') pathname = '/index.html';

    const filePath = normalize(join(root, pathname));
    if (!filePath.startsWith(root + sep) && filePath !== root) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let info;
    try {
      info = await stat(filePath);
    } catch {
      // Missing file: route-like paths (no extension) fall back to the SPA shell; real assets 404.
      if (!extname(pathname)) {
        await sendFile(res, join(root, 'index.html'));
      } else {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      }
      return;
    }

    if (info.isDirectory()) {
      await sendFile(res, join(filePath, 'index.html'));
      return;
    }
    await sendFile(res, filePath);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain' }).end('Server error');
  }
}).listen(port, () => {
  console.log(`\n  kevin.es → http://127.0.0.1:${port}/\n  Ctrl+C to stop.\n`);
});
