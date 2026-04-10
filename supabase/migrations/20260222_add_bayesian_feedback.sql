-- Migration: Add Bayesian Feedback Loop columns and helper function
-- Run this in your Supabase SQL Editor

-- 1. Add count columns to rules table
ALTER TABLE rules 
ADD COLUMN IF NOT EXISTS approved_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS false_positive_count INTEGER DEFAULT 0;

-- 2. Create RPC function to safely increment counters
-- This avoids race conditions and handles the dynamic column name
CREATE OR REPLACE FUNCTION increment_rule_stat(
    target_policy_id UUID,
    target_rule_id TEXT,
    stat_column TEXT
)
RETURNS VOID AS $$
BEGIN
    EXECUTE format(
        'UPDATE rules SET %I = %I + 1 WHERE policy_id = $1 AND rule_id = $2',
        stat_column, stat_column
    )
    USING target_policy_id, target_rule_id;
END;
$$ LANGUAGE plpgsql;
