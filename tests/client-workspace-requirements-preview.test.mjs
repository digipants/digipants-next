import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const main = new URL("../app/workspace-preview/WorkspacePreview.tsx", import.meta.url);
const extra = new URL("../app/workspace-preview/WorkspacePreviewNext.tsx", import.meta.url);

test("new client preview sections are navigable but remain fixture-only", async () => {
  const [mainSource, nextSource] = await Promise.all([
    readFile(main, "utf8"), readFile(extra, "utf8"),
  ]);
  for (const route of ["requirements", "documents"]) {
    assert.match(mainSource, new RegExp('id: "' + route + '"'));
    assert.match(mainSource, new RegExp('section === "' + route + '"'));
  }
  assert.match(mainSource, /<RequirementsPreview\/>/);
  assert.match(mainSource, /<DocumentsPreview\/>/);
  assert.match(nextSource, /Shared sample · v02/);
  assert.match(nextSource, /Open clarification questions/);
  assert.match(nextSource, /Published document register/);
  assert.match(nextSource, /Private means private/);
  assert.match(nextSource, /aria-live="polite"/);
  assert.match(nextSource, /htmlFor="preview-document-filter"/);
  assert.match(nextSource, /sharedDocuments\.filter/);
});

test("document entries are non-downloadable published examples, not client storage", async () => {
  const source = await readFile(extra, "utf8");
  assert.match(source, /These sample rows do not represent stored files/);
  assert.match(source, /Internal working files, unpublished revisions and developer evidence must stay out/);
  assert.match(source, /cannot be edited or approved here/);
  assert.match(source, /Approval action/);
  assert.match(source, /Disabled/);
  assert.match(source, /sharedDocuments/);
  for (const forbidden of [
    /\bfetch\s*\(/, /\baxios\b/, /process\.env/, /@prisma/, /\/api\//,
    /razorpay/i, /localStorage/, /sessionStorage/, /window\.open/,
    /href=/, /\bdownload=/, /\bonSubmit=/, /type="file"/,
    /FormData/, /navigator\./, /createObjectURL/, /NEXT_PUBLIC_/,
  ]) {
    assert.doesNotMatch(source, forbidden, "preview module must not cross the live boundary: " + forbidden);
  }
});
