# iMenu VPS — staging checklist and cutover gate

Production has NOT been migrated. Do not switch www, preview, customer domains, provider callbacks, printer releases or production schedulers without the user's explicit cutover approval.

## Verified staging installation

KingHost 177.153.39.121: Ubuntu 24.04 LTS, 6 vCPU, 8 GB RAM, 170 GB contracted disk. Root workspace: /opt/imenu-migration. Official Supabase self-hosted/v0.8.2 at 564eab8ad7840b13324f68b1bfac074ef8d51c21, PostgreSQL 17. App/DB/Auth/Data API/Storage/Realtime/Edge Runtime/Studio/pooler run in Docker.

SSH requires a key and a pinned host fingerprint. PostgreSQL and Studio are private. The Supabase Docker network is internal. App and Auth have separately configured outbound access. Private environment files stay mode 600 and are excluded from Git/build context.

Protected staging:
- https://vps-stage.imenuapp.com.br
- https://api-vps-stage.imenuapp.com.br

Caddy has trusted certificates, HTTP redirects, noindex and operator-IP restrictions; external non-allowlisted website requests return 403. The authenticated MCP gateway returns 401 without credentials. The website/API allowlist must not be removed to make a test pass. Internal Docker calls are allowed separately. Public production/custom-domain Caddy configuration remains a template.

## Global checklist

"Verified" means a concrete check passed; it does not mean every real-device or production flow has been exercised.

| Item | State | Evidence / remaining gate |
| --- | --- | --- |
| OS, SSH key, firewall, Docker | Verified | Key-only SSH; private DB/admin; running services healthy |
| Pinned Supabase stack | Verified | Official release and persistent volumes |
| Initial database migration | Verified | 47 public tables; initial snapshot 20261014T165707Z |
| Auth accounts and password hashes | Verified | Accounts restored; password login, refresh and getUser passed |
| Original JWT/anon/service-role keys | Verified | Original signatures verified; no private key in browser output |
| Browser/printer saved session key | Implemented and tested | Legacy sb-mjogdsnxbwhbqcoijrwt-auth-token retained |
| Storage contents | Verified | All 15,735 unique objects / 982,433,988 bytes matched original SHA256; IDs/versions/xattrs preserved |
| Public/private Storage access | Verified | Public downloads and private anonymous denial; owner-only object listing |
| SQL functions, triggers, extensions, Vault | Restored | Two Vault secrets re-encrypted; cron definitions retained inactive |
| Tenant isolation / RLS | Verified in staging | 14 previously unprotected tables hardened; anonymous private-data/write and cross-tenant access denied; owner update allowed |
| Media, function search paths, Storage listing | Hardened | Owner media writes, fixed function search paths, restricted definer-trigger execution; advisor WARN/ERROR cleared |
| Application build/regression | Verified | TypeScript, Next production build and 208 IA regression tests passed in prior successful deployments; CI reruns for changed application code |
| Menu/order/stock | Verified | Isolated offline order through app; stock decrement; fixture cleanup |
| Realtime | Verified | Authenticated order INSERT and fresh connection subscription passed; wait for setAuth before subscribing |
| Printer queue | Verified | Atomic claim, duplicate rejection, retry, acknowledgement, history, receipt and reprint checks |
| Printer executable | Preview build verified | Both current Windows and Windows 7 legacy preview installers built successfully without publishing; legacy saved-session and staging-config overrides verified; physical printer test and customer rollout still pending |
| Signup/recovery emails | Verified with capture | Confirmation link creates session; recovery email captured locally |
| External SMTP | Verified | Resend TLS/auth and message accepted by official Resend delivery simulator; no customer recipient |
| Google OAuth | Configured, full login unverified | Staging callback is https://api-vps-stage.imenuapp.com.br/auth/v1/callback; last recorded Google error was redirect_uri_mismatch; Cloud client registration and complete login must be verified |
| AI providers | Credentials restored; live GPT verified | Minimal real gpt-5.6-luna response completed; no restaurant analysis generated/applied |
| WAHA | Read-only verified | Existing external service queried; sessions not started/stopped/migrated and no WhatsApp sent |
| Asaas / Fixie / Mercado Pago | Authentication verified | Original credentials restored privately; real charge, payout and paid-webhook flow not performed |
| Webhook credentials | Restored in staging | WAHA HMAC and Asaas token reject unsigned requests; Mercado Pago re-fetches payment from provider and validates reference/amount; malformed ID rejected before provider fetch |
| Push notifications | Original key pair verified | PKCS8 newline formatting corrected without re-keying; derived public key and JWT sign/verify passed; real-device delivery/permission test remains pending |
| Five Vercel schedules | Prepared, disabled | UTC schedules preserved; PRODUCTION_JOBS_ENABLED absent; payouts disabled |
| Six database schedules | Prepared, disabled | cron.launch_active_jobs=off and zero active jobs |
| Automatic preview deployment | Implemented | Restricted SSH identity; exact preview SHA; health gate; no main/production deploy |
| Application rollback | Verified | Previous image restored healthy, current image restored healthy, database untouched |
| Encrypted backups | Verified | Daily DB/Storage/config/TLS archive; seven server copies, fourteen PC copies; checksum-verified pull |
| Recovery rehearsal | Verified within scope | Encrypted archive authenticated, all Storage files/xattrs checked, 47 public tables restored into temporary DB and counts compared with the backup snapshot; tampered archive rejected |
| Local monitor / log bounds / security updates | Active | Five-minute checks; bounded Docker/journal logs; unattended upgrades enabled |
| Independent monitoring | Configured | Hourly ChatGPT VPS monitor reads private imenu_ops.health through MCP; works without the PC. This is supplementary, not a sub-minute uptime SLA |
| MCP personal plugin | Verified | Connector initialization, real SQL read and transactional write/rollback; unauthorized gateway blocked |
| Capacity/headroom | Bounded checks only | Successful bounded menu load and current resource checks; no 100% availability or 10x capacity claim |
| Fresh final source sync | Deliberately pending | Source remains writable; repeat snapshot and file delta at approved maintenance window |
| Production TLS/custom domains/callbacks | Deliberately pending | Validate final owned API hostname and dynamic customer routing before switch; no customer DNS changes here |
| Production migration | NOT authorized/executed | Explicit approval required |

