# iMenu — AI working rules

## Scope and conduct
- Do only what the user explicitly requests. Do not alter unrelated code, behavior, data, naming, formatting, or architecture. Make the smallest correct change and reuse existing mechanisms.
- For investigation, explanation, or suggestions: inspect and report; **do not edit** unless expressly asked to implement.
- Inspect the actual relevant implementation, schema, state, and logs before concluding. Never invent findings or claim validation not performed.
- For bug fixes, reproduce or verify the failure before editing. Fix the underlying cause, not just the symptom. Never implement speculative fixes.
- Keep answers brief and direct unless details are requested. Do not unnecessarily ask for information already available.

## Access and source of truth
- iMenu repository: `metrix0/imenu`; **working branch: `preview`**; `main` is production. Preview: https://preview.imenuapp.com.br.
- All iMenu repository changes must go through GitHub, on `preview` only. Never commit to `main`. Other repositories use `main` unless their workflow says otherwise.
- **GitHub code search can index the default (`main`) branch.** Treat search matches only as discovery hints: get paths from the `preview` tree and fetch every relevant file explicitly with `ref: "preview"`. Do not rely on default-branch file contents or assume a search excerpt matches `preview`.
- Before editing, inspect related callers/components and current behavior. Immediately before editing or committing, reread each affected existing file from current target-branch HEAD; check whether HEAD advanced and reconcile instead of overwriting others' work.
- Use **@iMenu Supabase** for all database reads, writes, SQL, schema, and `pg_cron`. Use **@iMenu VPS / Deploy** for VPS, deployment, timers, logs, and monitoring.
- **Never use the Vercel plugin without explicit permission.** **Never use Remote Desktop Commander/Controller without asking permission first.** If permission is given for RDC, first read `C:\Users\Usuario\AI-Apps\READMEAI.md` once.
- If essential GitHub/iMenu Supabase/iMenu VPS access is missing, stop and identify exactly what must be reconnected. If only secrets/envs prevent testing, finish and commit the otherwise-complete implementation and report what is needed.

## Frontend/UI, when applicable
- Read `docs/ai-design-guidelines.md` first; inspect the actual affected page and existing `components/` and `components/ui/` patterns.
- `design-system.html` remains the authoritative visual reference. Consult the full artifact when the concise guide is insufficient, ambiguous, stale, or when introducing/modifying a visual pattern. Do not invent a competing design pattern.
- Reuse existing components, utilities, styles, spacing, and interactions; preserve unrelated UI behavior.
- For UI changes, compare the rendered result against the existing design and verify affected interactions and screen sizes. Passing tests/builds alone does not prove visual correctness.

## Changes, validation, and delivery
1. Locate and inspect only relevant code/DB/logs on the correct source branch; assess dependent behavior.
2. Make the smallest requested change; no speculative cleanups or parallel implementations.
3. Validate with the repository's relevant existing commands/tests and, where possible, a targeted behavior check. Clearly separate pre-existing failures and unavailable validation.
4. Create **one final commit** to the correct branch and push it. Never create extra branches, except unique temporary test branches containing `temp`, based on the target branch. Never reuse an old temporary branch.
5. Never commit SQL migration files, temporary SQL, schema dumps, or one-off DB scripts. Requested database changes may be executed directly via @iMenu Supabase but are not committed.
6. If the user says `preview` was merged into `main`, continue from `preview`; their system resynchronizes them.

## Final report after a commit
Report concisely: (1) commit hash; (2) exact changed/added/removed files and total; (3) any database tables and exact modifications; (4) clickable preview links for each affected page with only that page's changes; (5) exact validation commands actually run and results. Omit sections that do not apply.
