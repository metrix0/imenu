# iMenu VPS migration — staging only

Production DNS, Vercel main, provider webhooks, and source Supabase remain unchanged. Do not activate production or schedulers without explicit approval.

## Current installation

- KingHost: Ubuntu 24.04, 6 vCPU, 8 GB RAM, 170 GB disk.
- Server workspace: /opt/imenu-migration.
- Supabase official Docker release: self-hosted/v0.8.2, commit 564eab8ad7840b13324f68b1bfac074ef8d51c21.
- PostgreSQL 17; Auth, PostgREST, Realtime, Storage, Edge Runtime, Studio, Supavisor.
- Isolated Docker network: imenu-stage_default (internal).
- SSH key authentication only; firewall permits SSH and staging HTTP/HTTPS (80/443). Database and dashboard are not public.
- App: imenu-stage-app; health endpoint checks PostgreSQL, Data API, and Auth.
- Source snapshot: 20261014T165707Z. Restored 47 public tables, 1,912 users, 1,849 restaurants, 13,879 orders.
- Copied 15,735 Storage files (982,433,988 bytes); file versions, object IDs, policies, bucket settings, and filesystem MIME/cache xattrs preserved.
- All 47 public table counts matched the snapshot. Ten sampled downloads across five buckets matched copied SHA256 values.
- Six source database cron jobs copied INACTIVE; cron.launch_active_jobs=off.
- Two Vault secrets recreated from decrypted source values using destination encryption.
- Realtime publication includes orders, printer_queue_signals, whatsapp_connections.
- storage-maintenance function copied. Runtime dependency cache warmed, then outbound network removed.
- Staging payments: the existing Asaas API credentials and all five Fixie proxy URLs have been restored to the private staging runtime/build environments, and the app alone has outbound access through the existing staging Caddy egress network. The Supabase database network remains internal, payouts and schedulers remain disabled, and production DNS/webhooks remain unchanged. The original Mercado Pago access token is now configured in private staging environment files and authenticated successfully in a read-only API check (HTTP 200); real Pix charge creation and payment webhooks have not been tested. WAHA, other AI/provider secrets and Vercel domain credentials remain disabled in staging.

## Build and access

Build with deployment/vps/Dockerfile and a private BuildKit secret named build_env. It must contain shell-quoted environment assignments. Pass BUILD_PUBLIC_CONFIG_SHA256 as a build argument containing the SHA256 of the sorted NEXT_PUBLIC_ configuration. BuildKit secret changes alone do not invalidate cached build layers; the public fingerprint forces browser configuration to rebuild. Never include private keys in that fingerprint. The image runs the existing IA regression tests, TypeScript, and Next production build. Never put .env files or credentials in the build context or Git.

