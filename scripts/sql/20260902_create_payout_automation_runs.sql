CREATE TABLE public.payout_automation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_date date NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'processing', 'completed', 'blocked', 'partial', 'failed')),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    cutoff_at timestamptz NOT NULL,
    payzu_step_status text NOT NULL DEFAULT 'pending'
        CHECK (payzu_step_status IN ('pending', 'running', 'processing', 'completed', 'skipped', 'blocked', 'failed')),
    adjustment_step_status text NOT NULL DEFAULT 'pending'
        CHECK (adjustment_step_status IN ('pending', 'running', 'processing', 'completed', 'skipped', 'blocked', 'failed')),
    comparison_step_status text NOT NULL DEFAULT 'pending'
        CHECK (comparison_step_status IN ('pending', 'running', 'processing', 'completed', 'skipped', 'blocked', 'failed')),
    payout_step_status text NOT NULL DEFAULT 'pending'
        CHECK (payout_step_status IN ('pending', 'running', 'processing', 'completed', 'skipped', 'blocked', 'failed')),
    payzu_balance_before_cents integer CHECK (payzu_balance_before_cents >= 0),
    payzu_reserve_cents integer CHECK (payzu_reserve_cents >= 0),
    transferred_cents integer CHECK (transferred_cents >= 0),
    asaas_balance_before_payout_cents integer CHECK (asaas_balance_before_payout_cents >= 0),
    gross_cents integer CHECK (gross_cents >= 0),
    payzu_fee_cents integer CHECK (payzu_fee_cents >= 0),
    discount_cents integer,
    payout_cents integer CHECK (payout_cents >= 0),
    difference_cents integer,
    restaurant_count integer NOT NULL DEFAULT 0 CHECK (restaurant_count >= 0),
    paid_count integer NOT NULL DEFAULT 0 CHECK (paid_count >= 0),
    processing_count integer NOT NULL DEFAULT 0 CHECK (processing_count >= 0),
    failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
    payzu_client_reference text NOT NULL UNIQUE,
    payzu_transaction_id text,
    payzu_transaction_status text,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_automation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payout_automation_runs FROM anon, authenticated;
GRANT ALL ON TABLE public.payout_automation_runs TO service_role;

ALTER TABLE public.payouts
    ADD COLUMN automation_run_id uuid
        REFERENCES public.payout_automation_runs(id) ON DELETE SET NULL,
    ADD COLUMN asaas_transfer_id text;

CREATE UNIQUE INDEX payouts_automation_run_restaurant_idx
    ON public.payouts (automation_run_id, restaurant_id)
    WHERE automation_run_id IS NOT NULL;

CREATE UNIQUE INDEX payouts_asaas_transfer_id_idx
    ON public.payouts (asaas_transfer_id)
    WHERE asaas_transfer_id IS NOT NULL;
