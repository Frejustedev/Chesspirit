-- Jetons de notification (application mobile) et pays de la sous-région.
select tests.reset_role();
create temp table ids as select tests.create_user('mobile-a@test.bj') as a, tests.create_user('mobile-b@test.bj') as b;
grant select on ids to anon, authenticated, service_role;
insert into public.profiles (user_id, first_name, last_name, birth_date) select a, 'Ama', 'Mobile', '1990-01-01' from ids;
insert into public.profiles (user_id, first_name, last_name, birth_date) select b, 'Bio', 'Mobile', '1990-01-01' from ids;

select tests.login_as((select a from ids));
insert into public.push_tokens (token, profile_id, platform) values ('ExponentPushToken[aaaaaaaaaaaaaaaa]', private.my_profile_id(), 'android');
select tests.throws($$insert into public.push_tokens (token, profile_id, platform) values ('ExponentPushToken[bbbbbbbbbbbbbbbb]', (select id from public.profiles where first_name = 'Bio'), 'ios')$$, 'jeton pour un autre profil refusé');
select tests.throws($$insert into public.push_tokens (token, profile_id, platform) values ('pas-un-jeton', private.my_profile_id(), 'ios')$$, 'format de jeton contrôlé');
select tests.throws($$update public.profiles set country = 'ZZ' where id = private.my_profile_id()$$, 'pays inconnu refusé');
update public.countries set enabled = true where code = 'TG';
select tests.eq((select enabled from public.countries where code = 'TG'), false, 'ouverture d''un pays réservée à la super-administration');

select tests.login_as((select b from ids));
select tests.eq((select count(*)::int from public.push_tokens), 0, 'jetons des autres invisibles');
select tests.as_anon();
select tests.eq((select count(*)::int from public.countries where enabled), 1, 'seul le Bénin est ouvert');
select tests.no_read($$select * from public.push_tokens$$, 'jetons non lisibles par un anonyme');
