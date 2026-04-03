-- ============================================================
-- P1-14: Persist engine validation metadata on extracted rules
-- Date: 2026-04-03
-- ============================================================

-- validation_status: 'valid' | 'invalid' (NULL = legacy / pre-migration rows)
ALTER TABLE rules
    ADD COLUMN IF NOT EXISTS validation_status TEXT;

-- Structured issues from validateRuleForExecution (category, message, path)
ALTER TABLE rules
    ADD COLUMN IF NOT EXISTS validation_issues JSONB;

COMMENT ON COLUMN rules.validation_status IS 'Engine: valid = executable scan; invalid = quarantined (is_active false)';
COMMENT ON COLUMN rules.validation_issues IS 'Array of { category, message, path? } when validation_status = invalid';
