-- Statistiques et alertes accessibles aussi au rôle service (tâches planifiées : synthèse et rapport mensuel).

create or replace function public.admin_stats(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not (private.is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles where merged_into is null and not is_demo),
      'accounts', (select count(*) from public.profiles where user_id is not null and merged_into is null),
      'new', (select count(*) from public.profiles where created_at::date between p_from and p_to and not is_demo),
      'active', (select count(distinct user_id) from auth.sessions where updated_at::date between p_from and p_to),
      'by_department', (select coalesce(jsonb_object_agg(coalesce(department, '—'), c), '{}') from (
        select department, count(*) c from public.profiles where merged_into is null and not is_demo group by 1) d),
      'by_sex', (select coalesce(jsonb_object_agg(coalesce(sex::text, '—'), c), '{}') from (
        select sex, count(*) c from public.profiles where merged_into is null and not is_demo group by 1) d),
      'by_age', (select coalesce(jsonb_object_agg(g, c), '{}') from (
        select case when birth_date is null then '—'
          when birth_date > current_date - interval '14 years' then '<14'
          when birth_date > current_date - interval '18 years' then '14-17'
          when birth_date > current_date - interval '30 years' then '18-29'
          when birth_date > current_date - interval '50 years' then '30-49' else '50+' end g, count(*) c
        from public.profiles where merged_into is null and not is_demo group by 1) d),
      'by_city', (select coalesce(jsonb_object_agg(city, c), '{}') from (
        select coalesce(city, '—') city, count(*) c from public.profiles where merged_into is null and not is_demo
        group by 1 order by 2 desc limit 10) d)
    ),
    'competitions', jsonb_build_object(
      'tournaments', (select count(*) from public.tournaments where starts_at::date between p_from and p_to and status <> 'draft'),
      'registrations', (select count(*) from public.registrations where created_at::date between p_from and p_to and status not in ('cancelled', 'refused')),
      'players', (select count(distinct player_id) from public.registrations r join public.tournaments t on t.id = r.tournament_id
        where t.starts_at::date between p_from and p_to and r.status not in ('cancelled', 'refused')),
      'games', (select count(*) from public.games where played_on between p_from and p_to),
      'by_month', (select coalesce(jsonb_object_agg(m, c), '{}') from (
        select to_char(starts_at, 'YYYY-MM') m, count(*) c from public.tournaments
        where starts_at::date between p_from and p_to and status <> 'draft' group by 1) d)
    ),
    'finance', jsonb_build_object(
      'revenue', (select coalesce(sum(amount_xof), 0) from public.payments where status = 'succeeded' and confirmed_at::date between p_from and p_to),
      'refunds', (select coalesce(sum(amount_xof), 0) from public.refunds where status = 'succeeded' and created_at::date between p_from and p_to),
      'by_object', (select coalesce(jsonb_object_agg(object_type, s), '{}') from (
        select object_type, sum(amount_xof) s from public.payments where status = 'succeeded' and confirmed_at::date between p_from and p_to group by 1) d),
      'by_month', (select coalesce(jsonb_object_agg(m, s), '{}') from (
        select to_char(confirmed_at, 'YYYY-MM') m, sum(amount_xof) s from public.payments
        where status = 'succeeded' and confirmed_at::date between p_from and p_to group by 1) d),
      'failed', (select count(*) from public.payments where status = 'failed' and created_at::date between p_from and p_to)
    ),
    'coaching', jsonb_build_object(
      'bookings', (select count(*) from public.bookings where created_at::date between p_from and p_to and status in ('confirmed', 'completed')),
      'commission', (select coalesce(sum(commission_xof), 0) from public.bookings where created_at::date between p_from and p_to and status in ('confirmed', 'completed'))
    ),
    'shop', jsonb_build_object(
      'orders', (select count(*) from public.orders where created_at::date between p_from and p_to and status not in ('pending_payment', 'cancelled')),
      'top_products', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'qty', q) order by q desc), '[]') from (
        select oi.name, sum(oi.quantity) q from public.order_items oi join public.orders o on o.id = oi.order_id
        where o.created_at::date between p_from and p_to and o.status not in ('pending_payment', 'cancelled')
        group by 1 order by 2 desc limit 5) d)
    ),
    'content', jsonb_build_object(
      'puzzle_attempts', (select count(*) from public.puzzle_attempts where attempted_on between p_from and p_to),
      'puzzle_solvers', (select count(distinct profile_id) from public.puzzle_attempts where attempted_on between p_from and p_to and solved),
      'articles', (select count(*) from public.articles where published_at::date between p_from and p_to),
      'episodes', (select count(*) from public.media_episodes where published_at::date between p_from and p_to)
    )
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_stats from anon, public;
grant execute on function public.admin_stats to authenticated, service_role;

-- Alertes : stock bas, tournoi presque complet, paiements échoués, demandes en attente.
create or replace function public.admin_alerts()
returns table (kind text, count bigint, detail text)
language sql stable security definer set search_path = '' as $$
  select * from (
    select 'low_stock'::text, count(*), string_agg(p.name ->> 'fr', ', ')
      from public.product_variants pv join public.products p on p.id = pv.product_id
      where p.kind = 'physical' and p.is_active and not p.is_preorder and pv.is_active and pv.stock <= 3
    union all
    select 'tournament_almost_full', count(*), string_agg(t.name, ', ')
      from public.tournaments t
      where t.status = 'registration_open' and t.capacity is not null
        and (select count(*) from public.registrations r where r.tournament_id = t.id
             and r.status in ('confirmed', 'pending_payment', 'pending_validation')) >= t.capacity * 0.9
    union all
    select 'payment_failed', count(*), null from public.payments where status = 'failed' and created_at > now() - interval '7 days'
    union all
    select 'needs_refund', count(*), null from public.payments where (metadata ->> 'needs_refund')::boolean
      and status = 'succeeded' and not exists (select 1 from public.refunds rf where rf.payment_id = payments.id)
    union all
    select 'pending_requests', (select count(*) from public.data_requests where status = 'pending')
      + (select count(*) from public.contact_messages where status = 'new')
      + (select count(*) from public.listing_claims where status = 'pending'), null
  ) a (kind, count, detail)
  where (private.is_admin() or coalesce(auth.role(), '') = 'service_role') and a.count > 0
$$;
revoke execute on function public.admin_alerts from anon, public;
grant execute on function public.admin_alerts to authenticated, service_role;
