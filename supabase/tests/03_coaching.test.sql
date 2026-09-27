-- Coaching : offres publiques, réservation, commission, suivi réservé au coach et à l'élève.
select tests.reset_role();
create temp table ids as select
  tests.create_user('coach@test.bj') as coach,
  tests.create_user('eleve@test.bj') as eleve,
  tests.create_user('autre@test.bj') as autre;
grant select on ids to anon, authenticated, service_role;
insert into public.profiles (user_id, first_name, last_name, birth_date, sex) select coach, 'Carla', 'Coach', '1985-01-01', 'F' from ids;
insert into public.profiles (user_id, first_name, last_name, birth_date, sex) select eleve, 'Eli', 'Eleve', '2005-01-01', 'M' from ids;
insert into public.profiles (user_id, first_name, last_name, birth_date, sex) select autre, 'Aude', 'Autre', '1999-01-01', 'F' from ids;
insert into public.coach_profiles (id, profile_id, slug, status)
  select '00000000-0000-0000-0000-0000000c0001', id, 'carla-coach-test', 'approved' from public.profiles where first_name = 'Carla';
insert into public.offers (id, coach_id, title, language, modality, level, format, price_xof)
  values ('00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-0000000c0001', '{"fr":"Cours test"}', 'fr', 'online', 'beginner', 'individual', 10000);
insert into public.availability_slots (id, coach_id, starts_at, ends_at, modality)
  values ('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-0000000c0001', now() + interval '2 days', now() + interval '2 days 1 hour', 'online');

select tests.as_anon();
select tests.eq((select count(*)::int from public.offers where id = '00000000-0000-0000-0000-0000000c0002'), 1, 'offre publique visible');
select tests.eq((select count(*)::int from public.public_coaches where slug = 'carla-coach-test'), 1, 'coach approuvé visible');
select tests.throws($$select public.book_slot('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-0000000c0002', gen_random_uuid())$$, 'anonyme : réservation impossible');

select tests.login_as((select eleve from ids));
select tests.eq((select status || '/' || amount_xof || '/' || commission_xof from public.book_slot('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-0000000c0002', private.my_profile_id())),
  'pending_payment/10000/1500', 'réservation avec commission de 15 %');
select tests.throws($$select public.book_slot('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-0000000c0002', private.my_profile_id())$$, 'créneau individuel déjà pris');
select tests.throws($$update public.bookings set status = 'confirmed' returning 1/0$$, 'l''élève ne confirme pas sa réservation');
select tests.throws($$insert into public.progress_notes (coach_id, student_id, note) values ('00000000-0000-0000-0000-0000000c0001', private.my_profile_id(), 'x')$$,
  'l''élève n''écrit pas de note de coach');

select tests.login_as((select autre from ids));
select tests.eq((select count(*)::int from public.bookings), 0, 'une autre personne ne voit pas la réservation');
select tests.throws($$update public.offers set price_xof = 1 where id = '00000000-0000-0000-0000-0000000c0002' returning 1/0$$, 'impossible de modifier l''offre d''un autre coach');

select tests.login_as((select coach from ids));
select tests.eq((select count(*)::int from public.bookings), 1, 'le coach voit la réservation');
insert into public.progress_notes (coach_id, student_id, note)
  select '00000000-0000-0000-0000-0000000c0001', student_id, 'Bonne séance' from public.bookings;
select tests.eq((select count(*)::int from public.progress_notes), 1, 'le coach note son élève');
select tests.throws($$update public.coach_profiles set status = 'approved', is_chesspirit = true where slug = 'carla-coach-test'$$, 'le coach ne change pas son statut');
select tests.eq((select count(*)::int from public.profiles where first_name = 'Eli'), 1, 'le coach voit la fiche de son élève');
select tests.eq((select count(*)::int from public.profiles where first_name = 'Aude'), 0, 'mais pas celle d''une autre personne');

-- Correctifs de sécurité : le coach ne réaffecte pas une réservation ni ne change les montants.
select tests.login_as((select coach from ids));
select tests.throws($$update public.bookings set student_id = (select id from public.profiles where first_name = 'Aude' limit 1)$$, 'le coach ne change pas l''élève d''une réservation');
select tests.throws($$update public.bookings set commission_xof = 0$$, 'le coach ne change pas la commission');
