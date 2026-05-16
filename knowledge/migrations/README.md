# SQL migrations (Supabase / Postgres)

Apply **in filename order** in your Supabase SQL editor (or `psql`).

| # | File | Phase | What it does |
|---|------|-------|-------------|
| 1 | `2026-03-19-p0-durable-upload-and-mapping.sql` | P0 | `uploaded_datasets`, `mapping_configs` tables + RLS |
| 2 | `2026-04-02-clean-runtime-data-keep-policies-and-rules.sql` | P1 | Optional: clears runtime rows, keeps policies/rules |
| 3 | `2026-04-03-rules-validation-metadata.sql` | P1 | Adds `validation_status`, `validation_issues` to `rules` |
| 4 | `2026-04-04-p2-01-organizations.sql` | P2 | `organizations`, `organization_members`; adds `organization_id` to business tables; org-based RLS |
| 5 | `2026-04-04-p2-02-backfill-personal-orgs.sql` | P2 | Creates personal org per existing user, backfills `organization_id` |
| 6 | `2026-04-04-p2-03-audits-table.sql` | P2 | `audits` table (lifecycle states); adds `audit_id` to `scans` |
| 7 | `2026-04-04-p2-04-export-logs.sql` | P2 | `export_logs` table with org-scoped RLS |
| 8 | `2026-04-04-p2-05-connectors.sql` | P2 | `connectors` table (Postgres + S3); credential storage as AES-256-GCM encrypted BYTEA |
| 9 | `2026-04-04-p3-01-cases.sql` | P3 | `cases`, `case_events` tables; `case_id` on violations; SAR-prep fields; RLS |
| 10 | `2026-05-15-saas-org-management.sql` | SaaS orgs | Multi-org invitations, org events, ownership helpers; includes the org RLS helper functions needed by later policies |
| 11 | `2026-05-16-fix-org-events-insert-rls.sql` | SaaS orgs | Follow-up policy correction for databases that already applied the May 15 SaaS org migration |

## Notes

- **Pre-P2**: Migrations 1–3 should already be applied from P0/P1.
- **P2**: Migrations 4–8. Apply in order (4 before 5).
- **P3**: Migration 9 adds AML case infrastructure. Requires P2 migrations (org tables) to be in place first.
- After migration **5** runs successfully, verify the backfill, then uncomment the `ALTER COLUMN ... SET NOT NULL` lines at the bottom of that file.
- After migration **8**, set the `YGG_CONNECTOR_SECRET` env var (32-byte hex key).
- Until migration **4** is applied, the app gracefully falls back to user-only scoping.
- Until migration **9** is applied, AML scans work normally but skip case auto-creation.
- Migration **10** is self-contained for org RLS helper functions and can be applied after the base P2 org migration; the April 29 recursion fix remains compatible but is not required first.

---

## Manual steps by phase

### P2 manual steps

1. Apply migrations **4–8** in order in Supabase SQL editor or `psql`.
2. After migration **5**, verify the backfill populated `organization_id` on existing rows, then uncomment the `ALTER COLUMN ... SET NOT NULL` lines at the bottom of that file and re-run.
3. Set the `YGG_CONNECTOR_SECRET` environment variable (generate with `openssl rand -hex 32`) in your deployment environment (Vercel, `.env.local`, etc.).
4. Optionally add `YGG_CONNECTOR_SECRET` to CI secrets if connectors are tested in CI.
5. Redeploy the application.

### P3 manual steps

1. Apply migration **9** (`2026-04-04-p3-01-cases.sql`) in Supabase SQL editor or `psql`. P2 migrations must already be in place.
2. Redeploy the application.
3. No new environment variables are required for P3.
