-- ============================================================
-- P2-02: Backfill existing single-user data into personal orgs
-- Date: 2026-04-04
-- Idempotent: safe to run multiple times.
-- ============================================================

-- Step 1: Create a personal org for every user who owns data but has no org yet.
-- Collects distinct user_ids from policies, scans, uploaded_datasets.
INSERT INTO organizations (id, name, slug, created_by)
SELECT
    gen_random_uuid(),
    'Personal',
    'personal-' || LEFT(u.uid::text, 8),
    u.uid
FROM (
    SELECT user_id AS uid FROM policies WHERE organization_id IS NULL
    UNION
    SELECT user_id AS uid FROM scans WHERE organization_id IS NULL
    UNION
    SELECT user_id AS uid FROM uploaded_datasets WHERE organization_id IS NULL
) u
WHERE NOT EXISTS (
    SELECT 1 FROM organization_members om WHERE om.user_id = u.uid
)
ON CONFLICT (slug) DO NOTHING;

-- Step 2: Add owner membership for each user → their personal org
INSERT INTO organization_members (organization_id, user_id, role)
SELECT o.id, o.created_by, 'owner'
FROM organizations o
WHERE o.name = 'Personal'
  AND NOT EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = o.id AND om.user_id = o.created_by
  );

-- Step 3: Backfill organization_id on business tables
-- Uses the exact personal org (matched by created_by + 'Personal' name) rather
-- than picking an arbitrary owner membership, which could mis-assign data when
-- a user belongs to multiple orgs.
UPDATE policies p
SET organization_id = (
    SELECT o.id FROM organizations o
    WHERE o.created_by = p.user_id AND o.name = 'Personal' LIMIT 1
)
WHERE p.organization_id IS NULL;

UPDATE scans s
SET organization_id = (
    SELECT o.id FROM organizations o
    WHERE o.created_by = s.user_id AND o.name = 'Personal' LIMIT 1
)
WHERE s.organization_id IS NULL;

UPDATE violations v
SET organization_id = s.organization_id
FROM scans s
WHERE v.scan_id = s.id
  AND v.organization_id IS NULL
  AND s.organization_id IS NOT NULL;

UPDATE uploaded_datasets ud
SET organization_id = (
    SELECT o.id FROM organizations o
    WHERE o.created_by = ud.user_id AND o.name = 'Personal' LIMIT 1
)
WHERE ud.organization_id IS NULL;

UPDATE mapping_configs mc
SET organization_id = (
    SELECT o.id FROM organizations o
    WHERE o.created_by = mc.user_id AND o.name = 'Personal' LIMIT 1
)
WHERE mc.organization_id IS NULL;

-- Step 4: Make organization_id NOT NULL on tables where all rows are now backfilled.
-- Only run these once you have confirmed the backfill is complete.
-- Uncomment when ready:
--
-- ALTER TABLE policies          ALTER COLUMN organization_id SET NOT NULL;
-- ALTER TABLE scans             ALTER COLUMN organization_id SET NOT NULL;
-- ALTER TABLE violations        ALTER COLUMN organization_id SET NOT NULL;
-- ALTER TABLE uploaded_datasets ALTER COLUMN organization_id SET NOT NULL;
-- ALTER TABLE mapping_configs   ALTER COLUMN organization_id SET NOT NULL;
