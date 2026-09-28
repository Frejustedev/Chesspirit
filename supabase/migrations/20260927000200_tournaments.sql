-- Chesspirit — tournois, inscriptions, rondes, appariements, parties, classements.

create type public.cadence as enum ('blitz', 'rapid', 'classical');
create type public.tournament_status as enum (
  'draft', 'published', 'registration_open', 'registration_closed', 'ongoing', 'finished', 'archived', 'cancelled'
);
create type public.registration_status as enum (
  'pending_payment', 'pending_validation', 'confirmed', 'waitlisted', 'cancelled', 'refused'
);
create type public.payment_status as enum ('not_required', 'pending', 'paid', 'due_on_site', 'refunded', 'failed');
create type public.game_result as enum ('1-0', '0-1', '1/2-1/2', '+-', '-+', '=-=', '0-0');

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 3 and 160),
  edition text,
  summary jsonb not null default '{}', -- {fr, en}
  description jsonb not null default '{}', -- {fr, en}
  venue text,
  address text,
  city text,
  country char(2) not null default 'BJ',
  lat double precision,
  lng double precision,
  starts_at timestamptz not null,
  ends_at timestamptz,
  checkin_opens_at timestamptz,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  cadence public.cadence,
  base_minutes int check (base_minutes between 1 and 240),
  increment_seconds int check (increment_seconds between 0 and 120),
  rounds_count int check (rounds_count between 1 and 40),
  pairing_system text not null default 'swiss_dutch' check (pairing_system in (
    'swiss_dutch', 'swiss_accelerated', 'round_robin', 'double_round_robin', 'knockout',
    'scheveningen', 'team_swiss', 'arena', 'pools_then_knockout', 'simul')),
  tiebreaks text[] not null default '{buchholz_cut1,buchholz,sonneborn_berger}',
  categories jsonb not null default '[]',
  conditions jsonb not null default '{}', -- {min_rating, max_rating, min_age, max_age, sex, league_id}
  entry_fee_xof int check (entry_fee_xof >= 0), -- null = à confirmer
  entry_fee_notes jsonb not null default '{}',
  capacity int check (capacity >= 1), -- null = non limité / à confirmer
  is_online boolean not null default false,
  rated boolean not null default false,
  counts_for_tour boolean not null default false,
  league_id uuid,
  status public.tournament_status not null default 'draft',
  validation_mode text not null default 'auto' check (validation_mode in ('auto', 'manual')),
  waitlist_enabled boolean not null default true,
  allow_online_payment boolean not null default true,
  allow_on_site_payment boolean not null default true,
  results_published boolean not null default false,
  organizer_profile_id uuid references public.profiles(id),
  organization_id uuid references public.organizations(id),
  poster_path text,
  contact_phone text,
  unconfirmed_fields text[] not null default '{}', -- champs explicitement « À confirmer »
  duplicated_from uuid references public.tournaments(id),
  is_demo boolean not null default false,
  search_text text generated always as (private.unaccent_lower(name || ' ' || coalesce(city, '') || ' ' || coalesce(venue, ''))) stored,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index tournaments_starts_idx on public.tournaments (starts_at);
create index tournaments_status_idx on public.tournaments (status);
create index tournaments_search_idx on public.tournaments using gin (search_text extensions.gin_trgm_ops);
create trigger tournaments_updated_at before update on public.tournaments
  for each row execute function private.set_updated_at();

