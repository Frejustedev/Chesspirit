-- Contenus : articles, émissions et épisodes (vidéo, podcast, direct), leçons, puzzles et défis,
-- ressources, glossaire et lexique (fr, en, fon).

create or replace function private.can_edit_content() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin_of('content') or private.has_role('editor')
$$;

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title jsonb not null,
  excerpt jsonb not null default '{}',
  body jsonb not null default '{}',
  tags text[] not null default '{}',
  tournament_id uuid references public.tournaments(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index articles_published_idx on public.articles (status, published_at desc);
create trigger articles_updated_at before update on public.articles for each row execute function private.set_updated_at();

create table public.media_series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null check (kind in ('show', 'podcast', 'live')),
  title jsonb not null,
  description jsonb not null default '{}',
  language text not null default 'fr' check (language in ('fr', 'en', 'fon', 'multi')),
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger media_series_updated_at before update on public.media_series for each row execute function private.set_updated_at();

create table public.media_episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.media_series(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  season int not null default 1 check (season >= 1),
  number int not null check (number >= 1),
  title jsonb not null,
  description jsonb not null default '{}',
  format text not null check (format in ('video', 'audio', 'live')),
  video_url text check (video_url ~ '^https://(www\.youtube\.com/watch\?v=|youtu\.be/|vimeo\.com/)[A-Za-z0-9_-]+'),
  audio_url text check (audio_url ~ '^https://'),
  live_at timestamptz,
  duration_min int check (duration_min between 1 and 600),
  language text not null default 'fr' check (language in ('fr', 'en', 'fon')),
  level text check (level in ('discovery', 'beginner', 'intermediate', 'advanced', 'competition')),
  theme text,
  transcript text check (char_length(transcript) <= 100000),
  positions jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, season, number)
);
create index media_episodes_pub_idx on public.media_episodes (status, published_at desc);
create trigger media_episodes_updated_at before update on public.media_episodes for each row execute function private.set_updated_at();

