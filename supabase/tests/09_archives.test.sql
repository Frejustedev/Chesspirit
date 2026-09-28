-- Archives : les positions suivent la visibilité des parties ; écriture réservée au service ; assistant WhatsApp.
select tests.reset_role();
insert into public.games (id, white_name, black_name, result, pgn, is_public) values
  ('00000000-0000-0000-0000-0000000a1001', 'Public A', 'Public B', '1-0', '1. e4 e5 1-0', true),
  ('00000000-0000-0000-0000-0000000a1002', 'Privé A', 'Privé B', '0-1', '1. e4 c5 0-1', false);
insert into public.game_positions (game_id, ply, fen_key, next_san) values
  ('00000000-0000-0000-0000-0000000a1001', 0, 'clé-test w KQkq -', 'e4'),
  ('00000000-0000-0000-0000-0000000a1002', 0, 'clé-test w KQkq -', 'd4');

insert into public.whatsapp_inbound (message_id, wa_from, body) values ('wamid.test', '22990000001', 'bonjour');

select tests.as_anon();
select tests.eq((select count(*)::int from public.game_positions where fen_key = 'clé-test w KQkq -'), 1, 'positions des parties privées masquées');
select tests.eq((select string_agg(next_san, ',') from public.position_explorer('clé-test w KQkq -')), 'e4', 'explorateur limité aux parties visibles');
select tests.throws($$insert into public.game_positions (game_id, ply, fen_key) values ('00000000-0000-0000-0000-0000000a1001', 5, 'x w - -')$$, 'écriture des positions refusée');
select tests.no_read($$select * from public.whatsapp_inbound$$, 'messages WhatsApp non lisibles par un anonyme');
select tests.throws($$select public.purge_whatsapp_inbound()$$, 'purge réservée au service');
