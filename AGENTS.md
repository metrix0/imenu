# iMenu — AI working rules

## Scope and conduct
- Do only what the user explicitly requests. Do not alter unrelated code, behavior, data, naming, formatting, or architecture. Make the smallest correct change and reuse existing mechanisms.
- For investigation, explanation, or suggestions: inspect and report; **do not edit** unless expressly asked to implement.
- Inspect the actual relevant implementation, schema, state, and logs before concluding. Never invent findings or claim validation not performed.
- For bug fixes, reproduce or verify the failure before editing. Fix the underlying cause, not just the symptom. Never implement speculative fixes.
- Keep answers brief and direct unless details are requested. Do not unnecessarily ask for information already available.

## Access and source of truth
- iMenu repository: `metrix0/imenu`; **default working branch: `preview`**; `main` is production. Preview: https://preview.imenuapp.com.br.
- All iMenu repository changes must go through GitHub, on `preview` by default. Another non-`main` branch may be used only when the user explicitly authorizes it for the task. Never commit to `main`. Other repositories use `main` unless their workflow says otherwise.
- **GitHub code search can index the default (`main`) branch.** Treat search matches only as discovery hints: get paths from the `preview` tree and fetch every relevant file explicitly with `ref: "preview"`. Do not rely on default-branch file contents or assume a search excerpt matches `preview`.
- Before editing, inspect related callers/components and current behavior. Immediately before editing or committing, reread each affected existing file from current target-branch HEAD; check whether HEAD advanced and reconcile instead of overwriting others' work.
- Pushing to `preview` automatically triggers the GitHub Actions build and staging deployment. Never manually trigger or manage builds or deployments after pushing; leave them to the automated workflow unless the user explicitly requests otherwise.
- Use **@iMenu Supabase** for all database reads, writes, SQL, schema, and `pg_cron`. Use **@iMenu VPS / Deploy** for VPS, deployment, timers, logs, and monitoring.
- **Never use the Vercel plugin without explicit permission.** **Never use Remote Desktop Commander/Controller without asking permission first.** If permission is given for RDC, first read `C:\Users\Usuario\AI-Apps\READMEAI.md` once.
- If essential GitHub/iMenu Supabase/iMenu VPS access is missing, stop and identify exactly what must be reconnected. If only secrets/envs prevent testing, finish and commit the otherwise-complete implementation and report what is needed.

## Code organization (for new work only)
- Before creating a file or folder, inspect the existing structure and search for reusable implementations. Prefer extending existing code over creating duplicated logic, components, helpers, or parallel implementations. Put new files alongside the feature they serve; create a new folder only when no suitable existing one exists.
- **`lib/`**: Do not add new `.ts` files directly at the root of `lib/`. Organize new logic by feature, using existing folders such as `ia-vendas/`, `pizza/`, `payments/`, `qr-table/`, `menu/`, `promotions/`, `addons/`, `delivery/`, `push/`, `seo/`, and `printer/` as appropriate.
  - `services/`: business operations and external-service workflows; `api/`: API/integration clients and communication helpers; `database/`: database clients, queries, and storage operations.
  - `utils/`: generic helpers genuinely reusable across features, **not** feature-specific logic; `stores/`: state management grouped by feature; `types/`: types shared across features.
  - `auth/`: authentication and authorization; `analytics/`: event tracking, metrics, and analytics logic; `dev/`: developer dashboard and development-only utilities.
- **`components/`**: Preserve existing directories and their purposes:
  - `restaurant-owner/<feature>/`: restaurant management UI, organized by existing feature folders; `costumer/`: customer-facing ordering UI (retain the repository's existing spelling).
  - `dev/`: developer dashboard UI; `payments/`: payment UI; `auth/`: authentication UI; `landing/`: marketing and landing-page UI.
  - `ui/`: reusable UI primitives (buttons, inputs, modals, etc.); `common/`: shared components, providers, and cross-feature analytics/tracking components (`common/analytics/`).
- Prefer existing feature subfolders over new top-level categories. These rules guide future additions only: do **not** relocate or reorganize existing files unless expressly requested.

## Frontend/UI, when applicable
- **Before designing or editing UI, list the entire `components/` directory tree, including filenames.** Identify existing components relevant to the requested interface, read their implementations, and inspect at least one comparable existing page. Reuse those components and their supported interactions. Create a custom implementation only when existing components cannot support the requirement; extend an existing component when appropriate.
- **Before implementing an interaction or visual state, find its existing implementation. Reuse or extend the whole behavior and layout; do not recreate them from primitives merely because those primitives are shared.**
- **Settings save automatically by default.** Reuse `lib/utils/useAutoSave.ts` for saving and `components/ui/SaveStatus.tsx` for saving, saved, and error feedback, following `app/painel/loja/page.tsx` and `app/painel/disponibilidade/page.tsx`. Do not introduce a manual save button unless the user explicitly requests it; older screens with save buttons are not the default pattern. Identify the reference page's saving behavior before implementation and verify that edits persist without a save click. Debounce text edits, serialize writes so older requests cannot overwrite newer edits, and do not save on initial load or report failed/pending changes as saved.
- **Loading:** Use the reused component's existing loading behavior. For page-level loading, use `components/ui/Loader.tsx`, following the established page layout. Do not invent loading indicators or substitute plain “Carregando...” text. Keep initial loading separate from saving so autosave does not hide the form.
- **User-facing copy:** Add text only when it helps the end user understand or use the feature. Do not add implementation notes, testing explanations, developer justifications, or unsolicited explanatory footers. Describe the user's task and relevant conditions using concise product language.
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
