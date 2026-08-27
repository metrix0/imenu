alter table public.restaurant_addons
add column if not exists qr_design_template text not null default 'banner',
add column if not exists qr_design_color text;

alter table public.restaurant_addons
drop constraint if exists restaurant_addons_qr_design_template_check;

alter table public.restaurant_addons
add constraint restaurant_addons_qr_design_template_check
check (
    qr_design_template in (
        'classic',
        'dark',
        'banner',
        'logo',
        'xadrez',
        'gradient',
        'minimal'
    )
);

update public.restaurant_addons as addon
set
    qr_design_template = coalesce(restaurant.qr_design_template, 'banner'),
    qr_design_color = restaurant.qr_design_color
from public.restaurants as restaurant
where addon.restaurant_id = restaurant.id
  and addon.product_key = 'qr_code_mesa';

alter table public.restaurants
drop column if exists qr_design_template,
drop column if exists qr_design_color;
