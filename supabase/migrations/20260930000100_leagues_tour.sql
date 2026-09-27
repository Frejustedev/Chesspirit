-- Ligues individuelles (3 divisions × 3 cadences) et Chesspirit Tour.
-- Toutes les règles (formats, montées, descentes, barèmes, coefficients) sont en base et modifiables.

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'closed')),
  -- Règles de ligue : montées, descentes, barrage, règle de Sofia, forfaits, licence.
  league_rules jsonb not null default '{"promoted": 2, "relegated": 2, "playoff": {"upper_rank": 10, "lower_rank": 3}, "sofia_rule": false, "max_unjustified_forfeits": 2, "postpone_deadline_days": 7}',
  license_fee_xof int check (license_fee_xof >= 0), -- null = à confirmer
  tour_best_results int not null default 6 check (tour_best_results between 1 and 20),
  masters_qualified int not null default 8,
  masters_invited int not null default 2,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on)
);
create trigger seasons_updated_at before update on public.seasons for each row execute function private.set_updated_at();

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  division text not null check (division in ('l1', 'l2', 'amateur')),
  cadence public.cadence not null,
  format text not null check (format in ('round_robin', 'double_round_robin', 'swiss')),
  size int check (size between 2 and 500),
  base_minutes int not null,
  increment_seconds int not null,
  rounds_count int,
  schedule_note jsonb not null default '{}',
  status text not null default 'planned' check (status in ('planned', 'ongoing', 'finished')),
  champion_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, division, cadence)
);
create trigger leagues_updated_at before update on public.leagues for each row execute function private.set_updated_at();
alter table public.tournaments add constraint tournaments_league_fk foreign key (league_id) references public.leagues(id) on delete set null;
create index tournaments_league_idx on public.tournaments (league_id);

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  seed int,
  status text not null default 'active' check (status in ('active', 'withdrawn', 'excluded')),
  unjustified_forfeits int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, profile_id)
);
create trigger league_members_updated_at before update on public.league_members for each row execute function private.set_updated_at();

-- Journées : une journée = un tournoi (ronde(s) d'une ligue fermée ou tournoi suisse mensuel de la Ligue Amateur).
create table public.league_matchdays (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  number int not null check (number >= 1),
  scheduled_on date,
  rounds text, -- ex. « 1-6 » pour les journées de rapide
  tournament_id uuid references public.tournaments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, number)
);
create trigger league_matchdays_updated_at before update on public.league_matchdays for each row execute function private.set_updated_at();

create table public.league_licenses (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  cadences public.cadence[] not null default '{blitz,rapid,classical}',
  status text not null default 'pending_payment' check (status in ('pending_payment', 'active', 'exempt', 'cancelled')),
  amount_xof int not null default 0,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, profile_id)
);
create trigger league_licenses_updated_at before update on public.league_licenses for each row execute function private.set_updated_at();

create table public.league_postponements (
  id uuid primary key default gen_random_uuid(),
  pairing_id uuid not null references public.pairings(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  reason text check (char_length(reason) <= 1000),
  proposed_date date,
  opponent_agreed boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
  decided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pairing_id)
);
create trigger league_postponements_updated_at before update on public.league_postponements for each row execute function private.set_updated_at();

