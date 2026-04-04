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

