# Integrações Delivery

Panel: `/painel/integracoes`. New integrations start disabled. Tracking settings are unchanged.

## Activation (operator)

- Provision `DELIVERY_INTEGRATIONS_KEY`: a persistent random 32-byte key, encoded as base64. It encrypts restaurant credentials with AES-256-GCM. Back it up; replacing it without re-encryption makes existing credentials unreadable.
- Machine defaults to sandbox (`api-vendas.taximachine.com.br`). Set `MACHINE_API_ENVIRONMENT=production` only after explicit approval and sandbox validation. This switches subsequent enabled dispatches to real paid courier requests. Roll back by disabling the integration or reverting that environment setting.
- iFood requires a homologated **centralized** application and merchant access approved in the Partner Portal. The restaurant enters its merchant ID and authorized application credentials. Settings and toggle preferences save even when incomplete or invalid, without contacting the provider. Each provider shows “Não configurado” until its required fields are filled; this indicates completeness, not verified connectivity. One shared webhook works for multiple merchants of the same application.
- Only after explicit approval, register the deployed HTTPS `/api/integrations/ifood` URL in iFood Developer. This changes where the application's events arrive; record the old URL for rollback. No code here registers/replaces webhooks or changes provider permissions.
- Confirm Order API permissions during homologation. Accepting in iMenu sends /confirm; confirmed immediate orders send /startPreparation. Marking ready sends /readyToPickup; merchant delivery then sends /dispatch after readiness is confirmed. iFood logistics never receives /dispatch. Signed lifecycle events update local status; HTTP 202 alone does not advance it. Cancellation/refund, menu, stock and price changes are excluded.
- Machine requires the Chama API key, company user/password, company ID, an allowed delivery payment method and optionally a category ID. Company pickup address comes from the Machine company registration. The payment selection pays the **courier service**, not the customer's order.

## Behavior

Signed iFood PLACED events fetch order details and atomically insert orders/items and the external-ID mapping. Names, selected options, observations, payment description and totals are retained without catalog matching. `payment_method=ifood` prevents native Pix charging/refunds. The existing DB trigger queues printing after transaction commit. Replayed events cannot create a second order. Confirmed preparation, readiness, dispatch/collection and conclusion events synchronize local statuses without regressing them. Unsupported events are acknowledged without changing local orders. No customer WhatsApp status messages are sent for imported orders.

Machine dispatch runs after an accepted native order becomes `preparing`, only for `is_delivery=entrega`. Imported iFood orders are excluded to avoid conflicting courier responsibility. Pickup, counter and table orders do not dispatch. The existing printable customer address is parsed and the restaurant city/state complete the destination; unparseable addresses produce a visible failure instead of a guessed destination.

One durable dispatch row claims each order. The order UUID is also Machine's unique `id_externo`. Definite failures can be retried in the integrations card. Timeouts, duplicate references, crashes and uncertain responses require checking Machine; they never automatically retry. Provider failures do not undo acceptance or claim that a courier was requested. No automatic courier cancellation or tracking sync is included.

Tables: `delivery_integrations` (encrypted credentials and merchant routing), `delivery_imported_orders` (external-ID deduplication/address), `delivery_dispatches` (claim/result/error). All are backend-only with RLS and no anon/authenticated grants. Creation was applied through the database connector; no SQL migration files are tracked.

Provider contracts: https://docs.machine.global/pages/v2/openapi-entregas.json and https://developer.ifood.com.br/en-US/docs/food/guides/modules/events/webhook-request

Status synchronization progress is stored in `delivery_imported_orders.sync_state` (JSONB, default `{}`). It records pending commands and last confirmed event to serialize owner actions, suppress duplicate sends and ignore stale events. Completion follows iFood events; no delivery-code, cancellation or refund command is sent.
