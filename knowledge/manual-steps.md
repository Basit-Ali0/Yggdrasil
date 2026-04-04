# Manual Steps By Phase

This file tracks the human-run steps that need to happen outside normal code changes.

## P1

### 1. Apply the rules validation metadata migration

Run the SQL in:

- `knowledge/migrations/2026-04-03-rules-validation-metadata.sql`

This adds:

- `rules.validation_status`
- `rules.validation_issues`

Without this migration, the app still works because rule inserts fall back gracefully, but invalid-rule state will not be fully visible in the UI.

### 2. Install Playwright locally on each machine that runs E2E tests

Run:

```powershell
npx playwright install chromium
```

This is a one-time machine setup step for local `npm run test:e2e`.

### 3. Add optional GitHub Actions secrets for real-environment E2E

If you want CI to run against a real Supabase/Gemini environment, add these repository secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`

If these are not set, CI still runs with placeholder values and the public-shell smoke tests can still pass.

### 4. Commit and push phase completion

After local verification:

```powershell
git add .
git commit -m "P1 closeout"
git push
```

### 5. Verify contributions appear on GitHub

For GitHub contribution/activity visibility, make sure:

- your commit email is attached and verified on your GitHub account
- the work is merged into the repository default branch, or the default branch is changed to the branch carrying the phase work

## P2

### 1. Apply the 5 P2 database migrations in order

Run these SQL files one at a time, in order:

- `knowledge/migrations/2026-04-04-p2-01-organizations.sql`  
  Creates `organizations` and `organization_members`, adds `organization_id` to core business tables, and sets up org-based RLS.
- `knowledge/migrations/2026-04-04-p2-02-backfill-personal-orgs.sql`  
  Creates a personal org for each existing user and backfills `organization_id` on existing rows.
- `knowledge/migrations/2026-04-04-p2-03-audits-table.sql`  
  Creates the `audits` table with lifecycle states and adds `audit_id` to scans.
- `knowledge/migrations/2026-04-04-p2-04-export-logs.sql`  
  Creates the `export_logs` table with org-scoped RLS.
- `knowledge/migrations/2026-04-04-p2-05-connectors.sql`  
  Creates the `connectors` table for Postgres and S3 data sources.

Order matters because migration 2 depends on tables created by migration 1.

### 2. Verify the backfill and enforce `NOT NULL`

After running `2026-04-04-p2-02-backfill-personal-orgs.sql`, verify that no rows are missing `organization_id`:

```sql
SELECT COUNT(*) FROM policies WHERE organization_id IS NULL;
SELECT COUNT(*) FROM scans WHERE organization_id IS NULL;
SELECT COUNT(*) FROM uploaded_datasets WHERE organization_id IS NULL;
```

If all three queries return `0`, uncomment and run the `ALTER COLUMN ... SET NOT NULL` lines at the bottom of `2026-04-04-p2-02-backfill-personal-orgs.sql`.

### 3. Set `YGG_CONNECTOR_SECRET`

Generate a secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then set:

```powershell
YGG_CONNECTOR_SECRET=<the 64-char hex string>
```

This environment variable is required for connector credential storage only. The rest of the app can run without it.

### 4. Redeploy the application

After the migrations are applied and `YGG_CONNECTOR_SECRET` is set, redeploy the app so the P2 code picks up the schema changes and encryption key.

### 5. Optionally add `YGG_CONNECTOR_SECRET` to CI

If you want connector tests in GitHub Actions to use encrypted connector credentials, add `YGG_CONNECTOR_SECRET` as a repository secret.
