-- Import des participants d'un tournoi (liste tenue hors du site) par l'équipe d'organisation.
-- Chaque ligne : prénom, nom, et au choix date de naissance, sexe, téléphone, club, identifiant FIDE, paiement.
-- Un profil existant est retrouvé par identifiant FIDE, puis par téléphone, puis par nom et date de naissance ;
-- sinon un profil non réclamé est créé (privé, source « import »).
create or replace function public.import_participants(p_tournament uuid, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.tournaments;
  r jsonb;
  i int := 0;
  v_first text; v_last text; v_birth date; v_sex public.sex; v_phone text; v_club text; v_fide text; v_pay text;
  pid uuid;
  created int := 0; matched int := 0; registered int := 0; already int := 0;
  errors jsonb := '[]';
begin
  if not private.can_manage_tournament(p_tournament) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into t from public.tournaments where id = p_tournament;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'invalid_rows' using errcode = '22023';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    begin
      v_first := nullif(trim(r ->> 'first_name'), '');
      v_last := nullif(trim(r ->> 'last_name'), '');
      if v_first is null or v_last is null or char_length(v_first) > 80 or char_length(v_last) > 80 then
        raise exception 'name_required';
      end if;
      v_birth := nullif(trim(r ->> 'birth_date'), '')::date;
      if v_birth is not null and (v_birth > current_date or v_birth < date '1900-01-01') then raise exception 'birth_date_invalid'; end if;
      v_sex := nullif(upper(trim(r ->> 'sex')), '')::public.sex;
      v_phone := nullif(regexp_replace(coalesce(r ->> 'phone', ''), '[\s.-]', '', 'g'), '');
      if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'phone_invalid'; end if;
      v_club := nullif(trim(r ->> 'club'), '');
      v_fide := nullif(trim(r ->> 'fide_id'), '');
      if v_fide is not null and v_fide !~ '^[0-9]{4,10}$' then raise exception 'fide_invalid'; end if;
      v_pay := coalesce(nullif(lower(trim(r ->> 'payment')), ''), case when coalesce(t.entry_fee_xof, 0) = 0 then 'not_required' else 'due_on_site' end);
      if v_pay not in ('paid', 'due_on_site', 'not_required') then raise exception 'payment_invalid'; end if;

      pid := null;
      if v_fide is not null then
        select id into pid from public.profiles where fide_id = v_fide and merged_into is null;
      end if;
      if pid is null and v_phone is not null then
        select id into pid from public.profiles where phone = v_phone and merged_into is null order by created_at limit 1;
      end if;
      if pid is null and v_birth is not null then
        select id into pid from public.profiles
        where private.unaccent_lower(first_name) = private.unaccent_lower(v_first)
          and private.unaccent_lower(last_name) = private.unaccent_lower(v_last)
          and birth_date = v_birth and merged_into is null
        order by created_at limit 1;
      end if;
      if pid is null then
        insert into public.profiles (first_name, last_name, birth_date, sex, phone, club_name, fide_id, source, is_public)
        values (v_first, v_last, v_birth, v_sex, v_phone, v_club, v_fide, 'import', false)
        returning id into pid;
        created := created + 1;
      else
        matched := matched + 1;
      end if;

      insert into public.registrations (tournament_id, player_id, status, payment_status, amount_xof, source, registered_by)
      values (p_tournament, pid, 'confirmed', v_pay::public.payment_status,
        case when v_pay = 'not_required' then null else t.entry_fee_xof end, 'import', auth.uid())
      on conflict (tournament_id, player_id) do nothing;
      if found then registered := registered + 1; else already := already + 1; end if;
    exception when others then
      errors := errors || jsonb_build_object('line', i, 'error',
        case when sqlerrm in ('name_required', 'birth_date_invalid', 'phone_invalid', 'fide_invalid', 'payment_invalid')
          then sqlerrm else 'invalid' end);
    end;
  end loop;
  perform private.audit('import_participants', 'tournaments', p_tournament::text, null,
    jsonb_build_object('registered', registered, 'created', created, 'errors', jsonb_array_length(errors)));
  return jsonb_build_object('registered', registered, 'already', already, 'created_profiles', created,
    'matched_profiles', matched, 'errors', errors);
end $$;
revoke execute on function public.import_participants from anon, public;
grant execute on function public.import_participants to authenticated;
