-- DESIGN PROPOSAL ONLY. NOT A MIGRATION. Do not apply to any database.
-- Review with engineering/security before converting to a Prisma schema/migration.
-- Requires PostgreSQL with gen_random_uuid(). No RLS, grants, audit immutability
-- triggers, tenant-filtered queries or authenticated routes are implemented here.
-- provider_subject and project tenant_id are intended immutable, but this DDL
-- does not forbid those updates; add database-role restrictions or triggers
-- before these columns are used as authorization bindings.
-- All dates are UTC timestamptz. Never use email address as user authorization ID.

CREATE TABLE workspace_principals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL DEFAULT 'better_auth' CHECK (provider = 'better_auth'),
    provider_subject text NOT NULL UNIQUE CHECK (length(provider_subject) BETWEEN 1 AND 255),
    kind text NOT NULL CHECK (kind IN ('client', 'staff')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT workspace_principal_kind_uq UNIQUE (id, kind)
);

CREATE TABLE workspace_tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name text NOT NULL CHECK (length(btrim(legal_name)) BETWEEN 1 AND 240),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- A client identity may belong to multiple tenants, but must be explicitly
-- activated within each. This FK prevents a staff-kind principal from receiving
-- a client membership merely because they share a user ID.
CREATE TABLE workspace_client_memberships (
    tenant_id uuid NOT NULL REFERENCES workspace_tenants(id) ON DELETE RESTRICT,
    principal_id uuid NOT NULL,
    principal_kind text NOT NULL DEFAULT 'client' CHECK (principal_kind = 'client'),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    granted_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    PRIMARY KEY (tenant_id, principal_id),
    FOREIGN KEY (principal_id, principal_kind)
        REFERENCES workspace_principals(id, kind) ON DELETE RESTRICT,
    CHECK ((status = 'active' AND revoked_at IS NULL) OR
           (status = 'revoked' AND revoked_at IS NOT NULL))
);

-- Staff membership is separate and is not a wildcard project entitlement.
CREATE TABLE workspace_staff_memberships (
    principal_id uuid PRIMARY KEY,
    principal_kind text NOT NULL DEFAULT 'staff' CHECK (principal_kind = 'staff'),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    granted_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    FOREIGN KEY (principal_id, principal_kind)
        REFERENCES workspace_principals(id, kind) ON DELETE RESTRICT,
    CHECK ((status = 'active' AND revoked_at IS NULL) OR
           (status = 'revoked' AND revoked_at IS NOT NULL))
);

CREATE TABLE workspace_projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES workspace_tenants(id) ON DELETE RESTRICT,
    title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
    state text NOT NULL DEFAULT 'planned'
        CHECK (state IN ('planned','active','paused','change_review','handover','closed')),
    publication text NOT NULL DEFAULT 'unpublished'
        CHECK (publication IN ('unpublished','published')),
    revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT workspace_project_tenant_id_uq UNIQUE (tenant_id, id)
);

