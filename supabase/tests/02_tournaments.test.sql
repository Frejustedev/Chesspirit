-- Tournois, inscriptions, pointage, résultats, paiements.
select tests.reset_role();
create temp table ids as select
  tests.create_user('player@test.bj') as player,
  tests.create_user('other@test.bj') as other,
  tests.create_user('arbiter@test.bj') as arbiter,
  tests.create_user('orga@test.bj') as orga;
grant select on ids to anon, authenticated, service_role;
insert into public.profiles (user_id, first_name, last_name, birth_date, sex) select player, 'Paul', 'Joueur', '2000-01-01', 'M' from ids;
insert into public.profiles (user_id, first_name, last_name, birth_date, sex) select other, 'Olga', 'Autre', '1995-01-01', 'F' from ids;
insert into public.profiles (user_id, first_name, last_name, birth_date, sex) select arbiter, 'Ari', 'Arbitre', '1980-01-01', 'M' from ids;
insert into public.profiles (user_id, first_name, last_name, birth_date, sex) select orga, 'Oscar', 'Orga', '1985-01-01', 'M' from ids;
insert into public.tournaments (id, slug, name, starts_at, status, entry_fee_xof, capacity, organizer_profile_id)
  values ('00000000-0000-0000-0000-00000000a001', 'test-open', 'Open test', now() + interval '7 days', 'registration_open', 2000, 1,
    (select id from public.profiles where first_name = 'Oscar'));
insert into public.tournaments (id, slug, name, starts_at, status)
  values ('00000000-0000-0000-0000-00000000a002', 'brouillon', 'Brouillon', now() + interval '30 days', 'draft');
insert into public.tournament_staff (tournament_id, profile_id, role)
  select '00000000-0000-0000-0000-00000000a001', id, 'chief_arbiter' from public.profiles where first_name = 'Ari';

select tests.as_anon();
select tests.eq((select count(*)::int from public.tournaments), 1, 'anonyme : brouillons masqués');
select tests.throws($$select public.register_for_tournament('00000000-0000-0000-0000-00000000a001', gen_random_uuid())$$,
  'anonyme : inscription impossible');

select tests.login_as((select player from ids));
select tests.throws($$update public.tournaments set name = 'Piraté'$$ || ' where slug = ''test-open'' returning 1/0', 'un joueur ne modifie pas un tournoi');
select tests.eq((select status::text from public.register_for_tournament('00000000-0000-0000-0000-00000000a001', private.my_profile_id(), '{}', 'online')),
  'pending_payment', 'inscription avec paiement en ligne en attente');
select tests.eq((select payment_status::text from public.registrations), 'pending', 'paiement en attente');
select tests.throws($$select public.register_for_tournament('00000000-0000-0000-0000-00000000a001', (select id from public.public_profiles where first_name = 'Olga'))$$,
  'impossible d''inscrire un autre joueur');
select tests.throws($$update public.registrations set status = 'confirmed', payment_status = 'paid' returning 1/0$$,
  'un joueur ne peut pas valider son propre paiement');
select tests.eq((select count(*)::int from public.payments), 0, 'aucun paiement visible');
select tests.throws($$insert into public.payments (provider, amount_xof, object_type, object_id) values ('fake', 1, 'registration', gen_random_uuid())$$,
  'un joueur ne peut pas créer un paiement');
select tests.throws($$select public.confirm_payment(gen_random_uuid(), 'succeeded', 'x')$$, 'confirm_payment réservé au rôle service');

-- Capacité 1 : la deuxième inscription passe en liste d'attente.
select tests.login_as((select other from ids));
select tests.eq((select status::text from public.register_for_tournament('00000000-0000-0000-0000-00000000a001', private.my_profile_id(), '{}', 'on_site')),
  'waitlisted', 'tournoi complet : liste d''attente');
select tests.eq((select count(*)::int from public.registrations), 1, 'Olga ne voit que son inscription');
select tests.eq((select count(*)::int from public.public_registrations where tournament_id = '00000000-0000-0000-0000-00000000a001'), 2,
  'liste publique des inscrits');
select tests.throws($$select public.check_in((select ticket_code from public.registrations limit 1))$$, 'un joueur ne pointe pas');

-- Webhook de paiement (rôle service) : confirme l'inscription.
select tests.as_service();
insert into public.payments (id, provider, amount_xof, object_type, object_id, status)
  select '00000000-0000-0000-0000-00000000b001', 'fake', 2000, 'registration', r.id, 'pending'
  from public.registrations r join public.profiles p on p.id = r.player_id where p.first_name = 'Paul';
select public.confirm_payment('00000000-0000-0000-0000-00000000b001', 'succeeded', 'fake_123');

select tests.login_as((select player from ids));
select tests.eq((select status::text || '/' || payment_status::text from public.registrations), 'confirmed/paid', 'webhook : inscription confirmée');
select tests.eq((select count(*)::int from public.payments), 1, 'le joueur voit son paiement');

-- Arbitre : pointage et appariements.
select tests.login_as((select arbiter from ids));
select tests.eq((select count(*)::int from public.registrations), 2, 'l''arbitre voit les inscrits de son tournoi');
select tests.eq((select already from public.check_in((select ticket_code from public.registrations r join public.profiles p on p.id = r.player_id where p.first_name = 'Paul'))), false,
  'pointage par QR code');
insert into public.rounds (id, tournament_id, number, status) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a001', 1, 'paired');
insert into public.pairings (tournament_id, round_id, board, white_id, black_id)
  select '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', 1,
    (select id from public.public_profiles where first_name = 'Paul' union select player_id from public.registrations r join public.profiles p on p.id = r.player_id where p.first_name = 'Paul' limit 1),
    (select player_id from public.registrations r join public.profiles p on p.id = r.player_id where p.first_name = 'Olga');
update public.pairings set result = '1-0';
select tests.eq((select count(*)::int from public.audit_logs), 0, 'le journal n''est pas lisible par un arbitre');
select tests.throws($$update public.tournaments set name = 'Autre nom' where slug = 'test-open' returning 1/0$$,
  'l''arbitre ne modifie pas la fiche du tournoi');

-- Les appariements non publiés restent invisibles au public.
select tests.as_anon();
select tests.eq((select count(*)::int from public.pairings), 0, 'appariements non publiés masqués');

-- Organisateur : import du classement final.
select tests.login_as((select orga from ids));
select tests.eq(public.import_standings('00000000-0000-0000-0000-00000000a001',
  '[{"rank":1,"name":"Paul Joueur","points":1},{"rank":2,"name":"Nouveau, Joueur","points":0,"club":"Club démo"}]'::jsonb), 2,
  'import du classement');
select tests.as_anon();
select tests.eq((select string_agg(display_name, ',' order by rank) from public.public_standings), 'Paul Joueur,Joueur Nouveau',
  'classement public, profil pré-créé pour un joueur inconnu');

select tests.reset_role();
select tests.eq((select count(*)::int from public.audit_logs where object_type = 'pairings'), 2, 'chaque modification d''appariement est journalisée');
