-- Administration : journal des consultations, statistiques de base.

-- Journalise la consultation d'une liste contenant des données personnelles (staff ou admin).
create or replace function public.log_admin_view(p_object_type text, p_object_id text, p_context text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (private.is_admin() or (p_object_type = 'tournaments' and private.can_arbitrate(p_object_id::uuid))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform private.audit('view_personal_data', p_object_type, p_object_id, null, jsonb_build_object('context', p_context));
end $$;
revoke execute on function public.log_admin_view from anon, public;
grant execute on function public.log_admin_view to authenticated;

-- Tableau de bord administrateur (agrégats).
create or replace function public.admin_overview()
returns table (users bigint, profiles bigint, registrations bigint, payments_succeeded bigint, revenue_xof bigint,
  pending_data_requests bigint, contact_new bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select
    (select count(*) from auth.users),
    (select count(*) from public.profiles where merged_into is null),
    (select count(*) from public.registrations where status not in ('cancelled', 'refused')),
    (select count(*) from public.payments where status = 'succeeded'),
    (select coalesce(sum(amount_xof), 0)::bigint from public.payments where status = 'succeeded'),
    (select count(*) from public.data_requests where status = 'pending'),
    (select count(*) from public.contact_messages where status = 'new');
end $$;
revoke execute on function public.admin_overview from anon, public;
grant execute on function public.admin_overview to authenticated;

-- Tournois gérés par l'utilisateur (admin : tous ; staff : les siens).
create or replace function public.my_managed_tournaments()
returns setof public.tournaments language sql stable security definer set search_path = '' as $$
  select t.* from public.tournaments t where private.can_arbitrate(t.id) order by t.starts_at desc
$$;
revoke execute on function public.my_managed_tournaments from anon, public;
grant execute on function public.my_managed_tournaments to authenticated;
