-- Communauté : adhésion et contenu premium, parrainage, ambassadeurs, Awards, pronostics, public contre le maître.
select tests.reset_role();
create temp table ids as select
  tests.create_user('membre-c@test.bj') as membre,
  tests.create_user('filleul-c@test.bj') as filleul,
  tests.create_user('admin-c@test.bj') as admin;
grant select on ids to anon, authenticated, service_role;
insert into public.user_roles (user_id, role) select admin, 'admin' from ids;
insert into public.profiles (user_id, first_name, last_name, birth_date, is_public) select membre, 'Cora', 'Communauté', '1990-01-01', true from ids;
insert into public.profiles (user_id, first_name, last_name, birth_date, is_public) select filleul, 'Fifi', 'Filleul', '1992-01-01', true from ids;
insert into public.profiles (id, first_name, last_name, birth_date, is_public, source) values
  ('00000000-0000-0000-0000-0000000c0a01', 'Blanc', 'Joueur', '1990-01-01', true, 'import'),
  ('00000000-0000-0000-0000-0000000c0a02', 'Noir', 'Joueur', '1990-01-01', true, 'import');
insert into public.lessons_library (slug, level, theme, title, body, is_premium, status)
  values ('lecon-premium-test', 'advanced', 'endgames', '{"fr":"Premium"}', '{"fr":"Texte secret"}', true, 'published');
insert into public.tournaments (id, slug, name, starts_at, status)
  values ('00000000-0000-0000-0000-0000000c0b01', 'pronostics-test', 'Pronostics test', now(), 'ongoing');
insert into public.rounds (id, tournament_id, number, status, published_at) values
  ('00000000-0000-0000-0000-0000000c0c01', '00000000-0000-0000-0000-0000000c0b01', 1, 'ongoing', now()),
  ('00000000-0000-0000-0000-0000000c0c02', '00000000-0000-0000-0000-0000000c0b01', 2, 'ongoing', now() - interval '20 minutes');
insert into public.pairings (id, tournament_id, round_id, board, white_id, black_id) values
  ('00000000-0000-0000-0000-0000000c0d01', '00000000-0000-0000-0000-0000000c0b01', '00000000-0000-0000-0000-0000000c0c01', 1,
   '00000000-0000-0000-0000-0000000c0a01', '00000000-0000-0000-0000-0000000c0a02'),
  ('00000000-0000-0000-0000-0000000c0d02', '00000000-0000-0000-0000-0000000c0b01', '00000000-0000-0000-0000-0000000c0c02', 1,
   '00000000-0000-0000-0000-0000000c0a02', '00000000-0000-0000-0000-0000000c0a01');
insert into public.award_editions (id, year, slug, title, status) values
  ('00000000-0000-0000-0000-0000000c0e01', 2026, 'awards-test', '{"fr":"Test"}', 'voting'),
  ('00000000-0000-0000-0000-0000000c0e02', 2026, 'awards-brouillon', '{"fr":"Brouillon"}', 'draft');
insert into public.award_categories (id, edition_id, name) values
  ('00000000-0000-0000-0000-0000000c0f01', '00000000-0000-0000-0000-0000000c0e01', '{"fr":"Catégorie"}'),
  ('00000000-0000-0000-0000-0000000c0f02', '00000000-0000-0000-0000-0000000c0e02', '{"fr":"Cachée"}');
insert into public.award_nominees (id, category_id, name) values
  ('00000000-0000-0000-0000-0000000c1001', '00000000-0000-0000-0000-0000000c0f01', 'Nommé A'),
  ('00000000-0000-0000-0000-0000000c1002', '00000000-0000-0000-0000-0000000c0f01', 'Nommé B'),
  ('00000000-0000-0000-0000-0000000c1003', '00000000-0000-0000-0000-0000000c0f02', 'Nommé caché');
insert into public.pvm_games (id, slug, title, master_name, public_color)
  values ('00000000-0000-0000-0000-0000000c1101', 'pvm-test', '{"fr":"PvM"}', 'Maître test', 'w');

-- Anonyme : catalogue et formules lisibles, texte premium et adhésions non.
select tests.as_anon();
select tests.eq((select count(*)::int from public.membership_plans), 2, 'formules visibles');
select tests.eq((select count(*)::int from public.lesson_catalog where slug = 'lecon-premium-test'), 1, 'leçon premium au catalogue');
select tests.eq((select count(*)::int from public.lessons_library where slug = 'lecon-premium-test'), 0, 'texte premium masqué');
select tests.eq((select count(*)::int from public.award_categories where name ->> 'fr' = 'Cachée'), 0, 'édition en brouillon masquée');

-- Membre : adhésion gratuite, premium impossible tant que le tarif n'est pas fixé.
select tests.login_as((select membre from ids));
select tests.eq((public.request_membership('free')).status, 'active', 'adhésion gratuite active immédiatement');
select tests.eq((select count(*)::int from public.memberships where profile_id = private.my_profile_id()), 1, 'adhésion idempotente (lecture)');
select public.request_membership('free');
select tests.eq((select count(*)::int from public.memberships where profile_id = private.my_profile_id()), 1, 'pas de doublon d''adhésion');
select tests.throws($$select public.request_membership('premium')$$, 'premium impossible sans tarif fixé');
select tests.throws($$insert into public.memberships (profile_id, plan, status) values (private.my_profile_id(), 'premium', 'active')$$, 'adhésion premium auto-attribuée impossible');
update public.memberships set status = 'active', plan = 'premium' where profile_id = private.my_profile_id();
select tests.eq((select plan from public.memberships where profile_id = private.my_profile_id()), 'free', 'adhésion non modifiable par le membre');
select tests.throws($$select public.refresh_badges('00000000-0000-0000-0000-0000000c0a01')$$, 'badges d''un autre profil non recalculables');
select public.refresh_badges(private.my_profile_id());
select tests.eq((select count(*)::int from public.user_badges where profile_id = private.my_profile_id() and badge_code = 'member'), 1, 'badge membre attribué');

