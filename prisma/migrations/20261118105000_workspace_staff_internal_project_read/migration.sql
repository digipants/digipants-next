-- Restore published-project read access for genuine founder/workspace_owner staff.
-- This is a read-only authorization purpose, not delivery.edit or project.activate.
-- Keep the existing signed transaction context, exact project grant, membership,
-- active tenant, FOR SHARE locks and the independent MFA/session check.
-- CREATE OR REPLACE preserves the existing cw_schema_owner owner and the
-- cw_runtime-specific EXECUTE grant; no public or new app-role grants are added.
CREATE OR REPLACE FUNCTION public.cw_lock_staff_project_grant(
  p_provider_subject text, p_tenant_id uuid, p_project_id uuid, p_action text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE authorized_principal_id uuid;
BEGIN
  IF p_action NOT IN (
    'project.activate', 'project.close', 'delivery.edit', 'project.read_internal'
  ) OR
     NOT public.cw_workspace_context_allows(
       p_tenant_id, p_project_id, p_provider_subject, p_action
     ) THEN
    RETURN NULL;
  END IF;

  SELECT p.id INTO authorized_principal_id
    FROM public.workspace_principals AS p
    JOIN public.workspace_staff_memberships AS m ON m.principal_id = p.id
    JOIN public.workspace_staff_project_grants AS g ON g.principal_id = p.id
    JOIN public.workspace_tenants AS t ON t.id = g.tenant_id
   WHERE p.provider = 'better_auth' AND p.provider_subject = p_provider_subject
     AND p.kind = 'staff' AND p.status = 'active'
     AND m.principal_kind = 'staff' AND m.status = 'active' AND m.revoked_at IS NULL
     AND g.status = 'active' AND g.revoked_at IS NULL
     AND g.tenant_id = p_tenant_id AND g.project_id = p_project_id
     AND t.status = 'active'
     AND (
       (p_action IN ('project.activate', 'project.close')
        AND g.role = 'workspace_owner')
       OR (p_action = 'delivery.edit'
           AND g.role IN ('delivery_staff', 'delivery_lead'))
       OR (p_action = 'project.read_internal'
           AND g.role IN (
             'workspace_owner', 'delivery_staff', 'delivery_lead', 'commercial_approver'
           ))
     )
   LIMIT 1 FOR SHARE OF p, m, g, t;
  RETURN authorized_principal_id;
END;
$$;

-- Reassert fail-closed execution rights without altering existing owner.
REVOKE ALL ON FUNCTION public.cw_lock_staff_project_grant(text,uuid,uuid,text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cw_lock_staff_project_grant(text,uuid,uuid,text)
  TO cw_runtime;
