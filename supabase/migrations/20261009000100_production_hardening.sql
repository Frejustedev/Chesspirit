-- Durcissement avant la mise en production (audit du 28 septembre 2026).
-- Numérotée après la dernière migration existante : toute nouvelle migration doit garder un numéro croissant.

-- 1. Vues en lecture seule pour les rôles d'API.
-- Les droits par défaut accordent aussi l'écriture sur chaque nouvelle vue. Trois vues sont modifiables
-- automatiquement (public_profiles, lesson_catalog, resource_catalog) et s'exécutent avec les droits de leur
-- propriétaire : un visiteur anonyme pouvait donc modifier ou supprimer les lignes sous-jacentes sans RLS.
do $$
declare v regclass;
begin
  for v in
    select c.oid::regclass from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
  loop
    execute format('revoke insert, update, delete, truncate, references, trigger on %s from anon, authenticated', v);
  end loop;
end $$;

-- Fonctions internes (appelées seulement par des fonctions « security definer ») : fermées aussi au rôle de
-- service, comme dans la pile locale, maintenant que le schéma private a des droits par défaut explicites.
revoke execute on function private.order_paid(uuid), private.release_order(uuid), private.unwind_paid_order(uuid),
  private.expire_orders(), private.audit(text, text, text, jsonb, jsonb), private.gift_code(),
  private.membership_paid(uuid)
  from service_role;

-- 2. Suppression d'un compte de connexion (droit à l'effacement) : les colonnes qui mémorisent l'auteur d'une
-- action ne bloquent plus la suppression, elles sont vidées.
alter table public.user_roles drop constraint user_roles_granted_by_fkey,
  add constraint user_roles_granted_by_fkey foreign key (granted_by) references auth.users (id) on delete set null;
alter table public.consents drop constraint consents_granted_by_fkey,
  add constraint consents_granted_by_fkey foreign key (granted_by) references auth.users (id) on delete set null;
alter table public.data_requests drop constraint data_requests_processed_by_fkey,
  add constraint data_requests_processed_by_fkey foreign key (processed_by) references auth.users (id) on delete set null;
alter table public.tournaments drop constraint tournaments_created_by_fkey,
  add constraint tournaments_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;
alter table public.registrations drop constraint registrations_registered_by_fkey,
  add constraint registrations_registered_by_fkey foreign key (registered_by) references auth.users (id) on delete set null;
alter table public.registrations drop constraint registrations_checked_in_by_fkey,
  add constraint registrations_checked_in_by_fkey foreign key (checked_in_by) references auth.users (id) on delete set null;
alter table public.pairings drop constraint pairings_result_entered_by_fkey,
  add constraint pairings_result_entered_by_fkey foreign key (result_entered_by) references auth.users (id) on delete set null;
alter table public.pairings drop constraint pairings_updated_by_fkey,
  add constraint pairings_updated_by_fkey foreign key (updated_by) references auth.users (id) on delete set null;
alter table public.games drop constraint games_created_by_fkey,
  add constraint games_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;
alter table public.games drop constraint games_validated_by_fkey,
  add constraint games_validated_by_fkey foreign key (validated_by) references auth.users (id) on delete set null;
alter table public.refunds drop constraint refunds_requested_by_fkey,
  add constraint refunds_requested_by_fkey foreign key (requested_by) references auth.users (id) on delete set null;
alter table public.bookings drop constraint bookings_booked_by_fkey,
  add constraint bookings_booked_by_fkey foreign key (booked_by) references auth.users (id) on delete set null;
alter table public.coach_applications drop constraint coach_applications_reviewed_by_fkey,
  add constraint coach_applications_reviewed_by_fkey foreign key (reviewed_by) references auth.users (id) on delete set null;
alter table public.league_postponements drop constraint league_postponements_decided_by_fkey,
  add constraint league_postponements_decided_by_fkey foreign key (decided_by) references auth.users (id) on delete set null;
alter table public.listing_claims drop constraint listing_claims_decided_by_fkey,
  add constraint listing_claims_decided_by_fkey foreign key (decided_by) references auth.users (id) on delete set null;

-- 3. Import de participants : rapprochement par date de naissance indexé (limite de durée des requêtes
-- de l'API hébergée : 8 s pour un utilisateur connecté).
create index if not exists profiles_birth_date_idx on public.profiles (birth_date);

-- 4. Indicateurs de fonctionnalité : « payments_online » est désormais lu par le site (interrupteur du paiement
-- en ligne, effectif seulement avec un prestataire configuré) ; « google_login » n'était lu nulle part : le
-- bouton Google suit le fournisseur activé dans Supabase Auth.
update public.feature_flags
  set description = 'Paiement en ligne (effectif seulement si un prestataire est configuré : PAYMENT_PROVIDER et ses clés)'
  where key = 'payments_online';
delete from public.feature_flags where key = 'google_login';

-- 5. Réclamation d'un profil importé à la première connexion : le garde des profils juge le rôle qui exécute
-- la requête (comme ceux des inscriptions et des réservations). Dans une fonction « security definer »
-- (complete_onboarding, fusion, anonymisation), ce sont les contrôles de la fonction qui s'appliquent ;
-- auparavant, la réclamation par complete_onboarding était refusée (forbidden_field).
create or replace function private.profiles_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') or private.is_admin() then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
     or new.verified is distinct from old.verified
     or new.merged_into is distinct from old.merged_into
     or new.suspended_at is distinct from old.suspended_at
     or new.claimed is distinct from old.claimed
     or new.source is distinct from old.source
     or new.is_demo is distinct from old.is_demo
     or new.guardian_id is distinct from old.guardian_id
     or new.titles is distinct from old.titles then
    raise exception 'forbidden_field' using errcode = '42501';
  end if;
  return new;
end $$;
