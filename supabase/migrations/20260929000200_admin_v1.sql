-- Administration v1 : doublons et fusion de profils, anonymisation (droit à l'effacement),
-- recherche de doublons, remboursements tracés.

-- Doublons probables d'un profil : même téléphone, même identifiant FIDE, ou même nom et date de naissance.
create or replace function public.admin_find_duplicates(p_profile uuid)
returns table (id uuid, first_name text, last_name text, birth_date date, phone text, fide_id text, user_id uuid, reason text)
language sql stable security definer set search_path = '' as $$
  select o.id, o.first_name, o.last_name, o.birth_date, o.phone, o.fide_id, o.user_id,
    case when o.phone = p.phone then 'phone' when o.fide_id = p.fide_id then 'fide' else 'name' end
  from public.profiles p
  join public.profiles o on o.id <> p.id and o.merged_into is null
    and ((p.phone is not null and o.phone = p.phone)
      or (p.fide_id is not null and o.fide_id = p.fide_id)
      or (private.unaccent_lower(o.first_name || ' ' || o.last_name) = private.unaccent_lower(p.first_name || ' ' || p.last_name)
          and (o.birth_date is null or p.birth_date is null or o.birth_date = p.birth_date)))
  where p.id = p_profile and private.is_admin()
  limit 20
$$;

/*
 * Fusionne p_merge dans p_keep : toutes les références (inscriptions, parties, cotes, commandes…)
 * sont reportées sur p_keep. En cas de conflit d'unicité (même tournoi, même liste…), la ligne du
 * doublon est supprimée. Le doublon est conservé, marqué merged_into, pour l'historique.
 */
create or replace function public.admin_merge_profiles(p_keep uuid, p_merge uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  keep public.profiles;
  dup public.profiles;
  fk record;
  r record;
  moved int := 0;
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_keep = p_merge then raise exception 'same_profile' using errcode = '22023'; end if;
  select * into keep from public.profiles where id = p_keep for update;
  select * into dup from public.profiles where id = p_merge for update;
  if keep.id is null or dup.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if keep.merged_into is not null or dup.merged_into is not null then raise exception 'already_merged' using errcode = '22023'; end if;
  if keep.user_id is not null and dup.user_id is not null then raise exception 'two_accounts' using errcode = '22023'; end if;

  for fk in
    select cl.relname as tbl, att.attname as col
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype = 'f' and con.confrelid = 'public.profiles'::regclass and ns.nspname = 'public'
      and array_length(con.conkey, 1) = 1
      and not (cl.relname = 'profiles' and att.attname = 'merged_into')
  loop
    for r in execute format('select ctid from public.%I where %I = $1', fk.tbl, fk.col) using p_merge loop
      begin
        execute format('update public.%I set %I = $1 where ctid = $2', fk.tbl, fk.col) using p_keep, r.ctid;
        moved := moved + 1;
      exception when unique_violation then
        execute format('delete from public.%I where ctid = $1', fk.tbl) using r.ctid;
      end;
    end loop;
  end loop;

  -- Compte de connexion et informations manquantes reportés sur le profil conservé.
  update public.profiles set user_id = null where id = dup.id;
  update public.profiles set
    user_id = coalesce(keep.user_id, dup.user_id),
    phone = coalesce(keep.phone, dup.phone),
    email = coalesce(keep.email, dup.email),
    birth_date = coalesce(keep.birth_date, dup.birth_date),
    fide_id = coalesce(keep.fide_id, dup.fide_id),
    club_name = coalesce(keep.club_name, dup.club_name),
    claimed = keep.claimed or dup.claimed,
    verified = keep.verified or dup.verified,
    onboarded = keep.onboarded or dup.onboarded
  where id = keep.id;
  update public.profiles set merged_into = keep.id, is_public = false, phone = null, fide_id = null where id = dup.id;
  perform private.audit('merge_profiles', 'profiles', keep.id::text, to_jsonb(dup), jsonb_build_object('kept', keep.id, 'moved', moved));
  return moved;
end $$;
revoke execute on function public.admin_merge_profiles from anon, public;
grant execute on function public.admin_merge_profiles to authenticated;

/*
 * Effacement (RGPD) : les données d'identification sont supprimées ; les résultats sportifs
 * restent sous un nom anonyme pour ne pas fausser les classements et cotes des autres joueurs.
 * La suppression du compte de connexion est faite ensuite par le serveur (API d'administration).
 */
create or replace function public.admin_anonymize_profile(p_profile uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  p public.profiles;
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into p from public.profiles where id = p_profile for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.profiles set
    first_name = 'Joueur', last_name = 'anonyme', birth_date = null, sex = null, phone = null, email = null,
    photo_path = null, city = null, department = null, club_name = null, fide_id = null, bio = null,
    is_public = false, user_id = null, notification_prefs = '{"email": false, "sms": false, "whatsapp": false}'
  where id = p.id;
  delete from public.consents where profile_id = p.id;
  delete from public.wishlists where profile_id = p.id;
  update public.orders set contact_name = 'Anonyme', contact_phone = '+00000000', contact_email = null, delivery_address = '{}'
    where profile_id = p.id;
  perform private.audit('anonymize_profile', 'profiles', p.id::text, null, jsonb_build_object('had_account', p.user_id is not null));
  return p.user_id;
end $$;
revoke execute on function public.admin_anonymize_profile from anon, public;
grant execute on function public.admin_anonymize_profile to authenticated;

-- Remboursement enregistré (le reversement se fait chez le prestataire ; statut suivi ici).
create or replace function public.admin_record_refund(p_payment uuid, p_amount int, p_reason text)
returns public.refunds language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
  already int;
  rf public.refunds;
begin
  if not (private.is_admin_of('shop') or private.is_admin_of('competitions')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into pay from public.payments where id = p_payment for update;
  if not found or pay.status <> 'succeeded' then raise exception 'not_refundable' using errcode = '22023'; end if;
  select coalesce(sum(amount_xof), 0) into already from public.refunds where payment_id = pay.id and status <> 'failed';
  if p_amount < 1 or already + p_amount > pay.amount_xof then raise exception 'invalid_amount' using errcode = '22023'; end if;
  insert into public.refunds (payment_id, amount_xof, reason, status) values (pay.id, p_amount, left(p_reason, 500), 'succeeded')
    returning * into rf;
  if already + p_amount = pay.amount_xof then
    update public.payments set status = 'refunded' where id = pay.id;
    if pay.object_type = 'order' then
      update public.orders set status = 'refunded' where id = pay.object_id and status not in ('cancelled', 'refunded');
      insert into public.order_events (order_id, status, note) values (pay.object_id, 'refunded', left(p_reason, 500));
    elsif pay.object_type = 'registration' then
      update public.registrations set payment_status = 'refunded' where id = pay.object_id;
    end if;
  end if;
  return rf;
end $$;
revoke execute on function public.admin_record_refund from anon, public;
grant execute on function public.admin_record_refund to authenticated;
