-- ============================================================
-- Fix organization_events insert RLS
-- Date: 2026-05-16
--
-- Apply this if 2026-05-15-saas-org-management.sql was already
-- applied before the insert policy was tightened to admins/owners.
-- ============================================================

DROP POLICY IF EXISTS "Org admins insert events" ON organization_events;
CREATE POLICY "Org admins insert events"
    ON organization_events FOR INSERT
    WITH CHECK (public.current_user_is_org_admin(organization_id));