create table public.tournament_staff (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('organizer', 'chief_arbiter', 'deputy_arbiter', 'operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, profile_id, role)
);
create trigger tournament_staff_updated_at before update on public.tournament_staff
  for each row execute function private.set_updated_at();

create table public.tournament_partners (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  role text not null default 'partner' check (role in ('partner', 'sponsor', 'host', 'media')),
  url text,
  logo_path text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tournament_partners_updated_at before update on public.tournament_partners
  for each row execute function private.set_updated_at();

create table public.prizes (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  kind text not null default 'rank' check (kind in ('rank', 'category', 'special')),
  rank int,
  category text, -- u18, women, veteran…
  label jsonb not null default '{}',
  amount_xof int check (amount_xof >= 0), -- null = à confirmer / en nature
  awarded_profile_id uuid references public.profiles(id),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger prizes_updated_at before update on public.prizes
  for each row execute function private.set_updated_at();

create table public.registration_forms (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null unique references public.tournaments(id) on delete cascade,
  fields jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger registration_forms_updated_at before update on public.registration_forms
  for each row execute function private.set_updated_at();

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  registered_by uuid references auth.users(id) default auth.uid(),
  status public.registration_status not null,
  payment_status public.payment_status not null default 'not_required',
  payment_method text not null default 'free' check (payment_method in ('online', 'on_site', 'free')),
  amount_xof int check (amount_xof >= 0),
  answers jsonb not null default '{}',
  ticket_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  seed_rating int,
  category text,
  waitlist_position int,
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id),
  notes text,
  source text not null default 'online' check (source in ('online', 'group', 'import', 'on_site', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, player_id)
);
create index registrations_tournament_idx on public.registrations (tournament_id, status);
create index registrations_player_idx on public.registrations (player_id);
create trigger registrations_updated_at before update on public.registrations
  for each row execute function private.set_updated_at();

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  number int not null check (number >= 1),
  status text not null default 'pending' check (status in ('pending', 'paired', 'ongoing', 'finished')),
  starts_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, number)
);
create trigger rounds_updated_at before update on public.rounds
  for each row execute function private.set_updated_at();

create table public.pairings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  board int not null check (board >= 0),
  white_id uuid not null references public.profiles(id),
  black_id uuid references public.profiles(id), -- null = exempt (bye)
  result public.game_result,
  bye_type text check (bye_type in ('full', 'half', 'zero')),
  is_manual boolean not null default false,
  updated_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((black_id is null) = (bye_type is not null)),
  check (black_id is null or black_id <> white_id)
);
create index pairings_round_idx on public.pairings (round_id, board);
create index pairings_players_idx on public.pairings (tournament_id, white_id, black_id);
create trigger pairings_updated_at before update on public.pairings
  for each row execute function private.set_updated_at();
create trigger pairings_audit after insert or update or delete on public.pairings
  for each row execute function private.audit_trigger();

create table public.games (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete set null,
  round_id uuid references public.rounds(id) on delete set null,
  pairing_id uuid references public.pairings(id) on delete set null,
  round_number int,
  board int,
  white_id uuid references public.profiles(id),
  black_id uuid references public.profiles(id),
  white_name text not null,
  black_name text not null,
  white_rating int,
  black_rating int,
  result text not null check (result in ('1-0', '0-1', '1/2-1/2', '*')),
  pgn text not null check (char_length(pgn) < 200000),
  eco text check (eco is null or eco ~ '^[A-E][0-9]{2}$'),
  opening text,
  moves_count int,
  played_on date,
  cadence public.cadence,
  source text not null default 'upload' check (source in ('upload', 'board_entry', 'lichess', 'import', 'ocr')),
  is_public boolean not null default true,
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index games_tournament_idx on public.games (tournament_id, round_number, board);
create index games_white_idx on public.games (white_id);
create index games_black_idx on public.games (black_id);
create index games_eco_idx on public.games (eco);
create trigger games_updated_at before update on public.games
  for each row execute function private.set_updated_at();

create table public.game_annotations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ply int not null default 0,
  comment text not null check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger game_annotations_updated_at before update on public.game_annotations
  for each row execute function private.set_updated_at();

create table public.standings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  rank int not null check (rank >= 1),
  points numeric(5, 1) not null check (points >= 0),
  games int,
  tiebreaks jsonb not null default '{}',
  performance int,
  rating_before int,
  rating_after int,
  rating_delta int,
  prize text,
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, player_id)
);
create index standings_tournament_idx on public.standings (tournament_id, rank);
create trigger standings_updated_at before update on public.standings
  for each row execute function private.set_updated_at();
