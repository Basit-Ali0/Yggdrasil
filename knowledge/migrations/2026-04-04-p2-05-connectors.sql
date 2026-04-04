-- ============================================================
-- P2-16: Connector data model
-- Date: 2026-04-04
--
-- Credential storage: app-level AES-256-GCM in credentials_enc BYTEA.
-- Key source: YGG_CONNECTOR_SECRET env var (32-byte hex or base64).
-- Alternative: Supabase Vault (pgsodium). Not used here because Vault
-- is plan-gated and adds RPC overhead for serverless decrypt. See
-- src/lib/connector-crypto.ts for the full rationale.
-- ============================================================

CREATE TABLE IF NOT EXISTS connectors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('postgres', 's3_csv')),
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    credentials_enc BYTEA NULL,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'error')),
    last_tested_at  TIMESTAMPTZ NULL,
    created_by      UUID NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connectors_org ON connectors(organization_id);

ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members access connectors" ON connectors;
CREATE POLICY "Org members access connectors"
    ON connectors FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );
