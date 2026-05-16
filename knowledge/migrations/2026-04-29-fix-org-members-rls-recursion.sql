-- ============================================================
-- Fix organization_members RLS recursion
-- Date: 2026-04-29
--
-- The original organization_members admin policy queried
-- organization_members from inside a policy on organization_members,
-- which causes Postgres to recurse while evaluating RLS.
-- ============================================================

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

CREATE OR REPLACE FUNCTION public.current_user_is_org_admin(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
    )
$$;

GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_org_admin(UUID) TO authenticated;

DROP POLICY IF EXISTS "Members see own orgs" ON organizations;
CREATE POLICY "Members see own orgs"
    ON organizations FOR SELECT
    USING (id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS "Owners can update org" ON organizations;
CREATE POLICY "Owners can update org"
    ON organizations FOR UPDATE
    USING (public.current_user_is_org_admin(id))
    WITH CHECK (public.current_user_is_org_admin(id));

DROP POLICY IF EXISTS "Members see own memberships" ON organization_members;
DROP POLICY IF EXISTS "Org admins manage members" ON organization_members;

CREATE POLICY "Members see own memberships"
    ON organization_members FOR SELECT
    USING (
        user_id = auth.uid()
        OR public.current_user_is_org_admin(organization_id)
    );

CREATE POLICY "Org admins insert members"
    ON organization_members FOR INSERT
    WITH CHECK (public.current_user_is_org_admin(organization_id));

CREATE POLICY "Org admins update members"
    ON organization_members FOR UPDATE
    USING (public.current_user_is_org_admin(organization_id))
    WITH CHECK (public.current_user_is_org_admin(organization_id));

CREATE POLICY "Org admins delete members"
    ON organization_members FOR DELETE
    USING (public.current_user_is_org_admin(organization_id));
