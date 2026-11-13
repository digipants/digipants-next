import "server-only";

import { auth } from "./auth.js";
import { getAuthPrisma, getWorkspacePrisma } from "./database.js";
import { maxMfaAgeSecondsForAction } from "./mfa-freshness.js";
import { setWorkspaceAuthorizationContext } from "./workspace-tenant-context.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATES = new Set(["planned", "active", "paused", "change_review", "handover", "closed"]);

type Sql = {
  $queryRaw<T = unknown>(sql: TemplateStringsArray, ...params: unknown[]): Promise<T>;
};
type Workspace = Sql & {
  $transaction<T>(callback: (transaction: Sql) => Promise<T>, options?: { isolationLevel: "Serializable" }): Promise<T>;
};

export type PublishedProjectForClient = Readonly<{
  id: string;
  tenantId: string;
  title: string;
  state: string;
  revision: string;
  milestones: ReadonlyArray<Readonly<{ id: string; title: string; detail: string; state: string }>>;
  progressUpdates: ReadonlyArray<Readonly<{ id: string; body: string; nextAction: string; approvedAt: string }>>;
}>;

export class PublishedProjectAccessDenied extends Error {
  constructor() {
    super("Project unavailable.");
    this.name = "PublishedProjectAccessDenied";
  }
}

/**
 * Trusted, server-only project reader. sessionId and providerSubject must come
 * exclusively from Better Auth's verified server session; they are NOT request
 * parameters. Recheck email verification, MFA and active grants against DB.
 *
 * This is not a public endpoint and never authorizes by a caller-set tenant GUC.
 */
