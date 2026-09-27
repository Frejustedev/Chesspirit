-- Un coach voit la fiche des élèves qui ont réservé un cours avec lui (moindre privilège).
create or replace function private.coach_sees_profile(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bookings b where b.student_id = pid and b.coach_id = private.my_coach_id())
$$;
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (private.manages_profile(id) or private.is_admin() or private.staff_sees_profile(id) or private.coach_sees_profile(id));
