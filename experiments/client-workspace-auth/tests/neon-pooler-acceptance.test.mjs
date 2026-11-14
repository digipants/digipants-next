import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  assertPooledNeonUrl, assertVerifiedPooledTlsSocket,
  CHILD_POOLER_HOST, CHILD_DATABASE, TENANT_A, PROJECT_A,
  createSignedContextToken,
} from "../scripts/neon-pooler-acceptance.mjs";

const pooled = "postgresql://cw_pooler_acceptance:" + "x".repeat(48) +
  "@" + CHILD_POOLER_HOST + "/" + CHILD_DATABASE +
  "?sslmode=verify-full&channel_binding=require";

test("only the pinned child pooler URL and restricted login are accepted", () => {
  assert.equal(assertPooledNeonUrl(pooled).hostname, CHILD_POOLER_HOST);
  const invalid = [
    pooled.replace("-pooler.", "."),
    pooled.replace(CHILD_POOLER_HOST, "ep-other-pooler.c-2.eu-west-2.aws.neon.tech"),
    pooled.replace("cw_pooler_acceptance", "postgres"),
    pooled.replace(CHILD_DATABASE, "digipants_auth_prod"),
    pooled.replace("verify-full", "require"),
    pooled.replace("?sslmode=verify-full&channel_binding=require", ""),
    pooled + "&host=attacker.invalid",
    pooled.replace("postgresql://", "http://"),
    pooled.replace(".neon.tech/", ".neon.tech:5433/"),
    pooled + "#fragment",
    "",
  ];
  for (const value of invalid) assert.throws(() => assertPooledNeonUrl(value));
});

test("TLS acceptance requires the actual authenticated TLS socket", () => {
  assert.throws(() => assertVerifiedPooledTlsSocket({}, CHILD_POOLER_HOST));
  assert.throws(() => assertVerifiedPooledTlsSocket({
    connection: { stream: {
      encrypted: true, authorized: true, authorizationError: null,
      getPeerCertificate: () => ({ subjectaltname: "DNS:" + CHILD_POOLER_HOST }),
    } },
  }, CHILD_POOLER_HOST));
});

test("signed scope token is transaction, tenant, project, actor and purpose bound", () => {
  const input = {
    transactionId: "742", tenantId: TENANT_A, projectId: PROJECT_A,
    actorSubject: "synthetic-security-staff-a", purpose: "delivery.edit",
  };
  const token = createSignedContextToken(input);
  const [payloadHex, signature] = token.split(".");
  const payload = Buffer.from(payloadHex, "hex");
  assert.equal(payload.toString("utf8"),
    "v1|742|" + TENANT_A + "|" + PROJECT_A +
    "|synthetic-security-staff-a|delivery.edit");
  assert.equal(signature, createHmac("sha256", Buffer.alloc(32, 0x11))
    .update(payload).digest("hex"));
  assert.notEqual(token, createSignedContextToken({ ...input, transactionId: "743" }));
  assert.notEqual(token, createSignedContextToken({
    ...input, tenantId: "22222222-2222-4222-8222-222222222222",
  }));
  assert.throws(() => createSignedContextToken({ ...input, transactionId: "not-a-xid" }));
});