export async function loadPublishedProjectForTrustedIdentity(input: {
  sessionId: string;
  providerSubject: string;
  tenantId: string;
  projectId: string;
}): Promise<PublishedProjectForClient> {
  try {
    const values = {
      sessionId: input.sessionId,
      providerSubject: input.providerSubject,
      tenantId: input.tenantId,
      projectId: input.projectId,
    };
    if (!UUID.test(values.tenantId) || !UUID.test(values.projectId) ||
        typeof values.sessionId !== "string" || values.sessionId.length < 1 || values.sessionId.length > 255 ||
        typeof values.providerSubject !== "string" || values.providerSubject.length < 1 ||
        values.providerSubject.length > 255) throw new PublishedProjectAccessDenied();

    const maxAge = maxMfaAgeSecondsForAction("project.read_published");
    if (maxAge === null) throw new PublishedProjectAccessDenied();
    const authDb: Sql = getAuthPrisma();
    const workspaceDb = getWorkspacePrisma() as unknown as Workspace;

    // An active MFA-verified session is distinct from possessing an invitation.
    // Email verification and an enabled verified factor are separate gates.
    const assure = async () => {
      const rows = await authDb.$queryRaw<Array<{ userId: string }>>`
        SELECT s.user_id AS "userId"
          FROM auth_spike.session s
          JOIN auth_spike."user" u ON u.id = s.user_id
          JOIN auth_spike."twoFactor" f ON f.user_id = u.id AND f.verified = true
         WHERE s.id = ${values.sessionId}
           AND s.user_id = ${values.providerSubject}
           AND s.expires_at > statement_timestamp()
           AND u.email_verified = true
           AND u.two_factor_enabled = true
           AND s.mfa_verified_at IS NOT NULL
           AND s.mfa_verified_at <= statement_timestamp()
           AND s.mfa_verified_at >= statement_timestamp() - (${maxAge} * interval '1 second')
         LIMIT 1
      `;
      return rows.length === 1 && rows[0]?.userId === values.providerSubject;
    };
    if (!(await assure())) throw new PublishedProjectAccessDenied();

    const result = await workspaceDb.$transaction(async tx => {
      // The dedicated runtime role may never own the schema, bypass RLS or
      // read invitation bearer hashes. Check both session_user (original\n      // login) and current_user (possibly SET ROLE); a privileged underlying\n      // login switching into cw_runtime is NOT an acceptable connection.
      const identities = await tx.$queryRaw<Array<{ restricted: boolean }>>`
        SELECT (NOT executor.rolsuper AND NOT executor.rolbypassrls
          AND NOT executor.rolcreatedb AND NOT executor.rolcreaterole
          AND NOT login.rolsuper AND NOT login.rolbypassrls
          AND NOT login.rolcreatedb AND NOT login.rolcreaterole
          AND login.rolcanlogin
          AND pg_has_role(session_user, 'cw_runtime', 'USAGE')
          AND pg_has_role(current_user, 'cw_runtime', 'USAGE')
          AND NOT pg_has_role(session_user, 'cw_schema_owner', 'USAGE')
          AND NOT pg_has_role(session_user, 'cw_audit_writer', 'USAGE')
          AND NOT pg_has_role(current_user, 'cw_schema_owner', 'USAGE')
          AND NOT pg_has_role(current_user, 'cw_audit_writer', 'USAGE')
          AND NOT has_table_privilege(session_user, 'public.workspace_invitation_records', 'SELECT')
        ) AS restricted
        FROM pg_roles AS executor CROSS JOIN pg_roles AS login
       WHERE executor.rolname = current_user AND login.rolname = session_user
      `;
      if (identities.length !== 1 || identities[0]?.restricted !== true) {
        throw new PublishedProjectAccessDenied();
      }

      await setWorkspaceAuthorizationContext(tx, {
        tenantId: values.tenantId, projectId: values.projectId,
        actorSubject: values.providerSubject, purpose: "project.read_published",
      });

      // Server-verified subject is resolved through a narrowly scoped
      // SECURITY DEFINER helper which locks active client membership/grant
      // rows against concurrent revocation for this transaction. The helper
      // alone cannot authenticate a caller and must never be public.
      let actors = await tx.$queryRaw<Array<{ principalId: string | null }>>`
        SELECT public.cw_lock_client_project_grant(
          ${values.providerSubject}, ${values.tenantId}::uuid,
          ${values.projectId}::uuid, 'project.read_published'
        )::text AS "principalId"
      `;
      if (!actors[0]?.principalId) {
        await setWorkspaceAuthorizationContext(tx, {
          tenantId: values.tenantId, projectId: values.projectId,
          actorSubject: values.providerSubject, purpose: "delivery.edit",
        });
        actors = await tx.$queryRaw<Array<{ principalId: string | null }>>`
          SELECT public.cw_lock_staff_project_grant(
            ${values.providerSubject}, ${values.tenantId}::uuid,
            ${values.projectId}::uuid, 'delivery.edit'
          )::text AS "principalId"
        `;
      }
      if (!actors[0]?.principalId) throw new PublishedProjectAccessDenied();

      const rows = await tx.$queryRaw<Array<{
        id: string; tenantId: string; title: string; state: string; revision: bigint;
      }>>`
        SELECT project.id::text AS id,
               project.tenant_id::text AS "tenantId",
               project.title, project.state, project.revision
          FROM public.workspace_projects AS project
          JOIN public.workspace_tenants AS tenant ON tenant.id = project.tenant_id
         WHERE project.tenant_id = ${values.tenantId}::uuid
           AND project.id = ${values.projectId}::uuid
           AND tenant.status = 'active'
           AND project.publication = 'published'
         LIMIT 1
      `;
      const row = rows[0];
      if (rows.length !== 1 || !row || row.id !== values.projectId ||
          row.tenantId !== values.tenantId || !STATES.has(row.state) ||
          typeof row.title !== "string" || row.title.trim().length === 0 ||
          row.title.length > 200 || typeof row.revision !== "bigint" ||
          row.revision < 1n) throw new PublishedProjectAccessDenied();

      const milestones = await tx.$queryRaw<Array<{
        id: string; title: string; detail: string; state: string;
      }>>`
        SELECT id::text AS id, title, detail, state
          FROM public.workspace_milestones
         WHERE tenant_id = ${values.tenantId}::uuid
           AND project_id = ${values.projectId}::uuid
           AND client_visible = true
           AND approved_by_staff_id IS NOT NULL
           AND approved_at IS NOT NULL
         ORDER BY sort_order ASC, id ASC
         LIMIT 20
      `;
      const progressUpdates = await tx.$queryRaw<Array<{
        id: string; body: string; nextAction: string; approvedAt: Date;
      }>>`
        SELECT id::text AS id, body, next_action AS "nextAction", approved_at AS "approvedAt"
          FROM public.workspace_progress_updates
         WHERE tenant_id = ${values.tenantId}::uuid
           AND project_id = ${values.projectId}::uuid
           AND status = 'approved' AND client_visible = true
           AND approved_by_staff_id IS NOT NULL AND approved_at IS NOT NULL
         ORDER BY approved_at DESC, id DESC
         LIMIT 10
      `;
      const safeMilestones = milestones.flatMap(item =>
        UUID.test(item.id) && typeof item.title === "string" && item.title.length <= 160 &&
        typeof item.detail === "string" && item.detail.length <= 800 &&
        ["planned", "in_progress", "complete"].includes(item.state)
          ? [{ id: item.id, title: item.title, detail: item.detail, state: item.state }]
          : []);
      const safeProgressUpdates = progressUpdates.flatMap(item =>
        UUID.test(item.id) && typeof item.body === "string" && item.body.length <= 1200 &&
        typeof item.nextAction === "string" && item.nextAction.length <= 500 &&
        item.approvedAt instanceof Date && Number.isFinite(item.approvedAt.getTime())
          ? [{ id: item.id, body: item.body, nextAction: item.nextAction, approvedAt: item.approvedAt.toISOString() }]
          : []);

      return Object.freeze({
        id: row.id, tenantId: row.tenantId, title: row.title,
        state: row.state, revision: row.revision.toString(),
        milestones: Object.freeze(safeMilestones),
        progressUpdates: Object.freeze(safeProgressUpdates),
      });
    }, { isolationLevel: "Serializable" });

    // A cross-database session revocation concurrent with the workspace read
    // cannot be locked atomically. Rechecking before returning narrows but
    // does NOT remove that residual window; live rollout needs risk review.
    if (!(await assure())) throw new PublishedProjectAccessDenied();
    return result;
  } catch {
    // Same external error for missing, revoked, wrong-tenant and auth failure.
    throw new PublishedProjectAccessDenied();
  }
}

/** The only public-facing seam: identity is extracted from verified Better Auth. */
export async function loadPublishedProjectForVerifiedRequest(input: {
  headers: Headers;
  tenantId: string;
  projectId: string;
}): Promise<PublishedProjectForClient> {
  try {
    const headers = new Headers(input.headers);
    const current = await auth.api.getSession({ headers });
    if (!current?.session?.id || !current.user?.id) throw new PublishedProjectAccessDenied();
    return await loadPublishedProjectForTrustedIdentity({
      sessionId: current.session.id,
      providerSubject: current.user.id,
      tenantId: input.tenantId,
      projectId: input.projectId,
    });
  } catch {
    throw new PublishedProjectAccessDenied();
  }
}
