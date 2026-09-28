-- Profils, rôles, consentements, vues publiques.
select tests.reset_role();
create temp table ids as select
  tests.create_user('alice@test.bj') as alice,
  tests.create_user('bob@test.bj') as bob,
  tests.create_user('admin@test.bj') as admin;
grant select on ids to anon, authenticated, service_role;
insert into public.user_roles (user_id, role) select admin, 'super_admin' from ids;

-- Alice crée son profil et celui de son enfant.
select tests.login_as((select alice from ids));
insert into public.profiles (user_id, first_name, last_name, birth_date, sex, city, is_public)
  values ((select alice from ids), 'Alice', 'Test', '1990-01-01', 'F', 'Cotonou', true);
insert into public.profiles (first_name, last_name, birth_date, sex, guardian_id, source, is_public)
  values ('Enfant', 'Test', '2015-06-01', 'M', private.my_profile_id(), 'guardian', true);
select tests.eq((select count(*)::int from public.profiles), 2, 'Alice voit son profil et celui de son enfant');
select tests.eq((select is_public from public.profiles where first_name = 'Enfant'), false, 'un mineur est privé par défaut');
select tests.throws($$insert into public.profiles (user_id, first_name, last_name) values ((select bob from ids), 'Faux', 'Bob')$$,
  'impossible de créer un profil pour un autre compte');
select tests.throws($$update public.profiles set verified = true where first_name = 'Alice'$$,
  'un joueur ne peut pas se déclarer vérifié');
select tests.throws($$update public.profiles set guardian_id = null where first_name = 'Enfant'$$,
  'un joueur ne peut pas modifier le lien parent-enfant');
update public.profiles set city = 'Porto-Novo' where first_name = 'Alice';
select tests.eq((select city from public.profiles where first_name = 'Alice'), 'Porto-Novo', 'Alice corrige ses données');
insert into public.consents (profile_id, type, version, granted) values (private.my_profile_id(), 'terms', '2026-09', true);

-- Bob ne voit pas le profil d'Alice dans la table, seulement la vue publique (sans téléphone ni naissance).
select tests.login_as((select bob from ids));
select tests.eq((select count(*)::int from public.profiles), 0, 'Bob ne voit aucune donnée privée');
select tests.eq((select count(*)::int from public.public_profiles where first_name = 'Alice'), 1, 'profil public visible');
select tests.eq((select count(*)::int from public.consents), 0, 'consentements privés');
select tests.throws($$select phone from public.public_profiles$$, 'la vue publique n''expose pas le téléphone');
select tests.eq((select count(*)::int from public.user_roles), 0, 'Bob ne voit pas les rôles des autres');
select tests.throws($$insert into public.user_roles (user_id, role) values ((select bob from ids), 'admin')$$,
  'impossible de s''attribuer un rôle');

-- Anonyme.
select tests.as_anon();
select tests.eq((select count(*)::int from public.public_profiles where last_name = 'Test'), 1, 'anonyme : seul le profil public adulte');
select tests.throws($$select * from public.profiles$$, 'anonyme : pas d''accès à la table profiles');
select tests.eq((select count(*)::int from public.app_settings where key = 'require_admin_mfa'), 0, 'paramètres privés masqués');

-- Administrateur : exige la double authentification (aal2).
select tests.login_as((select admin from ids), 'aal1');
select tests.eq((select count(*)::int from public.profiles), 0, 'admin sans 2FA : aucun accès étendu');
select tests.login_as((select admin from ids), 'aal2');
select tests.eq((select count(*)::int from public.profiles where last_name = 'Test'), 2, 'admin avec 2FA : voit tout');
select public.log_personal_data_access((select id from public.profiles where first_name = 'Alice'), 'test');
select tests.eq((select count(*)::int from public.audit_logs where action = 'view_personal_data'
  and object_id = (select id::text from public.profiles where first_name = 'Alice' and last_name = 'Test')), 1, 'consultation journalisée');
update public.profiles set verified = true where first_name = 'Alice';
select tests.eq((select verified from public.profiles where first_name = 'Alice'), true, 'admin peut vérifier un profil');

-- Correctifs de sécurité : indicateurs non forçables à la création, titres réservés.
select tests.reset_role();
create temp table sec as select tests.create_user('secu@test.bj') as u;
grant select on sec to authenticated;
select tests.login_as((select u from sec));
insert into public.profiles (user_id, first_name, last_name, verified, claimed, is_demo, titles)
  select u, 'Secu', 'Test', true, true, true, '{GM}' from sec;
select tests.eq((select verified or claimed or is_demo or titles <> '{}' from public.profiles where first_name = 'Secu'), false, 'indicateurs et titres ignorés à la création');
select tests.throws($$update public.profiles set titles = '{IM}' where first_name = 'Secu'$$, 'titres non modifiables par le joueur');
