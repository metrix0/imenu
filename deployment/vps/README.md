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
| WAHA | Local service | imenu-kinghost-waha persists sessions under waha/sessions; included in encrypted backups and required monitoring. |
| Asaas / Fixie / Mercado Pago | Authentication verified | Original credentials restored privately; real charge, payout and paid-webhook flow not performed |
| Webhook credentials | Restored in staging | WAHA HMAC and Asaas token reject unsigned requests; Mercado Pago re-fetches payment from provider and validates reference/amount; malformed ID rejected before provider fetch |
| Push notifications | Original key pair verified | PKCS8 newline formatting corrected without re-keying; derived public key and JWT sign/verify passed; real-device delivery/permission test remains pending |
| Five host schedules | Active | Original UTC schedules preserved; production environment and container selected; Persistent=false. Old Vercel config deployment was explicitly deferred by the user; managed source read-only blocks writes, including payout run creation before transfer execution |
| Seven database schedules | Active on VPS only | Seven live jobs; the six original managed-source jobs remain disabled. Production HTTP jobs call www; Storage cleanup retains 24 hours of AI import images and allows a 30-second HTTP timeout. |
| Automatic deployments | GitHub-triggered production and staging | GitHub Actions deploys new main commits using a dedicated, restricted production SSH identity; preview keeps its independent SSH workflow. Existing build, health, rollback, and shared build locks remain. The old production polling timer is removed after the first verified GitHub-triggered deployment. |
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
4. Production commits trigger .github/workflows/deploy-vps-production.yml immediately. Verify GitHub Actions and ops/production-deploy-state/deployed-sha. Failed SHAs require explicit retries; newer commits supersede waiting deployments.
5. Resolve customer-owned DNS separately; do not assume an unverified custom domain is operational.

## Live production paths and validation

Cutover source image (historical): 2764c6055403cec3e9e6db40ce3413d406faa09e. Current image SHA is recorded in ops/production-deploy-state/deployed-sha. Container: imenu-production-app. Compose: ops/cutover/compose.app.yml. Runtime secrets: secrets/app-production.env. Build secrets: secrets/app-production-build.env. The production runtime Compose env_file uses format: raw, preserving dollar signs in provider credentials.

Caddy: ops/cutover/Caddyfile.live and ops/cutover/compose.proxy-live.yml. Supabase's private COMPOSE_FILE includes docker-compose.imenu-production.json. That overlay must be included in encrypted backups. Reproducible production-source and preview-checkout trees are excluded from backup archives.

The monitor now checks the production container and its /api/health route while retaining required staging services. Validate with python3 /opt/imenu-migration/ops/monitor.py. Run encrypted backup with bash /opt/imenu-migration/ops/backup.sh; the PC pull verifies SHA256 without sending its decryption key to the VPS.

Final cutover evidence remains private: ops/cutover/final-count-validation.json, ops/cutover/webhook-replay-validation.json, the final snapshot manifest, and final Storage copy report. No SQL, dumps, secrets or webhook payloads belong in GitHub.

Validation performed: npx tsc --noEmit; 213 tests / 20 suites; npx next build; final table-count comparison; final Storage copy with zero failures and ten API checksum samples; Auth fixture login/refresh/getUser/RLS/recovery link and cleanup; production health; apex redirect; container health; six active destination database jobs; five enabled host timers. Do not run payout or customer-message jobs manually merely to test scheduling.

## Prebuilt production deployment

Production GitHub Actions builds Next.js standalone with only the production NEXT_PUBLIC_ settings obtained over the restricted deploy SSH identity (no private runtime secrets on GitHub). It uploads a compressed standalone release to GitHub Actions artifact storage, then sends a short-lived signed HTTPS artifact URL over the existing restricted SSH connection for direct VPS download. The VPS checks the archive SHA256 before activation using the existing production image, environment, networks, health checks and rollback; no VPS-side Docker build, image export or image unpack. The existing production container image retains Puppeteer/Chromium runtime dependencies. Release verification checks commit and public configuration hashes; the previous release (or original image on the first switch) is restored if health checks fail. Manual retry uses workflow_dispatch retry_failed or retry-prebuilt:SHA. Staging continues using its existing Docker build path.

## Automatic production deployment

deployment/vps/deploy-preview.sh defaults to preview; --production selects main, imenu-production-app, production-checkout, production-deploy-state and the existing private production Compose file. Both modes reject a mismatched public API URL. Builds are serialized across targets. The production marker is required for production and no longer blocks isolated staging deployments.

Install github-production-deploy-hook.sh as a root-owned, root-only executable under /opt/imenu-migration/ops, and github-production-deploy-ssh.sh as a root-owned executable at /usr/local/bin/imenu-production-deploy-ssh. Give a dedicated imenu-production-deploy user a restricted, forced-command SSH key and sudo permission only for the production hook. Set the matching private key in GitHub Actions secret IMENU_PROD_DEPLOY_SSH_KEY. New main commits trigger .github/workflows/deploy-vps-production.yml; queued older commits are superseded without interrupting an active build. The production hook retires the legacy timer/service only after GitHub has successfully requested a healthy deployment. No application deployment changes SQL, Storage, Auth, schedules or DNS.

