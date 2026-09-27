-- Correctifs de la revue de sécurité de fin de phase 1.

-- H2 : colonnes protégées sur les inscriptions et réservations (le staff ou le coach ne peut
-- pas rattacher une ligne à une autre personne ni modifier les montants). Fonction d'appelant :
-- les fonctions SECURITY DEFINER (propriétaire) et le rôle service ne sont pas concernés.
create or replace function private.registrations_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') or private.is_admin() then return new; end if;
  if new.player_id is distinct from old.player_id or new.tournament_id is distinct from old.tournament_id
     or new.amount_xof is distinct from old.amount_xof or new.ticket_code is distinct from old.ticket_code
     or new.registered_by is distinct from old.registered_by then
    raise exception 'forbidden_field' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger registrations_guard before update on public.registrations
  for each row execute function private.registrations_guard();

create or replace function private.bookings_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') or private.is_admin() then return new; end if;
  if new.student_id is distinct from old.student_id or new.coach_id is distinct from old.coach_id
     or new.offer_id is distinct from old.offer_id or new.slot_id is distinct from old.slot_id
     or new.amount_xof is distinct from old.amount_xof or new.commission_xof is distinct from old.commission_xof
     or new.booked_by is distinct from old.booked_by then
    raise exception 'forbidden_field' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (old.status = 'confirmed' and new.status in ('completed', 'no_show', 'cancelled')) then
    raise exception 'forbidden_status' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger bookings_guard before update on public.bookings
  for each row execute function private.bookings_guard();

-- M6 : champs d'identité. Titres réservés aux administrateurs ; identifiant FIDE unique ;
-- à la création, les indicateurs de vérification ne peuvent pas être forcés.
create or replace function private.profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), 'system') in ('service_role', 'system') or private.is_admin() then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
     or new.verified is distinct from old.verified
     or new.merged_into is distinct from old.merged_into
     or new.suspended_at is distinct from old.suspended_at
     or new.claimed is distinct from old.claimed
     or new.source is distinct from old.source
     or new.is_demo is distinct from old.is_demo
     or new.guardian_id is distinct from old.guardian_id
     or new.titles is distinct from old.titles then
    raise exception 'forbidden_field' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function private.profiles_insert_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), 'system') in ('service_role', 'system') or private.is_admin() then
    return new;
  end if;
  new.verified := false;
  new.claimed := false;
  new.is_demo := false;
  new.merged_into := null;
  new.suspended_at := null;
  new.titles := '{}';
  return new;
end $$;
create trigger profiles_insert_guard before insert on public.profiles
  for each row execute function private.profiles_insert_guard();

create unique index profiles_fide_unique_idx on public.profiles (fide_id)
  where fide_id is not null and merged_into is null;

-- M6 : le staff est désigné par un identifiant vérifié du compte (pas par un champ de profil libre).
create or replace function public.add_tournament_staff(p_tournament_id uuid, p_identifier text, p_role text)
returns public.tournament_staff language plpgsql security definer set search_path = '' as $$
declare
  p public.profiles;
  s public.tournament_staff;
  v_id text := lower(trim(p_identifier));
  v_digits text := regexp_replace(v_id, '\D', '', 'g');
