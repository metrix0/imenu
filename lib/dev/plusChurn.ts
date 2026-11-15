export const ACTIVE_PLUS_FOR_ACCOUNT = (at = "NOW()") => `SELECT 1 FROM restaurant_addons addon
    JOIN restaurants owned ON owned.id = addon.restaurant_id
    WHERE addon.product_key = 'ia_plus'
      AND (addon.status = 'active'
        OR (addon.status IN ('canceled','past_due') AND addon.current_period_ends_at > ${at}))`;

export const RECOVERY_CUTOFF = "((date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '19 hours') AT TIME ZONE 'America/Sao_Paulo')";

export const PLUS_CHURN_EVENTS = `
    SELECT DISTINCT ON (COALESCE(owned.user_id, owned.id))
           owned.id AS restaurant_id, addon.current_period_ends_at AS event_at
    FROM restaurant_addons addon
    JOIN restaurants owned ON owned.id = addon.restaurant_id
    CROSS JOIN churn_bounds bounds
    WHERE addon.product_key = 'ia_plus'
      AND addon.current_period_ends_at >= bounds.start_at
      AND addon.current_period_ends_at < bounds.end_at
      AND (
          EXISTS (
              SELECT 1 FROM restaurant_addon_payments payment
              WHERE payment.addon_id = addon.id
                AND payment.paid_at < addon.current_period_ends_at AND payment.amount_cents > 0
                AND UPPER(payment.status) IN ('CONFIRMED','RECEIVED','RECEIVED_IN_CASH','PAID','COMPLETED','APPROVED')
          )
          OR (addon.activated_at < addon.current_period_ends_at
              AND UPPER(addon.payzu_payment_status) IN ('PAID','COMPLETED','CONFIRMED'))
      )
      AND NOT EXISTS (
          SELECT 1 FROM restaurant_addons renewed
          JOIN restaurants other ON other.id = renewed.restaurant_id
          WHERE COALESCE(other.user_id, other.id) = COALESCE(owned.user_id, owned.id)
            AND renewed.product_key = 'ia_plus'
            AND (renewed.status = 'active' OR renewed.status IN ('canceled','past_due'))
            AND (renewed.current_period_ends_at >= bounds.end_at
                 OR (renewed.status = 'active' AND renewed.current_period_ends_at IS NULL))
      )
    ORDER BY COALESCE(owned.user_id, owned.id), addon.current_period_ends_at DESC, owned.id
`;