Run compose.stage.yml with IMENU_STAGE_ENV_FILE set to the private runtime environment file. The app connects to the private `imenu-stage_default` network and the existing outward-facing `imenu-stage-proxy_acme` network; database containers remain internal. Restored payment credentials belong only in the private runtime/build env files, never Git. Quote literal `# iMenu VPS migration — staging only

Production DNS, Vercel main, provider webhooks, and source Supabase remain unchanged. Do not activate production or schedulers without explicit approval.

## Current installation

- KingHost: Ubuntu 24.04, 6 vCPU, 8 GB RAM, 170 GB disk.
- Server workspace: /opt/imenu-migration.
- Supabase official Docker release: self-hosted/v0.8.2, commit 564eab8ad7840b13324f68b1bfac074ef8d51c21.
- PostgreSQL 17; Auth, PostgREST, Realtime, Storage, Edge Runtime, Studio, Supavisor.
- Isolated Docker network: imenu-stage_default (internal).
- SSH key authentication only; firewall permits SSH and staging HTTP/HTTPS (80/443). Database and dashboard are not public.
- App: imenu-stage-app; health endpoint checks PostgreSQL, Data API, and Auth.
- Source snapshot: 20261014T165707Z. Restored 47 public tables, 1,912 users, 1,849 restaurants, 13,879 orders.
- Copied 15,735 Storage files (982,433,988 bytes); file versions, object IDs, policies, bucket settings, and filesystem MIME/cache xattrs preserved.
- All 47 public table counts matched the snapshot. Ten sampled downloads across five buckets matched copied SHA256 values.
- Six source database cron jobs copied INACTIVE; cron.launch_active_jobs=off.
- Two Vault secrets recreated from decrypted source values using destination encryption.
- Realtime publication includes orders, printer_queue_signals, whatsapp_connections.
- storage-maintenance function copied. Runtime dependency cache warmed, then outbound network removed.
- Staging payments: the existing Asaas API credentials and all five Fixie proxy URLs have been restored to the private staging runtime/build environments, and the app alone has outbound access through the existing staging Caddy egress network. The Supabase database network remains internal, payouts and schedulers remain disabled, and production DNS/webhooks remain unchanged. The original Mercado Pago access token is now configured in private staging environment files and authenticated successfully in a read-only API check (HTTP 200); real Pix charge creation and payment webhooks have not been tested. WAHA, other AI/provider secrets and Vercel domain credentials remain disabled in staging.

## Build and access

Build with deployment/vps/Dockerfile and a private BuildKit secret named build_env. It must contain shell-quoted environment assignments. Pass BUILD_PUBLIC_CONFIG_SHA256 as a build argument containing the SHA256 of the sorted NEXT_PUBLIC_ configuration. BuildKit secret changes alone do not invalidate cached build layers; the public fingerprint forces browser configuration to rebuild. Never include private keys in that fingerprint. The image runs the existing IA regression tests, TypeScript, and Next production build. Never put .env files or credentials in the build context or Git.

 in Asaas credentials correctly for Compose env parsing and shell-quote the BuildKit env. DATABASE_SSL=false is only for the isolated local Docker connection. The existing Vercel SSL behavior remains the default.

The Windows task workspace is %LOCALAPPDATA%\iMenuMigration. It contains the pinned SSH host key, private SSH key, ssh_exec.py, and stage_tunnel.py. Keep its private ACL. The tunnel provides app at http://localhost:13000, Supabase at http://supabase.localhost:8000, and captured mail at http://localhost:18025. Do not expose these ports publicly.

Snapshot dump and checksum manifest are also saved in the private Windows workspace. That is a one-time backup, not a verified recurring backup service.

## Protected VPS HTTPS staging

- `vps-stage.imenuapp.com.br` and `api-vps-stage.imenuapp.com.br` have dedicated A records to the VPS and trusted automatically renewed Caddy certificates. These records do not change `www`, `preview`, or restaurant domains.
- `Caddyfile.stage` and `compose.proxy-stage.yml` run the staging-only TLS proxy on ports 80/443 while preserving the existing localhost tunnel on port 18080. Only the configured external address may access the website/API, plus the isolated Docker subnet for backend API requests; blocked requests return 403. The website is marked `noindex`.
- Put `IMENU_STAGE_ALLOWED_IP=<authorized-public-ip>/32` and `IMENU_STAGE_INTERNAL_CIDR=<isolated-docker-subnet>` in the private `/opt/imenu-migration/tls/stage-proxy.env` (never commit it). Set `IMENU_STAGE_SOURCE=/opt/imenu-migration/app` and `IMENU_STAGE_PROXY_ENV_FILE=/opt/imenu-migration/tls/stage-proxy.env` when running the proxy compose file. Update the external IP when the operator's address changes.
- Caddy stores TLS certificates under `/opt/imenu-migration/tls/data` and `/opt/imenu-migration/tls/config`; include both in off-server backup plans. The isolated Docker network aliases the staging API hostname to Caddy, allowing internal HTTPS health checks without public egress. Both build and runtime `NEXT_PUBLIC_SUPABASE_URL` use `https://api-vps-stage.imenuapp.com.br`; rebuild the app when the public URL changes.
- This is a staging-only proxy. The main `Caddyfile` is still a production template. Dynamic customer-domain certificates and routing must be validated separately before an authorized production cutover.

## Prepared app compatibility

