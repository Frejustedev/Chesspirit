-- Revue de sécurité finale (docs/SECURITE.md, constats M1 à M4 et F2 à F4).

-- M1 : une structure proposée ne peut pas se publier elle-même (publication réservée à la modération).
create or replace function private.organizations_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), 'system') in ('service_role', 'system') or private.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.is_public := false;
    new.verified := false;
    new.is_demo := false;
  elsif new.verified is distinct from old.verified or new.claimed_by is distinct from old.claimed_by
     or new.is_demo is distinct from old.is_demo or new.is_public is distinct from old.is_public then
    raise exception 'forbidden_field' using errcode = '42501';
  end if;
  return new;
end $$;

-- F3 : adresse de site web en http(s) uniquement.
alter table public.organizations add constraint organizations_website_http
  check (website is null or website ~ '^https?://');

-- M2 : création et suppression des parties « public contre le maître » réservées à l'administration ;
-- le maître rattaché ne peut que jouer (position, coups, statut), sans changer l'identité de la partie.
drop policy pvm_admin on public.pvm_games;
create policy pvm_insert_admin on public.pvm_games for insert to authenticated with check (private.is_admin());
create policy pvm_delete_admin on public.pvm_games for delete to authenticated using (private.is_admin());
create policy pvm_update on public.pvm_games for update to authenticated
  using (private.is_admin() or (master_profile_id is not null and private.manages_profile(master_profile_id)))
  with check (private.is_admin() or (master_profile_id is not null and private.manages_profile(master_profile_id)));
create or replace function private.pvm_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), 'system') in ('service_role', 'system') or private.is_admin() then return new; end if;
  if new.slug is distinct from old.slug or new.title is distinct from old.title
     or new.master_name is distinct from old.master_name or new.master_profile_id is distinct from old.master_profile_id
     or new.public_color is distinct from old.public_color or new.is_demo is distinct from old.is_demo
     or new.vote_minutes is distinct from old.vote_minutes then
    raise exception 'forbidden_field' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger pvm_games_guard before update on public.pvm_games for each row execute function private.pvm_guard();

-- M3 : nom de famille d'un mineur toujours réduit à l'initiale dans les affichages publics.
create or replace function private.display_name(p public.profiles) returns text
language sql stable set search_path = '' as $$
  select case
    when p.is_minor then p.first_name || ' ' || left(p.last_name, 1) || '.'
    else p.first_name || ' ' || p.last_name
  end
$$;

-- M4 : pas d'âge exact des mineurs dans le classement du Tour, seulement leur tranche d'âge.
create or replace view public.tour_standings with (security_barrier = true) as
with ranked as (
  select st.season_id, tp.profile_id, tp.points,
    row_number() over (partition by st.season_id, tp.profile_id order by tp.points desc) as n
  from public.tour_points tp join public.tour_stages st on st.id = tp.stage_id and st.kind <> 'masters'
), totals as (
  select r.season_id, r.profile_id,
    sum(r.points) filter (where r.n <= se.tour_best_results) as total,
    count(*) as stages
  from ranked r join public.seasons se on se.id = r.season_id
  group by r.season_id, r.profile_id
), aged as (
  select t.*, case when p.birth_date is null then null else extract(year from age(se.starts_on, p.birth_date))::int end as years
  from totals t
  join public.profiles p on p.id = t.profile_id
  join public.seasons se on se.id = t.season_id
)
select t.season_id, t.profile_id, t.total, t.stages,
  rank() over (partition by t.season_id order by t.total desc) as rank,
  private.display_name(p) as display_name, coalesce(p.club_name, o.name) as club, p.titles,
  case when p.is_minor then null else p.sex end as sex,
  -- Âge au début de la saison pour les adultes ; tranche seulement pour les moins de 18 ans.
  case when t.years is null or t.years < 18 then null else t.years end as age,
  -- Catégorie féminine du Tour (dossier de projet), y compris pour les joueuses mineures.
  p.sex = 'F' as is_woman,
  (select r.rating from public.ratings r where r.profile_id = p.id and r.type = 'rapid') as rapid_rating,
  case when t.years is null then null when t.years < 14 then 'u14' when t.years < 18 then 'u18' end as age_group
from aged t
join public.profiles p on p.id = t.profile_id
left join public.organizations o on o.id = p.club_id;
grant select on public.tour_standings to anon, authenticated;

-- F2 : les tentatives de puzzle ne sont plus écrites directement ; le serveur vérifie la solution.
drop policy attempts_insert on public.puzzle_attempts;
revoke insert on public.puzzle_attempts from authenticated;

-- F4 : un report de ligue n'est approuvé qu'avec l'accord de l'adversaire, même par l'API.
drop policy postponements_arbiter on public.league_postponements;
create policy postponements_arbiter on public.league_postponements for update to authenticated
  using (private.pairing_arbiter(pairing_id))
  with check (private.pairing_arbiter(pairing_id) and (status <> 'approved' or opponent_agreed));
