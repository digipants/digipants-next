import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import test from "node:test";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";
import { normalizeInvitedEmail } from "../src/invite-issuance.ts";
import { setWorkspaceAuthorizationContext } from "../src/workspace-tenant-context.ts";

test("synthetic invitation recipient addresses are normalized and malformed ones rejected", () => {
  assert.equal(normalizeInvitedEmail("Client.Test+1@EXAMPLE.invalid"), "client.test+1@example.invalid");
  for (const bad of ["", " someone@example.test", "someone@example.test ", "a..b@example.test",
    "a@example", "a@-example.test", "a@x..test", "a\nb@example.test", null, {}, "x".repeat(255)]) {
    assert.equal(normalizeInvitedEmail(bad), null, String(bad));
  }
});

if (process.env.RUN_AUTH_EXPERIMENT_INTEGRATION !== "1") {
  test("audited invitation issuance (disposable PostgreSQL only)", { skip: "Enable synthetic loopback PG test explicitly." }, () => {});
} else {
  assertDisposableLoopbackDatabaseUrl(process.env.WORKSPACE_DATABASE_URL, "digipants_workspace_dev");
  process.env.AUTH_EXPERIMENT_ENABLED = "1";
  const [{ getWorkspacePrisma }, { issueClientInvitation, revokeClientInvitation }, { redeemClientInvitation }] = await Promise.all([
    import("../src/database.ts"), import("../src/invite-issuance.ts"), import("../src/invitations.ts"),
  ]);
  const db = getWorkspacePrisma();

  test("exact active project-owner issues and revokes hashed, audited invitations with no implicit rights", async (t) => {
    const id = {
      tenantA: randomUUID(), tenantB: randomUUID(),
      projectA: randomUUID(), projectB: randomUUID(),
      owner: randomUUID(), unassigned: randomUUID(),
    };
    const ownerSubject = `synthetic-invite-owner-${id.owner}`;
    const unassignedSubject = `synthetic-unassigned-${id.unassigned}`;
    const createdInvites = [];
    const common = {
      workspaceDb: db,
      issuerSubject: ownerSubject,
      tenantId: id.tenantA,
      projectId: id.projectA,
    };
    const issue = (overrides = {}) => issueClientInvitation({
      ...common,
      intendedEmail: "SYNTHETIC.Client+1@example.invalid",
      intendedRole: "client_viewer",
      ...overrides,
    });

    await t.after(async () => {
      try {
        await db.$executeRaw`DELETE FROM workspace_audit_events WHERE tenant_id IN (${id.tenantA}::uuid, ${id.tenantB}::uuid)`;
        await db.$executeRaw`DELETE FROM workspace_invitation_records WHERE tenant_id IN (${id.tenantA}::uuid, ${id.tenantB}::uuid)`;
        await db.$executeRaw`DELETE FROM workspace_staff_project_grants WHERE tenant_id IN (${id.tenantA}::uuid, ${id.tenantB}::uuid)`;
        await db.$executeRaw`DELETE FROM workspace_staff_memberships WHERE principal_id IN (${id.owner}::uuid, ${id.unassigned}::uuid)`;
        await db.$executeRaw`DELETE FROM workspace_projects WHERE tenant_id IN (${id.tenantA}::uuid, ${id.tenantB}::uuid)`;
        await db.$executeRaw`DELETE FROM workspace_principals WHERE id IN (${id.owner}::uuid, ${id.unassigned}::uuid)`;
        await db.$executeRaw`DELETE FROM workspace_tenants WHERE id IN (${id.tenantA}::uuid, ${id.tenantB}::uuid)`;
      } finally {
        await db.$disconnect();
      }
    });

    await db.$transaction(async tx => {
      await tx.$executeRaw`INSERT INTO workspace_tenants(id,legal_name) VALUES (${id.tenantA}::uuid,'Synthetic Invite A'),(${id.tenantB}::uuid,'Synthetic Invite B')`;
      await tx.$executeRaw`INSERT INTO workspace_principals(id,provider_subject,kind) VALUES (${id.owner}::uuid,${ownerSubject},'staff'),(${id.unassigned}::uuid,${unassignedSubject},'staff')`;
      await tx.$executeRaw`INSERT INTO workspace_staff_memberships(principal_id) VALUES (${id.owner}::uuid),(${id.unassigned}::uuid)`;
      await tx.$executeRaw`INSERT INTO workspace_projects(id,tenant_id,title) VALUES (${id.projectA}::uuid,${id.tenantA}::uuid,'Synthetic invite A'),(${id.projectB}::uuid,${id.tenantB}::uuid,'Synthetic invite B')`;
      await tx.$executeRaw`INSERT INTO workspace_staff_project_grants(tenant_id,project_id,principal_id,role) VALUES (${id.tenantA}::uuid,${id.projectA}::uuid,${id.owner}::uuid,'workspace_owner')`;
    });

    const context = await db.$transaction(async tx => {
      await setWorkspaceAuthorizationContext(tx, {
        tenantId: id.tenantA, projectId: id.projectA,
        actorSubject: ownerSubject, purpose: "project.activate",
      });
      return tx.$queryRaw`WITH context AS (
          SELECT current_setting('app.workspace_context_token', true) AS token
        ), decoded AS (
          SELECT token, decode(split_part(token, '.', 1), 'hex') AS payload_bytes
            FROM context WHERE token IS NOT NULL
        ), payload AS (
          SELECT token, payload_bytes, convert_from(payload_bytes, 'UTF8') AS value FROM decoded
        )
        SELECT context.token IS NOT NULL AS token_set,
          COALESCE(context.token ~ '^[0-9a-f]+\.[0-9a-f]{64}$' AND length(context.token) <= 1089, false) AS token_format_matches,
          COALESCE(split_part(payload.value, '|', 1) = 'v1', false) AS version_matches,
          COALESCE(split_part(payload.value, '|', 2) = pg_current_xact_id()::text, false) AS transaction_matches,
          COALESCE(split_part(payload.value, '|', 3) = ${id.tenantA}, false) AS tenant_matches,
          COALESCE(split_part(payload.value, '|', 4) = ${id.projectA}, false) AS project_matches,
          COALESCE(split_part(payload.value, '|', 5) = ${ownerSubject}, false) AS actor_matches,
          COALESCE(split_part(payload.value, '|', 6) = 'project.activate', false) AS purpose_matches,
          COALESCE(EXISTS (SELECT 1 FROM public.workspace_context_signing_keys
            WHERE singleton AND signing_key = decode(repeat('11',32),'hex')), false) AS synthetic_key_present,
          COALESCE(has_table_privilege('cw_schema_owner',
            'public.workspace_context_signing_keys', 'SELECT'), false) AS owner_can_read_key,
          COALESCE(has_function_privilege('cw_schema_owner',
            'public.hmac(bytea,bytea,text)', 'EXECUTE'), false) AS owner_can_hmac,
          COALESCE(public.hmac(payload.payload_bytes, signing.signing_key, 'sha256') =
            decode(split_part(payload.token, '.', 2), 'hex'), false) AS signature_matches,
          public.cw_workspace_context_tenant_id()::text AS tenant_id
          FROM context LEFT JOIN payload ON true
          LEFT JOIN public.workspace_context_signing_keys AS signing ON signing.singleton`;
    });
    assert.equal(context[0]?.token_set, true, "transaction-local signed scope was set");
    assert.equal(context[0]?.token_format_matches, true, "signed scope matches the database token format");
    assert.equal(context[0]?.version_matches, true, "signed scope uses a supported version");
    assert.equal(context[0]?.transaction_matches, true, "signed scope is transaction-bound");
    assert.equal(context[0]?.tenant_matches, true, "signed scope contains the requested tenant");
    assert.equal(context[0]?.project_matches, true, "signed scope contains the requested project");
    assert.equal(context[0]?.actor_matches, true, "signed scope contains the authenticated actor");
    assert.equal(context[0]?.purpose_matches, true, "signed scope contains the requested action");
    assert.equal(context[0]?.synthetic_key_present, true, "isolated test database has the synthetic key");
    assert.equal(context[0]?.owner_can_read_key, true, "validator owner can read the protected key");
    assert.equal(context[0]?.owner_can_hmac, true, "validator owner can execute HMAC");
    assert.equal(context[0]?.signature_matches, true, "signed scope matches the synthetic DB key");
    assert.equal(context[0]?.tenant_id, id.tenantA,
      "PostgreSQL accepts the signed tenant scope inside its originating transaction");

    const inviteA = await issue();
    assert.ok(inviteA, "only an active owner of this project can issue");
    createdInvites.push(inviteA.id);
    assert.equal(inviteA.email, "synthetic.client+1@example.invalid");
    assert.ok(inviteA.token.length >= 32);

    const rows = await db.$queryRaw`SELECT intended_email, intended_role, status, invitation_token_hash, issued_by_staff_id::text AS issuer,
      expires_at > statement_timestamp() AS future, expires_at <= statement_timestamp() + interval '21 minutes' AS bounded
      FROM workspace_invitation_records WHERE id = ${inviteA.id}::uuid`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].intended_email, inviteA.email);
    assert.equal(rows[0].intended_role, "client_viewer");
    assert.equal(rows[0].status, "pending");
    assert.equal(rows[0].issuer, id.owner);
    assert.equal(rows[0].future, true);
    assert.equal(rows[0].bounded, true);
    assert.equal(rows[0].invitation_token_hash, createHash("sha256").update(inviteA.token).digest("hex"));
    assert.notEqual(rows[0].invitation_token_hash, inviteA.token);
    const noImplicitGrants = await db.$queryRaw`SELECT count(*)::int AS n FROM workspace_client_project_grants WHERE tenant_id=${id.tenantA}::uuid`;
    assert.equal(noImplicitGrants[0].n, 0);

    assert.equal(await issue({ issuerSubject: unassignedSubject }), null, "unassigned staff never invites");
    assert.equal(await issue({ tenantId: id.tenantB, projectId: id.projectB }), null, "owner of tenant A cannot issue for tenant B");
    assert.equal(await issue({ tenantId: id.tenantA, projectId: id.projectB }), null, "cross-tenant project mismatch denies");
    assert.equal(await issue({ intendedRole: "workspace_owner" }), null, "cannot mint a staff-role invite");
    assert.equal(await issue({ intendedEmail: "invalid@unknown" }), null);
    assert.equal(await issue({ issuerSubject: "untrusted-user" }), null);

    const inviteB = await issue({ intendedRole: "client_approver" });
    assert.ok(inviteB && inviteB.token !== inviteA.token);
    createdInvites.push(inviteB.id);
    const hashes = await db.$queryRaw`SELECT invitation_token_hash FROM workspace_invitation_records WHERE id IN (${inviteA.id}::uuid,${inviteB.id}::uuid)`;
    assert.notEqual(hashes[0].invitation_token_hash, hashes[1].invitation_token_hash);

    const revokeWrongIssuer = await revokeClientInvitation({ ...common, issuerSubject: unassignedSubject, invitationId: inviteA.id });
    assert.equal(revokeWrongIssuer, false);
    const revokeWrongTenant = await revokeClientInvitation({ ...common, tenantId: id.tenantB, projectId: id.projectB, invitationId: inviteA.id });
    assert.equal(revokeWrongTenant, false);
    assert.equal(await revokeClientInvitation({ ...common, invitationId: inviteA.id }), true);
    assert.equal(await revokeClientInvitation({ ...common, invitationId: inviteA.id }), false, "cannot revoke twice");
    assert.equal(await redeemClientInvitation({
      workspaceDb: db, token: inviteA.token, intendedEmail: inviteA.email,
      providerSubject: `synthetic-invalid-redemption-${randomUUID()}`,
    }), false, "revoked token can never be redeemed");

    const audit = await db.$queryRaw`SELECT action, actor_principal_id::text AS actor, object_id FROM workspace_audit_events
      WHERE tenant_id=${id.tenantA}::uuid AND project_id=${id.projectA}::uuid ORDER BY occurred_at, id`;
    assert.equal(audit.filter(x => x.action === "invitation.issued").length, 2);
    assert.equal(audit.filter(x => x.action === "invitation.revoked").length, 1);
    assert.ok(audit.every(x => x.actor === id.owner));
    assert.ok(audit.every(x => createdInvites.includes(x.object_id)));

    await db.$executeRaw`UPDATE workspace_staff_project_grants SET status='revoked', revoked_at=statement_timestamp()
      WHERE tenant_id=${id.tenantA}::uuid AND project_id=${id.projectA}::uuid AND principal_id=${id.owner}::uuid`;
    assert.equal(await issue(), null, "revoked owner grant cannot issue");
    assert.equal(await revokeClientInvitation({ ...common, invitationId: inviteB.id }), false, "revoked owner cannot revoke");
  });
}
 AND length(context.token) <= 1089, false) AS token_format_matches,
          COALESCE(split_part(payload.value, '|', 1) = 'v1', false) AS version_matches,
          COALESCE(split_part(payload.value, '|', 2) = pg_current_xact_id()::text, false) AS transaction_matches,
          COALESCE(split_part(payload.value, '|', 3) = ${id.tenantA}, false) AS tenant_matches,
          COALESCE(split_part(payload.value, '|', 4) = ${id.projectA}, false) AS project_matches,
          COALESCE(split_part(payload.value, '|', 5) = ${ownerSubject}, false) AS actor_matches,
          COALESCE(split_part(payload.value, '|', 6) = 'project.activate', false) AS purpose_matches,
          COALESCE(EXISTS (SELECT 1 FROM public.workspace_context_signing_keys
            WHERE singleton AND signing_key = decode(repeat('11',32),'hex')), false) AS synthetic_key_present,
          COALESCE(has_table_privilege('cw_schema_owner',
            'public.workspace_context_signing_keys', 'SELECT'), false) AS owner_can_read_key,
          COALESCE(has_function_privilege('cw_schema_owner',
            'public.hmac(bytea,bytea,text)', 'EXECUTE'), false) AS owner_can_hmac,
          COALESCE(public.hmac(payload.payload_bytes, signing.signing_key, 'sha256') =
            decode(split_part(payload.token, '.', 2), 'hex'), false) AS signature_matches,
          public.cw_workspace_context_tenant_id()::text AS tenant_id
          FROM context LEFT JOIN payload ON true
          LEFT JOIN public.workspace_context_signing_keys AS signing ON signing.singleton`;
    });
    assert.equal(context[0]?.token_set, true, "transaction-local signed scope was set");
    assert.equal(context[0]?.token_format_matches, true, "signed scope matches the database token format");
    assert.equal(context[0]?.version_matches, true, "signed scope uses a supported version");
    assert.equal(context[0]?.transaction_matches, true, "signed scope is transaction-bound");
    assert.equal(context[0]?.tenant_matches, true, "signed scope contains the requested tenant");
    assert.equal(context[0]?.project_matches, true, "signed scope contains the requested project");
    assert.equal(context[0]?.actor_matches, true, "signed scope contains the authenticated actor");
    assert.equal(context[0]?.purpose_matches, true, "signed scope contains the requested action");
    assert.equal(context[0]?.synthetic_key_present, true, "isolated test database has the synthetic key");
    assert.equal(context[0]?.owner_can_read_key, true, "validator owner can read the protected key");
    assert.equal(context[0]?.owner_can_hmac, true, "validator owner can execute HMAC");
    assert.equal(context[0]?.signature_matches, true, "signed scope matches the synthetic DB key");
    assert.equal(context[0]?.tenant_id, id.tenantA,
      "PostgreSQL accepts the signed tenant scope inside its originating transaction");

    const inviteA = await issue();
    assert.ok(inviteA, "only an active owner of this project can issue");
    createdInvites.push(inviteA.id);
    assert.equal(inviteA.email, "synthetic.client+1@example.invalid");
    assert.ok(inviteA.token.length >= 32);

    const rows = await db.$queryRaw`SELECT intended_email, intended_role, status, invitation_token_hash, issued_by_staff_id::text AS issuer,
      expires_at > statement_timestamp() AS future, expires_at <= statement_timestamp() + interval '21 minutes' AS bounded
      FROM workspace_invitation_records WHERE id = ${inviteA.id}::uuid`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].intended_email, inviteA.email);
    assert.equal(rows[0].intended_role, "client_viewer");
    assert.equal(rows[0].status, "pending");
    assert.equal(rows[0].issuer, id.owner);
    assert.equal(rows[0].future, true);
    assert.equal(rows[0].bounded, true);
    assert.equal(rows[0].invitation_token_hash, createHash("sha256").update(inviteA.token).digest("hex"));
    assert.notEqual(rows[0].invitation_token_hash, inviteA.token);
    const noImplicitGrants = await db.$queryRaw`SELECT count(*)::int AS n FROM workspace_client_project_grants WHERE tenant_id=${id.tenantA}::uuid`;
    assert.equal(noImplicitGrants[0].n, 0);

    assert.equal(await issue({ issuerSubject: unassignedSubject }), null, "unassigned staff never invites");
    assert.equal(await issue({ tenantId: id.tenantB, projectId: id.projectB }), null, "owner of tenant A cannot issue for tenant B");
    assert.equal(await issue({ tenantId: id.tenantA, projectId: id.projectB }), null, "cross-tenant project mismatch denies");
    assert.equal(await issue({ intendedRole: "workspace_owner" }), null, "cannot mint a staff-role invite");
    assert.equal(await issue({ intendedEmail: "invalid@unknown" }), null);
    assert.equal(await issue({ issuerSubject: "untrusted-user" }), null);

    const inviteB = await issue({ intendedRole: "client_approver" });
    assert.ok(inviteB && inviteB.token !== inviteA.token);
    createdInvites.push(inviteB.id);
    const hashes = await db.$queryRaw`SELECT invitation_token_hash FROM workspace_invitation_records WHERE id IN (${inviteA.id}::uuid,${inviteB.id}::uuid)`;
    assert.notEqual(hashes[0].invitation_token_hash, hashes[1].invitation_token_hash);

    const revokeWrongIssuer = await revokeClientInvitation({ ...common, issuerSubject: unassignedSubject, invitationId: inviteA.id });
    assert.equal(revokeWrongIssuer, false);
    const revokeWrongTenant = await revokeClientInvitation({ ...common, tenantId: id.tenantB, projectId: id.projectB, invitationId: inviteA.id });
    assert.equal(revokeWrongTenant, false);
    assert.equal(await revokeClientInvitation({ ...common, invitationId: inviteA.id }), true);
    assert.equal(await revokeClientInvitation({ ...common, invitationId: inviteA.id }), false, "cannot revoke twice");
    assert.equal(await redeemClientInvitation({
      workspaceDb: db, token: inviteA.token, intendedEmail: inviteA.email,
      providerSubject: `synthetic-invalid-redemption-${randomUUID()}`,
    }), false, "revoked token can never be redeemed");

    const audit = await db.$queryRaw`SELECT action, actor_principal_id::text AS actor, object_id FROM workspace_audit_events
      WHERE tenant_id=${id.tenantA}::uuid AND project_id=${id.projectA}::uuid ORDER BY occurred_at, id`;
    assert.equal(audit.filter(x => x.action === "invitation.issued").length, 2);
    assert.equal(audit.filter(x => x.action === "invitation.revoked").length, 1);
    assert.ok(audit.every(x => x.actor === id.owner));
    assert.ok(audit.every(x => createdInvites.includes(x.object_id)));

    await db.$executeRaw`UPDATE workspace_staff_project_grants SET status='revoked', revoked_at=statement_timestamp()
      WHERE tenant_id=${id.tenantA}::uuid AND project_id=${id.projectA}::uuid AND principal_id=${id.owner}::uuid`;
    assert.equal(await issue(), null, "revoked owner grant cannot issue");
    assert.equal(await revokeClientInvitation({ ...common, invitationId: inviteB.id }), false, "revoked owner cannot revoke");
  });
}
