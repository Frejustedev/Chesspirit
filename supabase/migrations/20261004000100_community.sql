-- Communauté : adhésion (gratuite ou premium), carte de membre, badges, parrainage, ambassadeurs,
-- Chesspirit Awards, pronostics gratuits, partie « Le public contre le maître ».

-- Adhésion -------------------------------------------------------------------------
create table public.membership_plans (
  code text primary key check (code in ('free', 'premium')),
  name jsonb not null,
  description jsonb not null default '{}',
  benefits jsonb not null default '[]',
  price_xof int check (price_xof >= 0), -- null = à confirmer
  duration_months int check (duration_months between 1 and 36),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger membership_plans_updated_at before update on public.membership_plans for each row execute function private.set_updated_at();
insert into public.membership_plans (code, name, description, benefits, price_xof, duration_months) values
  ('free', '{"fr":"Membre","en":"Member"}', '{"fr":"Adhésion gratuite à la communauté Chesspirit.","en":"Free membership of the Chesspirit community."}',
   '[{"fr":"Carte de membre numérique","en":"Digital member card"},{"fr":"Niveaux, badges et pronostics","en":"Levels, badges and predictions"},{"fr":"Leçons gratuites et puzzle du jour","en":"Free lessons and daily puzzle"}]', 0, null),
  ('premium', '{"fr":"Membre premium","en":"Premium member"}', '{"fr":"Tout le contenu premium de l''académie.","en":"All premium academy content."}',
   '[{"fr":"Cours et ressources premium","en":"Premium courses and resources"},{"fr":"Badge premium","en":"Premium badge"},{"fr":"Tous les avantages membre","en":"All member benefits"}]', null, 12);

create sequence public.member_card_seq start 1001;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null references public.membership_plans(code),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'active', 'expired', 'cancelled')),
  card_number text not null unique default ('CSP-' || lpad(nextval('public.member_card_seq')::text, 6, '0')),
  amount_xof int not null default 0,
  starts_on date,
  ends_on date,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index memberships_profile_idx on public.memberships (profile_id, status);
create trigger memberships_updated_at before update on public.memberships for each row execute function private.set_updated_at();

create or replace function private.has_premium(p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.profile_id = p_profile and m.plan = 'premium'
    and m.status = 'active' and (m.ends_on is null or m.ends_on >= current_date))
$$;

-- Demande d'adhésion : gratuite immédiatement active, premium au tarif fixé par la base.
create or replace function public.request_membership(p_plan text) returns public.memberships
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.my_profile_id();
  pl public.membership_plans;
  m public.memberships;
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select * into pl from public.membership_plans where code = p_plan and is_active;
  if not found then raise exception 'invalid_plan' using errcode = '22023'; end if;
  if pl.price_xof is null then raise exception 'price_not_set' using errcode = '22023'; end if;
  select * into m from public.memberships where profile_id = me and plan = p_plan
    and (status = 'pending_payment' or (status = 'active' and (ends_on is null or ends_on >= current_date)))
    order by created_at desc limit 1;
  if found then return m; end if;
  insert into public.memberships (profile_id, plan, status, amount_xof, starts_on, ends_on)
  values (me, p_plan, case when pl.price_xof = 0 then 'active' else 'pending_payment' end, pl.price_xof,
    case when pl.price_xof = 0 then current_date end,
    case when pl.price_xof = 0 and pl.duration_months is not null then current_date + make_interval(months => pl.duration_months) end)
  returning * into m;
  return m;
end $$;
revoke execute on function public.request_membership from anon, public;
grant execute on function public.request_membership to authenticated;

