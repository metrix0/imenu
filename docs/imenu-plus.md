# iMenu Plus: product and access map

Read this document before changing plan features, names, pricing, access or billing. Keep it current with the same change.

## Product definition

`lib/addons/products.ts` is the source of truth for the name, price, four main benefits and five bonuses. The customer-facing name is **iMenu Plus** (formerly IA Plus). The price remains R$ 49,99/month. Marketing's full feature name is **Automações de Marketing WhatsApp**, under `/painel/marketing`.

Main benefits, in order: Automações de Marketing WhatsApp; Assistente IA; Vendas IA; iMenu QR Code (Incluso).

Bonuses, in order: Atendimento exclusivo; Upsells automáticos; Modo vitrine; Painel Garçom; Download Cardápio em PDF. This presentation does not remove existing free access to other features; the existing Assistente IA free allowance and automatic upsell behavior are preserved.

## Compatibility and entitlement

- Keep the database/payment key `ia_plus`, provider reference prefix `ia-plus`, `/api/ia-plus/*`, activation event `imenu:ia-plus-activated` and existing terms URL `/restaurante/dados/termos/ia-plus`. They identify existing subscriptions and integrations; they are not customer-facing plan names.
- `lib/addons/access.ts` checks Plus access. Existing paid-period semantics apply: active subscriptions, or canceled/past-due subscriptions with a future paid-period end, retain access. An inactive, pending or expired subscription does not grant it.
- Plus grants QR access immediately for existing and future subscribers. QR inclusion is derived from the Plus subscription; there is no extra paid subscription, synchronization trigger, duplicate payment or backfill row. Cancellation/expiry follows the existing paid-period rules automatically.
- `lib/qr-table/types.ts` resolves the effective QR entitlement. Existing QR records retain their universal token and design, including when their QR-only period expires but Plus remains valid. Plus-only subscribers use the Plus record's universal token and design. Previously printed per-table and universal QR codes remain valid while either plan grants access.
- QR-only remains independently available for R$ 5,00/month. Existing separately paid QR subscriptions are not automatically canceled or refunded. The QR checkout rejects another charge while Plus includes access, and prepaid QR expiry notices/reminders are suppressed while covered by Plus.
- `restaurant_tables` owner SELECT/INSERT/UPDATE/DELETE RLS policies accept either valid `qr_code_mesa` or `ia_plus` access, while retaining ownership checks. Update these policies through iMenu Supabase when changing entitlement rules; do not commit SQL files.

## Surfaces to maintain

| Surface | Files / records |
| --- | --- |
| Product name, price, benefits, bonuses | `lib/addons/products.ts` |
| Plan discovery and sales modal | `components/restaurant-owner/ia-vendas/IaPlusProductCard.tsx`, `IaPlusSalesModal.tsx`; shared `components/restaurant-owner/mesas/MenuProductCard.tsx`, `MenuProductCards.tsx` |
| Plan management, inclusion/renewal display | `app/painel/planos/page.tsx`, `components/restaurant-owner/configuracoes/QrCodeMesaSettingsSection.tsx`, `app/api/addons/billing/route.ts`, `app/api/addons/subscription/route.ts` |
| Branding | `public/logos/PlusCombinationMarkLogo_Brand.svg`; legacy asset filenames/classes may remain for compatibility but must not be shown as the old plan name |
| Marketing paywall and saving | `app/painel/marketing/page.tsx`, `app/api/automations/route.ts` |
| Marketing delivery authorization | `lib/services/crmAutomations.ts`: filter restaurants and recheck access during each atomic send claim. `app/api/cron/customer-automations/route.ts` invokes it. Losing Plus must stop new marketing sends without deleting saved settings or history. Robô WhatsApp remains free. |
| AI access, limits, paywalls | `lib/ia-vendas/access.ts`, `runs.ts`, `chat.ts`, `http.ts`; `app/painel/IAVendasPage.tsx`; `components/restaurant-owner/ia-vendas/AnalysisReport.tsx`, `SalesWidgets.tsx`; `lib/stores/restaurant-owner/iaVendasStore.ts` |
| QR management, waiter and table-order access | `app/painel/mesas/page.tsx`, `app/painel/page.tsx`, `app/painel/motoboy-garcom/page.tsx`, `app/garcom/page.tsx`, `app/[slug]/page.tsx`, `app/api/orders/route.ts`, `app/api/qr-table/design/route.ts`, `app/api/qr-table/billing/route.ts` |
| Vitrine and PDF | `app/painel/configuracoes/page.tsx`, `app/[slug]/page.tsx`, `app/vitrine/[slug]/page.tsx`, `app/api/menu/export-pdf/route.ts` |
| Checkout, activation, payment success | `lib/addons/checkout.ts`, `reconcile.ts`; `components/restaurant-owner/mesas/QrCodeMesaCheckoutModal.tsx`; `components/payments/AddonPaymentSuccess.tsx`; `app/api/ia-plus/*`; `app/api/webhooks/{asaas,mercadopago,payzu}/route.ts`; `lib/qr-table/*Billing.ts` |
| Purchase and expiry messaging templates | `lib/services/addonPurchaseWhatsApp.ts`, `app/api/cron/addon-expiry-whatsapp/route.ts`, `app/api/addons/expiring/route.ts` — edit templates without sending test messages to customers |
| Analysis watcher | `app/api/cron/ia-plus-analysis-watch/route.ts` — keeps the legacy technical name/key |
| Support and AI knowledge | `lib/services/supportAgent.ts`, `supportMcp.ts`, `lib/ia-vendas/chat.ts`; database table `support_knowledge` (plan, costs, Assistente, Vendas, Vitrine, PDF and payment entries). Updating repository copy alone does not update this curated knowledge. |
| Public website and SEO | `app/page.tsx`, `app/(extra)/(seo)/blog/{assistente-ia-para-restaurante,analise-de-vendas-com-ia,cardapio-vitrine}/page.tsx`, `lib/seo/blogArticles.ts` |
| Terms and integrations | `app/restaurante/dados/termos/ia-plus/page.tsx`, `app/painel/integracoes/page.tsx` |
| Navigation and analytics | `app/painel/PanelLayoutBase.tsx`, `components/ui/PanelFeatureCallout.tsx` (Marketing discovery on Clientes and Robô WhatsApp), `lib/ia-vendas/panelTabs.ts`, `lib/analytics/productOverview.ts`, `lib/dev/dashboardPosthog.ts`, `dashboardFormat.ts`, `components/dev/DashboardPresentation.tsx`, `app/(extra)/dev/dashboard/page.tsx` |

The legacy `IaPlus*` filenames, exports, error code `IA_PLUS_REQUIRED`, CSS classes and analytics/database keys remain stable. Search for both legacy identifiers and the current display name when locating related code. New customer-visible text uses iMenu Plus and the central benefits/bonuses whenever possible.
