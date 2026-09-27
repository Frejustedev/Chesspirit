-- Boutique : catalogue, variantes et stock, avis, liste de souhaits, codes promo,
-- cartes cadeaux, points de fidélité, commandes, livraison et suivi.

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name jsonb not null,
  description jsonb not null default '{}',
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.product_categories(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null default 'physical' check (kind in ('physical', 'gift_card')),
  name jsonb not null,
  description jsonb not null default '{}',
  price_xof int not null check (price_xof >= 0),
  compare_at_xof int check (compare_at_xof >= 0),
  art text not null default 'board',
  image_url text check (image_url is null or image_url ~ '^(https://|/)'),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_preorder boolean not null default false,
  preorder_date date,
  rating_avg numeric(2, 1),
  reviews_count int not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category_id, is_active);
create trigger products_updated_at before update on public.products for each row execute function private.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name jsonb not null default '{}',
  sku text unique,
  price_xof int check (price_xof >= 0),
  stock int not null default 0 check (stock >= 0),
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id);
create trigger product_variants_updated_at before update on public.product_variants for each row execute function private.set_updated_at();

create table public.wishlists (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, product_id)
);

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{3,32}$'),
  kind text not null check (kind in ('percent', 'amount', 'free_shipping')),
  value int not null default 0 check (value >= 0),
  min_subtotal_xof int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses int,
  uses int not null default 0,
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value between 1 and 100)
);

create type public.order_status as enum (
  'pending_payment', 'paid', 'preparing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled', 'refunded'
);

create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('CS-' || to_char(now(), 'YYYY') || '-' || nextval('public.order_number_seq')),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  profile_id uuid references public.profiles(id) on delete set null,
  status public.order_status not null default 'pending_payment',
  delivery_method text not null check (delivery_method in ('pickup', 'cotonou', 'subregion', 'none')),
  delivery_address jsonb not null default '{}',
  contact_name text not null,
  contact_phone text not null,
  contact_email text,
  subtotal_xof int not null,
  discount_xof int not null default 0,
  shipping_xof int not null default 0,
  gift_card_xof int not null default 0,
  loyalty_xof int not null default 0,
  total_xof int not null check (total_xof >= 0),
  promo_code_id uuid references public.promo_codes(id) on delete set null,
  gift_card_id uuid,
  loyalty_points_used int not null default 0,
  loyalty_points_earned int not null default 0,
  has_preorder boolean not null default false,
  notes text check (char_length(notes) <= 1000),
  tracking_note text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create trigger orders_updated_at before update on public.orders for each row execute function private.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  name text not null,
  variant_name text,
  unit_price_xof int not null,
  quantity int not null check (quantity between 1 and 50),
  total_xof int not null,
  is_preorder boolean not null default false,
  gift jsonb
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  initial_xof int not null check (initial_xof > 0),
  balance_xof int not null check (balance_xof >= 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'used', 'cancelled')),
  purchase_order_id uuid references public.orders(id) on delete set null,
  recipient_name text,
  recipient_contact text,
  message text check (char_length(message) <= 500),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger gift_cards_updated_at before update on public.gift_cards for each row execute function private.set_updated_at();
alter table public.orders add constraint orders_gift_card_fk foreign key (gift_card_id) references public.gift_cards(id) on delete set null;

create table public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  points int not null,
  reason text not null check (reason in ('order_earned', 'order_spent', 'order_refund', 'adjustment')),
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index loyalty_ledger_profile_idx on public.loyalty_ledger (profile_id);

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  unique (product_id, profile_id)
);

insert into public.app_settings (key, value, is_public, description) values
  ('shop_shipping_cotonou_xof', '1500', true, 'Frais de livraison à Cotonou (valeur de démonstration, à confirmer)'),
  ('shop_shipping_subregion_xof', '10000', true, 'Frais d''expédition dans la sous-région (valeur de démonstration, à confirmer)'),
  ('shop_free_shipping_from_xof', '50000', true, 'Livraison gratuite à Cotonou à partir de ce montant (démonstration, à confirmer)'),
  ('shop_pickup_address', '"À confirmer"', true, 'Adresse du point de retrait'),
  ('shop_loyalty_points_per_100_xof', '1', true, 'Points de fidélité gagnés par tranche de 100 F CFA payés'),
  ('shop_loyalty_point_value_xof', '1', true, 'Valeur d''un point de fidélité en F CFA'),
  ('shop_order_expiry_hours', '48', false, 'Délai avant annulation automatique d''une commande impayée');

