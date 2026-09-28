-- Création du profil après la première connexion, réclamation d'un profil pré-créé, compte famille.

-- Profil minimal + consentements + rôle joueur, en une transaction.
-- Si le numéro de téléphone vérifié (OTP) correspond à un profil importé non réclamé, il est réclamé.
create or replace function public.complete_onboarding(p_profile jsonb, p_consents jsonb, p_version text default '2026-09')
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_email text;
  p public.profiles;
  k text;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if coalesce((p_consents ->> 'terms')::boolean, false) = false then
    raise exception 'terms_required' using errcode = 'P0001';
  end if;
  select case when u.phone is null or u.phone = '' then null else '+' || ltrim(u.phone, '+') end, u.email
    into v_phone, v_email from auth.users u where u.id = v_uid;

  select * into p from public.profiles where user_id = v_uid;
  if not found and v_phone is not null then
    select * into p from public.profiles
      where phone = v_phone and user_id is null and source in ('import', 'express') and merged_into is null
      order by created_at limit 1 for update;
    if found then
      update public.profiles set user_id = v_uid, claimed = true where id = p.id returning * into p;
    end if;
  end if;

  if p.id is null then
    insert into public.profiles (user_id, first_name, last_name, source, phone, email)
    values (v_uid, p_profile ->> 'first_name', p_profile ->> 'last_name', 'signup', v_phone, v_email)
    returning * into p;
  end if;

  update public.profiles set
    first_name = p_profile ->> 'first_name',
    last_name = p_profile ->> 'last_name',
    birth_date = (p_profile ->> 'birth_date')::date,
    sex = (p_profile ->> 'sex')::public.sex,
    city = p_profile ->> 'city',
    department = p_profile ->> 'department',
    club_name = nullif(p_profile ->> 'club_name', ''),
    fide_id = nullif(p_profile ->> 'fide_id', ''),
    phone = coalesce(phone, v_phone),
    email = coalesce(email, v_email),
    is_public = coalesce((p_consents ->> 'public_profile')::boolean, false)
      and (p_profile ->> 'birth_date')::date <= (current_date - interval '18 years'),
    onboarded = true
  where id = p.id returning * into p;

  foreach k in array array['terms', 'newsletter', 'public_profile', 'image_rights'] loop
    insert into public.consents (profile_id, type, version, granted)
    values (p.id, k::public.consent_type, p_version, coalesce((p_consents ->> k)::boolean, false));
  end loop;

  insert into public.user_roles (user_id, role) values (v_uid, 'player') on conflict do nothing;
  return p;
end $$;
revoke execute on function public.complete_onboarding from anon, public;
grant execute on function public.complete_onboarding to authenticated;

-- Compte famille : un parent crée le profil de son enfant mineur (accord parental tracé).
create or replace function public.add_child(p_profile jsonb, p_image_rights boolean default false)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  v_parent uuid := private.my_profile_id();
  c public.profiles;
begin
  if v_parent is null then
    raise exception 'profile_required' using errcode = 'P0001';
  end if;
  if (p_profile ->> 'birth_date')::date <= (current_date - interval '18 years') then
    raise exception 'child_must_be_minor' using errcode = 'P0001';
  end if;
  insert into public.profiles (first_name, last_name, birth_date, sex, city, department, club_name, fide_id,
    guardian_id, source, onboarded, is_public)
  values (p_profile ->> 'first_name', p_profile ->> 'last_name', (p_profile ->> 'birth_date')::date,
    (p_profile ->> 'sex')::public.sex, p_profile ->> 'city', p_profile ->> 'department',
    nullif(p_profile ->> 'club_name', ''), nullif(p_profile ->> 'fide_id', ''), v_parent, 'guardian', true, false)
  returning * into c;
  insert into public.consents (profile_id, type, version, granted) values
    (c.id, 'parental', '2026-09', true),
    (c.id, 'image_rights', '2026-09', coalesce(p_image_rights, false));
  insert into public.user_roles (user_id, role) values (auth.uid(), 'parent') on conflict do nothing;
  return c;
end $$;
revoke execute on function public.add_child from anon, public;
grant execute on function public.add_child to authenticated;
