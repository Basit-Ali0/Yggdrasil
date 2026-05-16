-- ============================================================
-- Provision missing personal organizations
-- Date: 2026-04-29
--
-- The original P2 backfill created personal orgs only for users who
-- already owned rows in business tables. New or empty accounts also need
-- an organization_members row before org-scoped APIs can create audits.
-- ============================================================

INSERT INTO organizations (id, name, slug, created_by)
SELECT
    gen_random_uuid(),
    'Personal',
    'personal-' || LEFT(u.id::text, 8),
    u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = u.id
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO organization_members (organization_id, user_id, role)
SELECT o.id, o.created_by, 'owner'
FROM organizations o
WHERE o.name = 'Personal'
  AND NOT EXISTS (
      SELECT 1
      FROM organization_members om
      WHERE om.organization_id = o.id
        AND om.user_id = o.created_by
  );
