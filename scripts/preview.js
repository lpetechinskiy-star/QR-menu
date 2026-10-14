#!/usr/bin/env node
/*
 * Локальный просмотр собранных страниц:
 *   npm run preview            → http://localhost:8080
 *   PORT=3000 npm run preview
 * Сервер доступен и с телефона в той же Wi-Fi сети (адрес печатается при запуске).
 */
'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const DIST = path.resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
};

function listing() {
  const cafes = fs.existsSync(DIST)
    ? fs.readdirSync(DIST, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : [];
  const items = cafes
    .map(
      (c) => `<li><a href="/${encodeURIComponent(c)}/">${c}</a>
      · <a href="/${encodeURIComponent(c)}/table-tent.html">тейбл-тент</a>
      · <a href="/${encodeURIComponent(c)}/qr.png">QR</a></li>`
    )
    .join('');
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>QR-меню — превью</title>
<body style="font:16px/1.6 system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h1>Собранные меню</h1><ul>${items || '<li>Пусто — запустите npm run build</li>'}</ul>
<p style="color:#777">Темы: добавьте к адресу ?theme=light, ?theme=dark или ?theme=warm</p>`;
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath === '/') {
      res.writeHead(200, { 'Content-Type': TYPES['.html'] });
      return res.end(listing());
    }
    let file = path.join(DIST, path.normalize(urlPath));
    if (!file.startsWith(DIST)) {
      res.writeHead(403);
      return res.end();
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!urlPath.endsWith('/')) {
        res.writeHead(301, { Location: urlPath + '/' });
        return res.end();
      }
      file = path.join(file, 'index.html');
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Не найдено');
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  })
  .listen(PORT, () => {
    console.log(`Превью: http://localhost:${PORT}`);
    for (const nets of Object.values(os.networkInterfaces())) {
      for (const n of nets || []) {
        if (n.family === 'IPv4' && !n.internal) console.log(`С телефона: http://${n.address}:${PORT}`);
      }
    }
  });
