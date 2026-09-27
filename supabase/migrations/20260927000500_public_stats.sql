-- Chiffres clés publics (agrégats uniquement, aucune donnée personnelle).
create or replace function public.public_stats()
returns table (rated_players bigint, tournaments bigint, games bigint, demo boolean)
language sql stable security definer set search_path = '' as $$
  select
    (select count(distinct profile_id) from public.ratings r where not r.provisional),
    (select count(*) from public.tournaments t where t.status in ('finished', 'archived')),
    (select count(*) from public.games g where g.is_public),
    exists (select 1 from public.tournaments t where t.is_demo)
$$;
grant execute on function public.public_stats to anon, authenticated;
