import "server-only";

import { auth } from "./auth.js";
import { getAuthPrisma, getWorkspacePrisma } from "./database.js";
import { issueClientInvitation, revokeClientInvitation } from "./invite-issuance.js";
import type { ClientInvitationRole } from "./invite-issuance.js";
import { composePrivateInvitationEmail } from "./invitation-delivery.js";
import type { InvitationMessage } from "./invitation-delivery.js";

type Sql = {
  $queryRaw<T = unknown>(sql: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};
const MAX_STAFF_MFA_AGE_SECONDS = 5 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * This experiment deliberately cannot run in production. The existing
 * public DigiPants contact-mail service and live invite routes are untouched.
 * Test-only activation requires BOTH explicit flags and disposable local DBs.
 */
function experimentEnabled(): boolean {
  return process.env.NODE_ENV !== "production" &&
    process.env.AUTH_EXPERIMENT_ENABLED === "1" &&
    process.env.WORKSPACE_INVITE_TEST_DELIVERY_ENABLED === "1";
}

async function hasPersistedStaffAssurance(authDb: Sql, values: {
  sessionId: string;
  subject: string;
}): Promise<boolean> {
  const rows = await authDb.$queryRaw<Array<{ userId: string }>>`
    SELECT session.user_id AS "userId"
      FROM auth_spike.session AS session
      JOIN auth_spike."user" AS staff ON staff.id = session.user_id
      JOIN auth_spike."twoFactor" AS factor
        ON factor.user_id = staff.id AND factor.verified = true
     WHERE session.id = ${values.sessionId}
       AND session.user_id = ${values.subject}
       AND session.expires_at > statement_timestamp()
       AND staff.email_verified = true
       AND staff.two_factor_enabled = true
       AND session.mfa_verified_at IS NOT NULL
       AND session.mfa_verified_at <= statement_timestamp()
       AND session.mfa_verified_at >= statement_timestamp()
           - (${MAX_STAFF_MFA_AGE_SECONDS} * interval '1 second')
     LIMIT 1
  `;
  return rows.length === 1 && rows[0]?.userId === values.subject;
}

/**
 * INTERNAL core for server-verified Better Auth identities only. The subject
 * and session must be supplied by the server-side getSession seam below,
 * NEVER copied from a browser body/header. Email transport is injected.
 *
 * Returns a boolean only; raw bearer, token hash, recipient and link never
 * appear in the outcome. Delivery failures trigger best-effort revocation.
 * Retry/recovery after a failed compensating revoke is a release blocker.
 */
export async function dispatchInvitationForTrustedStaff(input: {
  sessionId: string;
  providerSubject: string;
  tenantId: string;
  projectId: string;
  intendedEmail: string;
  role: ClientInvitationRole;
  send: (message: InvitationMessage) => Promise<boolean>;
}): Promise<boolean> {
  let invite: { id: string; token: string; email: string } | null = null;
  let successfullyDelivered = false;
  let values: {
    sessionId: string; providerSubject: string; tenantId: string;
    projectId: string; intendedEmail: string; role: ClientInvitationRole;
    send: (message: InvitationMessage) => Promise<boolean>;
  } | null = null;
  try {
    if (!experimentEnabled()) return false;
    values = {
      sessionId: input.sessionId,
      providerSubject: input.providerSubject,
      tenantId: input.tenantId,
      projectId: input.projectId,
      intendedEmail: input.intendedEmail,
      role: input.role,
      send: input.send,
    };
    if (typeof values.sessionId !== "string" || values.sessionId.length < 1 ||
        values.sessionId.length > 255 || typeof values.providerSubject !== "string" ||
        values.providerSubject.length < 1 || values.providerSubject.length > 255 ||
        !UUID.test(values.tenantId) || !UUID.test(values.projectId) ||
        typeof values.send !== "function") return false;

    const authDb: Sql = getAuthPrisma();
    const workspaceDb = getWorkspacePrisma();
    if (!(await hasPersistedStaffAssurance(authDb, {
      sessionId: values.sessionId, subject: values.providerSubject,
    }))) return false;

    // The database helper separately requires an active EXACT project owner
    // grant, active tenant, named client role, and hashes the invite bearer.
    invite = await issueClientInvitation({
      workspaceDb, issuerSubject: values.providerSubject,
      tenantId: values.tenantId, projectId: values.projectId,
      intendedEmail: values.intendedEmail, intendedRole: values.role,
    });
    if (!invite) return false;

    // Recheck the persisted MFA after the workspace insert, not merely the
    // unsigned claims returned by a request. Cross-DB revocation isn't atomic.
    if (!(await hasPersistedStaffAssurance(authDb, {
      sessionId: values.sessionId, subject: values.providerSubject,
    }))) return false;
    const message = composePrivateInvitationEmail({
      invitationId: invite.id, recipient: invite.email,
      bearerToken: invite.token, workspaceOrigin: "https://digipants.com",
    });
    if (!message) return false;
    successfullyDelivered = (await values.send(message)) === true;
    return successfullyDelivered;
  } catch {
    return false;
  } finally {
    if (invite && !successfullyDelivered && values) {
      try {
        // Revocation can itself fail if the issuer's owner grant was revoked
        // during delivery. Never claim this is guaranteed compensation.
        await revokeClientInvitation({
          workspaceDb: getWorkspacePrisma(),
          issuerSubject: values.providerSubject,
          tenantId: values.tenantId, projectId: values.projectId,
          invitationId: invite.id,
        });
      } catch {
        // An operator-managed failed-delivery reconciliation queue is still
        // needed before customer activation; never log private payloads.
      }
    }
  }
}

/** The only HTTP-request-facing seam; there is NO mounted Next.js route. */
export async function dispatchInvitationForVerifiedStaffRequest(input: {
  headers: Headers;
  tenantId: string;
  projectId: string;
  intendedEmail: string;
  role: ClientInvitationRole;
  send: (message: InvitationMessage) => Promise<boolean>;
}): Promise<boolean> {
  try {
    if (!experimentEnabled()) return false;
    const headers = new Headers(input.headers);
    const current = await auth.api.getSession({ headers });
    if (!current?.session?.id || !current.user?.id) return false;
    return await dispatchInvitationForTrustedStaff({
      sessionId: current.session.id,
      providerSubject: current.user.id,
      tenantId: input.tenantId, projectId: input.projectId,
      intendedEmail: input.intendedEmail, role: input.role,
      send: input.send,
    });
  } catch {
    return false;
  }
}
