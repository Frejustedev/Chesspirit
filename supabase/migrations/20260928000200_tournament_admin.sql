-- Gestion d'un tournoi : affectation du staff par téléphone ou e-mail, duplication.

create or replace function public.add_tournament_staff(p_tournament_id uuid, p_identifier text, p_role text)
returns public.tournament_staff language plpgsql security definer set search_path = '' as $$
declare
  p public.profiles;
  s public.tournament_staff;
  v_id text := lower(trim(p_identifier));
begin
  if not private.can_manage_tournament(p_tournament_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('organizer', 'chief_arbiter', 'deputy_arbiter', 'operator') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  select * into p from public.profiles
    where merged_into is null and (lower(email) = v_id or phone = v_id or phone = '+229' || regexp_replace(v_id, '\D', '', 'g'))
    order by user_id nulls last limit 1;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  insert into public.tournament_staff (tournament_id, profile_id, role) values (p_tournament_id, p.id, p_role)
    on conflict (tournament_id, profile_id, role) do update set role = excluded.role
    returning * into s;
  if p.user_id is not null then
    insert into public.user_roles (user_id, role, granted_by)
      values (p.user_id, case when p_role = 'organizer' then 'organizer'::public.app_role else 'arbiter'::public.app_role end, auth.uid())
      on conflict do nothing;
  end if;
  insert into public.tournament_audit (tournament_id, action, details)
    values (p_tournament_id, 'add_staff', jsonb_build_object('profile', p.id, 'role', p_role));
  return s;
end $$;
revoke execute on function public.add_tournament_staff from anon, public;
grant execute on function public.add_tournament_staff to authenticated;

-- Liste du staff avec les noms (visible par le staff du tournoi).
create or replace function public.tournament_staff_list(p_tournament_id uuid)
returns table (id uuid, role text, profile_id uuid, name text, phone text, email text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.role, p.id, p.first_name || ' ' || p.last_name, p.phone, p.email
  from public.tournament_staff s join public.profiles p on p.id = s.profile_id
  where s.tournament_id = p_tournament_id and private.can_arbitrate(p_tournament_id)
  order by s.role, p.last_name
$$;
revoke execute on function public.tournament_staff_list from anon, public;
grant execute on function public.tournament_staff_list to authenticated;

-- Duplication d'un tournoi passé (édition suivante) : fiche, partenaires, dotations, formulaire.
create or replace function public.duplicate_tournament(p_tournament_id uuid, p_slug text, p_starts_at timestamptz)
returns public.tournaments language plpgsql security definer set search_path = '' as $$
declare
  src public.tournaments;
  t public.tournaments;
begin
  if not private.can_manage_tournament(p_tournament_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into src from public.tournaments where id = p_tournament_id;
  insert into public.tournaments (slug, name, edition, summary, description, venue, address, city, country, lat, lng,
    starts_at, cadence, base_minutes, increment_seconds, rounds_count, pairing_system, tiebreaks, categories, conditions,
    entry_fee_xof, entry_fee_notes, capacity, is_online, rated, counts_for_tour, status, validation_mode, waitlist_enabled,
    allow_online_payment, allow_on_site_payment, organizer_profile_id, organization_id, contact_phone, unconfirmed_fields,
    duplicated_from, initial_color, bye_points, is_demo)
  values (p_slug, src.name, null, src.summary, src.description, src.venue, src.address, src.city, src.country, src.lat, src.lng,
    p_starts_at, src.cadence, src.base_minutes, src.increment_seconds, src.rounds_count, src.pairing_system, src.tiebreaks,
    src.categories, src.conditions, src.entry_fee_xof, src.entry_fee_notes, src.capacity, src.is_online, src.rated,
    src.counts_for_tour, 'draft', src.validation_mode, src.waitlist_enabled, src.allow_online_payment,
    src.allow_on_site_payment, coalesce(private.my_profile_id(), src.organizer_profile_id), src.organization_id,
    src.contact_phone, src.unconfirmed_fields, src.id, src.initial_color, src.bye_points, src.is_demo)
  returning * into t;
  insert into public.tournament_partners (tournament_id, name, role, url, logo_path, position)
    select t.id, name, role, url, logo_path, position from public.tournament_partners where tournament_id = src.id;
  insert into public.prizes (tournament_id, kind, rank, category, label, amount_xof, position)
    select t.id, kind, rank, category, label, amount_xof, position from public.prizes where tournament_id = src.id;
  insert into public.registration_forms (tournament_id, fields)
    select t.id, fields from public.registration_forms where tournament_id = src.id;
  insert into public.tournament_staff (tournament_id, profile_id, role)
    select t.id, profile_id, role from public.tournament_staff where tournament_id = src.id;
  return t;
end $$;
revoke execute on function public.duplicate_tournament from anon, public;
grant execute on function public.duplicate_tournament to authenticated;
