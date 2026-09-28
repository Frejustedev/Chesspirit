-- Compétitions en ligne (Lichess) et tournois par équipes.

-- Comptes Lichess liés (OAuth PKCE : seule l'identité est conservée, pas de jeton).
create table public.lichess_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  username text not null,
  lichess_id text not null unique,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger lichess_accounts_updated_at before update on public.lichess_accounts for each row execute function private.set_updated_at();
alter table public.lichess_accounts enable row level security;
revoke all on public.lichess_accounts from anon;
create policy lichess_read on public.lichess_accounts for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin_of('competitions'));
create policy lichess_delete on public.lichess_accounts for delete to authenticated
  using (private.manages_profile(profile_id) or private.is_admin_of('competitions'));
-- L'écriture passe par le serveur après vérification OAuth (rôle service) ou par l'administration.
create policy lichess_admin on public.lichess_accounts for all to authenticated
  using (private.is_admin_of('competitions')) with check (private.is_admin_of('competitions'));

create view public.public_lichess_accounts with (security_barrier = true) as
select la.profile_id, la.username from public.lichess_accounts la
join public.profiles p on p.id = la.profile_id and p.is_public;
grant select on public.public_lichess_accounts to anon, authenticated;

alter table public.tournaments
  add column lichess_kind text check (lichess_kind in ('arena', 'swiss')),
  add column lichess_id text check (lichess_id ~ '^[A-Za-z0-9]{4,16}$'),
  add column lichess_imported_at timestamptz,
  add column team_scoring text not null default 'match_points' check (team_scoring in ('match_points', 'game_points')),
  add column team_size int not null default 4 check (team_size between 2 and 10);

-- Équipes ---------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  organization_id uuid references public.organizations(id) on delete set null,
  captain_id uuid references public.profiles(id) on delete set null,
  seed int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, name)
);
create trigger teams_updated_at before update on public.teams for each row execute function private.set_updated_at();

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  board_order int not null check (board_order >= 1),
  is_substitute boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, profile_id),
  unique (team_id, board_order)
);
create trigger team_members_updated_at before update on public.team_members for each row execute function private.set_updated_at();

create table public.team_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number int not null check (round_number >= 1),
  table_number int not null check (table_number >= 1),
  home_team_id uuid not null references public.teams(id) on delete cascade,
  away_team_id uuid references public.teams(id) on delete cascade, -- null = exempt
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, round_number, table_number)
);
create trigger team_matches_updated_at before update on public.team_matches for each row execute function private.set_updated_at();

create table public.board_results (
  id uuid primary key default gen_random_uuid(),
  team_match_id uuid not null references public.team_matches(id) on delete cascade,
  board int not null check (board >= 1),
  white_id uuid references public.profiles(id),
  black_id uuid references public.profiles(id),
  home_is_white boolean not null,
  result public.game_result,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_match_id, board)
);
create trigger board_results_updated_at before update on public.board_results for each row execute function private.set_updated_at();

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_matches enable row level security;
alter table public.board_results enable row level security;
revoke insert, update, delete on public.teams, public.team_members, public.team_matches, public.board_results from anon;

create policy teams_read on public.teams for select to anon, authenticated
  using (private.tournament_is_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy teams_write on public.teams for all to authenticated
  using (private.can_arbitrate(tournament_id)) with check (private.can_arbitrate(tournament_id));
create policy team_members_write on public.team_members for all to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and private.can_arbitrate(t.tournament_id)))
  with check (exists (select 1 from public.teams t where t.id = team_id and private.can_arbitrate(t.tournament_id)));
create policy team_members_read_staff on public.team_members for select to authenticated
  using (private.manages_profile(profile_id)
    or exists (select 1 from public.teams t where t.id = team_id and private.can_arbitrate(t.tournament_id)));
create policy team_matches_read on public.team_matches for select to anon, authenticated
  using ((published and private.tournament_is_public(tournament_id)) or private.can_arbitrate(tournament_id));
create policy team_matches_write on public.team_matches for all to authenticated
  using (private.can_arbitrate(tournament_id)) with check (private.can_arbitrate(tournament_id));
create policy board_results_read_staff on public.board_results for select to authenticated
  using (exists (select 1 from public.team_matches m where m.id = team_match_id and private.can_arbitrate(m.tournament_id)));
create policy board_results_write on public.board_results for all to authenticated
  using (exists (select 1 from public.team_matches m where m.id = team_match_id and private.can_arbitrate(m.tournament_id)))
  with check (exists (select 1 from public.team_matches m where m.id = team_match_id and private.can_arbitrate(m.tournament_id)));
do $$
declare t text;
begin
  foreach t in array array['teams', 'team_members', 'team_matches', 'board_results'] loop
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$s for each row execute function private.audit_trigger()', t);
  end loop;
end $$;

-- Vues publiques : composition (noms réduits pour les mineurs) et résultats par échiquier des rencontres publiées.
create view public.public_team_members with (security_barrier = true) as
select tm.team_id, t.tournament_id, tm.profile_id, tm.board_order, tm.is_substitute,
  private.display_name(p) as display_name, p.titles
from public.team_members tm
join public.teams t on t.id = tm.team_id
join public.profiles p on p.id = tm.profile_id
where private.tournament_is_public(t.tournament_id);
grant select on public.public_team_members to anon, authenticated;

create view public.public_board_results with (security_barrier = true) as
select br.team_match_id, br.board, br.home_is_white, br.result,
  private.display_name(w) as white_name, private.display_name(b) as black_name
from public.board_results br
join public.team_matches m on m.id = br.team_match_id and m.published
left join public.profiles w on w.id = br.white_id
left join public.profiles b on b.id = br.black_id
where private.tournament_is_public(m.tournament_id);
grant select on public.public_board_results to anon, authenticated;
