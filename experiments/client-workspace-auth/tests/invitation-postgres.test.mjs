import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import test from "node:test";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";
import { redeemClientInvitation } from "../src/invitations.ts";

const enabled = process.env.RUN_AUTH_EXPERIMENT_INTEGRATION === "1";

if (!enabled) {
  test("invitation transaction on PostgreSQL 17 (loopback fixture only)", { skip: "Set RUN_AUTH_EXPERIMENT_INTEGRATION=1 with the named disposable PostgreSQL database." }, () => {});
} else {
  const workspaceUrl = process.env.WORKSPACE_DATABASE_URL;
  assertDisposableLoopbackDatabaseUrl(workspaceUrl, "digipants_workspace_dev");
  const { Pool } = pg;
  const pool = new Pool({ connectionString: workspaceUrl, max: 4, connectionTimeoutMillis: 5_000 });

  function compile(strings, values) {
    let text = strings[0];
    for (let index = 0; index < values.length; index += 1) {
      text += `$${index + 1}${strings[index + 1]}`;
    }
    return { text, values };
  }

  function transactionClient(client) {
    return {
      async $queryRaw(strings, ...values) {
        const result = await client.query(compile(strings, values));
        return result.rows;
      },
      async $executeRaw(strings, ...values) {
        const result = await client.query(compile(strings, values));
        return result.rowCount ?? 0;
      },
    };
  }

  const workspaceDb = {
    async $transaction(operation) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await operation(transactionClient(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };

  test("invitation redemption is scoped, expiring, single use and grants no permissions", async (t) => {
    const tenantId = randomUUID();
    const projectId = randomUUID();
    const staffId = randomUUID();
    const staffSubject = `synthetic-inviter-${staffId}`;
    const token = randomBytes(32).toString("base64url");
    const invitationId = randomUUID();
    const expiredToken = randomBytes(32).toString("base64url");
    const expiredInvitationId = randomUUID();
    const revokedToken = randomBytes(32).toString("base64url");
    const revokedInvitationId = randomUUID();
    const mismatchToken = randomBytes(32).toString("base64url");
    const mismatchInvitationId = randomUUID();
    const email = `invite-${randomUUID()}@example.invalid`;
    const candidateSubjects = [`synthetic-client-${randomUUID()}`, `synthetic-client-${randomUUID()}`];
    let candidatePrincipalIds = [];

    await t.after(async () => {
      await pool.query("DELETE FROM workspace_invitation_records WHERE id = ANY($1::uuid[])", [[invitationId, expiredInvitationId, revokedInvitationId, mismatchInvitationId]]);
      if (candidatePrincipalIds.length > 0) {
        await pool.query("DELETE FROM workspace_client_project_grants WHERE principal_id = ANY($1::uuid[])", [candidatePrincipalIds]);
        await pool.query("DELETE FROM workspace_client_memberships WHERE principal_id = ANY($1::uuid[])", [candidatePrincipalIds]);
        await pool.query("DELETE FROM workspace_principals WHERE id = ANY($1::uuid[])", [candidatePrincipalIds]);
      }
      await pool.query("DELETE FROM workspace_staff_memberships WHERE principal_id = $1::uuid", [staffId]);
      await pool.query("DELETE FROM workspace_principals WHERE id = $1::uuid", [staffId]);
      await pool.query("DELETE FROM workspace_projects WHERE tenant_id = $1::uuid", [tenantId]);
      await pool.query("DELETE FROM workspace_tenants WHERE id = $1::uuid", [tenantId]);
      await pool.end();
    });

    await pool.query("INSERT INTO workspace_tenants (id, legal_name) VALUES ($1, $2)", [tenantId, "Synthetic invitation fixture"]);
    await pool.query("INSERT INTO workspace_principals (id, provider_subject, kind) VALUES ($1, $2, 'staff')", [staffId, staffSubject]);
    await pool.query("INSERT INTO workspace_staff_memberships (principal_id) VALUES ($1)", [staffId]);
    await pool.query("INSERT INTO workspace_projects (id, tenant_id, title) VALUES ($1, $2, 'Synthetic invited project')", [projectId, tenantId]);

    async function addInvitation(id, intendedEmail, rawToken, expiresAt) {
      await pool.query(
        `INSERT INTO workspace_invitation_records
          (id, tenant_id, project_id, intended_email, intended_role, invitation_token_hash, issued_by_staff_id, expires_at)
         VALUES ($1, $2, $3, $4, 'client_approver', $5, $6, $7)`,
        [id, tenantId, projectId, intendedEmail, createHash("sha256").update(rawToken).digest("hex"), staffId, expiresAt],
      );
    }

    await addInvitation(invitationId, email, token, new Date(Date.now() + 60_000));
    await addInvitation(expiredInvitationId, `expired-${randomUUID()}@example.invalid`, expiredToken, new Date(Date.now() - 60_000));
    await addInvitation(revokedInvitationId, `revoked-${randomUUID()}@example.invalid`, revokedToken, new Date(Date.now() + 60_000));
    await addInvitation(mismatchInvitationId, `intended-${randomUUID()}@example.invalid`, mismatchToken, new Date(Date.now() + 60_000));
    await pool.query("UPDATE workspace_invitation_records SET status = 'revoked' WHERE id = $1", [revokedInvitationId]);

    const concurrentResults = await Promise.all([
      redeemClientInvitation({ workspaceDb, token, intendedEmail: email, providerSubject: candidateSubjects[0] }),
      redeemClientInvitation({ workspaceDb, token, intendedEmail: email, providerSubject: candidateSubjects[1] }),
    ]);
    assert.deepEqual(concurrentResults.sort(), [false, true], "exactly one racing redemption may consume a token");

    const redeemed = await pool.query(
      "SELECT status, redeemed_by_client_id, intended_role, invitation_token_hash FROM workspace_invitation_records WHERE id = $1",
      [invitationId],
    );
    assert.equal(redeemed.rows[0].status, "redeemed");
    assert.equal(redeemed.rows[0].intended_role, "client_approver");
    assert.equal(redeemed.rows[0].invitation_token_hash, createHash("sha256").update(token).digest("hex"));
    assert.ok(redeemed.rows[0].redeemed_by_client_id);
    candidatePrincipalIds = (await pool.query(
      "SELECT id FROM workspace_principals WHERE provider_subject = ANY($1::text[])",
      [candidateSubjects],
    )).rows.map((row) => row.id);
    assert.equal(candidatePrincipalIds.length, 1);
    const noGrant = await pool.query(
      `SELECT (SELECT count(*) FROM workspace_client_memberships WHERE principal_id = $1) AS memberships,
              (SELECT count(*) FROM workspace_client_project_grants WHERE principal_id = $1) AS grants`,
      [redeemed.rows[0].redeemed_by_client_id],
    );
    assert.equal(Number(noGrant.rows[0].memberships), 0);
    assert.equal(Number(noGrant.rows[0].grants), 0);

    assert.equal(await redeemClientInvitation({
      workspaceDb,
      token,
      intendedEmail: email,
      providerSubject: `synthetic-replay-${randomUUID()}`,
    }), false, "redeemed invitation replay must fail");

    const expiredEmail = (await pool.query("SELECT intended_email FROM workspace_invitation_records WHERE id = $1", [expiredInvitationId])).rows[0].intended_email;
    assert.equal(await redeemClientInvitation({ workspaceDb, token: expiredToken, intendedEmail: expiredEmail, providerSubject: `synthetic-expired-${randomUUID()}` }), false);
    const revokedEmail = (await pool.query("SELECT intended_email FROM workspace_invitation_records WHERE id = $1", [revokedInvitationId])).rows[0].intended_email;
    assert.equal(await redeemClientInvitation({ workspaceDb, token: revokedToken, intendedEmail: revokedEmail, providerSubject: `synthetic-revoked-${randomUUID()}` }), false);
    assert.equal(await redeemClientInvitation({ workspaceDb, token: mismatchToken, intendedEmail: email, providerSubject: `synthetic-mismatch-${randomUUID()}` }), false);

    const mismatchStatus = await pool.query("SELECT status FROM workspace_invitation_records WHERE id = $1", [mismatchInvitationId]);
    assert.equal(mismatchStatus.rows[0].status, "pending", "mismatched recipient cannot consume another person's invite");
  });
}
