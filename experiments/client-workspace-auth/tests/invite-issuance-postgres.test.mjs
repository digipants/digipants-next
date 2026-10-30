import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import test from "node:test";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";
import { normalizeInvitedEmail } from "../src/invite-issuance.ts";

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
