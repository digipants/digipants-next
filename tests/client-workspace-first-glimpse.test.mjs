import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = new URL("../app/workspace-preview/page.tsx", import.meta.url);
const ui = new URL("../app/workspace-preview/WorkspacePreview.tsx", import.meta.url);

test("first-glimpse route is explicitly noindex and contains only the synthetic UI", async () => {
  const [route, content] = await Promise.all([readFile(page, "utf8"), readFile(ui, "utf8")]);
  assert.match(route, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false/);
  assert.match(route, /WorkspacePreview/);
  assert.match(content, /data-workspace-synthetic-preview/);
  assert.match(content, /Everything here is fictional/);
  assert.match(content, /No real data, authentication or payments/);
  assert.match(content, /Example Studio/);
  assert.match(content, /DEMO-INV-001/);
  assert.match(content, /No invoices are issued, linked or downloadable/);
});

test("preview is interactive, accessible and never connected to clients, databases or gateways", async () => {
  const content = await readFile(ui, "utf8");
  assert.match(content, /aria-label="Preview sections"/);
  assert.match(content, /aria-current=/);
  assert.match(content, /aria-expanded=/);
  assert.match(content, /onChange=\{e => setScenario/);
  assert.match(content, /onClick=\{\(\) => setSection/);
  assert.match(content, /Payments are disabled/);
  assert.match(content, /request changes or decline it/);
  for (const forbidden of [
    /\bfetch\s*\(/,
    /process\.env/,
    /\baxios\b/,
    /@prisma/,
    /@\/lib\/client-workspace/,
    /\/api\//,
    /razorpay\.com/,
    /NEXT_PUBLIC_/,
    /localStorage/,
    /sessionStorage/,
    /credentials\s*:/,
  ]) {
    assert.doesNotMatch(content, forbidden, `preview must not use a live dependency: ${forbidden}`);
  }
});
