-- ============================================================
-- SaaS organization management
-- Date: 2026-05-15
-- ============================================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS organization_invitations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    token_hash      TEXT NOT NULL UNIQUE,
    invited_by      UUID NOT NULL REFERENCES auth.users(id),
    accepted_by     UUID REFERENCES auth.users(id),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at     TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invites_pending_email
    ON organization_invitations (organization_id, lower(email))
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_org_invites_org_created
    ON organization_invitations (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS organization_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_user_id   UUID REFERENCES auth.users(id),
    target_user_id  UUID REFERENCES auth.users(id),
    event_type      TEXT NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_events_org_created
    ON organization_events (organization_id, created_at DESC);

-- Role helpers used by RLS and APIs.
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_org_role(org_id UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role
    FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_org_owner(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT public.current_user_org_role(org_id) = 'owner'
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_org_admin(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT public.current_user_org_role(org_id) IN ('owner', 'admin')
$$;

GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_org_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_org_admin(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users create owner membership for own orgs" ON organization_members;
CREATE POLICY "Users create owner membership for own orgs"
    ON organization_members FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND role = 'owner'
        AND organization_id IN (
            SELECT id FROM organizations WHERE created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Org members see all memberships" ON organization_members;
CREATE POLICY "Org members see all memberships"
    ON organization_members FOR SELECT
    USING (organization_id IN (SELECT public.current_user_org_ids()));

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins manage invitations" ON organization_invitations;
CREATE POLICY "Org admins manage invitations"
    ON organization_invitations FOR ALL
    USING (public.current_user_is_org_admin(organization_id))
    WITH CHECK (public.current_user_is_org_admin(organization_id));

DROP POLICY IF EXISTS "Org members view events" ON organization_events;
CREATE POLICY "Org members view events"
    ON organization_events FOR SELECT
    USING (organization_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS "Org admins insert events" ON organization_events;
CREATE POLICY "Org admins insert events"
    ON organization_events FOR INSERT
    WITH CHECK (public.current_user_is_org_admin(organization_id));

-- Safe invite preview by token hash. Returns no token hash.
CREATE OR REPLACE FUNCTION public.resolve_organization_invitation(invite_hash TEXT)
RETURNS TABLE (
    id UUID,
    organization_id UUID,
    organization_name TEXT,
    email TEXT,
    role TEXT,
    status TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        i.id,
        i.organization_id,
        o.name AS organization_name,
        i.email,
        i.role,
        CASE
            WHEN i.status = 'pending' AND i.expires_at <= NOW() THEN 'expired'
            ELSE i.status
        END AS status,
        i.expires_at,
        i.created_at
    FROM public.organization_invitations i
    JOIN public.organizations o ON o.id = i.organization_id
    WHERE i.token_hash = invite_hash
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.accept_organization_invitation(invite_hash TEXT)
RETURNS TABLE (
    organization_id UUID,
    organization_name TEXT,
    role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    invite public.organization_invitations%ROWTYPE;
    user_email TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    user_email := lower(COALESCE(auth.jwt() ->> 'email', ''));

    SELECT *
    INTO invite
    FROM public.organization_invitations
    WHERE token_hash = invite_hash
    LIMIT 1
    FOR UPDATE;

    IF invite.id IS NULL THEN
        RAISE EXCEPTION 'Invitation not found';
    END IF;

    IF invite.status <> 'pending' OR invite.expires_at <= NOW() THEN
        UPDATE public.organization_invitations
        SET status = CASE WHEN status = 'pending' THEN 'expired' ELSE status END
        WHERE id = invite.id;
        RAISE EXCEPTION 'Invitation is not active';
    END IF;

    IF lower(invite.email) <> user_email THEN
        RAISE EXCEPTION 'Invitation email does not match signed-in user';
    END IF;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (invite.organization_id, auth.uid(), invite.role)
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    UPDATE public.organization_invitations
    SET status = 'accepted',
        accepted_by = auth.uid(),
        accepted_at = NOW()
    WHERE id = invite.id;

    INSERT INTO public.organization_events (organization_id, actor_user_id, target_user_id, event_type, metadata)
    VALUES
        (invite.organization_id, auth.uid(), auth.uid(), 'invitation.accepted', jsonb_build_object('email', invite.email, 'role', invite.role)),
        (invite.organization_id, auth.uid(), auth.uid(), 'member.joined', jsonb_build_object('via', 'invitation'));

    RETURN QUERY
    SELECT o.id, o.name, invite.role
    FROM public.organizations o
    WHERE o.id = invite.organization_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_organization_invitation(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(TEXT) TO authenticated;
