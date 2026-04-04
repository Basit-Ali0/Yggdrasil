-- ============================================================
-- P2-01: Organization and membership schema
-- Date: 2026-04-04
-- ============================================================

-- 1) Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    created_by  UUID NOT NULL REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Organization members (user ↔ org, with role)
CREATE TABLE IF NOT EXISTS organization_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org  ON organization_members (organization_id);

-- 3) Add organization_id to business tables (nullable for backfill phase)
ALTER TABLE policies          ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE scans             ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE violations        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE uploaded_datasets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE mapping_configs   ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_policies_org     ON policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_scans_org        ON scans(organization_id);
CREATE INDEX IF NOT EXISTS idx_violations_org   ON violations(organization_id);
CREATE INDEX IF NOT EXISTS idx_uploads_org      ON uploaded_datasets(organization_id);
CREATE INDEX IF NOT EXISTS idx_mappings_org     ON mapping_configs(organization_id);

-- 4) RLS on organizations / members
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members see own orgs" ON organizations;
CREATE POLICY "Members see own orgs"
    ON organizations FOR SELECT
    USING (
        id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Owners can update org" ON organizations;
CREATE POLICY "Owners can update org"
    ON organizations FOR UPDATE
    USING (
        id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'owner')
    );

DROP POLICY IF EXISTS "Authenticated users can create orgs" ON organizations;
CREATE POLICY "Authenticated users can create orgs"
    ON organizations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Members see own memberships" ON organization_members;
CREATE POLICY "Members see own memberships"
    ON organization_members FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Org admins manage members" ON organization_members;
CREATE POLICY "Org admins manage members"
    ON organization_members FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- 5) Update RLS on business tables to use org membership
-- policies
DROP POLICY IF EXISTS "Users see own data" ON policies;
DROP POLICY IF EXISTS "Org members access policies" ON policies;
CREATE POLICY "Org members access policies"
    ON policies FOR ALL
    USING (
        organization_id IS NULL AND user_id = COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)
        OR organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- scans
DROP POLICY IF EXISTS "Org members access scans" ON scans;
CREATE POLICY "Org members access scans"
    ON scans FOR ALL
    USING (
        organization_id IS NULL AND user_id = COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)
        OR organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- violations
DROP POLICY IF EXISTS "Org members access violations" ON violations;
CREATE POLICY "Org members access violations"
    ON violations FOR ALL
    USING (
        organization_id IS NULL AND scan_id IN (
            SELECT id FROM scans WHERE user_id = COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)
        )
        OR organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- uploaded_datasets (replace the P0 policy)
DROP POLICY IF EXISTS "Users manage own uploaded datasets" ON uploaded_datasets;
DROP POLICY IF EXISTS "Org members access uploads" ON uploaded_datasets;
CREATE POLICY "Org members access uploads"
    ON uploaded_datasets FOR ALL
    USING (
        organization_id IS NULL AND user_id = auth.uid()
        OR organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- mapping_configs (replace the P0 policy)
DROP POLICY IF EXISTS "Users manage own mapping configs" ON mapping_configs;
DROP POLICY IF EXISTS "Org members access mappings" ON mapping_configs;
CREATE POLICY "Org members access mappings"
    ON mapping_configs FOR ALL
    USING (
        organization_id IS NULL AND user_id = auth.uid()
        OR organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );
