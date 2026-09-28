-- Administration : fusion de doublons, effacement, remboursements, rôles.
select tests.reset_role();
create temp table ids as select
  tests.create_user('admin@test.bj') as admin,
  tests.create_user('joueur@test.bj') as joueur;
grant select on ids to anon, authenticated, service_role;
insert into public.user_roles (user_id, role) select admin, 'admin' from ids;
insert into public.profiles (id, user_id, first_name, last_name, birth_date, phone)
  select '00000000-0000-0000-0000-0000000e0001', joueur, 'Jean', 'Dossou', '1990-05-05', '+22997000001' from ids;
insert into public.profiles (id, first_name, last_name, birth_date, fide_id, source)
  values ('00000000-0000-0000-0000-0000000e0002', 'Jéan', 'DOSSOU', '1990-05-05', '99990001', 'import');
insert into public.tournaments (id, slug, name, starts_at, status)
  values ('00000000-0000-0000-0000-0000000e0010', 'test-fusion', 'Fusion', now() - interval '3 days', 'finished'),
         ('00000000-0000-0000-0000-0000000e0011', 'test-fusion-2', 'Fusion 2', now() - interval '2 days', 'finished');
insert into public.registrations (tournament_id, player_id, status) values
  ('00000000-0000-0000-0000-0000000e0010', '00000000-0000-0000-0000-0000000e0002', 'confirmed'),
  ('00000000-0000-0000-0000-0000000e0011', '00000000-0000-0000-0000-0000000e0002', 'confirmed'),
  ('00000000-0000-0000-0000-0000000e0011', '00000000-0000-0000-0000-0000000e0001', 'confirmed');
insert into public.payments (id, provider, amount_xof, object_type, object_id, status)
  values ('00000000-0000-0000-0000-0000000e0020', 'fake', 5000, 'registration',
    (select id from public.registrations where player_id = '00000000-0000-0000-0000-0000000e0002' and tournament_id = '00000000-0000-0000-0000-0000000e0010'), 'succeeded');

select tests.login_as((select joueur from ids));
select tests.throws($$select public.admin_merge_profiles('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000e0002')$$, 'un joueur ne fusionne pas');
select tests.throws($$select public.admin_anonymize_profile('00000000-0000-0000-0000-0000000e0002')$$, 'un joueur n''anonymise pas');
select tests.eq((select count(*)::int from public.admin_find_duplicates('00000000-0000-0000-0000-0000000e0001')), 0, 'recherche de doublons réservée');

select tests.login_as((select admin from ids), 'aal1');
select tests.throws($$select public.admin_merge_profiles('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000e0002')$$, 'administrateur sans double authentification refusé');

select tests.login_as((select admin from ids), 'aal2');
select tests.eq((select reason from public.admin_find_duplicates('00000000-0000-0000-0000-0000000e0001') limit 1), 'name', 'doublon trouvé (nom sans accents + naissance)');
select public.admin_merge_profiles('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000e0002');
select tests.eq((select count(*)::int from public.registrations where player_id = '00000000-0000-0000-0000-0000000e0001'), 2, 'inscriptions reportées (conflit du même tournoi résolu)');
select tests.eq((select fide_id from public.profiles where id = '00000000-0000-0000-0000-0000000e0001'), '99990001', 'identifiant FIDE récupéré');
select tests.eq((select merged_into from public.profiles where id = '00000000-0000-0000-0000-0000000e0002'), '00000000-0000-0000-0000-0000000e0001'::uuid, 'doublon marqué fusionné');
select tests.throws($$select public.admin_merge_profiles('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000e0002')$$, 'pas de double fusion');

select tests.eq((select status from public.admin_record_refund('00000000-0000-0000-0000-0000000e0020', 2000, 'geste')), 'succeeded', 'remboursement partiel');
select tests.throws($$select public.admin_record_refund('00000000-0000-0000-0000-0000000e0020', 4000, 'trop')$$, 'remboursement au-delà du payé refusé');
select public.admin_record_refund('00000000-0000-0000-0000-0000000e0020', 3000, 'solde');
select tests.eq((select status from public.payments where id = '00000000-0000-0000-0000-0000000e0020'), 'refunded', 'paiement remboursé en totalité');
select tests.no_write($$insert into public.user_roles (user_id, role) values ((select joueur from ids), 'admin')$$, 'un admin simple n''attribue pas de rôle');

select tests.eq((select public.admin_anonymize_profile('00000000-0000-0000-0000-0000000e0001')), (select joueur from ids), 'anonymisation (renvoie le compte à supprimer)');
select tests.eq((select first_name || ' ' || last_name || coalesce(phone, '-') from public.profiles where id = '00000000-0000-0000-0000-0000000e0001'), 'Joueur anonyme-', 'identité effacée');
select tests.eq((select count(*)::int from public.registrations where player_id = '00000000-0000-0000-0000-0000000e0001'), 2, 'résultats conservés');
select tests.eq((select count(*)::int from public.audit_logs where action in ('merge_profiles', 'anonymize_profile') and object_id = '00000000-0000-0000-0000-0000000e0001'), 2, 'fusion et effacement journalisés');