The build runs the existing IA Vendas regression suite, TypeScript check and Next production build before replacing the app. Branch HEAD is checked again after the build, so an obsolete build leaves the current app running. A healthy existing deployed SHA is a no-op. A startup failure restores the previous image and Compose file. Failed commits are recorded to prevent endless rebuilds. After investigating a failed production build, retry with bash /opt/imenu-migration/ops/deploy-preview.sh --production --retry FULL_MAIN_SHA.

Production deployer state: ops/production-deploy-state. Build log: ops/production-deploy-state/build.log. Git source is reproducible and excluded from encrypted backups; deployed SHA and rollback state remain in the backup.

## Storage retention and current configuration

Preview intentionally shares production database, Auth and Storage data. Only its application container/configuration is separate. Changes made through preview can affect live restaurants.

Install docker-retention.sh under ops and the matching systemd service/timer under /etc/systemd/system. The 15-minute timer skips active builds. Deployment invokes the same cleanup before and after builds under the shared application-build.lock, including failed builds, and refuses to start with less than 15 GiB free. Docker build cache is pruned toward 8 GB with 40 GB free-space headroom; referenced/shared layers can keep Docker's displayed aggregate above that target. Only obsolete application image tags and unreferenced image/cache data are removed. All container images and the latest/final, rollback and staging before-manual-rollback images are protected. No volumes are pruned. Inspect imenu-docker-retention.service failures and retain the disk alert.

The Dockerfile uses separate build/runtime stages. Tests and TypeScript remain build requirements; development-only dependencies, source trees, Next build cache and ownership-change layers are excluded from the runtime image. Puppeteer browser files, public assets and design-system.html remain available.

Maintained configuration sources:
- deployment/vps/Caddyfile -> ops/config/Caddyfile
- deployment/vps/compose.stage.yml -> ops/config/compose.stage.yml
- deployment/vps/compose.production.yml -> ops/config/compose.production.yml
- deployment/vps/compose.proxy-live.yml -> ops/config/compose.proxy-live.yml
- deployment/vps/compose.mcp-gateway.yml -> ops/mcp-bridge/compose.gateway.yml
- deployment/vps/backup.sh and monitor.py -> ops/

Production deployment uses the maintained production Compose file from its exact source commit when present. Keep private environment files outside Git. Do not recreate the entire Supabase stack to apply an application/proxy-only change. The base Supabase staging overlay disables cron; the production overlay must be last in COMPOSE_FILE to enable it. The observed order is docker-compose.yml:docker-compose.imenu-stage.yml:docker-compose.imenu-auth.json:docker-compose.imenu-ops.json:docker-compose.imenu-production.json.

Existing imenu-stage container/network/volume names and /opt/imenu-migration paths remain compatibility identifiers, not unused resources. Renaming them requires a separate coordinated data/mount/connector migration. api.imenuapp.com.br is the active Supabase endpoint. The preserved Auth storage key is required for existing sessions. Vercel domain support and environment tooling remain compatibility paths; PayZu/Fixie variables still have code dependencies.

The backup includes WAHA session/configuration files along with DB, Storage, secrets, systemd units, ops and TLS; seven encrypted server copies remain the retention policy. WAHA SQLite databases use online snapshots and pass quick_check before archiving; WAL/SHM files and nested historical WAHA backups are excluded. Individual session snapshots and the main database are not a single atomic cross-service snapshot. Restore private WAHA sessions before restarting the same WhatsApp service; never activate a second instance against the same session store. Monitoring requires WAHA and the MCP gateway, uses the same usable-space disk calculation as df, and reports failures through the existing private health heartbeat.

Historical cutover files are recovery evidence. Keep encrypted accepted backups and active deployed/rollback state; do not delete historical secret copies or snapshots merely because their names look obsolete.

The VPS operations gateway queues preview-only deploy/rollback units with systemd --no-block. It releases its lock probe before the rollback precheck and lets the scripts acquire their own locks. The production marker does not block these preview-only operations. Backup systemd coverage includes service/timer drop-in directories, including the restricted gateway Docker client and application-lock configuration.

SQLite durability flushes are disabled only on disposable staging copies to avoid hundreds of redundant journal flushes. Every copied database must still pass quick_check; archives are encrypted and checksummed before becoming the latest backup. Live session databases remain read-only to the snapshot helper.

Before starting the restricted VPS operations service after a restore, recreate its shared lock file with touch /opt/imenu-migration/ops/application-build.lock and chmod 600 on that file. Backup archives intentionally exclude lock files; the normal deploy/rollback scripts also create this lock when run by the operator.

Live Storage directory-list changes during tar are accepted only when tar exits 1 and every diagnostic identifies an existing directory inside Storage. Changed regular files, unreadable files, other warnings and encryption failures still reject the archive. This does not make the live database/files archive atomic.