CUSTOM_DOMAIN_PROVIDER=vps selects the VPS domain backend; VPS_PUBLIC_IP sets its A record target. The default provider remains Vercel. Domain checks reject mixed A addresses and stale AAAA records. Caddyfile is a future TLS template, not an active public proxy.

IMENU_TLS_DOMAINS is an exact comma-separated allowlist for platform certificates. Other domains must already be registered in restaurants.custom_domain. /api/internal/domain-allowed rejects unknown names and fails closed on database errors.

GET /api/printer/config exposes only the public Supabase URL and an anon/publishable key. It must never expose a service-role or secret API key. This endpoint alone does not change already installed printers.

## Remaining work before cutover

1. Original legacy JWT secret recovered; original anon and service-role signatures verified and keys reused. Password login, refresh, user lookup, RLS reads, and recovery-link generation passed. Existing real-user session continuity and installed printer continuity still require end-to-end validation. NEXT_PUBLIC_SUPABASE_AUTH_STORAGE_KEY preserves sb-mjogdsnxbwhbqcoijrwt-auth-token for the browser when the API hostname changes; leave unset to retain the default behavior on Vercel.
2. Existing Google OAuth client ID/secret configured and authorize redirect verified. ADD http://localhost:8000/auth/v1/callback in the existing Google Cloud OAuth client before a full tunneled login test; preserve the managed Supabase callback. Original JWT issuer preserved. SMTP host/port/user/sender recovered, but Supabase hides the stored password and no Resend key was present in the local app envs. Obtain the existing Resend SMTP key before real email delivery tests. Staging still captures email in Mailpit; source requires email confirmation.
3. Prepare and test a printer release that retrieves the public backend config instead of using the hardcoded managed URL. Preserve its existing auth storage key. Do not release it to customers without the rollout decision.
4. Test Google login, email signup/reset delivery, authenticated dashboard/order flow, Realtime reconnect, printer claim/ack/retry/idempotency, and browser push in an isolated test tenant. Never send a test to a real printer or make a real payout.
5. Protected staging HTTPS is deployed and verified with trusted certificates, redirects, access restrictions, and app/API health. Before cutover, validate dynamic customer-domain certificates/routing, canonical redirects, and public/private Storage downloads on the production-ready configuration. Production DNS and certificate account details are still required.
6. Recreate the five Vercel schedules in UTC on the VPS: daily-payout 0 14 * * *; reconcile-payouts 5 15 * * *; addon-expiry-whatsapp 0 18 * * *; ia-vendas-analysis 0 0 * * *; storage-cleanup 30 4 * * *. Keep them DISABLED until cutover; do not duplicate the six database jobs.
7. Replace old project and preview URLs inside destination cron commands; preserve schedules and Vault authorization. Check pg_net/webhook side effects before enabling outbound access.
8. Configure encrypted recurring off-server backups for database, Storage with xattrs, private configuration, and TLS state; test recovery. Configure external uptime alerts, bounded logs, security updates, disk alerts, and restart behavior.
9. Check resource usage and bounded load against the copied database. A single VPS does not provide a 100% availability guarantee.

## Approved-cutover procedure — not executed

Supabase continues receiving production writes while this copy is tested. Do not use the stale staging database as the final production database.

- Obtain explicit approval and agree on a short maintenance window.
- Drain printing/background jobs; pause source writers and source schedules, and buffer/reconcile payment and WhatsApp webhooks. DNS propagation must not allow writes into two independent databases.
- Take a fresh full source snapshot and external backup. Restore the latest schema/auth/public/Storage metadata into the destination; incrementally synchronize new/changed/deleted files using versions and checksums.
- Rewrite only destination Storage URL prefixes to the final owned API hostname. Preserve paths, private bucket rules, IDs, users, tokens, and VAPID keys.
- Repeat row counts, checksums, Auth, RLS, file downloads, order flow, printer, and webhook checks.
- Switch traffic/DNS and provider callbacks together with the final backend configuration; enable exactly one copy of each scheduler.
- Monitor errors, latency, queue age, payouts, memory, disk, and delivery retries. Keep the source available during transition.
- Rollback must reconcile any writes received on the VPS before routing back; merely changing DNS back can lose new orders.
