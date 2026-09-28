-- Archives : index des positions des parties (recherche par position, explorateur d'ouvertures),
-- journal des messages reçus par l'assistant WhatsApp.

alter table public.games add column positions_indexed_at timestamptz;

-- Une ligne par demi-coup : position (4 premiers champs de la FEN) et coup joué ensuite.
create table public.game_positions (
  game_id uuid not null references public.games(id) on delete cascade,
  ply int not null check (ply >= 0),
  fen_key text not null check (char_length(fen_key) <= 100),
  next_san text check (char_length(next_san) <= 10),
  primary key (game_id, ply)
);
create index game_positions_key_idx on public.game_positions (fen_key);
alter table public.game_positions enable row level security;
revoke insert, update, delete on public.game_positions from anon, authenticated;
-- Visible exactement quand la partie l'est (les règles d'accès de games s'appliquent à la sous-requête).
create policy game_positions_read on public.game_positions for select to anon, authenticated
  using (exists (select 1 from public.games g where g.id = game_id));

-- Explorateur : coups joués depuis une position et résultats (parties visibles seulement).
create or replace function public.position_explorer(p_fen_key text)
returns table (next_san text, games bigint, white_wins bigint, draws bigint, black_wins bigint)
language sql stable security invoker set search_path = '' as $$
  select gp.next_san, count(distinct g.id),
    count(distinct g.id) filter (where g.result = '1-0'),
    count(distinct g.id) filter (where g.result = '1/2-1/2'),
    count(distinct g.id) filter (where g.result = '0-1')
  from public.game_positions gp join public.games g on g.id = gp.game_id
  where gp.fen_key = p_fen_key and gp.next_san is not null
  group by gp.next_san
  order by 2 desc, 1
  limit 30
$$;
grant execute on function public.position_explorer to anon, authenticated;

-- Assistant WhatsApp : messages reçus (déduplication des renvois de Meta), accès administration.
create table public.whatsapp_inbound (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique check (char_length(message_id) <= 200),
  wa_from text not null check (wa_from ~ '^[0-9]{6,15}$'),
  body text check (char_length(body) <= 4096),
  intent text,
  created_at timestamptz not null default now()
);
create index whatsapp_inbound_created_idx on public.whatsapp_inbound (created_at);
alter table public.whatsapp_inbound enable row level security;
revoke all on public.whatsapp_inbound from anon;
create policy whatsapp_inbound_admin on public.whatsapp_inbound for select to authenticated using (private.is_admin());

insert into public.feature_flags (key, enabled, description) values
  ('whatsapp_assistant', false, 'Assistant WhatsApp (réponses automatiques ; nécessite WhatsApp Business)')
on conflict (key) do nothing;

-- Maintenance : conservation limitée des messages reçus (90 jours).
create or replace function public.purge_whatsapp_inbound() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.whatsapp_inbound where created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_whatsapp_inbound from anon, authenticated, public;
grant execute on function public.purge_whatsapp_inbound to service_role;