-- Administration : tarif premium fixé.
select tests.login_as((select admin from ids), 'aal2');
update public.membership_plans set price_xof = 5000 where code = 'premium';

select tests.login_as((select membre from ids));
select tests.eq((public.request_membership('premium')).amount_xof, 5000, 'montant premium fixé par la base');
select tests.eq((select count(*)::int from public.lessons_library where slug = 'lecon-premium-test'), 0, 'premium non payé : texte masqué');

-- Paiement confirmé par le webhook (rôle service).
select tests.reset_role();
insert into public.payments (id, provider, amount_xof, object_type, object_id, status)
  select '00000000-0000-0000-0000-0000000c1201', 'fake', 5000, 'membership', m.id, 'pending'
  from public.memberships m join public.profiles p on p.id = m.profile_id where p.first_name = 'Cora' and m.plan = 'premium';
select tests.as_service();
select public.confirm_payment('00000000-0000-0000-0000-0000000c1201', 'succeeded', 'ref-c');
select tests.login_as((select membre from ids));
select tests.eq((select count(*)::int from public.lessons_library where slug = 'lecon-premium-test'), 1, 'premium payé : texte lisible');
select tests.eq((select ends_on > current_date + 360 from public.memberships where profile_id = private.my_profile_id() and plan = 'premium'), true, 'premium valable 12 mois');

-- Parrainage.
create temp table codes as select public.my_referral_code() as code;
grant select on codes to authenticated;
select tests.eq(public.claim_referral((select code from codes)), false, 'auto-parrainage refusé');
select tests.login_as((select filleul from ids));
select tests.eq(public.claim_referral((select code from codes)), true, 'parrainage enregistré');
select tests.eq(public.claim_referral((select code from codes)), false, 'parrainage unique');
select tests.eq(public.claim_referral('INCONNU1'), false, 'code inconnu refusé');

-- Ambassadeurs : candidature en attente seulement.
select tests.throws($$insert into public.ambassadors (profile_id, city, status) values (private.my_profile_id(), 'Parakou', 'approved')$$, 'ambassadeur auto-approuvé impossible');
insert into public.ambassadors (profile_id, city, motivation) values (private.my_profile_id(), 'Parakou', 'Je veux développer les échecs à Parakou.');

-- Awards : une voix par catégorie, modifiable ; résultats masqués avant la clôture.
select public.cast_award_vote('00000000-0000-0000-0000-0000000c1001');
select public.cast_award_vote('00000000-0000-0000-0000-0000000c1002');
select tests.eq((select nominee_id::text from public.award_votes where voter_id = private.my_profile_id()), '00000000-0000-0000-0000-0000000c1002', 'vote modifié, une seule voix');
select tests.throws($$select public.cast_award_vote('00000000-0000-0000-0000-0000000c1003')$$, 'vote impossible sur une édition en brouillon');
select tests.throws($$insert into public.award_votes (category_id, voter_id, nominee_id) values ('00000000-0000-0000-0000-0000000c0f01', private.my_profile_id(), '00000000-0000-0000-0000-0000000c1001')$$, 'vote direct sans la fonction impossible');
select tests.eq((select count(*)::int from public.award_results('00000000-0000-0000-0000-0000000c0e01')), 0, 'résultats masqués pendant le vote');

-- Pronostics.
select public.predict('00000000-0000-0000-0000-0000000c0d01', '1-0');
select tests.throws($$select public.predict('00000000-0000-0000-0000-0000000c0d02', '1-0')$$, 'pronostic fermé 15 minutes après la publication');
select tests.throws($$insert into public.predictions (profile_id, pairing_id, predicted, points) values (private.my_profile_id(), '00000000-0000-0000-0000-0000000c0d02', '1-0', 5)$$, 'pronostic direct impossible');

-- Le public contre le maître.
select public.pvm_vote('00000000-0000-0000-0000-0000000c1101', 'e2e4');
select tests.eq((select votes::int from public.pvm_tally('00000000-0000-0000-0000-0000000c1101') where move = 'e2e4'), 1, 'vote du public compté');
update public.pvm_games set fen = '8/8/8/8/8/8/8/K6k w - - 0 1' where id = '00000000-0000-0000-0000-0000000c1101';
select tests.eq((select fen from public.pvm_games where id = '00000000-0000-0000-0000-0000000c1101'), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'partie non modifiable par le public');

-- Résultat saisi : points attribués ; Awards clos : résultats publiés.
select tests.reset_role();
update public.pairings set result = '1-0' where id = '00000000-0000-0000-0000-0000000c0d01';
update public.award_editions set status = 'closed' where id = '00000000-0000-0000-0000-0000000c0e01';
update public.pvm_games set fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' where id = '00000000-0000-0000-0000-0000000c1101';
select tests.login_as((select filleul from ids));
select tests.eq((select points from public.predictions where profile_id = private.my_profile_id()), 1, 'bon pronostic : 1 point');
select tests.throws($$select public.pvm_vote('00000000-0000-0000-0000-0000000c1101', 'e7e5')$$, 'vote impossible au tour du maître');
select tests.as_anon();
select tests.eq((select votes::int from public.award_results('00000000-0000-0000-0000-0000000c0e01') where nominee_id = '00000000-0000-0000-0000-0000000c1002'), 1, 'résultats publiés après la clôture');
select tests.eq((select points::int from public.prediction_leaderboard where display_name like 'Fifi%'), 1, 'classement des pronostics public');
select tests.no_read($$select * from public.memberships$$, 'adhésions non lisibles par un anonyme');
