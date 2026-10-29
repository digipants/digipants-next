// Standalone loopback preview. No Next route, API, disk writes or external calls.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
if (process.env.NODE_ENV === 'production') throw new Error('Local preview disabled in production');
const compile = async name => ts.transpileModule(await readFile(new URL(name, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText;
const load = async name => import(`data:text/javascript;base64,${Buffer.from(await compile(name)).toString('base64')}`);
const { projectClient } = await load('model.ts');
const { fixture, scenarios } = await load('fixtures.ts');
const client = await compile('client.ts');
const template = await readFile(new URL('index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('style.css', import.meta.url), 'utf8');
createServer((req, res) => {
  if (!['127.0.0.1:4320','localhost:4320'].includes(req.headers.host) || req.method !== 'GET') { res.writeHead(403).end(); return; }
  const url = new URL(req.url, 'http://127.0.0.1:4320');
  let body; let type;
  if (url.pathname === '/') {
    const requested = url.searchParams.get('scenario') ?? 'active';
    const scenario = scenarios.includes(requested) ? requested : 'active';
    const kind = ['loading','error','access-denied'].includes(scenario) ? scenario : 'project';
    const view = projectClient(fixture(scenario), kind);
    // Escape script delimiters even for manually approved client text.
    const json = JSON.stringify(view).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');
    body = template.replace('"CLIENT_DATA"', json); type='text/html';
  } else if (url.pathname === '/client.js') { body=client;type='text/javascript'; }
  else if (url.pathname === '/style.css') { body=css;type='text/css'; }
  else { res.writeHead(404).end();return; }
  res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control':'no-store',
    'Content-Security-Policy': "default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" });
  res.end(body);
}).listen(4320,'127.0.0.1',()=>console.log('Local-only progress preview: http://127.0.0.1:4320'));
