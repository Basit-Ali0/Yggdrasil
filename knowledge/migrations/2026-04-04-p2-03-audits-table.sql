-- ============================================================
-- P2-06: Persisted audit lifecycle
-- Date: 2026-04-04
-- ============================================================

CREATE TABLE IF NOT EXISTS audits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    name            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','ready_to_scan','scan_running','completed','failed')),
    policy_id       UUID REFERENCES policies(id),
    upload_id       UUID REFERENCES uploaded_datasets(id),
    mapping_id      UUID REFERENCES mapping_configs(id),
    latest_scan_id  UUID NULL,
    data_source     TEXT NOT NULL DEFAULT 'csv',
    connector_id    UUID NULL,
    error_message   TEXT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audits_org ON audits(organization_id);
CREATE INDEX IF NOT EXISTS idx_audits_user ON audits(user_id);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audits_created ON audits(created_at DESC);

-- Link scans back to audits
ALTER TABLE scans ADD COLUMN IF NOT EXISTS audit_id UUID REFERENCES audits(id);
CREATE INDEX IF NOT EXISTS idx_scans_audit ON scans(audit_id);

-- RLS
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members access audits" ON audits;
CREATE POLICY "Org members access audits"
    ON audits FOR ALL
    USING (
        organization_id IS NULL AND user_id = COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)
        OR organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );
