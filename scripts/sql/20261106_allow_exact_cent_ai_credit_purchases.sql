-- Credit quotes are calculated in BRL cents; they are not restricted to R$0.50 increments.
-- Keep every positive exact-cent amount valid for the shared Pix checkout.
ALTER TABLE public.ia_vendas_credit_purchases
    DROP CONSTRAINT IF EXISTS ia_vendas_credit_purchases_price_cents_check;

ALTER TABLE public.ia_vendas_credit_purchases
    ADD CONSTRAINT ia_vendas_credit_purchases_price_cents_check
    CHECK (price_cents >= 1);
