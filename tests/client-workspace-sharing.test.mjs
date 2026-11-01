import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const path = new URL("../lib/client-workspace/sharing-projection.ts", import.meta.url);
const raw = await readFile(path, "utf8");
const js = ts.transpileModule(raw, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { formatVerifiedSharingRow } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const tenantId = "11111111-1111-4111-8111-111111111111";
const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const row = () => ({
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  tenantId, projectId, resourceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  kind: "document", version: 2, title: "Reviewed scope",
  summary: "Fictional client-safe summary",
  publishedAt: new Date("2026-10-31T00:00:00Z"),
  projectPublished: true, published: true, retracted: false,
  privateObjectRef: "obj_PRIVATE_INTERNAL_NEVER_SHARE_12345",
  contentSha256: "a".repeat(64),
  authToken: "NEVER_DISPLAY",
  reviewerEmail: "internal@example.invalid",
});

test("only safe published fields reach the client", () => {
  const view = formatVerifiedSharingRow(row(), { tenantId, projectId });
  assert.deepEqual(Object.keys(view).sort(), [
    "id", "kind", "resourceId", "version", "title", "summary", "publishedAt",
  ].sort());
  assert.equal(Object.isFrozen(view), true);
  const output = JSON.stringify(view);
  for (const secret of ["obj_PRIVATE", "NEVER_DISPLAY", "internal@example.invalid", "contentSha256"]) {
    assert.equal(output.includes(secret), false);
  }
});
test("wrong tenant/project, unpublished or withdrawn content fail closed", () => {
  for (const override of [
    { tenantId: "22222222-2222-4222-8222-222222222222" },
    { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    { projectPublished: false }, { published: false }, { retracted: true },
    { version: 0 }, { kind: "unknown" }, { publishedAt: "not a date" },
    { summary: "" }, { title: "" },
  ]) assert.equal(formatVerifiedSharingRow({ ...row(), ...override }, { tenantId, projectId }), null);
});
test("malformed and accessor inputs fail closed", () => {
  const evil = row();
  Object.defineProperty(evil, "title", { get() { throw new Error("unsafe accessor"); } });
  assert.equal(formatVerifiedSharingRow(evil, { tenantId, projectId }), null);
  assert.equal(formatVerifiedSharingRow(row(), { tenantId: "bad", projectId }), null);
  assert.equal(formatVerifiedSharingRow([], { tenantId, projectId }), null);
});
test("projection never independently authenticates or accesses storage/network", () => {
  for (const forbidden of [/\bfetch\s*\(/, /@prisma/, /process\.env/,
    /localStorage/, /sessionStorage/, /window\./, /href=/, /getSession\(/]) {
    assert.doesNotMatch(raw, forbidden);
  }
  assert.match(raw, /NOT authentication or an authorization gate/i);
});