create or replace function private.membership_paid(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare m public.memberships; dur int;
begin
  select * into m from public.memberships where id = p_id for update;
  if not found or m.status <> 'pending_payment' then return false; end if;
  select duration_months into dur from public.membership_plans where code = m.plan;
  update public.memberships set status = 'active', starts_on = current_date,
    ends_on = case when dur is null then null else current_date + make_interval(months => dur) end
  where id = m.id;
  return true;
end $$;
revoke execute on function private.membership_paid(uuid) from public, anon, authenticated;

-- Contenu premium : le texte n'est lisible qu'avec l'adhésion premium (catalogue public sans le texte).
drop policy lessons_read on public.lessons_library;
create policy lessons_read on public.lessons_library for select to anon, authenticated
  using (status = 'published' and (not is_premium or private.has_premium(private.my_profile_id())));
drop policy resources_read on public.resources;
create policy resources_read on public.resources for select to anon, authenticated
  using (status = 'published' and (not is_premium or private.has_premium(private.my_profile_id())));
create view public.lesson_catalog with (security_barrier = true) as
select id, slug, level, theme, title, summary, position, is_premium from public.lessons_library where status = 'published';
grant select on public.lesson_catalog to anon, authenticated;
create view public.resource_catalog with (security_barrier = true) as
select id, title, description, kind, level, language, is_premium, created_at,
  case when is_premium then null else url end as url
from public.resources where status = 'published';
grant select on public.resource_catalog to anon, authenticated;

-- Badges -------------------------------------------------------------------------------
create table public.badges (
  code text primary key check (code ~ '^[a-z0-9_:-]{2,60}$'),
  name jsonb not null,
  description jsonb not null default '{}',
  category text not null default 'general' check (category in ('general', 'competition', 'academy', 'community', 'tour')),
  icon text not null default 'p' check (icon in ('p', 'n', 'b', 'r', 'q', 'k')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create table public.user_badges (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  badge_code text not null references public.badges(code) on delete cascade,
  awarded_at timestamptz not null default now(),
  context text,
  primary key (profile_id, badge_code)
);
insert into public.badges (code, name, description, category, icon, position) values
  ('member', '{"fr":"Membre","en":"Member"}', '{"fr":"A rejoint la communauté Chesspirit.","en":"Joined the Chesspirit community."}', 'community', 'p', 1),
  ('premium', '{"fr":"Premium","en":"Premium"}', '{"fr":"Membre premium.","en":"Premium member."}', 'community', 'q', 2),
  ('first_tournament', '{"fr":"Premier tournoi","en":"First tournament"}', '{"fr":"A joué un premier tournoi.","en":"Played a first tournament."}', 'competition', 'p', 10),
  ('ten_tournaments', '{"fr":"Habitué","en":"Regular"}', '{"fr":"Dix tournois joués.","en":"Ten tournaments played."}', 'competition', 'r', 11),
  ('podium', '{"fr":"Podium","en":"Podium"}', '{"fr":"Termine dans les trois premiers d''un tournoi.","en":"Finished in the top three of a tournament."}', 'competition', 'b', 12),
  ('winner', '{"fr":"Vainqueur","en":"Winner"}', '{"fr":"A remporté un tournoi.","en":"Won a tournament."}', 'competition', 'k', 13),
  ('league_player', '{"fr":"Joueur de ligue","en":"League player"}', '{"fr":"Membre d''une ligue Chesspirit.","en":"Member of a Chesspirit league."}', 'competition', 'n', 14),
  ('puzzle_10', '{"fr":"Chercheur","en":"Solver"}', '{"fr":"Dix puzzles résolus.","en":"Ten puzzles solved."}', 'academy', 'n', 20),
  ('puzzle_100', '{"fr":"Tacticien","en":"Tactician"}', '{"fr":"Cent puzzles résolus.","en":"A hundred puzzles solved."}', 'academy', 'q', 21),
  ('ambassador', '{"fr":"Ambassadeur","en":"Ambassador"}', '{"fr":"Ambassadeur de Chesspirit.","en":"Chesspirit ambassador."}', 'community', 'k', 30),
  ('referrer_3', '{"fr":"Parrain","en":"Referrer"}', '{"fr":"Trois personnes parrainées.","en":"Three people referred."}', 'community', 'b', 31);

-- Passeport du circuit : un badge par ville d'étape du Tour jouée.
create or replace function public.refresh_badges(p_profile uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; k int; c record;
begin
  if not (private.manages_profile(p_profile) or private.is_admin() or coalesce(auth.role(), 'system') in ('service_role', 'system')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.user_badges (profile_id, badge_code)
  select p_profile, b from (values
    ('member', exists (select 1 from public.memberships where profile_id = p_profile and status = 'active')),
    ('premium', private.has_premium(p_profile)),
    ('first_tournament', (select count(*) from public.standings where player_id = p_profile) >= 1),
    ('ten_tournaments', (select count(*) from public.standings where player_id = p_profile) >= 10),
    ('podium', exists (select 1 from public.standings s join public.tournaments t on t.id = s.tournament_id
      where s.player_id = p_profile and s.rank <= 3 and s.is_final and not t.is_online)),
    ('winner', exists (select 1 from public.standings s where s.player_id = p_profile and s.rank = 1 and s.is_final)),
    ('league_player', exists (select 1 from public.league_members where profile_id = p_profile)),
    ('puzzle_10', (select count(distinct puzzle_id) from public.puzzle_attempts where profile_id = p_profile and solved) >= 10),
    ('puzzle_100', (select count(distinct puzzle_id) from public.puzzle_attempts where profile_id = p_profile and solved) >= 100),
    ('ambassador', exists (select 1 from public.ambassadors where profile_id = p_profile and status = 'approved')),
    ('referrer_3', (select count(*) from public.referrals where referrer_id = p_profile) >= 3)
  ) as x(b, ok)
  where ok on conflict do nothing;
  get diagnostics k = row_count;
  n := n + k;
  for c in
    select distinct lower(regexp_replace(st.city, '[^A-Za-z0-9]+', '-', 'g')) as slug, st.city
    from public.tour_points tp join public.tour_stages st on st.id = tp.stage_id
    where tp.profile_id = p_profile and st.city is not null
  loop
    insert into public.badges (code, name, description, category, icon, position)
    values ('tour:' || c.slug, jsonb_build_object('fr', 'Tour : ' || c.city, 'en', 'Tour: ' || c.city),
      jsonb_build_object('fr', 'A joué l''étape de ' || c.city || '.', 'en', 'Played the ' || c.city || ' stage.'), 'tour', 'r', 50)
    on conflict (code) do nothing;
    insert into public.user_badges (profile_id, badge_code, context) values (p_profile, 'tour:' || c.slug, c.city)
    on conflict do nothing;
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return n;
end $$;
revoke execute on function public.refresh_badges from anon, public;
grant execute on function public.refresh_badges to authenticated, service_role;

-- Parrainage et ambassadeurs ----------------------------------------------------------------
create table public.referral_codes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz not null default now()
);
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);
create table public.ambassadors (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  city text,
  motivation text check (char_length(motivation) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger ambassadors_updated_at before update on public.ambassadors for each row execute function private.set_updated_at();

create or replace function public.my_referral_code() returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := private.my_profile_id(); c text;
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select code into c from public.referral_codes where profile_id = me;
  if c is null then
    loop
      c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      exit when length(c) = 8 and not exists (select 1 from public.referral_codes where code = c);
    end loop;
    insert into public.referral_codes (profile_id, code) values (me, c);
  end if;
  return c;
end $$;
revoke execute on function public.my_referral_code from anon, public;
grant execute on function public.my_referral_code to authenticated;

-- Parrainage enregistré une seule fois, dans les 30 jours suivant la création du profil.
create or replace function public.claim_referral(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; ref uuid;
begin
  select * into me from public.profiles where id = private.my_profile_id();
  if me.id is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select profile_id into ref from public.referral_codes where code = upper(trim(p_code));
  if ref is null or ref = me.id or me.created_at < now() - interval '30 days' then return false; end if;
  insert into public.referrals (referrer_id, referred_id) values (ref, me.id) on conflict (referred_id) do nothing;
  return found;
end $$;
revoke execute on function public.claim_referral from anon, public;
grant execute on function public.claim_referral to authenticated;

-- Chesspirit Awards ------------------------------------------------------------------------
create table public.award_editions (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'voting', 'closed')),
  voting_ends_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger award_editions_updated_at before update on public.award_editions for each row execute function private.set_updated_at();
create table public.award_categories (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.award_editions(id) on delete cascade,
  name jsonb not null,
  description jsonb not null default '{}',
  position int not null default 0
);
create table public.award_nominees (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.award_categories(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  description text check (char_length(description) <= 500)
);
create table public.award_votes (
  category_id uuid not null references public.award_categories(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  nominee_id uuid not null references public.award_nominees(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (category_id, voter_id)
);

-- Vote : une voix par catégorie et par compte, modifiable tant que le vote est ouvert.
create or replace function public.cast_award_vote(p_nominee uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := private.my_profile_id(); n public.award_nominees; e public.award_editions;
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select * into n from public.award_nominees where id = p_nominee;
  select ed.* into e from public.award_editions ed join public.award_categories c on c.edition_id = ed.id where c.id = n.category_id;
  if e.id is null or e.status <> 'voting' or (e.voting_ends_at is not null and e.voting_ends_at < now()) then
    raise exception 'voting_closed' using errcode = '22023';
  end if;
  insert into public.award_votes (category_id, voter_id, nominee_id) values (n.category_id, me, n.id)
  on conflict (category_id, voter_id) do update set nominee_id = excluded.nominee_id, created_at = now();
end $$;
revoke execute on function public.cast_award_vote from anon, public;
grant execute on function public.cast_award_vote to authenticated;

-- Résultats publiés seulement après la clôture.
create or replace function public.award_results(p_edition uuid)
returns table (category_id uuid, nominee_id uuid, votes bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, n.id, count(v.voter_id)
  from public.award_categories c
  join public.award_editions e on e.id = c.edition_id
  join public.award_nominees n on n.category_id = c.id
  left join public.award_votes v on v.nominee_id = n.id
  where c.edition_id = p_edition and (e.status = 'closed' or private.is_admin())
  group by c.id, n.id
$$;
grant execute on function public.award_results to anon, authenticated;

-- Pronostics (gratuits, sans enjeu d'argent) ---------------------------------------------------
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  pairing_id uuid not null references public.pairings(id) on delete cascade,
  predicted text not null check (predicted in ('1-0', '1/2-1/2', '0-1')),
  points int not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, pairing_id)
);
create index predictions_pairing_idx on public.predictions (pairing_id);

-- Pronostic possible tant que la partie n'a pas de résultat et au plus 15 min après la publication de la ronde.
create or replace function public.predict(p_pairing uuid, p_result text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := private.my_profile_id(); ok boolean;
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select pr.result is null and pr.black_id is not null and r.published_at is not null
      and r.published_at > now() - interval '15 minutes' and pr.white_id <> me and pr.black_id <> me
    into ok
    from public.pairings pr join public.rounds r on r.id = pr.round_id where pr.id = p_pairing;
  if not coalesce(ok, false) then raise exception 'prediction_closed' using errcode = '22023'; end if;
  insert into public.predictions (profile_id, pairing_id, predicted) values (me, p_pairing, p_result)
  on conflict (profile_id, pairing_id) do update set predicted = excluded.predicted, created_at = now();
end $$;
revoke execute on function public.predict from anon, public;
grant execute on function public.predict to authenticated;

-- Points attribués à la saisie du résultat (1 point par bon pronostic).
create or replace function private.score_predictions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.predictions set points = case when new.result::text = predicted then 1 else 0 end
  where pairing_id = new.id;
  return new;
end $$;
create trigger pairings_score_predictions after update of result on public.pairings
  for each row execute function private.score_predictions();

create view public.prediction_leaderboard with (security_barrier = true) as
select p.id as profile_id, private.display_name(p) as display_name, sum(pr.points) as points, count(*) as predictions
from public.predictions pr join public.profiles p on p.id = pr.profile_id and p.is_public
group by p.id;
grant select on public.prediction_leaderboard to anon, authenticated;

-- Le public contre le maître ------------------------------------------------------------------
create table public.pvm_games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title jsonb not null,
  master_name text not null,
  master_profile_id uuid references public.profiles(id) on delete set null,
  public_color char(1) not null default 'w' check (public_color in ('w', 'b')),
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves text[] not null default '{}',
  status text not null default 'open' check (status in ('draft', 'open', 'finished')),
  result text,
  vote_minutes int not null default 1440 check (vote_minutes between 5 and 10080),
  vote_ends_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger pvm_games_updated_at before update on public.pvm_games for each row execute function private.set_updated_at();
create table public.pvm_votes (
  game_id uuid not null references public.pvm_games(id) on delete cascade,
  ply int not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  move text not null check (move ~ '^[a-h][1-8][a-h][1-8][qrbn]?$'),
  created_at timestamptz not null default now(),
  primary key (game_id, ply, profile_id)
);

-- Vote du public pour le coup à jouer (la légalité est vérifiée à la clôture du vote).
create or replace function public.pvm_vote(p_game uuid, p_move text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := private.my_profile_id(); g public.pvm_games;
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select * into g from public.pvm_games where id = p_game;
  if g.id is null or g.status <> 'open' or split_part(g.fen, ' ', 2) <> g.public_color
     or (g.vote_ends_at is not null and g.vote_ends_at < now()) then
    raise exception 'vote_closed' using errcode = '22023';
  end if;
  insert into public.pvm_votes (game_id, ply, profile_id, move) values (g.id, coalesce(array_length(g.moves, 1), 0), me, p_move)
  on conflict (game_id, ply, profile_id) do update set move = excluded.move, created_at = now();
end $$;
revoke execute on function public.pvm_vote from anon, public;
grant execute on function public.pvm_vote to authenticated;

create or replace function public.pvm_tally(p_game uuid)
returns table (move text, votes bigint)
language sql stable security definer set search_path = '' as $$
  select v.move, count(*) from public.pvm_votes v join public.pvm_games g on g.id = v.game_id
  where v.game_id = p_game and v.ply = coalesce(array_length(g.moves, 1), 0)
  group by v.move order by 2 desc, 1
$$;
grant execute on function public.pvm_tally to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Autorisations
-- ---------------------------------------------------------------------------
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.ambassadors enable row level security;
alter table public.award_editions enable row level security;
alter table public.award_categories enable row level security;
alter table public.award_nominees enable row level security;
alter table public.award_votes enable row level security;
alter table public.predictions enable row level security;
alter table public.pvm_games enable row level security;
alter table public.pvm_votes enable row level security;
revoke insert, update, delete on public.membership_plans, public.badges, public.user_badges, public.award_editions,
  public.award_categories, public.award_nominees, public.pvm_games from anon;
revoke all on public.memberships, public.referral_codes, public.referrals, public.ambassadors, public.award_votes,
  public.predictions, public.pvm_votes from anon;

-- Points d'expérience (niveaux du Pion au Roi calculés par l'application).
create or replace function public.member_progress(p_profile uuid)
returns table (tournaments bigint, games bigint, puzzles bigint, lessons_booked bigint, predictions bigint)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.standings where player_id = p_profile),
    (select count(*) from public.pairings where (white_id = p_profile or black_id = p_profile) and result is not null),
    (select count(distinct puzzle_id) from public.puzzle_attempts where profile_id = p_profile and solved),
    (select count(*) from public.bookings where student_id = p_profile and status in ('confirmed', 'completed')),
    (select count(*) from public.predictions where profile_id = p_profile and points > 0)
  where exists (select 1 from public.public_profiles pp where pp.id = p_profile) or private.manages_profile(p_profile) or private.is_admin()
$$;
grant execute on function public.member_progress to anon, authenticated;


create policy plans_read on public.membership_plans for select to anon, authenticated using (true);
create policy plans_admin on public.membership_plans for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy memberships_read on public.memberships for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin());
create policy memberships_admin on public.memberships for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy badges_read on public.badges for select to anon, authenticated using (true);
create policy badges_admin on public.badges for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy user_badges_read on public.user_badges for select to anon, authenticated
  using (exists (select 1 from public.public_profiles pp where pp.id = profile_id) or private.manages_profile(profile_id) or private.is_admin());
create policy referral_codes_own on public.referral_codes for select to authenticated using (profile_id = private.my_profile_id() or private.is_admin());
create policy referrals_own on public.referrals for select to authenticated
  using (referrer_id = private.my_profile_id() or referred_id = private.my_profile_id() or private.is_admin());
create policy ambassadors_read on public.ambassadors for select to anon, authenticated
  using (status = 'approved' or profile_id = private.my_profile_id() or private.is_admin());
create policy ambassadors_apply on public.ambassadors for insert to authenticated
  with check (profile_id = private.my_profile_id() and status = 'pending');
create policy ambassadors_admin on public.ambassadors for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy editions_read on public.award_editions for select to anon, authenticated using (status <> 'draft' or private.is_admin());
create policy editions_admin on public.award_editions for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy categories_read on public.award_categories for select to anon, authenticated
  using (exists (select 1 from public.award_editions e where e.id = edition_id and (e.status <> 'draft' or private.is_admin())));
create policy categories_admin on public.award_categories for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy nominees_read on public.award_nominees for select to anon, authenticated
  using (exists (select 1 from public.award_categories c join public.award_editions e on e.id = c.edition_id
    where c.id = category_id and (e.status <> 'draft' or private.is_admin())));
create policy nominees_admin on public.award_nominees for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy votes_own on public.award_votes for select to authenticated using (voter_id = private.my_profile_id());
create policy predictions_own on public.predictions for select to authenticated using (profile_id = private.my_profile_id() or private.is_admin());
create policy pvm_read on public.pvm_games for select to anon, authenticated using (status <> 'draft' or private.is_admin());
create policy pvm_admin on public.pvm_games for all to authenticated
  using (private.is_admin() or (master_profile_id is not null and private.manages_profile(master_profile_id)))
  with check (private.is_admin() or (master_profile_id is not null and private.manages_profile(master_profile_id)));
create policy pvm_votes_own on public.pvm_votes for select to authenticated using (profile_id = private.my_profile_id());

-- Paiement de l'adhésion (extension de confirm_payment).
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
  elsif pay.object_type = 'membership' and p_status = 'succeeded' then
    payable := private.membership_paid(pay.object_id);
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
