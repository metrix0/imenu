BEGIN;

CREATE TABLE IF NOT EXISTS public.owner_push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint text NOT NULL UNIQUE,
    p256dh text NOT NULL,
    auth_secret text NOT NULL,
    device_token text NOT NULL UNIQUE,
    user_agent text,
    enabled boolean NOT NULL DEFAULT true,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS owner_push_subscriptions_restaurant_idx
    ON public.owner_push_subscriptions (restaurant_id)
    WHERE enabled = true;

CREATE TABLE IF NOT EXISTS public.owner_push_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid NOT NULL
        REFERENCES public.owner_push_subscriptions(id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL,
    url text NOT NULL DEFAULT '/painel',
    tag text,
    created_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz
);

CREATE INDEX IF NOT EXISTS owner_push_notifications_pending_idx
    ON public.owner_push_notifications (subscription_id, created_at)
    WHERE delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS public.owner_push_order_events (
    order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_push_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_push_order_events ENABLE ROW LEVEL SECURITY;

-- These tables are intentionally server-only. The API validates the logged-in
-- owner and accesses them through the server database connection.
REVOKE ALL ON public.owner_push_subscriptions FROM anon, authenticated;
REVOKE ALL ON public.owner_push_notifications FROM anon, authenticated;
REVOKE ALL ON public.owner_push_order_events FROM anon, authenticated;

COMMIT;
