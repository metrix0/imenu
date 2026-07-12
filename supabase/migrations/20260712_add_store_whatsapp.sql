ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS store_whatsapp text;

COMMENT ON COLUMN public.restaurants.store_whatsapp IS
'Public WhatsApp number used by customers to contact the restaurant. Separate from the manager/support phone.';