create trigger standings_audit after insert or update or delete on public.standings
  for each row execute function private.audit_trigger();

create table public.posters (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  format text not null check (format in ('a3', 'a4', 'instagram_post', 'instagram_story', 'whatsapp_status', 'facebook_banner', 'results')),
  path text,
  template text not null default 'chesspirit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger posters_updated_at before update on public.posters
  for each row execute function private.set_updated_at();

-- Journal propre au tournoi (actions d'arbitrage lisibles par le staff).
create table public.tournament_audit (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  actor_user_id uuid default auth.uid(),
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tournament_audit_idx on public.tournament_audit (tournament_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Autorisations spécifiques aux tournois
-- ---------------------------------------------------------------------------
create or replace function private.can_manage_tournament(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin_of('competitions')
    or exists (select 1 from public.tournaments t where t.id = tid and t.organizer_profile_id = private.my_profile_id())
    or exists (select 1 from public.tournament_staff s
               where s.tournament_id = tid and s.role = 'organizer' and s.profile_id = private.my_profile_id())
$$;

-- Arbitres et opérateurs : appariements, résultats, pointage.
create or replace function private.can_arbitrate(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_manage_tournament(tid)
    or exists (select 1 from public.tournament_staff s
               where s.tournament_id = tid and s.profile_id = private.my_profile_id()
                 and s.role in ('chief_arbiter', 'deputy_arbiter', 'operator'))
$$;

create or replace function private.tournament_is_public(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tournaments t where t.id = tid and t.status <> 'draft')
$$;

create or replace function private.tournament_results_public(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tournaments t where t.id = tid and t.status <> 'draft'
                 and (t.results_published or t.status in ('ongoing', 'finished', 'archived')))
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
revoke all on public.registrations, public.tournament_audit, public.game_annotations from anon;

alter table public.tournaments enable row level security;
alter table public.tournament_staff enable row level security;
alter table public.tournament_partners enable row level security;
alter table public.prizes enable row level security;
alter table public.registration_forms enable row level security;
alter table public.registrations enable row level security;
alter table public.rounds enable row level security;
alter table public.pairings enable row level security;
alter table public.games enable row level security;
alter table public.game_annotations enable row level security;
alter table public.standings enable row level security;
alter table public.posters enable row level security;
alter table public.tournament_audit enable row level security;

create policy tournaments_select on public.tournaments for select to anon, authenticated
  using (status <> 'draft' or private.can_arbitrate(id));
create policy tournaments_insert on public.tournaments for insert to authenticated
  with check (private.is_admin_of('competitions')
    or (private.has_role('organizer') and organizer_profile_id = private.my_profile_id()));
create policy tournaments_update on public.tournaments for update to authenticated
  using (private.can_manage_tournament(id)) with check (private.can_manage_tournament(id));
create policy tournaments_delete on public.tournaments for delete to authenticated
  using (private.is_admin_of('competitions') or (status = 'draft' and private.can_manage_tournament(id)));
create trigger tournaments_audit after insert or update or delete on public.tournaments
  for each row execute function private.audit_trigger();

create policy staff_select on public.tournament_staff for select to anon, authenticated
  using (private.tournament_is_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy staff_write on public.tournament_staff for all to authenticated
  using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));
create trigger tournament_staff_audit after insert or update or delete on public.tournament_staff
  for each row execute function private.audit_trigger();

create policy partners_select on public.tournament_partners for select to anon, authenticated
  using (private.tournament_is_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy partners_write on public.tournament_partners for all to authenticated
  using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));

create policy prizes_select on public.prizes for select to anon, authenticated
  using (private.tournament_is_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy prizes_write on public.prizes for all to authenticated
  using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));

create policy forms_select on public.registration_forms for select to anon, authenticated
  using (private.tournament_is_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy forms_write on public.registration_forms for all to authenticated
  using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));

-- Inscriptions : lecture par le joueur (ou son parent) et le staff ; écriture via fonctions.
create policy registrations_select on public.registrations for select to authenticated
  using (private.manages_profile(player_id) or registered_by = auth.uid() or private.can_arbitrate(tournament_id));
create policy registrations_staff_update on public.registrations for update to authenticated
  using (private.can_arbitrate(tournament_id)) with check (private.can_arbitrate(tournament_id));
create policy registrations_staff_delete on public.registrations for delete to authenticated
  using (private.can_manage_tournament(tournament_id));
create trigger registrations_audit after update or delete on public.registrations
  for each row execute function private.audit_trigger();

create policy rounds_select on public.rounds for select to anon, authenticated
  using (private.tournament_results_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy rounds_write on public.rounds for all to authenticated
  using (private.can_arbitrate(tournament_id)) with check (private.can_arbitrate(tournament_id));

create policy pairings_select on public.pairings for select to anon, authenticated
  using (
    (private.tournament_results_public(tournament_id)
      and exists (select 1 from public.rounds r where r.id = round_id and r.published_at is not null))
    or private.can_arbitrate(tournament_id));
create policy pairings_write on public.pairings for all to authenticated
  using (private.can_arbitrate(tournament_id)) with check (private.can_arbitrate(tournament_id));

create policy games_select on public.games for select to anon, authenticated
  using (
    (is_public and (tournament_id is null or private.tournament_results_public(tournament_id)))
    or private.manages_profile(white_id) or private.manages_profile(black_id)
    or (tournament_id is not null and private.can_arbitrate(tournament_id))
    or private.is_admin());
create policy games_write on public.games for all to authenticated
  using ((tournament_id is not null and private.can_arbitrate(tournament_id)) or private.is_admin())
  with check ((tournament_id is not null and private.can_arbitrate(tournament_id)) or private.is_admin());
create trigger games_audit after update or delete on public.games
  for each row execute function private.audit_trigger();

create policy annotations_own on public.game_annotations for all to authenticated
  using (private.manages_profile(profile_id)) with check (private.manages_profile(profile_id));

create policy standings_select on public.standings for select to anon, authenticated
  using (private.tournament_results_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy standings_write on public.standings for all to authenticated
  using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));

create policy posters_select on public.posters for select to anon, authenticated
  using (private.tournament_is_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy posters_write on public.posters for all to authenticated
  using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));

create policy tournament_audit_select on public.tournament_audit for select to authenticated
  using (private.can_arbitrate(tournament_id));
create policy tournament_audit_insert on public.tournament_audit for insert to authenticated
  with check (private.can_arbitrate(tournament_id) and actor_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Vues publiques
-- ---------------------------------------------------------------------------
create view public.public_registrations with (security_barrier = true) as
select r.tournament_id, r.id as registration_id, p.id as player_id, private.display_name(p) as display_name,
  coalesce(p.club_name, o.name) as club, p.city, r.seed_rating, p.titles, p.fide_id,
  case when p.is_minor then null else p.sex end as sex, r.status, r.created_at
from public.registrations r
join public.profiles p on p.id = r.player_id
left join public.organizations o on o.id = p.club_id
join public.tournaments t on t.id = r.tournament_id and t.status <> 'draft'
where r.status in ('confirmed', 'pending_validation', 'waitlisted', 'pending_payment');
grant select on public.public_registrations to anon, authenticated;

create view public.public_standings with (security_barrier = true) as
select s.tournament_id, s.rank, s.points, s.games, s.tiebreaks, s.performance, s.rating_before, s.rating_after,
  s.rating_delta, s.prize, s.is_final, p.id as player_id, private.display_name(p) as display_name,
  coalesce(p.club_name, o.name) as club, p.titles, p.fide_id,
  case when p.is_minor then null else p.sex end as sex
from public.standings s
join public.profiles p on p.id = s.player_id
left join public.organizations o on o.id = p.club_id
join public.tournaments t on t.id = s.tournament_id and t.status <> 'draft'
  and (t.results_published or t.status in ('ongoing', 'finished', 'archived'));
grant select on public.public_standings to anon, authenticated;

create view public.public_pairings with (security_barrier = true) as
select pr.id, pr.tournament_id, r.number as round_number, pr.board, pr.result, pr.bye_type,
  pr.white_id, private.display_name(w) as white_name,
  pr.black_id, case when b.id is null then null else private.display_name(b) end as black_name
from public.pairings pr
join public.rounds r on r.id = pr.round_id and r.published_at is not null
join public.profiles w on w.id = pr.white_id
left join public.profiles b on b.id = pr.black_id
join public.tournaments t on t.id = pr.tournament_id and t.status <> 'draft';
grant select on public.public_pairings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions métier
-- ---------------------------------------------------------------------------

-- Inscription : vérifie les droits, les conditions, la capacité (verrou), calcule le montant.
create or replace function public.register_for_tournament(
  p_tournament_id uuid,
  p_player_id uuid,
  p_answers jsonb default '{}',
  p_payment_method text default 'online'
) returns public.registrations
language plpgsql security definer set search_path = '' as $$
declare
  t public.tournaments;
  p public.profiles;
  r public.registrations;
  v_confirmed int;
  v_status public.registration_status;
  v_payment public.payment_status;
  v_age int;
  v_is_staff boolean;
  v_amount int;
  v_rating int;
  v_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  select * into t from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'tournament_not_found' using errcode = 'P0002';
  end if;
  v_is_staff := private.can_arbitrate(t.id);
  if not (private.manages_profile(p_player_id) or v_is_staff) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if t.status <> 'registration_open' and not v_is_staff then
    raise exception 'registration_closed' using errcode = 'P0001';
  end if;
  if not v_is_staff and (
    (t.registration_opens_at is not null and now() < t.registration_opens_at)
    or (t.registration_closes_at is not null and now() > t.registration_closes_at)) then
    raise exception 'registration_closed' using errcode = 'P0001';
  end if;
  select * into p from public.profiles where id = p_player_id;
  if p.birth_date is null or p.sex is null then
    raise exception 'profile_incomplete' using errcode = 'P0001';
  end if;
  v_age := extract(year from age(t.starts_at::date, p.birth_date))::int;
  if (t.conditions ? 'min_age' and v_age < (t.conditions ->> 'min_age')::int)
     or (t.conditions ? 'max_age' and v_age > (t.conditions ->> 'max_age')::int)
     or (t.conditions ? 'sex' and p.sex::text <> t.conditions ->> 'sex') then
    raise exception 'conditions_not_met' using errcode = 'P0001';
  end if;
  if p_payment_method not in ('online', 'on_site', 'free') then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  select * into r from public.registrations where tournament_id = t.id and player_id = p.id;
  v_exists := found;
  if v_exists and r.status not in ('cancelled', 'refused') then
    return r; -- déjà inscrit : idempotent
  end if;

  select count(*) into v_confirmed from public.registrations
    where tournament_id = t.id and status in ('confirmed', 'pending_payment', 'pending_validation');

  v_amount := t.entry_fee_xof;
  if coalesce(v_amount, 0) = 0 and v_amount is not null then
    v_payment := 'not_required';
    p_payment_method := 'free';
  elsif p_payment_method = 'online' and t.allow_online_payment and v_amount is not null then
    v_payment := 'pending';
  elsif p_payment_method = 'on_site' and t.allow_on_site_payment then
    v_payment := 'due_on_site';
  elsif v_amount is null and t.allow_on_site_payment then
    -- Frais « à confirmer » : réglés sur place.
    v_payment := 'due_on_site';
    p_payment_method := 'on_site';
  else
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  if t.capacity is not null and v_confirmed >= t.capacity then
    if not t.waitlist_enabled then
      raise exception 'tournament_full' using errcode = 'P0001';
    end if;
    v_status := 'waitlisted';
  elsif v_payment = 'pending' then
    v_status := 'pending_payment';
  elsif t.validation_mode = 'manual' and not v_is_staff then
    v_status := 'pending_validation';
  else
    v_status := 'confirmed';
  end if;

  v_rating := coalesce(
    (select rt.rating from public.ratings rt where rt.profile_id = p.id and rt.type = t.cadence::text::public.rating_type),
    (select case t.cadence when 'blitz' then fr.blitz when 'rapid' then fr.rapid else fr.standard end
       from public.fide_ratings fr where fr.fide_id = p.fide_id order by fr.period desc limit 1));

  if v_exists then
    update public.registrations set status = v_status, payment_status = v_payment, payment_method = p_payment_method,
      amount_xof = v_amount, answers = coalesce(p_answers, '{}'), seed_rating = v_rating,
      waitlist_position = case when v_status = 'waitlisted' then v_confirmed - t.capacity + 1 end
    where id = r.id returning * into r;
  else
    insert into public.registrations (tournament_id, player_id, status, payment_status, payment_method, amount_xof,
      answers, seed_rating, waitlist_position, source)
    values (t.id, p.id, v_status, v_payment, p_payment_method, v_amount, coalesce(p_answers, '{}'), v_rating,
      case when v_status = 'waitlisted' then v_confirmed - t.capacity + 1 end,
      case when v_is_staff and not private.manages_profile(p.id) then 'on_site' else 'online' end)
    returning * into r;
  end if;
  return r;
end $$;
revoke execute on function public.register_for_tournament from anon, public;
grant execute on function public.register_for_tournament to authenticated;

create or replace function public.cancel_registration(p_registration_id uuid) returns public.registrations
language plpgsql security definer set search_path = '' as $$
declare
  r public.registrations;
begin
  select * into r from public.registrations where id = p_registration_id for update;
  if not found or not (private.manages_profile(r.player_id) or private.can_arbitrate(r.tournament_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.registrations set status = 'cancelled' where id = r.id returning * into r;
  -- Promotion du premier de la liste d'attente.
  update public.registrations set status = case when payment_status = 'pending' then 'pending_payment'::public.registration_status else 'confirmed'::public.registration_status end,
    waitlist_position = null
  where id = (select id from public.registrations where tournament_id = r.tournament_id and status = 'waitlisted'
              order by waitlist_position nulls last, created_at limit 1);
  return r;
end $$;
revoke execute on function public.cancel_registration from anon, public;
grant execute on function public.cancel_registration to authenticated;

-- Pointage par QR code (arbitres, organisateurs, administrateurs).
create or replace function public.check_in(p_ticket_code text, p_mark_paid boolean default false)
returns table (registration_id uuid, tournament_id uuid, display_name text, status public.registration_status,
  payment_status public.payment_status, checked_in_at timestamptz, already boolean)
language plpgsql security definer set search_path = '' as $$
declare
  r public.registrations;
  v_already boolean;
begin
  select * into r from public.registrations where ticket_code = upper(trim(p_ticket_code)) for update;
  if not found then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;
  if not private.can_arbitrate(r.tournament_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_already := r.checked_in_at is not null;
  update public.registrations set
    checked_in_at = coalesce(r.checked_in_at, now()),
    checked_in_by = coalesce(r.checked_in_by, auth.uid()),
    payment_status = case when p_mark_paid and r.payment_status = 'due_on_site' then 'paid' else r.payment_status end
  where id = r.id returning * into r;
  insert into public.tournament_audit (tournament_id, action, details)
    values (r.tournament_id, 'check_in', jsonb_build_object('registration_id', r.id, 'mark_paid', p_mark_paid));
  return query select r.id, r.tournament_id, private.display_name(p), r.status, r.payment_status, r.checked_in_at, v_already
    from public.profiles p where p.id = r.player_id;
end $$;
revoke execute on function public.check_in from anon, public;
grant execute on function public.check_in to authenticated;

-- Billet : informations minimales accessibles avec le code (non devinable).
create or replace function public.ticket_info(p_ticket_code text)
returns table (display_name text, tournament_name text, tournament_slug text, starts_at timestamptz, venue text,
  status public.registration_status, payment_status public.payment_status, checked_in boolean)
language sql stable security definer set search_path = '' as $$
  select private.display_name(p), t.name, t.slug, t.starts_at, t.venue, r.status, r.payment_status, r.checked_in_at is not null
  from public.registrations r
  join public.profiles p on p.id = r.player_id
  join public.tournaments t on t.id = r.tournament_id
  where r.ticket_code = upper(trim(p_ticket_code))
$$;
grant execute on function public.ticket_info to anon, authenticated;

-- Import du classement final (CSV ou saisie) : rapproche ou crée des profils « importés ».
create or replace function public.import_standings(p_tournament_id uuid, p_rows jsonb, p_publish boolean default true)
returns int language plpgsql security definer set search_path = '' as $$
declare
  row jsonb;
  v_pid uuid;
  v_first text;
  v_last text;
  v_name text;
  n int := 0;
begin
  if not private.can_manage_tournament(p_tournament_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.standings where tournament_id = p_tournament_id;
  for row in select * from jsonb_array_elements(p_rows) loop
    v_pid := nullif(row ->> 'player_id', '')::uuid;
    v_name := trim(row ->> 'name');
    if v_pid is null and nullif(row ->> 'fide_id', '') is not null then
      select id into v_pid from public.profiles where fide_id = row ->> 'fide_id' and merged_into is null limit 1;
    end if;
    if v_pid is null then
      -- Rapprochement par inscription au tournoi puis par nom exact normalisé.
      select p.id into v_pid from public.registrations r join public.profiles p on p.id = r.player_id
        where r.tournament_id = p_tournament_id
          and private.unaccent_lower(p.first_name || ' ' || p.last_name) in (private.unaccent_lower(v_name),
            private.unaccent_lower(split_part(v_name, ',', 2) || ' ' || split_part(v_name, ',', 1)))
        limit 1;
    end if;
    if v_pid is null then
      if position(',' in v_name) > 0 then
        v_last := trim(split_part(v_name, ',', 1)); v_first := trim(split_part(v_name, ',', 2));
      else
        v_first := split_part(v_name, ' ', 1); v_last := nullif(trim(substr(v_name, length(v_first) + 1)), '');
      end if;
      insert into public.profiles (first_name, last_name, source, club_name, fide_id, phone)
      values (coalesce(nullif(v_first, ''), v_name), coalesce(v_last, '—'), 'import', nullif(row ->> 'club', ''),
        nullif(row ->> 'fide_id', ''), nullif(row ->> 'phone', ''))
      returning id into v_pid;
    end if;
    insert into public.standings (tournament_id, player_id, rank, points, games, tiebreaks, rating_before, prize, is_final)
    values (p_tournament_id, v_pid, (row ->> 'rank')::int, (row ->> 'points')::numeric,
      nullif(row ->> 'games', '')::int, coalesce(row -> 'tiebreaks', '{}'), nullif(row ->> 'rating', '')::int,
      nullif(row ->> 'prize', ''), true)
    on conflict (tournament_id, player_id) do update set rank = excluded.rank, points = excluded.points;
    n := n + 1;
  end loop;
  if p_publish then
    update public.tournaments set results_published = true,
      status = case when status in ('ongoing', 'registration_closed', 'registration_open', 'published') then 'finished' else status end
    where id = p_tournament_id;
  end if;
  insert into public.tournament_audit (tournament_id, action, details)
    values (p_tournament_id, 'import_standings', jsonb_build_object('rows', n));
  return n;
end $$;
revoke execute on function public.import_standings from anon, public;
grant execute on function public.import_standings to authenticated;

-- Le staff d'un tournoi voit la fiche des joueurs inscrits (pointage, contact, appariements).
create or replace function private.staff_sees_profile(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.registrations r where r.player_id = pid and private.can_arbitrate(r.tournament_id))
$$;
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (private.manages_profile(id) or private.is_admin() or private.staff_sees_profile(id));
