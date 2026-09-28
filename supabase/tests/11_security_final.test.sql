-- Revue de sécurité finale : régressions des constats M1 à M4, F2 à F4.
select tests.reset_role();
create temp table ids as select tests.create_user('secu-a@test.bj') as a, tests.create_user('secu-admin@test.bj') as admin;
grant select on ids to anon, authenticated, service_role;
insert into public.user_roles (user_id, role) select admin, 'admin' from ids;
insert into public.profiles (user_id, first_name, last_name, birth_date, is_public) select a, 'Ana', 'Securite', '1990-01-01', true from ids;
insert into public.profiles (id, first_name, last_name, birth_date, is_public, source)
  values ('00000000-0000-0000-0000-00000000e001', 'Kofi', 'Secretnom', '2015-01-01', true, 'import');
update public.profiles set is_public = true where id = '00000000-0000-0000-0000-00000000e001';
insert into public.puzzles (id, code, fen, solution, theme) values
  ('00000000-0000-0000-0000-00000000e002', 'secu-test', '8/8/8/8/8/8/8/K6k w - - 0 1', '{a1a2}', 'test');

-- M3 : nom d'un mineur public réduit partout.
select tests.as_anon();
select tests.eq((select display_name from public.public_profiles where id = '00000000-0000-0000-0000-00000000e001'), 'Kofi S.', 'mineur public : initiale du nom');

select tests.login_as((select a from ids));
-- M1 : la structure proposée ne peut pas se publier seule.
select public.propose_organization('{"type":"club","name":"Club secu","city":"Cotonou"}');
select tests.throws($$update public.organizations set is_public = true where name = 'Club secu'$$, 'publication par le proposant refusée');
-- F3 : lien de site web en http(s) seulement.
select tests.throws($$update public.organizations set website = 'javascript:alert(1)' where name = 'Club secu'$$, 'lien javascript refusé');
-- M2 : pas de partie public/maître créée par un membre.
select tests.throws($$insert into public.pvm_games (slug, title, master_name, master_profile_id) values ('usurpation', '{"fr":"x"}', 'Magnus', private.my_profile_id())$$, 'création de partie réservée à l''administration');
-- F2 : pas de tentative de puzzle écrite directement.
select tests.throws($$insert into public.puzzle_attempts (puzzle_id, profile_id, solved) values ('00000000-0000-0000-0000-00000000e002', private.my_profile_id(), true)$$, 'tentative directe refusée');

-- M2 : le maître rattaché joue mais ne change pas l'identité de la partie.
select tests.reset_role();
insert into public.pvm_games (id, slug, title, master_name, master_profile_id)
  select '00000000-0000-0000-0000-00000000e003', 'pvm-secu', '{"fr":"PvM"}', 'Maître', id from public.profiles where first_name = 'Ana';
select tests.login_as((select a from ids));
update public.pvm_games set status = 'finished', result = '1-0' where id = '00000000-0000-0000-0000-00000000e003';
select tests.eq((select status from public.pvm_games where id = '00000000-0000-0000-0000-00000000e003'), 'finished', 'le maître pilote la partie');
select tests.throws($$update public.pvm_games set master_name = 'Autre' where id = '00000000-0000-0000-0000-00000000e003'$$, 'identité de la partie figée');
