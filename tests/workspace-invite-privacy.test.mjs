import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const text = await readFile(new URL("../lib/client-workspace/invite-fragment.ts",import.meta.url),"utf8");
const js = ts.transpileModule(text,{compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,
}}).outputText;
const {consumePrivateInvitationFragment}=await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);
const token = "x".repeat(43);

test("invitation bearer is extracted only after history is cleared",()=>{
  const calls=[];
  assert.equal(consumePrivateInvitationFragment("#invite="+token,()=>calls.push("cleared")),token);
  assert.deepEqual(calls,["cleared"]);
});
test("malformed, appended and encoded invitation fragments fail closed",()=>{
  for(const fragment of [
    "", "#invite=", "#invite="+token+"&next=https://evil.invalid",
    "#invite="+token+"%0a", "#invite="+token+"?email=private@example.invalid",
    "#INVITE="+token, "#invite="+token.slice(1), "#invite="+token+"!",
    "#invite="+encodeURIComponent(token)+"x", "#invite=not_a_token",
    null, {}, "#other="+token,
  ]){
    let cleared=0;
    assert.equal(consumePrivateInvitationFragment(fragment,()=>{cleared++;}),null);
    assert.equal(cleared,1);
  }
  assert.equal(consumePrivateInvitationFragment("#invite="+token,()=>{throw Error("history failure")}),null);
  assert.equal(consumePrivateInvitationFragment("#invite="+token,null),null);
});

test("invite route declares no-marketing, no-referrer, anti-framing headers",async()=>{
  const config = (await import("../next.config.mjs")).default;
  assert.equal(typeof config.headers,"function");
  const configs=await config.headers();
  const invite=configs.find(x=>x.source==="/workspace/invite/:path*");
  assert.ok(invite,"CSP applies to private invitation path, not the public marketing site");
  const headers=Object.fromEntries(invite.headers.map(x=>[x.key.toLowerCase(),x.value]));
  assert.match(headers["cache-control"],/no-store/);
  assert.equal(headers["referrer-policy"],"no-referrer");
  assert.match(headers["x-robots-tag"],/noindex/);
  for(const directive of ["connect-src 'self'","frame-ancestors 'none'","object-src 'none'","form-action 'self'"]){
    assert.ok(headers["content-security-policy"].includes(directive),directive);
  }
  assert.equal(/googletagmanager|google-analytics|https:\/\//.test(headers["content-security-policy"]),false);
});

test("workspace invitation page keeps production gate and never stores the token in browser storage",async()=>{
  const root=new URL("../app/workspace/invite/",import.meta.url);
  const client=await readFile(new URL("WorkspaceInvitation.tsx",root),"utf8");
  const page=await readFile(new URL("page.tsx",root),"utf8");
  assert.match(page,/NODE_ENV === "production"/);
  assert.match(client,/consumePrivateInvitationFragment/);
  assert.match(client,/history.replaceState/);
  assert.doesNotMatch(client,/localStorage|sessionStorage|trackPageView|gtag|analytics\.google/);
  assert.doesNotMatch(client,/location\.search/);
});
