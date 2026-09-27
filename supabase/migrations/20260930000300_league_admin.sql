-- Administration des ligues : répartition initiale, création des journées, clôture.

-- Répartition par la cote des licenciés d'une saison (première saison) : pour chaque cadence,
-- 12 premiers en Ligue 1, 12 suivants en Ligue 2, les autres en Ligue Amateur.
-- Sans effet sur une cadence dont les ligues ont déjà des membres.
create or replace function public.allocate_season_by_rating(p_season uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  c public.cadence;
  n int := 0;
  k int;
  start_rating int := coalesce((private.setting('default_start_rating'))::int, 1200);
begin
  if not private.is_admin_of('competitions') then raise exception 'forbidden' using errcode = '42501'; end if;
  foreach c in array array['classical', 'rapid', 'blitz']::public.cadence[] loop
    if exists (select 1 from public.league_members m join public.leagues l on l.id = m.league_id
               where l.season_id = p_season and l.cadence = c) then
      continue;
    end if;
    with ranked as (
      select lic.profile_id,
        row_number() over (order by coalesce(r.rating, start_rating) desc, p.last_name, p.first_name) as pos
      from public.league_licenses lic
      join public.profiles p on p.id = lic.profile_id and p.merged_into is null
      left join public.ratings r on r.profile_id = lic.profile_id and r.type::text = c::text
      where lic.season_id = p_season and lic.status in ('active', 'exempt') and c = any (lic.cadences)
    )
    insert into public.league_members (league_id, profile_id, seed)
    select l.id, ranked.profile_id, case when ranked.pos <= 24 then ((ranked.pos - 1) % 12) + 1 else ranked.pos - 24 end
    from ranked
    join public.leagues l on l.season_id = p_season and l.cadence = c
      and l.division = case when ranked.pos <= 12 then 'l1' when ranked.pos <= 24 then 'l2' else 'amateur' end;
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return n;
end $$;
revoke execute on function public.allocate_season_by_rating from anon, public;
grant execute on function public.allocate_season_by_rating to authenticated;

-- Crée la journée suivante d'une ligue : tournoi en brouillon aux paramètres de la ligue,
-- membres actifs inscrits d'office (licence réglée), rattachement à la ligue.
create or replace function public.create_league_matchday(p_league uuid, p_date date default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  l public.leagues;
  se public.seasons;
  num int;
  tid uuid;
  lname text;
begin
  if not private.is_admin_of('competitions') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into l from public.leagues where id = p_league;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into se from public.seasons where id = l.season_id;
  select coalesce(max(number), 0) + 1 into num from public.league_matchdays where league_id = l.id;
  lname := case l.division when 'l1' then 'Ligue 1' when 'l2' then 'Ligue 2' else 'Ligue Amateur' end || ' '
    || case l.cadence when 'classical' then 'classique' when 'rapid' then 'rapide' else 'blitz' end;
  insert into public.tournaments (slug, name, edition, starts_at, cadence, base_minutes, increment_seconds, rounds_count,
    pairing_system, tiebreaks, rated, league_id, status, organizer_profile_id, is_demo, capacity, entry_fee_xof,
    allow_online_payment, allow_on_site_payment)
  values (l.slug || '-j' || num, lname || ' — journée ' || num, se.name,
    coalesce(p_date, current_date + 7)::timestamptz + interval '9 hours',
    l.cadence, l.base_minutes, l.increment_seconds,
    case when l.format = 'swiss' then 5 else l.rounds_count end,
    l.format, '{sonneborn_berger,wins}', true, l.id, 'draft', private.my_profile_id(), se.is_demo,
    case when l.format = 'swiss' then null else l.size end, 0, false, false)
  returning id into tid;
  insert into public.registrations (tournament_id, player_id, status, payment_status, seed_rating, source)
  select tid, m.profile_id, 'confirmed', 'not_required',
    (select r.rating from public.ratings r where r.profile_id = m.profile_id and r.type::text = l.cadence::text), 'admin'
  from public.league_members m where m.league_id = l.id and m.status = 'active';
  insert into public.league_matchdays (league_id, number, scheduled_on, tournament_id) values (l.id, num, p_date, tid);
  update public.leagues set status = 'ongoing' where id = l.id and status = 'planned';
  return tid;
end $$;
revoke execute on function public.create_league_matchday from anon, public;
grant execute on function public.create_league_matchday to authenticated;

-- Clôture d'une ligue : champion = premier du classement cumulé.
create or replace function public.close_league(p_league uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare champ uuid;
begin
  if not private.is_admin_of('competitions') then raise exception 'forbidden' using errcode = '42501'; end if;
  select player_id into champ from public.league_standings where league_id = p_league order by rank, points desc limit 1;
  update public.leagues set status = 'finished', champion_id = champ where id = p_league;
  return champ;
end $$;
revoke execute on function public.close_league from anon, public;
grant execute on function public.close_league to authenticated;
