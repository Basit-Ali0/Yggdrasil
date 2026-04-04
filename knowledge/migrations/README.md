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

## Notes

- **Pre-P2**: Migrations 1–3 should already be applied from P0/P1.
- **P2 new**: Migrations 4–8 are all new for P2. Apply them in order (4 before 5, since the backfill references the org tables).
- After migration **5** runs successfully, verify the backfill, then uncomment the `ALTER COLUMN ... SET NOT NULL` lines at the bottom of that file.
- After migration **8**, set the `YGG_CONNECTOR_SECRET` env var (32-byte hex key) for connector credential encryption. Generate one with:
  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Until migration **4** is applied, the app gracefully falls back to user-only scoping (no org context).