-- Each role is a separate explicit project grant. The FK to the client
-- membership enforces membership existence, NOT its active status; every
-- authorized query MUST verify principal + tenant membership + grant active.
CREATE TABLE workspace_client_project_grants (
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    principal_id uuid NOT NULL,
    role text NOT NULL CHECK (role IN
        ('client_viewer','client_contributor','client_approver','client_signatory')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
    granted_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    PRIMARY KEY (tenant_id, project_id, principal_id, role),
    FOREIGN KEY (tenant_id, project_id)
        REFERENCES workspace_projects(tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id, principal_id)
        REFERENCES workspace_client_memberships(tenant_id, principal_id)
        ON DELETE RESTRICT,
    CHECK ((status = 'active' AND revoked_at IS NULL) OR
           (status = 'revoked' AND revoked_at IS NOT NULL))
);

-- DigiPants staff may work across client tenants ONLY via explicit per-project
-- assignment, never an administrator wildcard.
CREATE TABLE workspace_staff_project_grants (
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    principal_id uuid NOT NULL REFERENCES workspace_staff_memberships(principal_id)
        ON DELETE RESTRICT,
    role text NOT NULL CHECK (role IN
        ('delivery_staff','delivery_lead','commercial_approver','workspace_owner')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
    granted_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    PRIMARY KEY (tenant_id, project_id, principal_id, role),
    FOREIGN KEY (tenant_id, project_id)
        REFERENCES workspace_projects(tenant_id, id) ON DELETE RESTRICT,
    CHECK ((status = 'active' AND revoked_at IS NULL) OR
           (status = 'revoked' AND revoked_at IS NOT NULL))
);

-- Self-hosted Better Auth: single-use high-entropy invite token stored only as
-- a digest (hash), never plaintext. Expiry and role assignment need audited
-- transactional server enforcement beyond these constraints.
-- Creating/accepting an invitation does NOT automatically grant project access.
-- Grant provisioning requires a separate trusted, audited server transaction.
CREATE TABLE workspace_invitation_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    intended_email text NOT NULL CHECK (length(btrim(intended_email)) BETWEEN 3 AND 254),
    intended_role text NOT NULL CHECK (intended_role IN
        ('client_viewer','client_contributor','client_approver','client_signatory')),
    invitation_token_hash text NOT NULL UNIQUE
        CHECK (length(invitation_token_hash) BETWEEN 48 AND 256),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','redeemed','revoked','expired')),
    issued_by_staff_id uuid NOT NULL
        REFERENCES workspace_staff_memberships(principal_id) ON DELETE RESTRICT,
    redeemed_by_client_id uuid,
    redeemed_principal_kind text NOT NULL DEFAULT 'client'
        CHECK (redeemed_principal_kind = 'client'),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    redeemed_at timestamptz,
    FOREIGN KEY (tenant_id, project_id)
        REFERENCES workspace_projects(tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (redeemed_by_client_id, redeemed_principal_kind)
        REFERENCES workspace_principals(id, kind) ON DELETE RESTRICT,
    CHECK ((status = 'redeemed' AND redeemed_by_client_id IS NOT NULL
            AND redeemed_at IS NOT NULL) OR
           (status <> 'redeemed' AND redeemed_by_client_id IS NULL
            AND redeemed_at IS NULL))
);

-- One event per idempotent business command in this first conceptual design.
-- Future complex commands may need an independent command/idempotency ledger.
-- Enforce append-only audit permissions and guarded writes in a future migration.
CREATE TABLE workspace_audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    actor_principal_id uuid REFERENCES workspace_principals(id) ON DELETE RESTRICT,
    origin text NOT NULL CHECK (origin IN ('person','system')),
    action text NOT NULL CHECK (length(btrim(action)) BETWEEN 1 AND 100),
    object_type text NOT NULL CHECK (length(btrim(object_type)) BETWEEN 1 AND 100),
    object_id text NOT NULL CHECK (length(btrim(object_id)) BETWEEN 1 AND 160),
    before_revision bigint CHECK (before_revision >= 0),
    after_revision bigint CHECK (after_revision >= 1),
    idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 128),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (tenant_id, project_id)
        REFERENCES workspace_projects(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT workspace_audit_command_once UNIQUE (tenant_id, idempotency_key),
    CHECK (origin = 'system' OR actor_principal_id IS NOT NULL)
);

CREATE INDEX workspace_project_tenant_state_idx
    ON workspace_projects (tenant_id, state);
CREATE INDEX workspace_client_grants_active_idx
    ON workspace_client_project_grants (principal_id, tenant_id, project_id)
    WHERE status = 'active';
CREATE INDEX workspace_staff_grants_active_idx
    ON workspace_staff_project_grants (principal_id, tenant_id, project_id)
    WHERE status = 'active';
CREATE INDEX workspace_invitations_tenant_status_idx
    ON workspace_invitation_records (tenant_id, status, expires_at);
CREATE INDEX workspace_audit_project_time_idx
    ON workspace_audit_events (tenant_id, project_id, occurred_at DESC);

-- Not provided by this SQL:
-- 1) active principal/membership/tenant filtering in every server-side query;
-- 2) tenant Row Level Security policy (requires pooled-connection review);
-- 3) provider-backed session/MFA checks, invitation redemption and revocation;
-- 4) transaction-safe approvals, append-only audit enforcement, backups/restore;
-- 5) published client snapshots, contracts/proposals, payments, GitHub evidence.
-- ALL must be implemented and tested before connecting real client data.
