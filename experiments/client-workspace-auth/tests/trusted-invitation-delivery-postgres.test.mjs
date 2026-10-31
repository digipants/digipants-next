import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";

if (process.env.RUN_AUTH_EXPERIMENT_INTEGRATION !== "1") {
  test("trusted private invitation dispatch (disposable PG only)", {
    skip: "Requires explicit isolated PostgreSQL fixture.",
  }, () => {});
} else {
  assertDisposableLoopbackDatabaseUrl(process.env.AUTH_DATABASE_URL, "auth_spike_test");
  assertDisposableLoopbackDatabaseUrl(process.env.WORKSPACE_DATABASE_URL, "digipants_workspace_dev");
  process.env.AUTH_EXPERIMENT_ENABLED = "1";
  process.env.WORKSPACE_INVITE_TEST_DELIVERY_ENABLED = "1";
  const [{ getAuthPrisma, getWorkspacePrisma }, { dispatchInvitationForTrustedStaff }] = await Promise.all([
    import("../src/database.ts"), import("../src/trusted-invitation-delivery.ts"),
  ]);
  const authDb = getAuthPrisma();
  const db = getWorkspacePrisma();

  test("verified staff MFA, exact owner grant, recipient-only delivery and failure revocation", async t => {
    const id = {
      subject: randomUUID(), session: randomUUID(), principal: randomUUID(),
      tenantA: randomUUID(), tenantB: randomUUID(),
      projectA: randomUUID(), projectB: randomUUID(),
    };
    const delivered = [];
    const send = async message => {
      delivered.push(message);
      return true;
    };
    const dispatch = (overrides={}) => dispatchInvitationForTrustedStaff({
      sessionId: id.session,
      providerSubject: id.subject,
      tenantId: id.tenantA,
      projectId: id.projectA,
      intendedEmail: "Invited.Client+1@EXAMPLE.invalid",
      role: "client_viewer",
      send,
      ...overrides,
    });

    await t.after(async () => {
      try {
        // This test runs BEFORE append-only hardening in a disposable CI job.
        // Never delete audit rows in any production or hardened database.
        await db.$executeRaw`DELETE FROM workspace_audit_events WHERE tenant_id IN
          (${id.tenantA}::uuid,${id.tenantB}::uuid)`;
        await db.$executeRaw`DELETE FROM workspace_invitation_records WHERE tenant_id IN
          (${id.tenantA}::uuid,${id.tenantB}::uuid)`;
        await db.$executeRaw`DELETE FROM workspace_staff_project_grants WHERE tenant_id IN
          (${id.tenantA}::uuid,${id.tenantB}::uuid)`;
        await db.$executeRaw`DELETE FROM workspace_staff_memberships WHERE principal_id=${id.principal}::uuid`;
        await db.$executeRaw`DELETE FROM workspace_projects WHERE tenant_id IN
          (${id.tenantA}::uuid,${id.tenantB}::uuid)`;
        await db.$executeRaw`DELETE FROM workspace_principals WHERE id=${id.principal}::uuid`;
        await db.$executeRaw`DELETE FROM workspace_tenants WHERE id IN
          (${id.tenantA}::uuid,${id.tenantB}::uuid)`;
        await authDb.session.deleteMany({where:{ userId: id.subject }});
        await authDb.twoFactor.deleteMany({where:{ userId: id.subject }});
        await authDb.user.deleteMany({where:{ id: id.subject }});
      } finally {
        await db.$disconnect();
        await authDb.$disconnect();
      }
    });

    await authDb.user.create({data:{
      id:id.subject, name:"Synthetic Delivery Staff", email:`staff-${id.subject}@example.invalid`,
      emailVerified:true, twoFactorEnabled:true,
    }});
    await authDb.twoFactor.create({data:{
      id:randomUUID(), userId:id.subject, secret:"synthetic-only-factor",
      backupCodes:"[]", verified:true,
    }});
    await authDb.session.create({data:{
      id:id.session, userId:id.subject, token:randomUUID(),
      expiresAt:new Date(Date.now()+60*60_000), mfaVerifiedAt:new Date(),
    }});
    await db.$transaction(async tx => {
      await tx.$executeRaw`INSERT INTO workspace_tenants(id,legal_name) VALUES
        (${id.tenantA}::uuid,'Test invite tenant A'),(${id.tenantB}::uuid,'Test invite tenant B')`;
      await tx.$executeRaw`INSERT INTO workspace_principals(id,provider_subject,kind)
        VALUES (${id.principal}::uuid,${id.subject},'staff')`;
      await tx.$executeRaw`INSERT INTO workspace_staff_memberships(principal_id)
        VALUES (${id.principal}::uuid)`;
      await tx.$executeRaw`INSERT INTO workspace_projects(id,tenant_id,title) VALUES
        (${id.projectA}::uuid,${id.tenantA}::uuid,'Synthetic approved project'),
        (${id.projectB}::uuid,${id.tenantB}::uuid,'Another tenant project')`;
      await tx.$executeRaw`INSERT INTO workspace_staff_project_grants
        (tenant_id,project_id,principal_id,role) VALUES
        (${id.tenantA}::uuid,${id.projectA}::uuid,${id.principal}::uuid,'workspace_owner')`;
    });

    assert.equal(await dispatch({providerSubject:randomUUID()}), false);
    assert.equal(await dispatch({sessionId:randomUUID()}), false);
    assert.equal(await dispatch({tenantId:id.tenantB,projectId:id.projectB}), false);
    assert.equal(await dispatch({tenantId:id.tenantA,projectId:id.projectB}), false);
    assert.equal(await dispatch({role:"workspace_owner"}), false);
    assert.equal(delivered.length, 0, "all invalid requests must not send mail");

    assert.equal(await dispatch(), true);
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].to, "invited.client+1@example.invalid");
    assert.equal(delivered[0].text.includes("http://localhost:3000/workspace/invite/#invite="), true);
    const first = await db.$queryRaw`SELECT status, invitation_token_hash AS hash,
        intended_email AS email FROM workspace_invitation_records WHERE tenant_id=${id.tenantA}::uuid`;
    assert.equal(first.length, 1);
    assert.equal(first[0].status, "pending");
    assert.equal(first[0].email, delivered[0].to);
    assert.equal(delivered[0].text.includes(first[0].hash), false);
    assert.equal((await db.$queryRaw`SELECT count(*)::int AS n
      FROM workspace_client_project_grants WHERE tenant_id=${id.tenantA}::uuid`)[0].n, 0);

    assert.equal(await dispatch({send:async () => false}), false);
    assert.equal(await dispatch({send:async () => { throw Error("synthetic outage"); }}), false);
    const invites = await db.$queryRaw`SELECT status FROM workspace_invitation_records
      WHERE tenant_id=${id.tenantA}::uuid ORDER BY created_at, id`;
    assert.equal(invites.filter(x=>x.status==="pending").length, 1);
    assert.equal(invites.filter(x=>x.status==="revoked").length, 2);

    await authDb.session.update({where:{id:id.session},
      data:{mfaVerifiedAt:new Date(Date.now()-6*60_000)}});
    assert.equal(await dispatch(), false, "stale MFA denies");
    await authDb.session.update({where:{id:id.session},data:{mfaVerifiedAt:new Date()}});
    await authDb.user.update({where:{id:id.subject},data:{emailVerified:false}});
    assert.equal(await dispatch(), false, "unverified staff email denies");
    await authDb.user.update({where:{id:id.subject},data:{emailVerified:true}});
    await db.$executeRaw`UPDATE workspace_staff_project_grants SET status='revoked',
      revoked_at=statement_timestamp() WHERE principal_id=${id.principal}::uuid`;
    assert.equal(await dispatch(), false, "revoked owner grant denies");
    assert.equal(delivered.length, 1);

    const audit = await db.$queryRaw`SELECT action FROM workspace_audit_events
      WHERE tenant_id=${id.tenantA}::uuid`;
    assert.equal(audit.filter(x=>x.action==="invitation.issued").length, 3);
    assert.equal(audit.filter(x=>x.action==="invitation.revoked").length, 2);
  });
}
