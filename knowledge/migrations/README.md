# SQL migrations (Supabase / Postgres)

Apply **in filename order** on your project database:

1. `2026-03-19-p0-durable-upload-and-mapping.sql`
2. `2026-04-02-clean-runtime-data-keep-policies-and-rules.sql` (optional cleanup; read comments inside)
3. `2026-04-03-rules-validation-metadata.sql` (`validation_status`, `validation_issues` on `rules`)

Until (3) is applied, rule inserts still work: the app retries without validation columns if the DB returns undefined-column errors.
