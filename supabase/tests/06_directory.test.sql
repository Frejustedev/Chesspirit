-- Annuaire : structures proposées puis modérées, revendications, offres d'emploi, arbitres, mineurs.
select tests.reset_role();
create temp table ids as select
  tests.create_user('membre@test.bj') as membre,
  tests.create_user('admin-annuaire@test.bj') as admin;
grant select on ids to anon, authenticated, service_role;
insert into public.user_roles (user_id, role) select admin, 'admin' from ids;
insert into public.profiles (user_id, first_name, last_name, birth_date, is_public) select membre, 'Mia', 'Membre', '1990-01-01', true from ids;
insert into public.profiles (first_name, last_name, birth_date, is_public, source) values ('Kiki', 'Mineurlongnom', '2015-01-01', true, 'import');
update public.profiles set is_public = true where last_name = 'Mineurlongnom';
insert into public.organizations (id, type, name, slug, is_public) values ('00000000-0000-0000-0000-0000000f0001', 'club', 'Club Test', 'club-test-annuaire', true);

select tests.as_anon();
select tests.eq((select last_name from public.public_profiles where first_name = 'Kiki'), 'M.', 'mineur : nom de famille réduit');

select tests.login_as((select membre from ids));
select public.propose_organization('{"type":"club","name":"Nouveau club","city":"Cotonou"}');
select tests.eq((select is_public::text || verified::text from public.organizations where name = 'Nouveau club'), 'falsefalse', 'structure proposée masquée et non vérifiée');
select tests.eq((select role from public.organization_members m join public.organizations o on o.id = m.organization_id where o.name = 'Nouveau club'), 'owner', 'le proposant gère la fiche');
select tests.throws($$update public.organizations set verified = true where name = 'Nouveau club'$$, 'badge vérifié non modifiable par le gestionnaire');
insert into public.listing_claims (organization_id, profile_id, role_in_org) values ('00000000-0000-0000-0000-0000000f0001', private.my_profile_id(), 'Présidente');
select tests.throws($$insert into public.listing_claims (organization_id, profile_id, role_in_org, status) values ('00000000-0000-0000-0000-0000000f0001', private.my_profile_id(), 'x', 'approved')$$, 'revendication auto-approuvée impossible');
insert into public.job_posts (posted_by, kind, title, description, contact) values (private.my_profile_id(), 'coach', 'Coach recherché', 'Une description suffisamment longue pour passer.', 'mia@test.bj');
select tests.throws($$insert into public.job_posts (posted_by, kind, title, description, contact, status) values (private.my_profile_id(), 'coach', 'Coach direct', 'Une description suffisamment longue pour passer.', 'x@test.bj', 'published')$$, 'offre publiée sans modération impossible');
insert into public.arbiter_profiles (profile_id, title, verified) values (private.my_profile_id(), 'FA', true);
select tests.eq((select verified from public.arbiter_profiles where profile_id = private.my_profile_id()), false, 'arbitre : badge vérifié non auto-attribué');

select tests.as_anon();
select tests.no_read($$select * from public.listing_claims$$, 'revendications non lisibles par un anonyme');
select tests.eq((select count(*)::int from public.job_posts where title = 'Coach recherché'), 0, 'offre en attente invisible');
select tests.eq((select count(*)::int from public.organizations where name = 'Nouveau club'), 0, 'structure en attente invisible');

select tests.login_as((select admin from ids), 'aal2');
select public.decide_listing_claim((select id from public.listing_claims where role_in_org = 'Présidente'), true);
select tests.eq((select verified from public.organizations where slug = 'club-test-annuaire'), true, 'revendication acceptée : fiche vérifiée');
update public.job_posts set status = 'published' where title = 'Coach recherché';
update public.arbiter_profiles set verified = true where title = 'FA' and profile_id = (select id from public.profiles where first_name = 'Mia');

select tests.as_anon();
select tests.eq((select count(*)::int from public.job_posts where title = 'Coach recherché'), 1, 'offre publiée visible');
select tests.eq((select verified from public.public_arbiters where display_name = 'Mia Membre'), true, 'arbitre vérifié visible');
