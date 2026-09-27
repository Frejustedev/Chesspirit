-- Moteur de tournoi : numéros de départ, forfaits, byes demandés, rondes, publication en direct.

alter table public.registrations
  add column start_number int,
  add column withdrawn_at timestamptz,
  add column bye_requests jsonb not null default '{}'; -- {"3": "half"} : bye demandé à la ronde 3
create unique index registrations_start_number_idx on public.registrations (tournament_id, start_number) where start_number is not null;

alter table public.rounds
  add column pairing_engine text check (pairing_engine in ('bbp', 'fallback', 'round_robin', 'knockout', 'manual')),
  add column notes text;

alter table public.pairings
  add column stage text not null default 'main' check (stage in ('main', 'blitz', 'armageddon')),
  add column result_entered_by uuid references auth.users(id),
  add column result_entered_at timestamptz;

alter table public.tournaments
  add column initial_color text not null default 'white1' check (initial_color in ('white1', 'black1')),
  add column bye_points numeric(2, 1) not null default 1.0 check (bye_points in (0, 0.5, 1));

-- Les arbitres tiennent le classement provisoire à jour (le classement final reste réservé à l'organisateur).
drop policy standings_write on public.standings;
create policy standings_write on public.standings for all to authenticated
  using (private.can_arbitrate(tournament_id)) with check (private.can_arbitrate(tournament_id));

-- Numéros de départ : par cote décroissante puis nom (non modifiés une fois attribués).
create or replace function public.assign_start_numbers(p_tournament_id uuid, p_only_checked_in boolean default false)
returns int language plpgsql security definer set search_path = '' as $$
declare
  n int := 0;
  base int;
  r record;
begin
  if not private.can_arbitrate(p_tournament_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(max(start_number), 0) into base from public.registrations where tournament_id = p_tournament_id;
  for r in
    select reg.id from public.registrations reg join public.profiles p on p.id = reg.player_id
    where reg.tournament_id = p_tournament_id and reg.status = 'confirmed' and reg.start_number is null
      and reg.withdrawn_at is null and (not p_only_checked_in or reg.checked_in_at is not null)
    order by reg.seed_rating desc nulls last, p.last_name, p.first_name
  loop
    n := n + 1;
    update public.registrations set start_number = base + n where id = r.id;
  end loop;
  insert into public.tournament_audit (tournament_id, action, details)
    values (p_tournament_id, 'assign_start_numbers', jsonb_build_object('count', n));
  return n;
end $$;
revoke execute on function public.assign_start_numbers from anon, public;
grant execute on function public.assign_start_numbers to authenticated;

-- Publication en direct (Supabase Realtime) des rondes, appariements et classements.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rounds, public.pairings, public.standings;
  end if;
end $$;

-- Le numéro de départ et le nom figurent dans la vue publique des appariements.
create or replace view public.public_pairings with (security_barrier = true) as
select pr.id, pr.tournament_id, r.number as round_number, pr.board, pr.result, pr.bye_type,
  pr.white_id, private.display_name(w) as white_name,
  pr.black_id, case when b.id is null then null else private.display_name(b) end as black_name, pr.stage,
  (select reg.start_number from public.registrations reg where reg.tournament_id = pr.tournament_id and reg.player_id = pr.white_id) as white_start,
  (select reg.start_number from public.registrations reg where reg.tournament_id = pr.tournament_id and reg.player_id = pr.black_id) as black_start
from public.pairings pr
join public.rounds r on r.id = pr.round_id and r.published_at is not null
join public.profiles w on w.id = pr.white_id
left join public.profiles b on b.id = pr.black_id
join public.tournaments t on t.id = pr.tournament_id and t.status <> 'draft';
grant select on public.public_pairings to anon, authenticated;
