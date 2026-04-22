-- ============================================================
-- P0 Migration: Durable upload + mapping persistence
-- Date: 2026-03-19
-- ============================================================

-- 1) Uploaded datasets (previously in-memory only)
CREATE TABLE IF NOT EXISTS uploaded_datasets (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    headers JSONB NOT NULL DEFAULT '[]'::jsonb,
    rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    row_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_datasets_user
    ON uploaded_datasets (user_id);

CREATE INDEX IF NOT EXISTS idx_uploaded_datasets_created
    ON uploaded_datasets (created_at DESC);

-- 2) Mapping configs (previously in-memory only)
CREATE TABLE IF NOT EXISTS mapping_configs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES uploaded_datasets(id) ON DELETE CASCADE,
    mapping_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    temporal_scale DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    clarification_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mapping_configs_user
    ON mapping_configs (user_id);

CREATE INDEX IF NOT EXISTS idx_mapping_configs_upload
    ON mapping_configs (upload_id);

CREATE INDEX IF NOT EXISTS idx_mapping_configs_created
    ON mapping_configs (created_at DESC);

-- 3) Row-level security
ALTER TABLE uploaded_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own uploaded datasets" ON uploaded_datasets;
CREATE POLICY "Users manage own uploaded datasets"
    ON uploaded_datasets
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own mapping configs" ON mapping_configs;
CREATE POLICY "Users manage own mapping configs"
    ON mapping_configs
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
