-- ============================================================
-- P3-02: Atomic increment for policies.rules_count
-- Avoids read-modify-write race when multiple add-pdf calls
-- run concurrently for the same policy.
-- Date: 2026-04-04
-- ============================================================

CREATE OR REPLACE FUNCTION increment_rules_count(p_policy_id UUID, p_delta INTEGER)
RETURNS VOID
LANGUAGE sql
AS $$
    UPDATE policies
    SET rules_count = COALESCE(rules_count, 0) + p_delta,
        updated_at  = NOW()
    WHERE id = p_policy_id;
$$;