create table public.lessons_library (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  level text not null check (level in ('discovery', 'beginner', 'intermediate', 'advanced', 'competition')),
  theme text not null,
  title jsonb not null,
  summary jsonb not null default '{}',
  body jsonb not null default '{}',
  positions jsonb not null default '[]',
  position int not null default 0,
  is_premium boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger lessons_library_updated_at before update on public.lessons_library for each row execute function private.set_updated_at();

create table public.puzzles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  fen text not null,
  solution text[] not null check (array_length(solution, 1) >= 1),
  theme text not null,
  mate_in int,
  rating int,
  source text not null default 'chesspirit',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger puzzles_updated_at before update on public.puzzles for each row execute function private.set_updated_at();

create table public.weekly_challenges (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique check (extract(isodow from week_start) = 1),
  title jsonb not null,
  puzzle_ids uuid[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger weekly_challenges_updated_at before update on public.weekly_challenges for each row execute function private.set_updated_at();

create table public.puzzle_attempts (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  solved boolean not null,
  context text not null default 'daily' check (context in ('daily', 'challenge', 'lesson', 'placement')),
  attempted_on date not null default (now() at time zone 'Africa/Porto-Novo')::date,
  created_at timestamptz not null default now(),
  unique (puzzle_id, profile_id, context, attempted_on)
);
create index puzzle_attempts_profile_idx on public.puzzle_attempts (profile_id, attempted_on desc);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title jsonb not null,
  description jsonb not null default '{}',
  kind text not null check (kind in ('pdf', 'worksheet', 'pgn', 'rules', 'video', 'link')),
  url text not null check (url ~ '^(https://|/)'),
  level text check (level in ('discovery', 'beginner', 'intermediate', 'advanced', 'competition')),
  language text not null default 'fr' check (language in ('fr', 'en', 'fon')),
  is_premium boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger resources_updated_at before update on public.resources for each row execute function private.set_updated_at();

-- Glossaire trilingue : le terme fon n'est affiché qu'une fois validé par un locuteur.
create table public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  term_fr text not null unique,
  term_en text not null,
  term_fon text,
  fon_status text not null default 'missing' check (fon_status in ('missing', 'proposed', 'validated')),
  definition jsonb not null default '{}',
  category text not null default 'general' check (category in ('general', 'pieces', 'rules', 'tactics', 'strategy', 'openings', 'endgames', 'competition')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger glossary_terms_updated_at before update on public.glossary_terms for each row execute function private.set_updated_at();

-- Propositions de traduction en fon par la communauté (validées par l'équipe éditoriale).
create table public.glossary_suggestions (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.glossary_terms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  term_fon text not null check (char_length(term_fon) between 1 and 120),
  note text check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'refused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id, profile_id)
);
create trigger glossary_suggestions_updated_at before update on public.glossary_suggestions for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Autorisations : lecture publique du contenu publié, écriture par l'équipe éditoriale.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['articles', 'media_series', 'media_episodes', 'lessons_library', 'puzzles', 'weekly_challenges',
    'resources', 'glossary_terms'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke insert, update, delete on public.%I from anon', t);
    execute format('create policy %1$s_edit on public.%1$s for all to authenticated using (private.can_edit_content()) with check (private.can_edit_content())', t);
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$s for each row execute function private.audit_trigger()', t);
  end loop;
end $$;
create policy articles_read on public.articles for select to anon, authenticated using (status = 'published');
create policy series_read on public.media_series for select to anon, authenticated using (is_active);
create policy episodes_read on public.media_episodes for select to anon, authenticated using (status = 'published');
create policy lessons_read on public.lessons_library for select to anon, authenticated using (status = 'published');
create policy puzzles_read on public.puzzles for select to anon, authenticated using (is_active);
create policy challenges_read on public.weekly_challenges for select to anon, authenticated using (true);
create policy resources_read on public.resources for select to anon, authenticated using (status = 'published');
create policy glossary_read on public.glossary_terms for select to anon, authenticated using (true);

alter table public.puzzle_attempts enable row level security;
revoke all on public.puzzle_attempts from anon;
create policy attempts_own on public.puzzle_attempts for select to authenticated
  using (private.manages_profile(profile_id) or private.can_edit_content());
create policy attempts_insert on public.puzzle_attempts for insert to authenticated
  with check (profile_id = private.my_profile_id());

alter table public.glossary_suggestions enable row level security;
revoke all on public.glossary_suggestions from anon;
create policy suggestions_own on public.glossary_suggestions for select to authenticated
  using (profile_id = private.my_profile_id() or private.can_edit_content());
create policy suggestions_insert on public.glossary_suggestions for insert to authenticated
  with check (profile_id = private.my_profile_id() and status = 'pending');
create policy suggestions_edit on public.glossary_suggestions for update to authenticated
  using (private.can_edit_content()) with check (private.can_edit_content());

-- Puzzle du jour : choix déterministe parmi les puzzles actifs (même puzzle pour tous, un par jour).
create or replace function public.daily_puzzle(p_day date default null) returns public.puzzles
language sql stable security definer set search_path = '' as $$
  with active as (select * from public.puzzles where is_active order by code),
  n as (select count(*) as c from active)
  select a.* from active a, n
  order by a.code
  offset (select ((coalesce(p_day, (now() at time zone 'Africa/Porto-Novo')::date) - date '2026-01-01') % greatest(n.c, 1))
          from n)
  limit 1
$$;
grant execute on function public.daily_puzzle to anon, authenticated;

-- Classement du défi de la semaine : puzzles résolus (première tentative de chaque jour comptée).
create or replace function public.challenge_leaderboard(p_challenge uuid)
returns table (display_name text, solved bigint)
language sql stable security definer set search_path = '' as $$
  select private.display_name(p), count(distinct a.puzzle_id)
  from public.weekly_challenges c
  join public.puzzle_attempts a on a.puzzle_id = any (c.puzzle_ids) and a.context = 'challenge' and a.solved
    and a.attempted_on between c.week_start and c.week_start + 6
  join public.profiles p on p.id = a.profile_id and p.is_public
  where c.id = p_challenge
  group by p.id
  order by 2 desc, 1
  limit 20
$$;
grant execute on function public.challenge_leaderboard to anon, authenticated;
