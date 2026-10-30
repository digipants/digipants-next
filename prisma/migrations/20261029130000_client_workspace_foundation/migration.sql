-- Client Workspace tenant/grant foundation. No authentication-provider tables.

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

CREATE TABLE workspace_staff_memberships (
    principal_id uuid PRIMARY KEY,
    principal_kind text NOT NULL DEFAULT 'staff' CHECK (principal_kind = 'staff'),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    granted_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    FOREIGN KEY (principal_id, principal_kind)
        REFERENCES workspace_principals(id, kind) ON DELETE RESTRICT,
    CONSTRAINT workspace_staff_membership_principal_kind_uq UNIQUE (principal_id, principal_kind),
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
    CONSTRAINT workspace_invites_redeemed_principal_kind_fkey
        FOREIGN KEY (redeemed_by_client_id, redeemed_principal_kind)
        REFERENCES workspace_principals(id, kind) ON DELETE RESTRICT,
    CHECK ((status = 'redeemed' AND redeemed_by_client_id IS NOT NULL
            AND redeemed_at IS NOT NULL) OR
           (status <> 'redeemed' AND redeemed_by_client_id IS NULL
            AND redeemed_at IS NULL))
);

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
    ON workspace_client_project_grants (principal_id, tenant_id, project_id, status);
CREATE INDEX workspace_staff_grants_active_idx
    ON workspace_staff_project_grants (principal_id, tenant_id, project_id, status);
CREATE INDEX workspace_invitations_tenant_status_idx
    ON workspace_invitation_records (tenant_id, status, expires_at);
CREATE INDEX workspace_audit_project_time_idx
    ON workspace_audit_events (tenant_id, project_id, occurred_at DESC);

-- Principal identity and project tenant bindings must not be reassigned.
CREATE FUNCTION workspace_prevent_principal_reassignment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.provider_subject IS DISTINCT FROM OLD.provider_subject
       OR NEW.kind IS DISTINCT FROM OLD.kind THEN
        RAISE EXCEPTION 'workspace principal identity is immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER workspace_principal_identity_immutable
BEFORE UPDATE ON workspace_principals
FOR EACH ROW EXECUTE FUNCTION workspace_prevent_principal_reassignment();

CREATE FUNCTION workspace_prevent_project_reassignment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
        RAISE EXCEPTION 'workspace project tenant binding is immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER workspace_project_tenant_immutable
BEFORE UPDATE ON workspace_projects
FOR EACH ROW EXECUTE FUNCTION workspace_prevent_project_reassignment();

-- Parent revocation and its dependent grants change in the same SQL statement.
CREATE FUNCTION workspace_revoke_client_grants_on_membership_revoke()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (OLD.status = 'active' AND NEW.status = 'revoked') OR
       (OLD.status = 'revoked' AND NEW.status = 'active') THEN
        UPDATE workspace_client_project_grants
           SET status = 'revoked', revoked_at = COALESCE(NEW.revoked_at, statement_timestamp())
         WHERE tenant_id = NEW.tenant_id
           AND principal_id = NEW.principal_id
           AND status = 'active';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER workspace_client_membership_revoke_grants
AFTER UPDATE OF status ON workspace_client_memberships
FOR EACH ROW EXECUTE FUNCTION workspace_revoke_client_grants_on_membership_revoke();

CREATE FUNCTION workspace_revoke_staff_grants_on_membership_revoke()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (OLD.status = 'active' AND NEW.status = 'revoked') OR
       (OLD.status = 'revoked' AND NEW.status = 'active') THEN
        UPDATE workspace_staff_project_grants
           SET status = 'revoked', revoked_at = COALESCE(NEW.revoked_at, statement_timestamp())
         WHERE principal_id = NEW.principal_id
           AND status = 'active';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER workspace_staff_membership_revoke_grants
AFTER UPDATE OF status ON workspace_staff_memberships
FOR EACH ROW EXECUTE FUNCTION workspace_revoke_staff_grants_on_membership_revoke();

CREATE FUNCTION workspace_disable_principal_memberships()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'active' AND NEW.status = 'disabled' THEN
        UPDATE workspace_client_memberships
           SET status = 'revoked', revoked_at = statement_timestamp()
         WHERE principal_id = NEW.id
           AND status = 'active';
        UPDATE workspace_staff_memberships
           SET status = 'revoked', revoked_at = statement_timestamp()
         WHERE principal_id = NEW.id
           AND status = 'active';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER workspace_disabled_principal_revoke_memberships
AFTER UPDATE OF status ON workspace_principals
FOR EACH ROW EXECUTE FUNCTION workspace_disable_principal_memberships();
