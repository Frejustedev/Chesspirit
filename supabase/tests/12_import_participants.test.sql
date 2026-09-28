-- Import des participants d'un tournoi.
select tests.reset_role();
create temp table ids as select tests.create_user('imp-admin@test.bj') as admin, tests.create_user('imp-membre@test.bj') as membre;
grant select on ids to anon, authenticated, service_role;
insert into public.user_roles (user_id, role) select admin, 'admin' from ids;
insert into public.profiles (user_id, first_name, last_name) select membre, 'Mo', 'Membre' from ids;
insert into public.profiles (first_name, last_name, fide_id, source) values ('Fide', 'Connu', '99887766', 'import');
insert into public.tournaments (id, slug, name, starts_at, status, entry_fee_xof)
  values ('00000000-0000-0000-0000-00000000f001', 'import-test', 'Import test', now() + interval '5 days', 'registration_open', 2000);
create temp table rows_in as select '[
  {"first_name":"Awa","last_name":"Import","birth_date":"2001-02-03","sex":"f","phone":"+229 01 90 11 22 33","payment":"paid"},
  {"first_name":"Autre","last_name":"Nom","fide_id":"99887766"},
  {"first_name":"","last_name":"SansPrenom"},
  {"first_name":"Tel","last_name":"Faux","phone":"123"}
]'::jsonb as j;
grant select on rows_in to authenticated;

select tests.login_as((select membre from ids));
select tests.throws($$select public.import_participants('00000000-0000-0000-0000-00000000f001', (select j from rows_in))$$, 'import réservé à l''organisation');

select tests.login_as((select admin from ids), 'aal2');
create temp table res as select public.import_participants('00000000-0000-0000-0000-00000000f001', (select j from rows_in)) as r;
select tests.eq((select (r ->> 'registered')::int from res), 2, 'deux participants inscrits');
select tests.eq((select (r ->> 'created_profiles')::int from res), 1, 'un profil créé');
select tests.eq((select (r ->> 'matched_profiles')::int from res), 1, 'profil retrouvé par identifiant FIDE');
select tests.eq((select jsonb_array_length(r -> 'errors') from res), 2, 'lignes invalides signalées');
select tests.eq((select payment_status::text || '/' || amount_xof from public.registrations r join public.profiles p on p.id = r.player_id where p.last_name = 'Import'), 'paid/2000', 'paiement et montant du tournoi');
select tests.eq((select p.phone || ' ' || p.is_public::text from public.profiles p where p.last_name = 'Import'), '+2290190112233 false', 'profil importé privé');
