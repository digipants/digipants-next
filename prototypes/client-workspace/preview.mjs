// Separate loopback server. Never imported by Next or placed in public/.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
if (process.env.NODE_ENV === 'production') throw new Error('Local preview disabled in production');
const files = { '/': ['index.html','text/html'], '/style.css': ['style.css','text/css'], '/app.mjs': ['app.mjs','text/javascript'], '/state.mjs': ['state.mjs','text/javascript'] };
createServer(async (req,res) => {
  if (!['127.0.0.1:4317','localhost:4317'].includes(req.headers.host) || req.method !== 'GET') { res.writeHead(403).end(); return; }
  const file = Object.hasOwn(files, req.url) ? files[req.url] : null;
  if (!file) { res.writeHead(404).end(); return; }
  try { const body = await readFile(new URL(file[0], import.meta.url)); res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" }); res.end(body); }
  catch { res.writeHead(500).end('Preview unavailable'); }
}).listen(4317, '127.0.0.1', () => console.log('Local-only preview: http://127.0.0.1:4317'));
