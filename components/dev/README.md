# Developer dashboard

`/dev` is the overview. Its only initial section is `AlertsSection`, also used by Health.

Keep reusable feature sections in `components/dev/`. Add a section to the overview by composing the same component used on its full page, with optional limits/filters where needed. Do not copy page JSX, calculations, data loaders, authentication, table or pagination implementations. `DevPage`, `PagedTable`, existing UI primitives, and `lib/dev/client.ts` provide the shared behavior.

The combined legacy support view is available at `/dev/old/support` using the same component in legacy composition mode. Preserve `/dev/dashboard`, `/dev/payout`, `/dev/cannonnade`, `/dev/login-restaurant` and their API contracts. New sections reuse the existing API routes through explicit query parameters. Large histories use 25 rows per page. Features are loaded only on the selected route; do not mount hidden sections or poll all tabs from the layout.

Monitoring uses the existing five-minute VPS monitor. It appends compact CPU/RAM/disk samples (30 days), and stores phone notifications / observed integration errors (90 days). API connection monitoring observes real requests; an unobserved connection is unknown, never assumed healthy. It does not actively probe payment, geocoding, or AI APIs. Do not record URLs, credentials or raw request data in integration errors. Private `dev_health_history` and `dev_alerts` tables have RLS enabled and no Data API grants. No additional monitoring timer is needed.

Automated blast descriptions in `lib/dev/blastHistory.ts` correspond to the existing cron senders and payout workflow; update them when changing those jobs. Campaigns, recipients, and standalone messages come from existing send logs. Preserve the composer and pause/resume/cancel behavior in `SupportSection`. Legacy sends whose exact body was not recorded must be labeled honestly; never invent historical message text.

Payout notifications reuse `whatsapp_outbound_messages.dedupe_key`, one atomic claim per restaurant and São Paulo calendar day. Never create another deduplication table. Uncertain network outcomes remain processing and must not be retried or announced as a confirmed payout failure. Preserve the existing 90-minute cutoff, transfer reconciliation and existing 1% net calculation. Do not run live payouts or send live customer messages for tests.

Response times pair each first successful reply with the latest preceding inbound, exclude blast conversations/messages, and split bot (model or automated dedupe key) from human replies. Unknown historical message authors cannot be reconstructed beyond the metadata already stored.

The shared /dev layout uses DevShell to verify the admin before mounting navigation or pages. Keep dashboard styles in dashboard.module.css; do not change global UI components for this area. Reuse DevPage, DevDialog and PagedTable. Blast history comes first; /dev/messages redirects there. Only campaign and explicitly requested automation messages belong in Blast, never routine chatbot replies or order notifications. Keep sections free of refresh buttons and polling.
