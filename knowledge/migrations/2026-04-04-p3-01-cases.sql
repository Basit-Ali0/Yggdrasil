-- ============================================================
-- P3-01/02: AML cases and case events schema
-- Date: 2026-04-04
-- ============================================================

-- 1) Cases — one per subject per scan
CREATE TABLE IF NOT EXISTS cases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    audit_id        UUID REFERENCES audits(id),
    scan_id         UUID NOT NULL REFERENCES scans(id),
    policy_id       UUID REFERENCES policies(id),
    subject_key     TEXT NOT NULL,
    subject_type    TEXT NOT NULL DEFAULT 'account',
    status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','in_review','escalated','closed_no_action','sar_prepared')),
    disposition     TEXT NULL
                    CHECK (disposition IS NULL OR disposition IN ('false_positive','monitor','investigate_further','prepare_sar','closed')),
    owner_id        UUID NULL REFERENCES auth.users(id),
    narrative       TEXT NULL,
    priority_score  DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Cheap summary fields (P3-05) — monetary amounts use NUMERIC to avoid float drift
    severity_rollup TEXT NOT NULL DEFAULT 'MEDIUM',
    violation_count INTEGER NOT NULL DEFAULT 0,
    open_violations INTEGER NOT NULL DEFAULT 0,
    suspicious_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    counterparty_count INTEGER NOT NULL DEFAULT 0,
    latest_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_at     TIMESTAMPTZ NULL,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_org ON cases(organization_id);
CREATE INDEX IF NOT EXISTS idx_cases_scan ON cases(scan_id);
CREATE INDEX IF NOT EXISTS idx_cases_audit ON cases(audit_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_owner ON cases(owner_id);
CREATE INDEX IF NOT EXISTS idx_cases_subject ON cases(organization_id, subject_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cases_scan_subject ON cases(scan_id, subject_key);
CREATE INDEX IF NOT EXISTS idx_cases_priority ON cases(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_cases_latest ON cases(latest_activity DESC);

-- 2) Case events — timeline of analyst actions
CREATE TABLE IF NOT EXISTS case_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
    event_type  TEXT NOT NULL CHECK (event_type IN (
        'created','status_change','disposition_change','assigned',
        'note','narrative_update','sar_prep','violation_reviewed'
    )),
    actor_id    UUID NULL REFERENCES auth.users(id),
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_events_case ON case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_events_created ON case_events(created_at DESC);

-- 3) Link violations to cases
ALTER TABLE violations ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES cases(id);
CREATE INDEX IF NOT EXISTS idx_violations_case ON violations(case_id);

-- 4) SAR-prep fields on cases (P3-19)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sar_date_range_start DATE NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sar_date_range_end DATE NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sar_flagged_amount NUMERIC(18,2) NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sar_involved_accounts JSONB NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sar_counterparties JSONB NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sar_analyst_summary TEXT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sar_supporting_triggers JSONB NULL;

-- 5) RLS
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;

-- Cases: separate SELECT / INSERT / UPDATE policies (no DELETE for regular members)
DROP POLICY IF EXISTS "Org members access cases" ON cases;
DROP POLICY IF EXISTS "Org members select cases" ON cases;
CREATE POLICY "Org members select cases"
    ON cases FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Org members insert cases" ON cases;
CREATE POLICY "Org members insert cases"
    ON cases FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Org members update cases" ON cases;
CREATE POLICY "Org members update cases"
    ON cases FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- Case events: SELECT + INSERT only (immutable audit trail — no UPDATE/DELETE)
DROP POLICY IF EXISTS "Org members access case events" ON case_events;
DROP POLICY IF EXISTS "Org members select case events" ON case_events;
CREATE POLICY "Org members select case events"
    ON case_events FOR SELECT
    USING (
        case_id IN (SELECT id FROM cases WHERE
            organization_id IN (
                SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Org members insert case events" ON case_events;
CREATE POLICY "Org members insert case events"
    ON case_events FOR INSERT
    WITH CHECK (
        case_id IN (SELECT id FROM cases WHERE
            organization_id IN (
                SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );
