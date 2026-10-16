# iMenu VPS — production migration and operations

Production migrated on 2026-10-16 with the user's approval. www.imenuapp.com.br and api.imenuapp.com.br now serve the KingHost VPS. The apex redirects to www. The managed source database is read-only and its six database jobs are disabled. Do not restore the source over the live destination or reverse DNS without reconciling destination writes.

## Verified staging installation

KingHost 177.153.39.121: Ubuntu 24.04 LTS, 6 vCPU, 8 GB RAM, 170 GB contracted disk. Root workspace: /opt/imenu-migration. Official Supabase self-hosted/v0.8.2 at 564eab8ad7840b13324f68b1bfac074ef8d51c21, PostgreSQL 17. App/DB/Auth/Data API/Storage/Realtime/Edge Runtime/Studio/pooler run in Docker.

SSH requires a key and a pinned host fingerprint. PostgreSQL and Studio are private. The Supabase Docker network is internal. App and Auth have separately configured outbound access. Private environment files stay mode 600 and are excluded from Git/build context.

Protected staging:
- https://vps-stage.imenuapp.com.br
- https://api-vps-stage.imenuapp.com.br

Caddy has trusted certificates, HTTP redirects, noindex and operator-IP restrictions; external non-allowlisted website requests return 403. The authenticated MCP gateway returns 401 without credentials. The website/API allowlist must not be removed to make a test pass. Internal Docker calls are allowed separately. Production Caddy uses ops/cutover/Caddyfile.live; protected staging and the authenticated private MCP route remain enabled.

## Global checklist

"Verified" means a concrete check passed; it does not mean every real-device or production flow has been exercised.

| Item | State | Evidence / remaining gate |
| --- | --- | --- |
| OS, SSH key, firewall, Docker | Verified | Key-only SSH; private DB/admin; running services healthy |
| Pinned Supabase stack | Verified | Official release and persistent volumes |
| Final database migration | Verified | Frozen source snapshot 20261016T130243Z; 47 public tables with zero count mismatches; 1,976 Auth users, 1,911 restaurants, 14,189 orders at cutover |
| Auth accounts and password hashes | Verified | Accounts restored; password login, refresh and getUser passed |
| Original JWT/anon/service-role keys | Verified | Original signatures verified; no private key in browser output |
| Browser/printer saved session key | Implemented and tested | Legacy sb-mjogdsnxbwhbqcoijrwt-auth-token retained |
| Storage contents | Verified | Final 16,284 objects / 1,094,703,536 bytes copied with zero failures; initial full SHA256 validation plus version-aware final delta; ten final API samples across five buckets matched SHA256; IDs/versions/xattrs preserved |
| Public/private Storage access | Verified | Public downloads and private anonymous denial; owner-only object listing |
| SQL functions, triggers, extensions, Vault | Restored | Two Vault secrets refreshed; six original cron schedules copied with destination URL adjustment and activated only after source freeze |
| Tenant isolation / RLS | Verified in staging | 14 previously unprotected tables hardened; anonymous private-data/write and cross-tenant access denied; owner update allowed |
| Media, function search paths, Storage listing | Hardened | Owner media writes, fixed function search paths, restricted definer-trigger execution; advisor WARN/ERROR cleared |
| Application build/regression | Verified | TypeScript, Next production build and 213 tests across 20 suites passed for production source 2764c6055403cec3e9e6db40ce3413d406faa09e; TypeScript and production build passed |
| Menu/order/stock | Verified | Isolated offline order through app; stock decrement; fixture cleanup |
| Realtime | Verified | Authenticated order INSERT and fresh connection subscription passed; wait for setAuth before subscribing |
| Printer queue | Verified | Atomic claim, duplicate rejection, retry, acknowledgement, history, receipt and reprint checks |
| Printer executable | Released and user tested | Primary release 1.4.2 installed by the user; order #71 reprinted successfully before database cutover. Restart the printer to refresh its backend configuration; post-cutover physical reprint is not yet confirmed |
| Signup/recovery emails | Verified with capture | Confirmation link creates session; recovery email captured locally |
| External SMTP | Verified | Resend TLS/auth and message accepted by official Resend delivery simulator; no customer recipient |
| Google OAuth | Final callback registered | Google client now includes https://api.imenuapp.com.br/auth/v1/callback; original managed and staging callbacks preserved. Full post-cutover browser login not independently observed |
| AI providers | Credentials restored; live GPT verified | Minimal real gpt-5.6-luna response completed; no restaurant analysis generated/applied |
| WAHA | Read-only verified | Existing external service queried; sessions not started/stopped/migrated and no WhatsApp sent |
| Asaas / Fixie / Mercado Pago | Authentication verified | Original credentials restored privately; real charge, payout and paid-webhook flow not performed |
| Webhook credentials | Restored in staging | WAHA HMAC and Asaas token reject unsigned requests; Mercado Pago re-fetches payment from provider and validates reference/amount; malformed ID rejected before provider fetch |
| Push notifications | Original key pair verified | PKCS8 newline formatting corrected without re-keying; derived public key and JWT sign/verify passed; real-device delivery/permission test remains pending |
| Five host schedules | Active | Original UTC schedules preserved; production environment and container selected; Persistent=false. Old Vercel config deployment was explicitly deferred by the user; managed source read-only blocks writes, including payout run creation before transfer execution |
| Six database schedules | Active on VPS only | cron.launch_active_jobs=on; six active destination jobs; six source jobs disabled |
| Automatic deployments | Production and staging configured | Production systemd timer checks main every 60 seconds and deploys exact HEAD; restricted preview SSH workflow retained. Separate environment, image, state and lock per target; shared build lock; health failure restores prior image |
| Application rollback | Verified | Previous image restored healthy, current image restored healthy, database untouched |
| Encrypted backups | Verified | Daily DB/Storage/config/TLS archive; seven server copies, fourteen PC copies; checksum-verified pull |
| Recovery rehearsal | Verified within scope | Encrypted archive authenticated, all Storage files/xattrs checked, 47 public tables restored into temporary DB and counts compared with the backup snapshot; tampered archive rejected |
| Local monitor / log bounds / security updates | Active | Five-minute checks; bounded Docker/journal logs; unattended upgrades enabled |
| Independent monitoring | Configured | Hourly ChatGPT VPS monitor reads private imenu_ops.health through MCP; works without the PC. This is supplementary, not a sub-minute uptime SLA |
| MCP personal plugin | Verified | Connector initialization, real SQL read and transactional write/rollback; unauthorized gateway blocked |
| Capacity/headroom | Bounded checks only | Successful bounded menu load and current resource checks; no 100% availability or 10x capacity claim |
| Fresh final source sync | Complete | Source frozen, final Auth/public/Storage restored, exact schema ACL entries restored from source dump and security hardening reapplied before reopening writes |
| Production TLS/domains | Owned hosts verified | www returns 200, apex 308, API TLS valid; preview remains restricted. Domino customer domain was already NXDOMAIN; other unverified customer domains require separate DNS acceptance |
| Production migration | Live and healthy | Production app and Supabase services healthy; 31 buffered webhooks replayed, zero pending; Auth password/refresh/getUser/RLS/recovery-link fixture passed and was removed |

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

## Post-cutover checks

1. Restart the physical printer so it reloads the backend configuration, then reprint order #71. Database reads alone cannot prove physical reprint delivery.
2. Confirm final Google login and real-device push. Original VAPID keys were preserved and cryptographically checked.
3. Deploy the user's edited Vercel configuration when ready to remove old Vercel schedules. Do not re-enable writes on the managed source.
4. Production merges deploy automatically through imenu-production-deploy.timer, checked every 60 seconds. Inspect systemctl status imenu-production-deploy.service and journalctl -u imenu-production-deploy.service. A failed SHA requires an explicit retry; newer commits are considered normally.
5. Resolve customer-owned DNS separately; do not assume an unverified custom domain is operational.

## Live production paths and validation

Production source image: 2764c6055403cec3e9e6db40ce3413d406faa09e. Container: imenu-production-app. Compose: ops/cutover/compose.app.yml. Runtime secrets: secrets/app-production.env. Build secrets: secrets/app-production-build.env. The production runtime Compose env_file uses format: raw, preserving dollar signs in provider credentials.

Caddy: ops/cutover/Caddyfile.live and ops/cutover/compose.proxy-live.yml. Supabase's private COMPOSE_FILE includes docker-compose.imenu-production.json. That overlay must be included in encrypted backups. Reproducible production-source and preview-checkout trees are excluded from backup archives.

The monitor now checks the production container and its /api/health route while retaining required staging services. Validate with python3 /opt/imenu-migration/ops/monitor.py. Run encrypted backup with bash /opt/imenu-migration/ops/backup.sh; the PC pull verifies SHA256 without sending its decryption key to the VPS.

Final cutover evidence remains private: ops/cutover/final-count-validation.json, ops/cutover/webhook-replay-validation.json, the final snapshot manifest, and final Storage copy report. No SQL, dumps, secrets or webhook payloads belong in GitHub.

Validation performed: npx tsc --noEmit; 213 tests / 20 suites; npx next build; final table-count comparison; final Storage copy with zero failures and ten API checksum samples; Auth fixture login/refresh/getUser/RLS/recovery link and cleanup; production health; apex redirect; container health; six active destination database jobs; five enabled host timers. Do not run payout or customer-message jobs manually merely to test scheduling.

## Automatic production deployment

deployment/vps/deploy-preview.sh defaults to preview; --production selects main, imenu-production-app, production-checkout, production-deploy-state and the existing private production Compose file. Both modes reject a mismatched public API URL. Builds are serialized across targets. The production marker is required for production and no longer blocks isolated staging deployments.

Install poll-production.sh under /opt/imenu-migration/ops and the service/timer from deployment/vps/systemd under /etc/systemd/system. Run systemctl daemon-reload and systemctl enable --now imenu-production-deploy.timer. The timer is independent of the operator PC and GitHub secrets. A successful merge is detected within approximately one minute plus build time; no deployment changes SQL, Storage, Auth, schedules or DNS.

The build runs the existing IA Vendas regression suite, TypeScript check and Next production build before replacing the app. Branch HEAD is checked again after the build, so an obsolete build leaves the current app running. A healthy existing deployed SHA is a no-op. A startup failure restores the previous image and Compose file. Failed commits are recorded to prevent endless rebuilds. After investigating a failed production build, retry with bash /opt/imenu-migration/ops/deploy-preview.sh --production --retry FULL_MAIN_SHA.

Production deployer state: ops/production-deploy-state. Build log: ops/production-deploy-state/build.log. Git source is reproducible and excluded from encrypted backups; deployed SHA and rollback state remain in the backup.
