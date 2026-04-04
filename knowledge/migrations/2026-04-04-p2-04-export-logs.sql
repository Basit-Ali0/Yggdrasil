-- ============================================================
-- P2-15: Export audit logging
-- Date: 2026-04-04
-- ============================================================

CREATE TABLE IF NOT EXISTS export_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    scan_id         UUID NOT NULL REFERENCES scans(id),
    format          TEXT NOT NULL CHECK (format IN ('json', 'pdf')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_export_logs_org ON export_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_logs_scan ON export_logs(scan_id);

ALTER TABLE export_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members access export logs" ON export_logs;
CREATE POLICY "Org members access export logs"
    ON export_logs FOR ALL
    USING (
        organization_id IS NULL AND user_id = auth.uid()
        OR organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );
