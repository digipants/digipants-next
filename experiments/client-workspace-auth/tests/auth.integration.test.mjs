import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";

const enabled = process.env.RUN_AUTH_EXPERIMENT_INTEGRATION === "1";

if (!enabled) {
  test("Better Auth/PostgreSQL integration (loopback fixture only)", { skip: "Set RUN_AUTH_EXPERIMENT_INTEGRATION=1 with the named disposable PostgreSQL databases." }, () => {});
} else {
  assertDisposableLoopbackDatabaseUrl(process.env.AUTH_DATABASE_URL, "auth_spike_test");
  assertDisposableLoopbackDatabaseUrl(process.env.AUTH_SHADOW_DATABASE_URL, "auth_spike_shadow");
  assertDisposableLoopbackDatabaseUrl(process.env.WORKSPACE_DATABASE_URL, "digipants_workspace_dev");

  process.env.AUTH_EXPERIMENT_ENABLED = "1";
  process.env.BETTER_AUTH_SECRET ??= randomBytes(32).toString("hex");
  process.env.AUTH_BASE_URL ??= "http://localhost:3000/api/auth";

  const [{ PrismaPg }, { PrismaClient }, { symmetricDecrypt }] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("../generated/client/index.js"),
    import("better-auth/crypto"),
  ]);

  const authDb = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.AUTH_DATABASE_URL, max: 1, connectionTimeoutMillis: 5_000 }),
  });
  const workspaceDb = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.WORKSPACE_DATABASE_URL, max: 1, connectionTimeoutMillis: 5_000 }),
  });
  globalThis.authExperimentAuthDb = authDb;
  globalThis.authExperimentWorkspaceDb = workspaceDb;
  const [{ auth }, { redeemClientInvitation }, { authorizeValidatedWorkspaceAction }] = await Promise.all([
    import("../src/auth.ts"),
    import("../src/invitations.ts"),
    import("../src/workspace-access-core.ts"),
  ]);

  function totp(secret, at = Date.now()) {
    const counter = BigInt(Math.floor(at / 30_000));
    const bytes = Buffer.alloc(8);
    bytes.writeBigUInt64BE(counter);
    const hmac = createHmac("sha1", Buffer.from(secret, "utf8")).update(bytes).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(binary % 1_000_000).padStart(6, "0");
  }

  function changedCode(code) {
    const digit = Number(code.at(-1));
    return `${code.slice(0, -1)}${(digit + 1) % 10}`;
  }

  function cookieJar() {
    const values = new Map();
    return {
      header() { return [...values].map(([name, value]) => `${name}=${value}`).join("; "); },
      absorb(headers) {
        for (const cookie of headers.getSetCookie()) {
          const first = cookie.split(";", 1)[0];
          const separator = first.indexOf("=");
          if (separator < 1) continue;
          const name = first.slice(0, separator);
          const value = first.slice(separator + 1);
          if (!value || /max-age=0/i.test(cookie)) values.delete(name);
          else values.set(name, value);
        }
      },
      clear() { values.clear(); },
    };
  }

  async function send(path, body, jar, extraHeaders = {}) {
    const headers = new Headers({
      "content-type": "application/json",
      origin: "http://localhost:3000",
      ...extraHeaders,
    });
    if (jar?.header()) headers.set("cookie", jar.header());
    const response = await auth.handler(new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
    }));
    jar?.absorb(response.headers);
    let payload = null;
    try { payload = await response.json(); } catch {}
    return { response, payload, headers };
  }

  async function loadExistingGrantQuery() {
    const fixtureDoubleKey = "__authExperimentWorkspacePrisma";
    globalThis[fixtureDoubleKey] = workspaceDb;
    let source = await readFile(new URL("../../../lib/client-workspace/effective-grants.ts", import.meta.url), "utf8");
    source = source.replace(/^import "server-only";\s*/m, "");
    source = source.replace(
      'import { getWorkspacePrisma } from "./database";',
      `const getWorkspacePrisma = () => globalThis.${fixtureDoubleKey};`,
    );
    const javascript = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
    return module.loadEffectiveWorkspaceGrants;
  }

  test("invitation-only enrollment, real 2FA assurance, lockout, replay and revocation", async (t) => {
    const ids = {
      tenant: randomUUID(),
      project: randomUUID(),
      staff: randomUUID(),
      clientEmail: `auth-fixture-${randomUUID()}@example.invalid`,
      principal: null,
      authUser: null,
    };
    const validToken = randomBytes(32).toString("base64url");
    const validInviteId = randomUUID();
    const expiredToken = randomBytes(32).toString("base64url");
    const expiredInviteId = randomUUID();
    const revokedToken = randomBytes(32).toString("base64url");
    const revokedInviteId = randomUUID();
    const mismatchedToken = randomBytes(32).toString("base64url");
    const mismatchedInviteId = randomUUID();
    const issuerSubject = `synthetic-staff-${ids.staff}`;
    const password = "fixture-only-password-not-a-real-credential-51!";
    const jar = cookieJar();
    let created = false;

    await t.after(async () => {
      if (ids.principal) {
        await workspaceDb.$executeRaw`DELETE FROM workspace_client_project_grants WHERE principal_id = ${ids.principal}::uuid`;
        await workspaceDb.$executeRaw`DELETE FROM workspace_client_memberships WHERE principal_id = ${ids.principal}::uuid`;
      }
      await workspaceDb.$executeRaw`DELETE FROM workspace_invitation_records WHERE id IN (${validInviteId}::uuid, ${expiredInviteId}::uuid, ${revokedInviteId}::uuid, ${mismatchedInviteId}::uuid)`;
      if (ids.principal) await workspaceDb.$executeRaw`DELETE FROM workspace_principals WHERE id = ${ids.principal}::uuid`;
      await workspaceDb.$executeRaw`DELETE FROM workspace_staff_memberships WHERE principal_id = ${ids.staff}::uuid`;
      await workspaceDb.$executeRaw`DELETE FROM workspace_principals WHERE id = ${ids.staff}::uuid`;
      await workspaceDb.$executeRaw`DELETE FROM workspace_projects WHERE tenant_id = ${ids.tenant}::uuid`;
      await workspaceDb.$executeRaw`DELETE FROM workspace_tenants WHERE id = ${ids.tenant}::uuid`;
      if (created && ids.authUser) await authDb.user.deleteMany({ where: { id: ids.authUser } });
      await authDb.$disconnect();
      await workspaceDb.$disconnect();
      delete globalThis.authExperimentAuthDb;
      delete globalThis.authExperimentWorkspaceDb;
      delete globalThis.__authExperimentWorkspacePrisma;
    });

    await workspaceDb.$executeRaw`INSERT INTO workspace_tenants (id, legal_name) VALUES (${ids.tenant}::uuid, 'Synthetic auth experiment tenant')`;
    await workspaceDb.$executeRaw`INSERT INTO workspace_principals (id, provider_subject, kind) VALUES (${ids.staff}::uuid, ${issuerSubject}, 'staff')`;
    await workspaceDb.$executeRaw`INSERT INTO workspace_staff_memberships (principal_id) VALUES (${ids.staff}::uuid)`;
    await workspaceDb.$executeRaw`INSERT INTO workspace_projects (id, tenant_id, title, publication) VALUES (${ids.project}::uuid, ${ids.tenant}::uuid, 'Synthetic security fixture', 'published')`;

    async function insertInvitation(id, email, token, expiresAt) {
      await workspaceDb.$executeRaw`
        INSERT INTO workspace_invitation_records
          (id, tenant_id, project_id, intended_email, intended_role, invitation_token_hash, issued_by_staff_id, expires_at)
        VALUES
          (${id}::uuid, ${ids.tenant}::uuid, ${ids.project}::uuid, ${email}, 'client_approver', ${createHash("sha256").update(token).digest("hex")}, ${ids.staff}::uuid, ${expiresAt})
      `;
    }

    await insertInvitation(validInviteId, ids.clientEmail, validToken, new Date(Date.now() + 60 * 60 * 1_000));
    await insertInvitation(expiredInviteId, `expired-${randomUUID()}@example.invalid`, expiredToken, new Date(Date.now() - 60_000));
    await insertInvitation(revokedInviteId, `revoked-${randomUUID()}@example.invalid`, revokedToken, new Date(Date.now() + 60 * 60 * 1_000));
    await insertInvitation(mismatchedInviteId, `other-${randomUUID()}@example.invalid`, mismatchedToken, new Date(Date.now() + 60 * 60 * 1_000));
    await workspaceDb.$executeRaw`UPDATE workspace_invitation_records SET status = 'revoked' WHERE id = ${revokedInviteId}::uuid`;

    const deniedEmail = `uninvited-${randomUUID()}@example.invalid`;
    const countBefore = await authDb.user.count({ where: { email: deniedEmail } });
    const deniedDirectSignup = await send("/sign-up/email", {
      name: "Synthetic Uninvited",
      email: deniedEmail,
      password,
    }, jar);
    assert.equal(deniedDirectSignup.response.ok, false, "uninvited direct signup must fail");
    assert.equal(await authDb.user.count({ where: { email: deniedEmail } }), countBefore,
      "denied signup must not create a user for the uninvited email");

    for (const path of [
      "/sign-in/social", "/sign-in/magic-link", "/sign-in/email-otp", "/sign-in/phone-number",
      "/sign-in/username", "/sign-in/passkey", "/sign-up/anonymous", "/sign-in/anonymous",
      "/two-factor/verify-otp",
    ]) {
      const bypass = await send(path, { email: ids.clientEmail, password, code: "123456" }, jar, {
        "x-digipants-workspace-invitation": validToken,
      });
      assert.equal(bypass.response.ok, false, `disabled bypass endpoint ${path} must fail`);
    }
    const inviteAfterBypassAttempts = await workspaceDb.$queryRaw`SELECT status FROM workspace_invitation_records WHERE id = ${validInviteId}::uuid`;
    assert.equal(inviteAfterBypassAttempts[0]?.status, "pending", "alternate endpoints cannot consume an invitation");

    const expiredRowEmail = (await workspaceDb.$queryRaw`SELECT intended_email FROM workspace_invitation_records WHERE id = ${expiredInviteId}::uuid`)[0].intended_email;
    const expiredSignup = await send("/sign-up/email", { name: "Synthetic Expired", email: expiredRowEmail, password }, jar, {
      "x-digipants-workspace-invitation": expiredToken,
    });
    assert.equal(expiredSignup.response.ok, false, "expired invitation must fail");

    const revokedEmail = (await workspaceDb.$queryRaw`SELECT intended_email FROM workspace_invitation_records WHERE id = ${revokedInviteId}::uuid`)[0].intended_email;
    const revokedSignup = await send("/sign-up/email", { name: "Synthetic Revoked", email: revokedEmail, password }, jar, {
      "x-digipants-workspace-invitation": revokedToken,
    });
    assert.equal(revokedSignup.response.ok, false, "revoked invitation must fail");

    const mismatchSignup = await send("/sign-up/email", {
      name: "Synthetic Wrong Recipient",
      email: `mismatch-${randomUUID()}@example.invalid`,
      password,
    }, jar, { "x-digipants-workspace-invitation": mismatchedToken });
    assert.equal(mismatchSignup.response.ok, false, "invitation is bound to its intended recipient");
    const mismatchStillPending = await workspaceDb.$queryRaw`SELECT status FROM workspace_invitation_records WHERE id = ${mismatchedInviteId}::uuid`;
    assert.equal(mismatchStillPending[0]?.status, "pending", "a mismatched attempt must not consume another recipient's invitation");

    const signup = await send("/sign-up/email", {
      name: "Synthetic Invited Client",
      email: ids.clientEmail,
      password,
      twoFactorEnabled: true,
      mfaVerifiedAt: "2099-01-01T00:00:00.000Z",
    }, jar, { "x-digipants-workspace-invitation": validToken });
    assert.equal(signup.response.ok, true, `invited signup should work: ${JSON.stringify(signup.payload)}`);
    created = true;
    ids.authUser = signup.payload.user.id;
    const signupUser = await authDb.user.findUnique({ where: { id: ids.authUser } });
    assert.equal(signupUser?.twoFactorEnabled, false, "client input cannot enable 2FA by assertion");
    const signupSession = await authDb.session.findFirst({ where: { userId: ids.authUser } });
    assert.equal(signupSession?.mfaVerifiedAt, null, "client input cannot assert session MFA assurance");

    const principalRows = await workspaceDb.$queryRaw`SELECT id::text AS id, status FROM workspace_principals WHERE provider_subject = ${ids.authUser}`;
    assert.equal(principalRows.length, 1, "redeemed identity should map to one workspace principal");
    ids.principal = principalRows[0].id;
    const redeemedInvite = await workspaceDb.$queryRaw`SELECT status, redeemed_by_client_id::text AS principal_id FROM workspace_invitation_records WHERE id = ${validInviteId}::uuid`;
    assert.equal(redeemedInvite[0]?.status, "redeemed");
    assert.equal(redeemedInvite[0]?.principal_id, ids.principal);
    const noImplicitRights = await workspaceDb.$queryRaw`
      SELECT
        (SELECT count(*) FROM workspace_client_memberships WHERE principal_id = ${ids.principal}::uuid) AS memberships,
        (SELECT count(*) FROM workspace_client_project_grants WHERE principal_id = ${ids.principal}::uuid) AS grants
    `;
    assert.equal(Number(noImplicitRights[0]?.memberships), 0, "signup must not create a tenant membership");
    assert.equal(Number(noImplicitRights[0]?.grants), 0, "signup must not create project permissions");

    const replay = await redeemClientInvitation({
      workspaceDb,
      token: validToken,
      intendedEmail: ids.clientEmail,
      providerSubject: `synthetic-replay-${randomUUID()}`,
    });
    assert.equal(replay, false, "a redeemed invitation cannot be replayed for another identity");
    const replaySignup = await send("/sign-up/email", { name: "Synthetic Replay", email: ids.clientEmail, password }, jar, {
      "x-digipants-workspace-invitation": validToken,
    });
    assert.equal(replaySignup.response.ok, false, "replayed enrollment cannot create another user/session");

    await workspaceDb.$executeRaw`INSERT INTO workspace_client_memberships (tenant_id, principal_id) VALUES (${ids.tenant}::uuid, ${ids.principal}::uuid)`;
    await workspaceDb.$executeRaw`INSERT INTO workspace_client_project_grants (tenant_id, project_id, principal_id, role) VALUES (${ids.tenant}::uuid, ${ids.project}::uuid, ${ids.principal}::uuid, 'client_approver')`;
    const loadEffectiveWorkspaceGrants = await loadExistingGrantQuery();
    const workspaceInput = {
      tenantId: ids.tenant,
      projectId: ids.project,
      action: "project.read_published",
      publication: "published",
      authDb,
      workspaceDb,
      loadEffectiveGrants: loadEffectiveWorkspaceGrants,
    };
    let current = await auth.api.getSession({ headers: new Headers({ cookie: jar.header() }) });
    assert.ok(current?.session?.id, "signup created a session for fixture verification");
    assert.equal(await authorizeValidatedWorkspaceAction({
      ...workspaceInput,
      sessionId: current.session.id,
      providerSubject: current.user.id,
    }), false, "pre-MFA session must be denied even when an explicit grant exists");

    const setup = await send("/two-factor/enable", { method: "totp", password }, jar);
    assert.equal(setup.response.ok, true, `TOTP enrollment should start: ${JSON.stringify(setup.payload)}`);
    assert.equal(setup.payload.method, "totp");
    assert.ok(Array.isArray(setup.payload.backupCodes) && setup.payload.backupCodes.length >= 4);
    const factor = await authDb.twoFactor.findFirst({ where: { userId: ids.authUser } });
    assert.ok(factor, "Better Auth owns the 2FA record");
    const authContext = await auth.$context;
    const totpSecret = await symmetricDecrypt({ key: authContext.secretConfig, data: factor.secret });
    const setupCode = totp(totpSecret);
    const setupVerification = await send("/two-factor/verify-totp", { code: setupCode }, jar);
    assert.equal(setupVerification.response.ok, true, `TOTP enrollment verification should work: ${JSON.stringify(setupVerification.payload)}`);
    current = await auth.api.getSession({ headers: new Headers({ cookie: jar.header() }) });
    assert.ok(current?.session?.id);
    assert.equal(await authorizeValidatedWorkspaceAction({
      ...workspaceInput,
      sessionId: current.session.id,
      providerSubject: current.user.id,
    }), false, "factor enrollment does not upgrade the earlier session's assurance");
    const afterEnrollment = await authDb.$queryRaw`SELECT mfa_verified_at FROM auth_spike.session WHERE id = ${current.session.id}`;
    assert.equal(afterEnrollment[0]?.mfa_verified_at, null, "enrollment session is not an MFA sign-in session");

    await send("/sign-out", {}, jar);
    const challenge = await send("/sign-in/email", { email: ids.clientEmail, password }, jar);
    assert.equal(challenge.response.ok, true);
    assert.equal(challenge.payload.twoFactorRedirect, true, "credential login must enter Better Auth's second-factor challenge");
    assert.equal(await auth.api.getSession({ headers: new Headers({ cookie: jar.header() }) }), null, "pre-verification challenge must not be an authenticated session");

    const wrongTotp = await send("/two-factor/verify-totp", { code: changedCode(setupCode) }, jar);
    assert.equal(wrongTotp.response.ok, false, "wrong TOTP must fail");
    assert.equal(await auth.api.getSession({ headers: new Headers({ cookie: jar.header() }) }), null, "wrong TOTP must not issue a session");

    const successfulCode = totp(totpSecret);
    const secondFactor = await send("/two-factor/verify-totp", { code: successfulCode, trustDevice: true }, jar);
    assert.equal(secondFactor.response.ok, true, `valid TOTP should verify: ${JSON.stringify(secondFactor.payload)}`);
    current = await auth.api.getSession({ headers: new Headers({ cookie: jar.header() }) });
    assert.ok(current?.session?.id);
    const assuredState = await authDb.$queryRaw`
      SELECT s.user_id, s.mfa_verified_at, u.two_factor_enabled, f.verified,
             s.expires_at > statement_timestamp() AS session_live
        FROM auth_spike.session AS s
        JOIN auth_spike."user" AS u ON u.id = s.user_id
        JOIN auth_spike."twoFactor" AS f ON f.user_id = u.id
       WHERE s.id = ${current.session.id}
    `;
    const effectiveGrants = await loadEffectiveWorkspaceGrants({
      providerSubject: current.user.id,
      tenantId: ids.tenant,
      projectId: ids.project,
    });
    const authorizedAfterTotp = await authorizeValidatedWorkspaceAction({
      ...workspaceInput,
      sessionId: current.session.id,
      providerSubject: current.user.id,
    });
    assert.equal(authorizedAfterTotp, true, `a session created after valid TOTP verification plus explicit grant may proceed: ${JSON.stringify({ assuredState, effectiveGrants })}`);
    const assuranceRow = await authDb.$queryRaw`SELECT mfa_verified_at FROM auth_spike.session WHERE id = ${current.session.id}`;
    assert.ok(assuranceRow[0]?.mfa_verified_at instanceof Date, "TOTP verification persisted server-owned assurance");

    // The same valid session must not retain unlimited MFA authority. All
    // comparisons are made against PostgreSQL time, never a browser timestamp.
    const verifiedSessionId = current.session.id;
    const authorizeWithAction = (action) => authorizeValidatedWorkspaceAction({
      ...workspaceInput,
      sessionId: verifiedSessionId,
      providerSubject: current.user.id,
      action,
    });
    const ageAssurance = async (minutes) => authDb.$executeRaw`
      UPDATE auth_spike.session
         SET mfa_verified_at = statement_timestamp() - (${minutes} * interval '1 minute')
       WHERE id = ${verifiedSessionId}
    `;

    await ageAssurance(10);
    assert.equal(await authorizeWithAction("project.read_published"), true, "a ten-minute MFA session can read the published project");
    assert.equal(await authorizeWithAction("brief.edit"), true, "routine edit allowed within 15 minutes");
    assert.equal(await authorizeWithAction("proposal.decide"), false, "ten-minute-old MFA cannot approve a proposal");
    await ageAssurance(20);
    assert.equal(await authorizeWithAction("brief.edit"), false, "routine edits expire after 15 minutes");
    assert.equal(await authorizeWithAction("project.read_published"), true, "published read retains its longer session window");
    await ageAssurance(13 * 60);
    assert.equal(await authorizeWithAction("project.read_published"), false, "even read authority expires after twelve hours");
    await authDb.$executeRaw`UPDATE auth_spike.session
       SET mfa_verified_at = statement_timestamp() + interval '1 minute'
       WHERE id = ${verifiedSessionId}`;
    assert.equal(await authorizeWithAction("project.read_published"), false, "future timestamps never establish assurance");
    await ageAssurance(0);
    assert.equal(await authorizeWithAction("proposal.decide"), true, "a genuinely fresh verified session can decide with the matching explicit grant");

    await authDb.twoFactor.updateMany({ where: { userId: ids.authUser }, data: { verified: false } });
    assert.equal(await authorizeWithAction("project.read_published"), false, "unverified factor denies a fresh session");
    await authDb.twoFactor.updateMany({ where: { userId: ids.authUser }, data: { verified: true } });
    await authDb.user.update({ where: { id: ids.authUser }, data: { twoFactorEnabled: false } });
    assert.equal(await authorizeWithAction("project.read_published"), false, "disabled MFA denies a fresh session");
    await authDb.user.update({ where: { id: ids.authUser }, data: { twoFactorEnabled: true } });

    await send("/sign-out", {}, jar);
    assert.equal(await authorizeWithAction("project.read_published"), false, "signed-out session cannot be reused even with a recent MFA marker");
    const replayChallenge = await send("/sign-in/email", { email: ids.clientEmail, password }, jar);
    assert.equal(replayChallenge.payload.twoFactorRedirect, true);
    const replayedTotp = await send("/two-factor/verify-totp", { code: successfulCode }, jar);
    assert.equal(replayedTotp.response.ok, false, "the same TOTP step cannot establish a second MFA session");
    assert.equal(await auth.api.getSession({ headers: new Headers({ cookie: jar.header() }) }), null, "replayed TOTP leaves no session");

    const backupChallenge = await send("/sign-in/email", { email: ids.clientEmail, password }, jar);
    assert.equal(backupChallenge.payload.twoFactorRedirect, true);
    const wrongBackup = await send("/two-factor/verify-backup-code", { code: "not-a-real-backup-code" }, jar);
    assert.equal(wrongBackup.response.ok, false, "wrong recovery code must fail");
    assert.equal(await auth.api.getSession({ headers: new Headers({ cookie: jar.header() }) }), null);
    const recovery = setup.payload.backupCodes[0];
    const recovered = await send("/two-factor/verify-backup-code", { code: recovery }, jar);
    assert.equal(recovered.response.ok, true, `unused backup code should recover a session: ${JSON.stringify(recovered.payload)}`);
    current = await auth.api.getSession({ headers: new Headers({ cookie: jar.header() }) });
    assert.ok(current?.session?.id);
    assert.equal(await authorizeValidatedWorkspaceAction({
      ...workspaceInput,
      sessionId: current.session.id,
      providerSubject: current.user.id,
    }), true, "verified recovery code establishes the same server assurance");
    const recoveryAssurance = await authDb.$queryRaw`SELECT mfa_verified_at FROM auth_spike.session WHERE id = ${current.session.id}`;
    assert.ok(recoveryAssurance[0]?.mfa_verified_at instanceof Date, "backup-code verification persisted server-owned assurance");

    await send("/sign-out", {}, jar);
    const reusedBackupChallenge = await send("/sign-in/email", { email: ids.clientEmail, password }, jar);
    assert.equal(reusedBackupChallenge.payload.twoFactorRedirect, true);
    const reusedBackup = await send("/two-factor/verify-backup-code", { code: recovery }, jar);
    assert.equal(reusedBackup.response.ok, false, "a consumed backup code cannot be reused");
    assert.equal(await auth.api.getSession({ headers: new Headers({ cookie: jar.header() }) }), null);

    await workspaceDb.$executeRaw`UPDATE workspace_client_project_grants SET status = 'revoked', revoked_at = statement_timestamp() WHERE tenant_id = ${ids.tenant}::uuid AND project_id = ${ids.project}::uuid AND principal_id = ${ids.principal}::uuid AND role = 'client_approver'`;
    const freshChallenge = await send("/sign-in/email", { email: ids.clientEmail, password }, jar);
    assert.equal(freshChallenge.payload.twoFactorRedirect, true);
    const freshBackup = setup.payload.backupCodes[1];
    const withFreshBackup = await send("/two-factor/verify-backup-code", { code: freshBackup }, jar);
    assert.equal(withFreshBackup.response.ok, true);
    current = await auth.api.getSession({ headers: new Headers({ cookie: jar.header() }) });
    assert.ok(current?.session?.id);
    assert.equal(await authorizeValidatedWorkspaceAction({
      ...workspaceInput,
      sessionId: current.session.id,
      providerSubject: current.user.id,
    }), false, "revoked project grant must deny a correctly MFA-authenticated identity");

    await workspaceDb.$executeRaw`UPDATE workspace_client_project_grants SET status = 'active', revoked_at = NULL, granted_at = statement_timestamp() WHERE tenant_id = ${ids.tenant}::uuid AND project_id = ${ids.project}::uuid AND principal_id = ${ids.principal}::uuid AND role = 'client_approver'`;
    await workspaceDb.$executeRaw`UPDATE workspace_principals SET status = 'disabled' WHERE id = ${ids.principal}::uuid`;
    assert.equal(await authorizeValidatedWorkspaceAction({
      ...workspaceInput,
      sessionId: current.session.id,
      providerSubject: current.user.id,
    }), false, "disabled workspace principal must deny a valid MFA session");
    const disabledMembership = await workspaceDb.$queryRaw`SELECT status FROM workspace_client_memberships WHERE principal_id = ${ids.principal}::uuid`;
    assert.equal(disabledMembership[0]?.status, "revoked", "principal disable cascades to its membership");

    const sessionsBeforeDirectAttempt = await authDb.session.count({ where: { userId: ids.authUser } });
    const directSessionAttempt = await send("/create-session", { userId: ids.authUser, mfaVerifiedAt: "2099-01-01T00:00:00.000Z" }, jar);
    assert.equal(directSessionAttempt.response.ok, false, "no public session-creation route may set assurance");
    assert.equal(await authDb.session.count({ where: { userId: ids.authUser } }), sessionsBeforeDirectAttempt, "disabled direct session creation cannot create another session");

    // Keep lockout terminal so it cannot affect the successful MFA and recovery
    // assertions above. This is the real Better Auth handler against PostgreSQL.
    const lockoutJar = cookieJar();
    const startingLockoutState = await authDb.twoFactor.findFirst({ where: { userId: ids.authUser } });
    assert.equal(startingLockoutState?.failedVerificationCount, 0, "positive MFA cases reset the failure counter before this phase");
    assert.equal(startingLockoutState?.lockedUntil, null);
    const beforeLockoutSignIn = await authDb.session.count({ where: { userId: ids.authUser } });
    const beforeLockoutAssurance = await authDb.$queryRaw`
      SELECT count(*)::int AS count FROM auth_spike.session
       WHERE user_id = ${ids.authUser} AND mfa_verified_at IS NOT NULL
    `;
    const lockoutChallenge = await send("/sign-in/email", { email: ids.clientEmail, password }, lockoutJar);
    assert.equal(lockoutChallenge.response.ok, true);
    assert.equal(lockoutChallenge.payload.twoFactorRedirect, true);

    const nearbyValidCodes = new Set([-90_000, -60_000, -30_000, 0, 30_000, 60_000, 90_000]
      .map((offset) => totp(totpSecret, Date.now() + offset)));
    let invalidLockoutCode = 0;
    while (nearbyValidCodes.has(String(invalidLockoutCode).padStart(6, "0"))) invalidLockoutCode += 1;
    const wrongFactorCode = String(invalidLockoutCode).padStart(6, "0");

    for (let failedAttempt = 1; failedAttempt <= 5; failedAttempt += 1) {
      const incorrectFactor = await send("/two-factor/verify-totp", { code: wrongFactorCode }, lockoutJar);
      assert.equal(incorrectFactor.response.ok, false, `incorrect factor attempt ${failedAttempt} must fail`);
      const persistedLockout = await authDb.twoFactor.findFirst({ where: { userId: ids.authUser } });
      assert.equal(persistedLockout?.failedVerificationCount, failedAttempt, "each failed sign-in factor increments the persisted counter");
      if (failedAttempt < 5) {
        assert.equal(persistedLockout?.lockedUntil, null, "lockout begins only at the configured fifth failure");
      } else {
        assert.ok(persistedLockout?.lockedUntil instanceof Date);
        assert.ok(persistedLockout.lockedUntil.getTime() > Date.now(), "fifth failed factor persists an active lock");
        assert.ok(persistedLockout.lockedUntil.getTime() <= Date.now() + 60_000, "lock expires after the configured 60 seconds");
      }
      assert.equal(await auth.api.getSession({ headers: new Headers({ cookie: lockoutJar.header() }) }), null);
    }

    const lockedFactor = await authDb.twoFactor.findFirst({ where: { userId: ids.authUser } });
    const correctDuringLockout = await send("/two-factor/verify-backup-code", {
      code: setup.payload.backupCodes[2],
    }, lockoutJar);
    assert.equal(correctDuringLockout.response.status, 429, "correct factor is rejected while the database-backed lock is active");
    assert.equal(correctDuringLockout.payload.code, "ACCOUNT_TEMPORARILY_LOCKED");
    assert.equal(await auth.api.getSession({ headers: new Headers({ cookie: lockoutJar.header() }) }), null, "locked verification creates no authenticated session");
    assert.equal(await authDb.session.count({ where: { userId: ids.authUser } }), beforeLockoutSignIn, "lockout creates no session row");
    const assuredDuringLockout = await authDb.$queryRaw`
      SELECT count(*)::int AS count FROM auth_spike.session
       WHERE user_id = ${ids.authUser} AND mfa_verified_at IS NOT NULL
    `;
    assert.equal(assuredDuringLockout[0]?.count, beforeLockoutAssurance[0]?.count, "lockout creates no MFA-assured session");
    const lockStillActive = await authDb.twoFactor.findFirst({ where: { userId: ids.authUser } });
    assert.equal(lockStillActive?.lockedUntil?.getTime(), lockedFactor?.lockedUntil?.getTime(), "a correct code cannot clear an active lock");

    // Age the lock in the disposable database rather than waiting 60 seconds;
    // the next real verification request exercises Better Auth's lazy expiry.
    const expiredLockRows = await authDb.$executeRaw`
      UPDATE auth_spike."twoFactor"
         SET locked_until = statement_timestamp() - interval '1 second'
       WHERE user_id = ${ids.authUser}
    `;
    assert.equal(expiredLockRows, 1);
    const expiredChallengeProbe = await send("/two-factor/verify-totp", { code: wrongFactorCode }, lockoutJar);
    assert.equal(expiredChallengeProbe.response.ok, false, "the exhausted challenge still requires a new password sign-in");
    assert.equal(expiredChallengeProbe.payload.code, "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE");
    const resetFactor = await authDb.twoFactor.findFirst({ where: { userId: ids.authUser } });
    assert.equal(resetFactor?.failedVerificationCount, 0);
    assert.equal(resetFactor?.lockedUntil, null, "expired lock and failure count are lazily cleared in PostgreSQL");
    assert.equal(await auth.api.getSession({ headers: new Headers({ cookie: lockoutJar.header() }) }), null);

    const recoveryJar = cookieJar();
    const postExpiryChallenge = await send("/sign-in/email", { email: ids.clientEmail, password }, recoveryJar);
    assert.equal(postExpiryChallenge.response.ok, true);
    assert.equal(postExpiryChallenge.payload.twoFactorRedirect, true);
    const recoveredAfterExpiry = await send("/two-factor/verify-backup-code", { code: setup.payload.backupCodes[3] }, recoveryJar);
    assert.equal(recoveredAfterExpiry.response.ok, true, "an unused backup factor succeeds after expiry and a fresh password challenge");
    const recoveredSession = await auth.api.getSession({ headers: new Headers({ cookie: recoveryJar.header() }) });
    assert.ok(recoveredSession?.session?.id);
    const recoveredAssurance = await authDb.$queryRaw`
      SELECT mfa_verified_at FROM auth_spike.session WHERE id = ${recoveredSession.session.id}
    `;
    assert.ok(recoveredAssurance[0]?.mfa_verified_at instanceof Date, "assurance resumes only after valid factor verification after expiry");
  });
}
