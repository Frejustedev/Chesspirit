-- Durcissement de mise en production : vues en lecture seule, effacement d'un compte, droits explicites de l'API.
select tests.reset_role();
create temp table ids as select tests.create_user('effacement@test.bj') as membre;
grant select on ids to anon, authenticated, service_role;
insert into public.profiles (id, user_id, first_name, last_name, birth_date, is_public)
  select '00000000-0000-0000-0000-00000000f001', membre, 'Efa', 'Cement', '1990-01-01', true from ids;
insert into public.lessons_library (slug, level, theme, title, body, is_premium, status)
  values ('lecon-premium-durcie', 'advanced', 'endgames', '{"fr":"Premium"}', '{"fr":"Texte secret"}', true, 'published');
insert into public.tournaments (id, slug, name, starts_at, status, created_by)
  select '00000000-0000-0000-0000-00000000f002', 'effacement-test', 'Effacement test', now() + interval '10 days', 'registration_open', membre from ids;
insert into public.registrations (tournament_id, player_id, status, registered_by)
  select '00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f001', 'confirmed', membre from ids;

-- Aucune vue du schéma public n'est modifiable par les rôles d'API (catalogue complet, vues futures comprises).
select tests.eq((select count(*)::int from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
    and (has_table_privilege('anon', c.oid, 'INSERT, UPDATE, DELETE')
      or has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE'))), 0, 'aucune vue publique modifiable');

select tests.as_anon();
select tests.eq((select count(*)::int from public.public_profiles where id = '00000000-0000-0000-0000-00000000f001'), 1, 'vue des profils toujours lisible');
select tests.no_write($$delete from public.public_profiles where id = '00000000-0000-0000-0000-00000000f001'$$, 'suppression d''un profil par la vue refusée (anonyme)');
select tests.no_write($$update public.public_profiles set first_name = 'Pirate' where id = '00000000-0000-0000-0000-00000000f001'$$, 'modification d''un profil par la vue refusée (anonyme)');
select tests.no_write($$update public.lesson_catalog set is_premium = false where slug = 'lecon-premium-durcie'$$, 'déverrouillage premium par la vue refusé');
select tests.login_as((select membre from ids));
select tests.no_write($$delete from public.resource_catalog where true$$, 'suppression de ressources par la vue refusée (connecté)');
select tests.no_write($$update public.lesson_catalog set is_premium = false where slug = 'lecon-premium-durcie'$$, 'déverrouillage premium refusé (connecté)');

-- Droits explicites de l'API (identiques en local et sur un projet hébergé récent).
select tests.reset_role();
select tests.eq(has_table_privilege('anon', 'public.tournaments', 'SELECT'), true, 'tables publiques accessibles à l''API');
select tests.eq(has_function_privilege('anon', 'private.is_admin()', 'EXECUTE'), true, 'fonctions des politiques exécutables');
select tests.eq((select count(*)::int from pg_default_acl where defaclnamespace = 'private'::regnamespace and defaclobjtype = 'f') > 0, true, 'droits par défaut du schéma private déclarés');
select tests.eq(has_function_privilege('authenticated', 'private.order_paid(uuid)', 'EXECUTE'), false, 'fonctions internes toujours fermées');

-- Effacement : aucune clé étrangère vers auth.users ne bloque la suppression du compte de connexion.
select tests.eq((select count(*)::int from pg_constraint c
  where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and c.connamespace = 'public'::regnamespace
    and c.confdeltype in ('a', 'r')), 0, 'aucune clé étrangère bloquante vers auth.users');
delete from auth.users where id = (select membre from ids);
select tests.eq((select registered_by from public.registrations where tournament_id = '00000000-0000-0000-0000-00000000f002'), null::uuid, 'inscription conservée, auteur vidé');
select tests.eq((select created_by from public.tournaments where id = '00000000-0000-0000-0000-00000000f002'), null::uuid, 'tournoi conservé, créateur vidé');
select tests.eq((select user_id from public.profiles where id = '00000000-0000-0000-0000-00000000f001'), null::uuid, 'profil détaché du compte supprimé');

-- Réclamation d'un profil importé : le téléphone vérifié (format hébergé, sans « + ») rattache le profil.
select tests.reset_role();
create temp table claim as select tests.create_user(null, '22990000123') as u;
grant select on claim to anon, authenticated, service_role;
insert into public.profiles (id, first_name, last_name, phone, source)
  values ('00000000-0000-0000-0000-00000000f101', 'Importé', 'Joueur', '+22990000123', 'import');
select tests.login_as((select u from claim));
select tests.eq((public.complete_onboarding('{"first_name":"Importé","last_name":"Joueur","birth_date":"1995-05-05","sex":"M","city":"Cotonou","department":"littoral"}', '{"terms":true}')).id,
  '00000000-0000-0000-0000-00000000f101'::uuid, 'profil importé réclamé à la première connexion');
select tests.eq((select claimed from public.profiles where id = '00000000-0000-0000-0000-00000000f101'), true, 'profil marqué réclamé');
select tests.throws($$update public.profiles set verified = true where id = '00000000-0000-0000-0000-00000000f101'$$, 'champ protégé toujours refusé au joueur');
select tests.throws($$update public.profiles set user_id = null where id = '00000000-0000-0000-0000-00000000f101'$$, 'détachement du compte refusé au joueur');
