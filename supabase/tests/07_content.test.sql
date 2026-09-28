-- Contenus : lecture publique du publié uniquement, écriture éditoriale, tentatives personnelles.
select tests.reset_role();
create temp table ids as select
  tests.create_user('lecteur@test.bj') as lecteur,
  tests.create_user('redac@test.bj') as redac;
grant select on ids to anon, authenticated, service_role;
insert into public.user_roles (user_id, role) select redac, 'editor' from ids;
insert into public.profiles (user_id, first_name, last_name) select lecteur, 'Léa', 'Lectrice' from ids;
insert into public.articles (slug, title, status) values ('brouillon-test', '{"fr":"Brouillon"}', 'draft'), ('publie-test', '{"fr":"Publié"}', 'published');
insert into public.puzzles (id, code, fen, solution, theme) values ('00000000-0000-0000-0000-00000000c0de', 'test-mat', '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', '{d1d8}', 'backRank');

select tests.as_anon();
select tests.eq((select count(*)::int from public.articles where slug in ('brouillon-test', 'publie-test')), 1, 'seul l''article publié est visible');
select tests.throws($$insert into public.articles (slug, title) values ('pirate', '{"fr":"x"}')$$, 'anonyme : pas d''écriture');
select tests.eq((select count(*)::int from public.daily_puzzle()), 1, 'puzzle du jour disponible');

select tests.login_as((select lecteur from ids));
select tests.throws($$update public.articles set status = 'published' where slug = 'publie-test' returning 1/0$$, 'un lecteur ne modifie pas un article');
select tests.throws($$insert into public.puzzle_attempts (puzzle_id, profile_id, solved) values ('00000000-0000-0000-0000-00000000c0de', private.my_profile_id(), true)$$, 'tentative non écrite par le lecteur (vérifiée par le serveur)');
insert into public.glossary_suggestions (term_id, profile_id, term_fon) select id, private.my_profile_id(), 'proposition' from public.glossary_terms limit 1;
select tests.throws($$update public.glossary_terms set term_fon = 'x', fon_status = 'validated' returning 1/0$$, 'un lecteur ne valide pas le fon');

-- Tentative enregistrée par le serveur après vérification des coups.
select tests.reset_role();
insert into public.puzzle_attempts (puzzle_id, profile_id, solved)
  select '00000000-0000-0000-0000-00000000c0de', p.id, true from public.profiles p join ids on p.user_id = ids.lecteur;

select tests.login_as((select redac from ids));
select tests.eq((select count(*)::int from public.articles where slug = 'brouillon-test'), 1, 'la rédaction voit les brouillons');
update public.articles set status = 'published' where slug = 'brouillon-test';
select tests.eq((select status from public.articles where slug = 'brouillon-test'), 'published', 'la rédaction publie');
select tests.eq((select count(*)::int >= 1 from public.glossary_suggestions), true, 'la rédaction voit les suggestions');
select tests.eq((select count(*)::int >= 1 from public.puzzle_attempts), true, 'la rédaction voit les tentatives (statistiques)');
