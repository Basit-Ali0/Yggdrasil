-- ============================================================
-- Cleanup runtime data while preserving policy definitions
-- Keeps: policies, rules
-- Wipes: scans, violations, uploaded_datasets, mapping_configs, pii_findings
-- ============================================================

BEGIN;

-- Truncate related runtime tables together so foreign keys are handled safely.
TRUNCATE TABLE
    pii_findings,
    violations,
    mapping_configs,
    scans,
    uploaded_datasets
RESTART IDENTITY CASCADE;

COMMIT;

-- Expected result:
-- - policies remain
-- - rules remain
-- - all scan history, violations, uploaded CSV payloads, mappings,
--   and PII findings are removed