-- Chesspirit Tour -----------------------------------------------------------
create table public.scoring_scales (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  places int[] not null,
  participation numeric(4, 1) not null default 5,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index scoring_scales_default_idx on public.scoring_scales (is_default) where is_default;
create trigger scoring_scales_updated_at before update on public.scoring_scales for each row execute function private.set_updated_at();
insert into public.scoring_scales (name, places, participation, is_default) values
  ('Barème Chesspirit', array[100, 80, 65, 55, 50, 45, 40, 36, 32, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 5, true);

create table public.tour_stages (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  tournament_id uuid unique references public.tournaments(id) on delete set null,
  number int not null,
  name text not null,
  city text,
  planned_on date,
  kind text not null default 'regular' check (kind in ('regular', 'major', 'online', 'masters')),
  coefficient numeric(3, 2) not null default 1 check (coefficient between 0 and 3),
  scale_id uuid references public.scoring_scales(id),
  status text not null default 'planned' check (status in ('planned', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, number)
);
create trigger tour_stages_updated_at before update on public.tour_stages for each row execute function private.set_updated_at();

create table public.tour_points (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.tour_stages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rank int not null,
  points numeric(6, 1) not null,
  created_at timestamptz not null default now(),
  unique (stage_id, profile_id)
);

create table public.masters_invitations (
  season_id uuid not null references public.seasons(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (season_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- Autorisations
-- ---------------------------------------------------------------------------
alter table public.seasons enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_matchdays enable row level security;
alter table public.league_licenses enable row level security;
alter table public.league_postponements enable row level security;
alter table public.scoring_scales enable row level security;
alter table public.tour_stages enable row level security;
alter table public.tour_points enable row level security;
alter table public.masters_invitations enable row level security;
revoke insert, update, delete on public.seasons, public.leagues, public.league_members, public.league_matchdays,
  public.scoring_scales, public.tour_stages, public.tour_points, public.masters_invitations from anon;
revoke all on public.league_licenses, public.league_postponements from anon;

do $$
declare t text;
begin
  foreach t in array array['seasons', 'leagues', 'league_matchdays', 'scoring_scales', 'tour_stages', 'tour_points', 'masters_invitations'] loop
    execute format('create policy %1$s_read on public.%1$s for select to anon, authenticated using (true)', t);
    execute format('create policy %1$s_admin on public.%1$s for all to authenticated using (private.is_admin_of(''competitions'')) with check (private.is_admin_of(''competitions''))', t);
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$s for each row execute function private.audit_trigger()', t);
  end loop;
end $$;

-- Membres : la composition des ligues est publique (via la vue public_league_members), la table reste réservée.
create policy league_members_read on public.league_members for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin_of('competitions'));
create policy league_members_admin on public.league_members for all to authenticated
  using (private.is_admin_of('competitions')) with check (private.is_admin_of('competitions'));
create trigger league_members_audit after insert or update or delete on public.league_members
  for each row execute function private.audit_trigger();

create policy league_licenses_read on public.league_licenses for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin_of('competitions'));
create policy league_licenses_admin on public.league_licenses for all to authenticated
  using (private.is_admin_of('competitions')) with check (private.is_admin_of('competitions'));

create or replace function private.pairing_player(p_pairing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pairings pr where pr.id = p_pairing
    and (private.manages_profile(pr.white_id) or private.manages_profile(pr.black_id)))
$$;
create or replace function private.pairing_arbiter(p_pairing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pairings pr where pr.id = p_pairing and private.can_arbitrate(pr.tournament_id))
$$;

create policy postponements_read on public.league_postponements for select to authenticated
  using (private.pairing_player(pairing_id) or private.pairing_arbiter(pairing_id));
create policy postponements_insert on public.league_postponements for insert to authenticated
  with check (private.manages_profile(requested_by) and private.pairing_player(pairing_id) and status = 'pending'
    and not opponent_agreed and decided_by is null);
create policy postponements_arbiter on public.league_postponements for update to authenticated
  using (private.pairing_arbiter(pairing_id)) with check (private.pairing_arbiter(pairing_id));

-- Accord de l'adversaire (seul champ modifiable par lui).
create or replace function public.agree_postponement(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare lp public.league_postponements; pr public.pairings;
begin
  select * into lp from public.league_postponements where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into pr from public.pairings where id = lp.pairing_id;
  if not ((private.manages_profile(pr.white_id) and pr.white_id <> lp.requested_by)
       or (private.manages_profile(pr.black_id) and pr.black_id <> lp.requested_by)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.league_postponements set opponent_agreed = true where id = lp.id;
end $$;
revoke execute on function public.agree_postponement from anon, public;
grant execute on function public.agree_postponement to authenticated;

-- ---------------------------------------------------------------------------
-- Vues publiques
-- ---------------------------------------------------------------------------
create view public.public_league_members with (security_barrier = true) as
select m.league_id, m.profile_id, m.seed, m.status, private.display_name(p) as display_name,
  coalesce(p.club_name, o.name) as club, p.titles
from public.league_members m
join public.profiles p on p.id = m.profile_id
left join public.organizations o on o.id = p.club_id;
grant select on public.public_league_members to anon, authenticated;

-- Classement de ligue : somme des points et du Sonneborn-Berger sur les journées (tournois) de la ligue.
create view public.league_standings with (security_barrier = true) as
with agg as (
  select t.league_id, s.player_id,
    sum(s.points) as points,
    sum(coalesce((s.tiebreaks ->> 'sonneborn_berger')::numeric, 0)) as sonneborn_berger,
    sum(coalesce(s.games, 0)) as games,
    count(distinct s.tournament_id) as matchdays
  from public.standings s
  join public.tournaments t on t.id = s.tournament_id and t.league_id is not null and t.status <> 'draft'
    and (t.results_published or t.status in ('ongoing', 'finished', 'archived'))
  group by t.league_id, s.player_id
)
select a.league_id, a.player_id, a.points, a.sonneborn_berger, a.games, a.matchdays,
  rank() over (partition by a.league_id order by a.points desc, a.sonneborn_berger desc) as rank,
  private.display_name(p) as display_name, coalesce(p.club_name, o.name) as club, p.titles
from agg a
join public.profiles p on p.id = a.player_id
left join public.organizations o on o.id = p.club_id;
grant select on public.league_standings to anon, authenticated;

-- Classement du Tour : meilleurs résultats de la saison (nombre défini par la saison), données pour les catégories.
create view public.tour_standings with (security_barrier = true) as
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
)
select t.season_id, t.profile_id, t.total, t.stages,
  rank() over (partition by t.season_id order by t.total desc) as rank,
  private.display_name(p) as display_name, coalesce(p.club_name, o.name) as club, p.titles,
  case when p.is_minor then null else p.sex end as sex,
  -- Âge au début de la saison (pour les catégories), sans exposer la date de naissance.
  case when p.birth_date is null then null else extract(year from age(se.starts_on, p.birth_date))::int end as age,
  p.sex = 'F' as is_woman,
  (select r.rating from public.ratings r where r.profile_id = p.id and r.type = 'rapid') as rapid_rating
from totals t
join public.profiles p on p.id = t.profile_id
join public.seasons se on se.id = t.season_id
left join public.organizations o on o.id = p.club_id;
grant select on public.tour_standings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Calculs
-- ---------------------------------------------------------------------------
-- Points du Tour d'une étape, depuis le classement final du tournoi lié (idempotent).
create or replace function public.compute_tour_points(p_tournament uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare st public.tour_stages; sc public.scoring_scales; n int;
begin
  if not (private.is_admin_of('competitions') or private.can_manage_tournament(p_tournament)
          or coalesce(auth.role(), 'system') in ('service_role', 'system')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into st from public.tour_stages where tournament_id = p_tournament;
  if not found then return 0; end if;
  select * into sc from public.scoring_scales where id = st.scale_id;
  if not found then select * into sc from public.scoring_scales where is_default; end if;
  delete from public.tour_points where stage_id = st.id;
  insert into public.tour_points (stage_id, profile_id, rank, points)
  select st.id, s.player_id, s.rank,
    round(((coalesce(sc.places[s.rank], 0) + sc.participation) * st.coefficient)::numeric, 1)
  from public.standings s where s.tournament_id = p_tournament;
  get diagnostics n = row_count;
  update public.tour_stages set status = 'done' where id = st.id;
  return n;
end $$;
revoke execute on function public.compute_tour_points from anon, public;
grant execute on function public.compute_tour_points to authenticated;

-- Forfaits non justifiés d'un membre de ligue (recalculés depuis les appariements) ; exclusion au seuil.
create or replace function public.refresh_league_forfeits(p_league uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare lim int; n int;
begin
  if not (private.is_admin_of('competitions') or exists (
    select 1 from public.tournaments t where t.league_id = p_league and private.can_arbitrate(t.id))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce((se.league_rules ->> 'max_unjustified_forfeits')::int, 2) into lim
    from public.leagues l join public.seasons se on se.id = l.season_id where l.id = p_league;
  update public.league_members m set unjustified_forfeits = (
    select count(*) from public.pairings pr join public.tournaments t on t.id = pr.tournament_id
    where t.league_id = p_league
      and ((pr.white_id = m.profile_id and pr.result = '-+') or (pr.black_id = m.profile_id and pr.result = '+-'))
      and not exists (select 1 from public.league_postponements lp where lp.pairing_id = pr.id and lp.status = 'approved'))
  where m.league_id = p_league;
  update public.league_members set status = 'excluded'
    where league_id = p_league and status = 'active' and unjustified_forfeits >= lim;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.refresh_league_forfeits from anon, public;
grant execute on function public.refresh_league_forfeits to authenticated;

-- Licence de ligue : demande par le joueur (montant fixé par la saison, jamais par le navigateur).
create or replace function public.request_league_license(p_season uuid, p_profile uuid) returns public.league_licenses
language plpgsql security definer set search_path = '' as $$
declare se public.seasons; lic public.league_licenses;
begin
  if not private.manages_profile(p_profile) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into se from public.seasons where id = p_season;
  if not found or se.status = 'closed' then raise exception 'season_closed' using errcode = '22023'; end if;
  if se.license_fee_xof is null then raise exception 'fee_not_set' using errcode = '22023'; end if;
  insert into public.league_licenses (season_id, profile_id, amount_xof, status)
  values (se.id, p_profile, se.license_fee_xof, case when se.license_fee_xof = 0 then 'active' else 'pending_payment' end)
  on conflict (season_id, profile_id) do update set amount_xof = excluded.amount_xof
    where public.league_licenses.status = 'pending_payment'
  returning * into lic;
  if lic.id is null then select * into lic from public.league_licenses where season_id = se.id and profile_id = p_profile; end if;
  return lic;
end $$;
revoke execute on function public.request_league_license from anon, public;
grant execute on function public.request_league_license to authenticated;

-- Paiement des licences (extension de confirm_payment).
create or replace function public.confirm_payment(p_payment_id uuid, p_status text, p_provider_ref text, p_reason text default null)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if pay.status = 'succeeded' then return pay; end if;
  update public.payments set status = p_status, provider_ref = coalesce(p_provider_ref, provider_ref),
    confirmed_at = case when p_status = 'succeeded' then now() end, failure_reason = p_reason
  where id = pay.id returning * into pay;
  if pay.object_type = 'registration' then
    if p_status = 'succeeded' then
      update public.registrations set payment_status = 'paid',
        status = case when status = 'pending_payment' then
          case when (select validation_mode from public.tournaments t where t.id = registrations.tournament_id) = 'manual'
            then 'pending_validation'::public.registration_status else 'confirmed'::public.registration_status end
          else status end
      where id = pay.object_id;
    elsif p_status in ('failed', 'cancelled') then
      update public.registrations set payment_status = 'failed' where id = pay.object_id and payment_status = 'pending';
    end if;
  elsif pay.object_type = 'booking' and p_status = 'succeeded' then
    update public.bookings set status = 'confirmed' where id = pay.object_id and status = 'pending_payment';
  elsif pay.object_type = 'order' and p_status = 'succeeded' then
    perform private.order_paid(pay.object_id);
  elsif pay.object_type = 'league_license' and p_status = 'succeeded' then
    update public.league_licenses set status = 'active' where id = pay.object_id and status = 'pending_payment';
  end if;
  return pay;
end $$;
revoke execute on function public.confirm_payment from anon, authenticated, public;
grant execute on function public.confirm_payment to service_role;