## Build, deploy and rollback

Build with deployment/vps/Dockerfile, private BuildKit secret build_env, and BUILD_PUBLIC_CONFIG_SHA256. Hash the sorted NEXT_PUBLIC_ configuration only: secret-file changes alone do not invalidate BuildKit cache. Never put private values in public build arguments.

Runtime: IMENU_STAGE_ENV_FILE=/opt/imenu-migration/secrets/app-stage.env. Keep shell-quoted app-build.env separate from the Compose env file. Preserve the PKCS8 private push key with literal backslash-n line separators for the existing runtime normalizer; do not flatten the PEM or generate a replacement key. DATABASE_SSL=false applies only to the private Docker database.

The GitHub staging workflow uses the restricted imenu-stage-deploy SSH identity and host fingerprint. The server deploy script builds exact preview HEAD, uses that commit's compose file, preserves the previous image/compose/SHA, checks health, and automatically restores the old image if startup fails. It never applies migrations or restores a database.

Manual application rollback:
- Check: bash /opt/imenu-migration/ops/rollback-preview.sh --check
- Restore previous staging app only: bash /opt/imenu-migration/ops/rollback-preview.sh --restore-previous
- Keep database state. After a production switch, reversing DNS without reconciling new writes is not a data-safe rollback.

Reapply staging security after a source restore, before exposing/restoring client traffic:
python3 /opt/imenu-migration/ops/harden-data-api.py --apply-staging

The script refuses a production marker or non-staging public API URL. It snapshots the original public policies and is idempotent. Apply it before changing staging URLs during the final cutover preparation. Server-only tables intentionally have RLS with no client policies.

## Backup and monitoring operations

Private Windows workspace: %LOCALAPPDATA%\iMenuMigration. The RSA backup private key stays on the PC. VPS archives use streaming RSA-OAEP/AES-256-GCM. The PC pull task now uses pythonw.exe, so it does not open a terminal every few minutes. PC pulls require that PC/user session to be available.

The server backup includes database.dump, globals, private settings, systemd units, Storage with xattrs, Edge Functions, operational scripts and TLS state. Daily consistency is a DB snapshot plus a file archive, not an atomic live DB/files snapshot. Pause writers for the final migration snapshot.

The host monitor publishes a private SQL heartbeat to imenu_ops.health. That schema is not exposed by PostgREST and grants no access to anon/authenticated. A separate hourly ChatGPT task checks it via the existing authenticated MCP connector, remains silent while healthy, and reports confirmed/stale/connection failures separately. Verify actual notification receipt; do not claim a future alert has already been delivered.

Detailed machine-readable checks remain private under /opt/imenu-migration/ops: integration-validation.json, integrity-security-validation.json, data-api-security-applied.json, rollback-validation.json, smtp-validation.json and health.json. Database recovery evidence is under backups/database-recovery-validation.json. Do not commit dumps, credentials, operator IP or private reports.

## Remaining acceptance and approved cutover order

1. Complete Google OAuth on the registered staging callback and verify login/session continuation. Do not replace the working managed Supabase callback.
2. Validate a physical printer and real-device push. The successful preview build/queue tests are not physical print proof. Do not publish a customer printer release without rollout approval.
3. Finish full authenticated dashboard/browser acceptance; the connected local browser was unavailable during the final pass. Finish controlled provider acceptance without a real payout or customer message. A successful provider authentication/read does not prove a paid order or notification delivery.
4. Verify final production API/custom-domain certificates, redirects, deployment and rollback configuration while keeping current production traffic in place.
5. Obtain explicit cutover approval and a maintenance window. Take a fresh source backup, pause/drain source writers and schedules, buffer/reconcile payment and WhatsApp webhooks, then restore latest schema/Auth/data and synchronize new/changed/deleted Storage objects. The test copy is stale.
6. Reapply the tested security changes after restoring the source; rewrite destination-only URLs and cron targets to the final owned API hostname. Rebuild public browser settings.
7. Repeat counts/checksums, Auth, public/private files, order/stock, Realtime and printer tests. Keep exactly one writable backend while DNS propagates.
8. Switch approved traffic/provider callbacks together; enable exactly one scheduler copy. Preserve source for the agreed rollback window and reconcile any VPS writes before routing back.