begin
  if not private.can_manage_tournament(p_tournament_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('organizer', 'chief_arbiter', 'deputy_arbiter', 'operator') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  select pr.* into p from auth.users u
    join public.profiles pr on pr.user_id = u.id and pr.merged_into is null
    where (u.email is not null and lower(u.email) = v_id and u.email_confirmed_at is not null)
       or (u.phone is not null and length(v_digits) >= 8 and u.phone_confirmed_at is not null
           and (u.phone = v_digits or u.phone = '229' || v_digits))
    limit 1;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  insert into public.tournament_staff (tournament_id, profile_id, role) values (p_tournament_id, p.id, p_role)
    on conflict (tournament_id, profile_id, role) do update set role = excluded.role
    returning * into s;
  insert into public.user_roles (user_id, role, granted_by)
    values (p.user_id, case when p_role = 'organizer' then 'organizer'::public.app_role else 'arbiter'::public.app_role end, auth.uid())
    on conflict do nothing;
  insert into public.tournament_audit (tournament_id, action, details)
    values (p_tournament_id, 'add_staff', jsonb_build_object('profile', p.id, 'role', p_role));
  return s;
end $$;
revoke execute on function public.add_tournament_staff from anon, public;
grant execute on function public.add_tournament_staff to authenticated;

-- M4 : une annulation ne libère une place (et ne promeut la liste d'attente) qu'une seule fois.
create or replace function public.cancel_registration(p_registration_id uuid) returns public.registrations
language plpgsql security definer set search_path = '' as $$
declare
  r public.registrations;
  freed boolean;
begin
  select * into r from public.registrations where id = p_registration_id for update;
  if not found or not (private.manages_profile(r.player_id) or private.can_arbitrate(r.tournament_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if r.status in ('cancelled', 'refused') then return r; end if;
  freed := r.status in ('confirmed', 'pending_payment', 'pending_validation');
  update public.registrations set status = 'cancelled', waitlist_position = null where id = r.id returning * into r;
  if freed then
    update public.registrations set status = case when payment_status = 'pending' then 'pending_payment'::public.registration_status else 'confirmed'::public.registration_status end,
      waitlist_position = null
    where id = (select id from public.registrations where tournament_id = r.tournament_id and status = 'waitlisted'
                order by waitlist_position nulls last, created_at limit 1 for update);
  end if;
  return r;
end $$;
revoke execute on function public.cancel_registration from anon, public;
grant execute on function public.cancel_registration to authenticated;

-- M3 : limite d'utilisation par client.
alter table public.promo_codes add column max_uses_per_user int default 1 check (max_uses_per_user is null or max_uses_per_user >= 1);

-- M2, M3 : commande (verrou par client, code promo réservé à la commande, cartes cadeaux non remisées).
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
  gift_subtotal int := 0;
  used_by_me int;
  pc public.promo_codes;
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
  -- Une commande à la fois par client : points et codes promo ne peuvent pas être dépensés deux fois.
  perform pg_advisory_xact_lock(hashtext('place_order:' || me::text));
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
    if v.kind = 'gift_card' then gift_subtotal := gift_subtotal + unit * qty; end if;
    lines := lines || jsonb_build_object('pid', v.pid, 'vid', v.id, 'name', coalesce(v.name ->> 'fr', ''),
      'vname', nullif(v.vname ->> 'fr', ''), 'unit', unit, 'qty', qty, 'pre', v.is_preorder,
      'gift', case when v.kind = 'gift_card' then coalesce(it -> 'gift', '{}'::jsonb) end);
  end loop;

  -- Les cartes cadeaux ne sont jamais remisées (sinon la remise se convertit en crédit).
  if p_promo is not null and trim(p_promo) <> '' then
    select * into pc from public.promo_codes where code = upper(trim(p_promo)) for update;
    select * into promo from public.check_promo(p_promo, subtotal - gift_subtotal);
    if pc.id is null or not promo.valid then raise exception 'invalid_promo' using errcode = '22023'; end if;
    select count(*) into used_by_me from public.orders
      where promo_code_id = pc.id and user_id = auth.uid() and status not in ('cancelled');
    if pc.max_uses_per_user is not null and used_by_me >= pc.max_uses_per_user then
      raise exception 'invalid_promo' using errcode = '22023';
    end if;
    discount := promo.discount_xof;
    promo_kind := promo.kind;
    promo_id := pc.id;
    -- Utilisation réservée dès la commande (restituée si elle est annulée).
    update public.promo_codes set uses = uses + 1 where id = pc.id;
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
    -- Les points ne paient pas les cartes cadeaux.
    pts := greatest(0, least(p_use_points, balance, greatest(0, remaining - gift_subtotal) / greatest(pt_value, 1)));
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

-- Commande payée : l'utilisation du code promo est déjà comptée à la commande.
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
  for it in select oi.* from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = o.id and p.kind = 'gift_card' loop
    for i in 1 .. it.quantity loop
      insert into public.gift_cards (code, initial_xof, balance_xof, status, purchase_order_id, recipient_name,
        recipient_contact, message, expires_at)
      values (private.gift_code(), it.unit_price_xof, it.unit_price_xof, 'active', o.id, it.gift ->> 'recipient_name',
        it.gift ->> 'recipient_contact', left(it.gift ->> 'message', 500), now() + interval '1 year');
    end loop;
  end loop;
  if o.delivery_method = 'none' then
    update public.orders set status = 'delivered' where id = o.id;
    insert into public.order_events (order_id, status, created_by) values (o.id, 'delivered', null);
  end if;
end $$;

-- Restitution : stock, carte cadeau utilisée, points dépensés, utilisation du code promo.
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
  if o.promo_code_id is not null then
    update public.promo_codes set uses = greatest(uses - 1, 0) where id = o.promo_code_id;
  end if;
end $$;

-- L3 : annulation ou remboursement d'une commande payée : points gagnés repris, cartes émises annulées.
create or replace function private.unwind_paid_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id;
  if o.loyalty_points_earned > 0 and o.profile_id is not null then
    insert into public.loyalty_ledger (profile_id, points, reason, order_id) values (o.profile_id, -o.loyalty_points_earned, 'adjustment', o.id);
  end if;
  update public.gift_cards set status = 'cancelled' where purchase_order_id = o.id and status in ('active', 'pending');
end $$;

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
  if o.status <> 'pending_payment' then perform private.unwind_paid_order(o.id); end if;
  update public.orders set status = 'cancelled' where id = o.id returning * into o;
  insert into public.order_events (order_id, status, note) values (o.id, 'cancelled', left(p_note, 500));
  update public.payments set status = 'cancelled' where object_type = 'order' and object_id = o.id and status = 'pending';
  return o;
end $$;
revoke execute on function public.cancel_order from anon, public;
grant execute on function public.cancel_order to authenticated;

-- M1 : expiration sans course avec un paiement qui se confirme au même moment.
create or replace function private.expire_orders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in select id from public.orders where status = 'pending_payment'
    and created_at < now() - make_interval(hours => coalesce((private.setting('shop_order_expiry_hours'))::int, 48))
    for update skip locked loop
    perform private.release_order(r.id);
    update public.orders set status = 'cancelled' where id = r.id and status = 'pending_payment';
    insert into public.order_events (order_id, status, note, created_by) values (r.id, 'cancelled', 'expired', null);
    update public.payments set status = 'cancelled' where object_type = 'order' and object_id = r.id and status = 'pending';
    n := n + 1;
  end loop;
  return n;
end $$;

-- L3 : remboursement complet d'une commande : restitution et annulation des cartes émises.
create or replace function public.admin_record_refund(p_payment uuid, p_amount int, p_reason text)
returns public.refunds language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
  already int;
  rf public.refunds;
  o public.orders;
begin
  if not (private.is_admin_of('shop') or private.is_admin_of('competitions')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into pay from public.payments where id = p_payment for update;
  if not found or pay.status <> 'succeeded' then raise exception 'not_refundable' using errcode = '22023'; end if;
  select coalesce(sum(amount_xof), 0) into already from public.refunds where payment_id = pay.id and status <> 'failed';
  if p_amount < 1 or already + p_amount > pay.amount_xof then raise exception 'invalid_amount' using errcode = '22023'; end if;
  insert into public.refunds (payment_id, amount_xof, reason, status) values (pay.id, p_amount, left(p_reason, 500), 'succeeded')
    returning * into rf;
  if already + p_amount = pay.amount_xof then
    update public.payments set status = 'refunded' where id = pay.id;
    if pay.object_type = 'order' then
      select * into o from public.orders where id = pay.object_id for update;
      if o.status not in ('cancelled', 'refunded') then
        -- Stock restitué seulement si la marchandise n'est pas partie.
        if o.status in ('paid', 'preparing', 'ready_for_pickup') then perform private.release_order(o.id); end if;
        perform private.unwind_paid_order(o.id);
        update public.orders set status = 'refunded' where id = o.id;
        insert into public.order_events (order_id, status, note) values (o.id, 'refunded', left(p_reason, 500));
      end if;
    elsif pay.object_type = 'registration' then
      update public.registrations set payment_status = 'refunded' where id = pay.object_id;
    elsif pay.object_type = 'booking' then
      update public.bookings set status = 'cancelled' where id = pay.object_id and status = 'confirmed';
    elsif pay.object_type = 'league_license' then
      update public.league_licenses set status = 'cancelled' where id = pay.object_id;
    end if;
  end if;
  return rf;
end $$;
revoke execute on function public.admin_record_refund from anon, public;
grant execute on function public.admin_record_refund to authenticated;

-- M1 : un paiement confirmé pour un objet qui n'est plus payable est signalé pour remboursement.
create or replace function public.confirm_payment(p_payment_id uuid, p_status text, p_provider_ref text, p_reason text default null)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
  payable boolean := true;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if pay.status in ('succeeded', 'refunded') then return pay; end if;
  update public.payments set status = p_status, provider_ref = coalesce(p_provider_ref, provider_ref),
    confirmed_at = case when p_status = 'succeeded' then now() end, failure_reason = p_reason
  where id = pay.id returning * into pay;
  if pay.object_type = 'registration' then
    if p_status = 'succeeded' then
      payable := exists (select 1 from public.registrations where id = pay.object_id and status not in ('cancelled', 'refused'));
      update public.registrations set payment_status = 'paid',
        status = case when status = 'pending_payment' then
          case when (select validation_mode from public.tournaments t where t.id = registrations.tournament_id) = 'manual'
            then 'pending_validation'::public.registration_status else 'confirmed'::public.registration_status end
          else status end
      where id = pay.object_id and status not in ('cancelled', 'refused');
    elsif p_status in ('failed', 'cancelled') then
      update public.registrations set payment_status = 'failed' where id = pay.object_id and payment_status = 'pending';
    end if;
  elsif pay.object_type = 'booking' and p_status = 'succeeded' then
    update public.bookings set status = 'confirmed' where id = pay.object_id and status = 'pending_payment';
    payable := found;
  elsif pay.object_type = 'order' and p_status = 'succeeded' then
    payable := exists (select 1 from public.orders where id = pay.object_id and status = 'pending_payment');
    perform private.order_paid(pay.object_id);
  elsif pay.object_type = 'league_license' and p_status = 'succeeded' then
    update public.league_licenses set status = 'active' where id = pay.object_id and status = 'pending_payment';
    payable := found;
  end if;
  if p_status = 'succeeded' and not payable then
    update public.payments set metadata = metadata || '{"needs_refund": true}' where id = pay.id returning * into pay;
    perform private.audit('payment_needs_refund', 'payments', pay.id::text, null,
      jsonb_build_object('object_type', pay.object_type, 'object_id', pay.object_id));
  end if;
  return pay;
end $$;
revoke execute on function public.confirm_payment from anon, authenticated, public;
grant execute on function public.confirm_payment to service_role;

-- Fusion : l'identifiant FIDE (désormais unique) est libéré sur le doublon avant report.
create or replace function public.admin_merge_profiles(p_keep uuid, p_merge uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  keep public.profiles;
  dup public.profiles;
  fk record;
  r record;
  moved int := 0;
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_keep = p_merge then raise exception 'same_profile' using errcode = '22023'; end if;
  select * into keep from public.profiles where id = p_keep for update;
  select * into dup from public.profiles where id = p_merge for update;
  if keep.id is null or dup.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if keep.merged_into is not null or dup.merged_into is not null then raise exception 'already_merged' using errcode = '22023'; end if;
  if keep.user_id is not null and dup.user_id is not null then raise exception 'two_accounts' using errcode = '22023'; end if;

  for fk in
    select cl.relname as tbl, att.attname as col
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype = 'f' and con.confrelid = 'public.profiles'::regclass and ns.nspname = 'public'
      and array_length(con.conkey, 1) = 1
      and not (cl.relname = 'profiles' and att.attname = 'merged_into')
  loop
    for r in execute format('select ctid from public.%I where %I = $1', fk.tbl, fk.col) using p_merge loop
      begin
        execute format('update public.%I set %I = $1 where ctid = $2', fk.tbl, fk.col) using p_keep, r.ctid;
        moved := moved + 1;
      exception when unique_violation then
        execute format('delete from public.%I where ctid = $1', fk.tbl) using r.ctid;
      end;
    end loop;
  end loop;

  -- Compte de connexion et informations manquantes reportés sur le profil conservé.
  -- Identifiants uniques libérés sur le doublon avant d'être reportés.
  update public.profiles set user_id = null, fide_id = null where id = dup.id;
  update public.profiles set
    user_id = coalesce(keep.user_id, dup.user_id),
    phone = coalesce(keep.phone, dup.phone),
    email = coalesce(keep.email, dup.email),
    birth_date = coalesce(keep.birth_date, dup.birth_date),
    fide_id = coalesce(keep.fide_id, dup.fide_id),
    club_name = coalesce(keep.club_name, dup.club_name),
    claimed = keep.claimed or dup.claimed,
    verified = keep.verified or dup.verified,
    onboarded = keep.onboarded or dup.onboarded
  where id = keep.id;
  update public.profiles set merged_into = keep.id, is_public = false, phone = null, fide_id = null where id = dup.id;
  perform private.audit('merge_profiles', 'profiles', keep.id::text, to_jsonb(dup), jsonb_build_object('kept', keep.id, 'moved', moved));
  return moved;
end $$;
revoke execute on function public.admin_merge_profiles from anon, public;
grant execute on function public.admin_merge_profiles to authenticated;

-- L4 : fonctions internes non appelables par les rôles d'API.
revoke execute on function private.order_paid(uuid), private.release_order(uuid), private.unwind_paid_order(uuid),
  private.expire_orders(), private.audit(text, text, text, jsonb, jsonb), private.gift_code()
  from public, anon, authenticated;