-- ---------------------------------------------------------------------------
-- Autorisations
-- ---------------------------------------------------------------------------
create or replace function private.is_shop_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin_of('shop')
$$;

create or replace function private.owns_order(p_order uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orders o where o.id = p_order and o.user_id = auth.uid())
$$;

create or replace function private.has_bought(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.order_items i join public.orders o on o.id = i.order_id
    where i.product_id = p_product and o.user_id = auth.uid()
      and o.status in ('paid', 'preparing', 'ready_for_pickup', 'shipped', 'delivered'))
$$;

alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.wishlists enable row level security;
alter table public.promo_codes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.gift_cards enable row level security;
alter table public.loyalty_ledger enable row level security;
alter table public.product_reviews enable row level security;
revoke all on public.wishlists, public.promo_codes, public.orders, public.order_items, public.order_events,
  public.gift_cards, public.loyalty_ledger from anon;
revoke insert, update, delete on public.product_categories, public.products, public.product_variants,
  public.product_reviews from anon;

create policy categories_read on public.product_categories for select to anon, authenticated
  using (is_active or private.is_shop_admin());
create policy categories_admin on public.product_categories for all to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());
create policy products_read on public.products for select to anon, authenticated
  using (is_active or private.is_shop_admin());
create policy products_admin on public.products for all to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());
create policy variants_read on public.product_variants for select to anon, authenticated
  using (is_active or private.is_shop_admin());
create policy variants_admin on public.product_variants for all to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());

create policy wishlists_own on public.wishlists for all to authenticated
  using (profile_id = private.my_profile_id()) with check (profile_id = private.my_profile_id());

-- Codes promo : jamais listés publiquement (vérification par fonction).
create policy promo_admin on public.promo_codes for all to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());

-- Commandes : lecture par l'acheteur ; toute écriture passe par les fonctions ci-dessous
-- ou par l'administration de la boutique.
create policy orders_read on public.orders for select to authenticated
  using (user_id = auth.uid() or private.is_shop_admin());
create policy orders_admin on public.orders for update to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());
create policy order_items_read on public.order_items for select to authenticated
  using (private.owns_order(order_id) or private.is_shop_admin());
create policy order_events_read on public.order_events for select to authenticated
  using (private.owns_order(order_id) or private.is_shop_admin());
create policy gift_cards_read on public.gift_cards for select to authenticated
  using ((purchase_order_id is not null and private.owns_order(purchase_order_id)) or private.is_shop_admin());
create policy gift_cards_admin on public.gift_cards for update to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());
create policy loyalty_read on public.loyalty_ledger for select to authenticated
  using (profile_id = private.my_profile_id() or private.is_shop_admin());

create policy reviews_read on public.product_reviews for select to anon, authenticated
  using (status = 'published' or profile_id = private.my_profile_id() or private.is_shop_admin());
create policy reviews_insert on public.product_reviews for insert to authenticated
  with check (profile_id = private.my_profile_id() and private.has_bought(product_id));
create policy reviews_update_own on public.product_reviews for update to authenticated
  using (profile_id = private.my_profile_id()) with check (profile_id = private.my_profile_id() and status = 'published');
create policy reviews_admin on public.product_reviews for update to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());
create policy reviews_delete on public.product_reviews for delete to authenticated
  using (profile_id = private.my_profile_id() or private.is_shop_admin());

-- Note moyenne des produits.
create or replace function private.refresh_product_rating() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    rating_avg = (select round(avg(rating)::numeric, 1) from public.product_reviews r where r.product_id = pid and r.status = 'published'),
    reviews_count = (select count(*) from public.product_reviews r where r.product_id = pid and r.status = 'published')
  where p.id = pid;
  return null;
end $$;
create trigger product_reviews_rating after insert or update or delete on public.product_reviews
  for each row execute function private.refresh_product_rating();

-- ---------------------------------------------------------------------------
-- Fonctions
-- ---------------------------------------------------------------------------
create or replace function public.loyalty_balance() returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(points), 0)::int from public.loyalty_ledger where profile_id = private.my_profile_id()
$$;

-- Remise d'un code promo pour un sous-total (0 si invalide). Ne révèle rien d'autre.
create or replace function public.check_promo(p_code text, p_subtotal int)
returns table (valid boolean, kind text, discount_xof int)
language plpgsql stable security definer set search_path = '' as $$
declare pc public.promo_codes;
begin
  select * into pc from public.promo_codes c where c.code = upper(trim(p_code)) and c.is_active
    and (c.starts_at is null or c.starts_at <= now()) and (c.ends_at is null or c.ends_at > now())
    and (c.max_uses is null or c.uses < c.max_uses) and c.min_subtotal_xof <= p_subtotal;
  if not found then return query select false, null::text, 0; return; end if;
  return query select true, pc.kind,
    case pc.kind when 'percent' then (p_subtotal * pc.value / 100)
                 when 'amount' then least(pc.value, p_subtotal) else 0 end;
end $$;

create or replace function public.gift_card_balance(p_code text) returns int
language sql stable security definer set search_path = '' as $$
  select balance_xof from public.gift_cards
  where code = upper(trim(p_code)) and status = 'active' and (expires_at is null or expires_at > now())
$$;

create or replace function private.gift_code() returns text language sql volatile set search_path = '' as $$
  select 'CAD-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4))
    || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4))
$$;

/*
 * Passe une commande. Les prix, remises, frais et stocks viennent exclusivement de la base.
 * p_items : [{ "variant_id": uuid, "quantity": int, "gift": { recipient_name, recipient_contact, message } }]
 * Le stock est réservé immédiatement et restitué en cas d'annulation ou d'expiration.
 */
create or replace function public.place_order(
  p_items jsonb, p_delivery text, p_address jsonb, p_contact_name text, p_contact_phone text,
  p_contact_email text default null, p_promo text default null, p_gift_code text default null,
  p_use_points int default 0, p_notes text default null
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.my_profile_id();
  o public.orders;
  it jsonb;
  v record;
  qty int;
  unit int;
  subtotal int := 0;
  physical boolean := false;
  preorder boolean := false;
  promo record;
  promo_kind text;
  promo_id uuid;
  discount int := 0;
  shipping int := 0;
  gc public.gift_cards;
  gc_amount int := 0;
  pts int := 0;
  pt_value int := coalesce((private.setting('shop_loyalty_point_value_xof'))::int, 1);
  balance int;
  remaining int;
  lines jsonb := '[]';
begin
  if auth.uid() is null or me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'empty_cart' using errcode = '22023';
  end if;
  if p_delivery not in ('pickup', 'cotonou', 'subregion') then raise exception 'invalid_delivery' using errcode = '22023'; end if;
  if coalesce(trim(p_contact_name), '') = '' or coalesce(trim(p_contact_phone), '') !~ '^\+?[0-9 ]{8,20}$' then
    raise exception 'invalid_contact' using errcode = '22023';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    qty := coalesce((it ->> 'quantity')::int, 0);
    if qty < 1 or qty > 50 then raise exception 'invalid_quantity' using errcode = '22023'; end if;
    select pv.id, pv.stock, pv.name as vname, coalesce(pv.price_xof, p.price_xof) as price, p.id as pid, p.name, p.kind,
      p.is_preorder
      into v
      from public.product_variants pv join public.products p on p.id = pv.product_id
      where pv.id = (it ->> 'variant_id')::uuid and pv.is_active and p.is_active
      for update of pv;
    if not found then raise exception 'product_unavailable' using errcode = 'P0002'; end if;
    if not v.is_preorder and v.kind = 'physical' then
      if v.stock < qty then raise exception 'out_of_stock' using errcode = '23514'; end if;
      update public.product_variants set stock = stock - qty where id = v.id;
    end if;
    if v.kind = 'physical' then physical := true; end if;
    if v.is_preorder then preorder := true; end if;
    unit := v.price;
    subtotal := subtotal + unit * qty;
    lines := lines || jsonb_build_object('pid', v.pid, 'vid', v.id, 'name', coalesce(v.name ->> 'fr', ''),
      'vname', nullif(v.vname ->> 'fr', ''), 'unit', unit, 'qty', qty, 'pre', v.is_preorder,
      'gift', case when v.kind = 'gift_card' then coalesce(it -> 'gift', '{}'::jsonb) end);
  end loop;

  if p_promo is not null and trim(p_promo) <> '' then
    select * into promo from public.check_promo(p_promo, subtotal);
    if not promo.valid then raise exception 'invalid_promo' using errcode = '22023'; end if;
    discount := promo.discount_xof;
    promo_kind := promo.kind;
    select id into promo_id from public.promo_codes where code = upper(trim(p_promo));
  end if;

  if physical then
    shipping := case p_delivery
      when 'pickup' then 0
      when 'cotonou' then case when subtotal - discount >= coalesce((private.setting('shop_free_shipping_from_xof'))::int, 2147483647)
        then 0 else coalesce((private.setting('shop_shipping_cotonou_xof'))::int, 0) end
      else coalesce((private.setting('shop_shipping_subregion_xof'))::int, 0) end;
    if promo_kind = 'free_shipping' then shipping := 0; end if;
  else
    p_delivery := 'none';
  end if;
  if p_delivery in ('cotonou', 'subregion') and coalesce(trim(p_address ->> 'line'), '') = '' then
    raise exception 'address_required' using errcode = '22023';
  end if;

  remaining := subtotal - discount + shipping;

  if p_gift_code is not null and trim(p_gift_code) <> '' then
    select * into gc from public.gift_cards where code = upper(trim(p_gift_code)) and status = 'active'
      and (expires_at is null or expires_at > now()) for update;
    if not found then raise exception 'invalid_gift_card' using errcode = '22023'; end if;
    gc_amount := least(gc.balance_xof, remaining);
    update public.gift_cards set balance_xof = balance_xof - gc_amount,
      status = case when balance_xof - gc_amount = 0 then 'used' else 'active' end where id = gc.id;
    remaining := remaining - gc_amount;
  end if;

  if coalesce(p_use_points, 0) > 0 then
    select coalesce(sum(points), 0) into balance from public.loyalty_ledger where profile_id = me;
    pts := least(p_use_points, balance, remaining / greatest(pt_value, 1));
    remaining := remaining - pts * pt_value;
  end if;

  insert into public.orders (user_id, profile_id, delivery_method, delivery_address, contact_name, contact_phone, contact_email,
    subtotal_xof, discount_xof, shipping_xof, gift_card_xof, loyalty_xof, total_xof, promo_code_id, gift_card_id,
    loyalty_points_used, has_preorder, notes)
  values (auth.uid(), me, p_delivery, coalesce(p_address, '{}'), trim(p_contact_name), trim(p_contact_phone),
    nullif(trim(p_contact_email), ''), subtotal, discount, shipping, gc_amount, pts * pt_value, remaining, promo_id,
    case when gc_amount > 0 then gc.id end, pts, preorder, left(p_notes, 1000))
  returning * into o;

  insert into public.order_items (order_id, product_id, variant_id, name, variant_name, unit_price_xof, quantity, total_xof, is_preorder, gift)
  select o.id, (l ->> 'pid')::uuid, (l ->> 'vid')::uuid, l ->> 'name', l ->> 'vname', (l ->> 'unit')::int,
    (l ->> 'qty')::int, (l ->> 'unit')::int * (l ->> 'qty')::int, (l ->> 'pre')::boolean,
    case when l -> 'gift' = 'null'::jsonb then null else l -> 'gift' end
  from jsonb_array_elements(lines) l;

  if pts > 0 then
    insert into public.loyalty_ledger (profile_id, points, reason, order_id) values (me, -pts, 'order_spent', o.id);
  end if;
  insert into public.order_events (order_id, status) values (o.id, 'pending_payment');

  if o.total_xof = 0 then
    perform private.order_paid(o.id);
    select * into o from public.orders where id = o.id;
  end if;
  return o;
end $$;
revoke execute on function public.place_order from anon, public;
grant execute on function public.place_order to authenticated;

-- Commande payée (appelée par confirm_payment ou quand le total est nul).
create or replace function private.order_paid(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  it record;
  i int;
  per100 int := coalesce((private.setting('shop_loyalty_points_per_100_xof'))::int, 0);
  earned int;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.status <> 'pending_payment' then return; end if;
  earned := (o.total_xof / 100) * per100;
  update public.orders set status = 'paid', paid_at = now(), loyalty_points_earned = earned where id = o.id;
  insert into public.order_events (order_id, status, created_by) values (o.id, 'paid', null);
  if earned > 0 and o.profile_id is not null then
    insert into public.loyalty_ledger (profile_id, points, reason, order_id) values (o.profile_id, earned, 'order_earned', o.id);
  end if;
  if o.promo_code_id is not null then
    update public.promo_codes set uses = uses + 1 where id = o.promo_code_id;
  end if;
  -- Cartes cadeaux achetées : une carte active par unité.
  for it in select oi.* from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = o.id and p.kind = 'gift_card' loop
    for i in 1 .. it.quantity loop
      insert into public.gift_cards (code, initial_xof, balance_xof, status, purchase_order_id, recipient_name,
        recipient_contact, message, expires_at)
      values (private.gift_code(), it.unit_price_xof, it.unit_price_xof, 'active', o.id, it.gift ->> 'recipient_name',
        it.gift ->> 'recipient_contact', left(it.gift ->> 'message', 500), now() + interval '1 year');
    end loop;
  end loop;
  -- Commande uniquement composée de cartes cadeaux : livrée immédiatement.
  if o.delivery_method = 'none' then
    update public.orders set status = 'delivered' where id = o.id;
    insert into public.order_events (order_id, status, created_by) values (o.id, 'delivered', null);
  end if;
end $$;

-- Restitution (stock, carte cadeau, points) d'une commande annulée.
create or replace function private.release_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id;
  update public.product_variants pv set stock = pv.stock + oi.quantity
    from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = o.id and oi.variant_id = pv.id and p.kind = 'physical' and not oi.is_preorder;
  if o.gift_card_id is not null and o.gift_card_xof > 0 then
    update public.gift_cards set balance_xof = balance_xof + o.gift_card_xof, status = 'active' where id = o.gift_card_id;
  end if;
  if o.loyalty_points_used > 0 and o.profile_id is not null then
    insert into public.loyalty_ledger (profile_id, points, reason, order_id) values (o.profile_id, o.loyalty_points_used, 'order_refund', o.id);
  end if;
end $$;

-- Annulation par l'acheteur (avant paiement) ou par l'administration de la boutique.
create or replace function public.cancel_order(p_order_id uuid, p_note text default null) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (private.is_shop_admin() or (o.user_id = auth.uid() and o.status = 'pending_payment')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if o.status in ('cancelled', 'refunded', 'delivered', 'shipped') then raise exception 'not_cancellable' using errcode = '22023'; end if;
  perform private.release_order(o.id);
  if o.status <> 'pending_payment' and o.loyalty_points_earned > 0 and o.profile_id is not null then
    insert into public.loyalty_ledger (profile_id, points, reason, order_id) values (o.profile_id, -o.loyalty_points_earned, 'adjustment', o.id);
  end if;
  update public.orders set status = 'cancelled' where id = o.id returning * into o;
  insert into public.order_events (order_id, status, note) values (o.id, 'cancelled', left(p_note, 500));
  update public.payments set status = 'cancelled' where object_type = 'order' and object_id = o.id and status = 'pending';
  return o;
end $$;
revoke execute on function public.cancel_order from anon, public;
grant execute on function public.cancel_order to authenticated;

-- Suivi logistique par l'administration de la boutique.
create or replace function public.set_order_status(p_order_id uuid, p_status public.order_status, p_note text default null)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if not private.is_shop_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status in ('pending_payment', 'paid', 'cancelled') then raise exception 'invalid_status' using errcode = '22023'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if o.status in ('pending_payment', 'cancelled', 'refunded') then raise exception 'invalid_transition' using errcode = '22023'; end if;
  update public.orders set status = p_status, tracking_note = coalesce(nullif(trim(p_note), ''), tracking_note)
    where id = o.id returning * into o;
  insert into public.order_events (order_id, status, note) values (o.id, p_status, left(p_note, 500));
  return o;
end $$;
revoke execute on function public.set_order_status from anon, public;
grant execute on function public.set_order_status to authenticated;

-- Suivi public : numéro de commande + téléphone de contact.
create or replace function public.track_order(p_number text, p_phone text)
returns table (number text, status public.order_status, delivery_method text, created_at timestamptz, events jsonb)
language sql stable security definer set search_path = '' as $$
  select o.number, o.status, o.delivery_method, o.created_at,
    (select coalesce(jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'at', e.created_at) order by e.created_at), '[]')
       from public.order_events e where e.order_id = o.id)
  from public.orders o
  where o.number = upper(trim(p_number))
    and regexp_replace(o.contact_phone, '[^0-9]', '', 'g') = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
    and length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) >= 8
$$;

-- Commandes impayées expirées (tâche planifiée).
create or replace function private.expire_orders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in select id from public.orders where status = 'pending_payment'
    and created_at < now() - make_interval(hours => coalesce((private.setting('shop_order_expiry_hours'))::int, 48)) loop
    perform private.release_order(r.id);
    update public.orders set status = 'cancelled' where id = r.id;
    insert into public.order_events (order_id, status, note, created_by) values (r.id, 'cancelled', 'expired', null);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Tableau de bord boutique.
create or replace function public.shop_overview()
returns table (orders_to_process bigint, revenue_xof bigint, low_stock bigint, pending_payment bigint)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.orders where status in ('paid', 'preparing')),
    (select coalesce(sum(total_xof), 0) from public.orders where status not in ('pending_payment', 'cancelled', 'refunded')),
    (select count(*) from public.product_variants pv join public.products p on p.id = pv.product_id
       where p.kind = 'physical' and p.is_active and not p.is_preorder and pv.stock <= 3),
    (select count(*) from public.orders where status = 'pending_payment')
  where private.is_shop_admin()
$$;
