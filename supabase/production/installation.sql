-- Chesspirit : installation complète d'un projet Supabase neuf (généré par scripts/build-production-sql.sh).
-- À exécuter UNE SEULE FOIS dans SQL Editor. En cas d'erreur, rien n'est appliqué (transaction unique).
begin;
set local statement_timeout = 0;
do $$ begin
  if to_regclass('public.profiles') is not null then
    raise exception 'Chesspirit est déjà installé sur ce projet : ne pas relancer ce fichier.';
  end if;
end $$;

-- ===== Migration 20260927000000_api_default_privileges.sql =====
-- Droits par défaut de l'API de données, rendus explicites.
-- Les projets Supabase anciens accordent automatiquement ces droits aux rôles d'API ; les nouveaux projets
-- ne le font plus (exposition « sur demande »). Toutes les migrations suivantes, leurs révocations et les
-- tests RLS reposent sur ce comportement : on le fixe ici, avant toute création d'objet, pour que la base
-- hébergée se comporte exactement comme la pile locale (supabase/local/bootstrap.sql).
-- Les vues sont ensuite ramenées en lecture seule (20261009000100_production_hardening.sql).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- Les fonctions du schéma private sont appelées par les politiques RLS avec le rôle de l'appelant.
create schema if not exists private;
alter default privileges in schema private grant execute on functions to anon, authenticated, service_role;

set search_path = "$user", public, extensions;

-- ===== Migration 20260927000100_foundation.sql =====
-- Chesspirit — fondations : identités, rôles, consentements, structures, audit, paramètres.
-- Toutes les tables ont la RLS activée. Les fonctions d'aide vivent dans le schéma « private »
-- (non exposé par l'API) et sont en SECURITY DEFINER avec un search_path figé.

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'player', 'parent', 'coach', 'arbiter', 'organizer', 'editor', 'partner',
  'admin', 'super_admin', 'admin_competitions', 'admin_shop', 'moderator'
);
create type public.sex as enum ('M', 'F');
create type public.consent_type as enum ('terms', 'newsletter', 'public_profile', 'image_rights', 'parental');
create type public.org_type as enum (
  'club', 'school', 'organizer', 'association', 'departmental_league', 'federation',
  'vendor', 'content_creator', 'media', 'university', 'company'
);

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function private.unaccent_lower(t text) returns text
language sql immutable parallel safe
set search_path = ''
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))) $$;

-- ---------------------------------------------------------------------------
-- Profils (une « personne » ; le compte auth est facultatif : profils pré-créés,
-- enfants gérés par un parent, comptes express créés par un arbitre)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  birth_date date,
  sex public.sex,
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  photo_path text,
  country char(2) not null default 'BJ',
  department text,
  city text,
  club_id uuid,
  club_name text,
  fide_id text check (fide_id is null or fide_id ~ '^[0-9]{4,10}$'),
  titles text[] not null default '{}',
  languages text[] not null default '{fr}',
  bio text,
  is_public boolean not null default false,
  is_minor boolean not null default false,
  guardian_id uuid references public.profiles(id) on delete set null,
  claimed boolean not null default false,
  verified boolean not null default false,
  onboarded boolean not null default false,
  source text not null default 'signup' check (source in ('signup', 'import', 'express', 'guardian', 'demo')),
  merged_into uuid references public.profiles(id),
  suspended_at timestamptz,
  preferred_locale text not null default 'fr' check (preferred_locale in ('fr', 'en')),
  notification_prefs jsonb not null default '{"email": true, "sms": true, "whatsapp": false}',
  is_demo boolean not null default false,
  search_text text generated always as (
    private.unaccent_lower(first_name || ' ' || last_name || ' ' || coalesce(city, '') || ' ' || coalesce(club_name, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Personnes (joueurs, parents, coachs, arbitres…). user_id nul = profil non réclamé ou enfant géré.';
create index profiles_search_idx on public.profiles using gin (search_text extensions.gin_trgm_ops);
create index profiles_phone_idx on public.profiles (phone);
create index profiles_fide_idx on public.profiles (fide_id);
create index profiles_guardian_idx on public.profiles (guardian_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Mineur : recalculé à chaque écriture (et chaque nuit par une tâche planifiée).
create or replace function private.profiles_minor() returns trigger
language plpgsql as $$
begin
  new.is_minor := new.birth_date is not null and new.birth_date > (current_date - interval '18 years');
  if new.is_minor and tg_op = 'INSERT' then
    new.is_public := false; -- profil réduit par défaut pour les mineurs
  end if;
  return new;
end $$;
create trigger profiles_minor before insert or update of birth_date on public.profiles
  for each row execute function private.profiles_minor();

-- ---------------------------------------------------------------------------
-- Rôles
-- ---------------------------------------------------------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  scope_id uuid, -- ex. tournoi ou structure pour un rôle délégué
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (user_id, role, scope_id)
);
create trigger user_roles_updated_at before update on public.user_roles
  for each row execute function private.set_updated_at();

-- Paramètres système (clé/valeur) ; certains sont publics.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  id uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function private.set_updated_at();
insert into public.app_settings (key, value, is_public, description) values
  ('require_admin_mfa', 'true', false, 'Double authentification obligatoire pour les rôles d''administration'),
  ('default_start_rating', '1200', true, 'Cote de départ des joueurs sans Elo FIDE'),
  ('coaching_commission_enabled', 'true', true, 'Plateforme ouverte avec commission (désactiver = coachs Chesspirit uniquement)'),
  ('coaching_commission_rate', '0.15', false, 'Taux de commission sur les cours (à confirmer par le propriétaire)'),
  ('contact_whatsapp', 'null', true, 'Numéro WhatsApp de contact (à confirmer)');

create or replace function private.setting(k text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select value from public.app_settings where key = k
$$;

-- ---------------------------------------------------------------------------
-- Fonctions d'autorisation
-- ---------------------------------------------------------------------------
create or replace function private.has_role(r public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = r)
$$;

create or replace function private.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((private.setting('require_admin_mfa'))::boolean, true) = false
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

-- Administrateur (tous sous-rôles), avec double authentification.
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.mfa_ok() and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'super_admin', 'admin_competitions', 'admin_shop', 'moderator')
  )
$$;

create or replace function private.is_admin_of(area text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.mfa_ok() and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and (ur.role in ('admin', 'super_admin')
        or (area = 'competitions' and ur.role = 'admin_competitions')
        or (area = 'shop' and ur.role = 'admin_shop')
        or (area = 'content' and ur.role = 'moderator'))
  )
$$;

create or replace function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.mfa_ok() and private.has_role('super_admin')
$$;

create or replace function private.my_profile_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.profiles where user_id = auth.uid() and merged_into is null limit 1
$$;

-- Profils que l'utilisateur gère : le sien et ceux de ses enfants mineurs.
create or replace function private.managed_profile_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.profiles p
  where p.user_id = auth.uid()
     or p.guardian_id in (select id from public.profiles where user_id = auth.uid())
$$;

create or replace function private.manages_profile(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select pid in (select private.managed_profile_ids())
$$;

-- ---------------------------------------------------------------------------
-- Audit (écriture uniquement via private.audit ou déclencheurs)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  object_type text not null,
  object_id text,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_logs_object_idx on public.audit_logs (object_type, object_id);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);

create or replace function private.request_ip() returns inet
language plpgsql stable as $$
declare
  h text;
begin
  h := split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1);
  return nullif(trim(h), '')::inet;
exception when others then
  return null;
end $$;

create or replace function private.audit(p_action text, p_type text, p_id text, p_before jsonb, p_after jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_user_id, action, object_type, object_id, before, after, ip)
  values (auth.uid(), p_action, p_type, p_id, p_before, p_after, private.request_ip())
$$;

-- Déclencheur générique : journalise toute écriture faite par un administrateur ou un arbitre.
create or replace function private.audit_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.audit(
    lower(tg_op), tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', ''),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

-- Consultation de données personnelles par un administrateur (appelée par l'application).
create or replace function public.log_personal_data_access(p_profile_id uuid, p_context text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform private.audit('view_personal_data', 'profiles', p_profile_id::text, null, jsonb_build_object('context', p_context));
end $$;

-- ---------------------------------------------------------------------------
-- Consentements
-- ---------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type public.consent_type not null,
  version text not null,
  granted boolean not null,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  granted_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index consents_profile_idx on public.consents (profile_id, type);
create trigger consents_updated_at before update on public.consents
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Structures (clubs, écoles, fédération…)
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  type public.org_type not null,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  country char(2) not null default 'BJ',
  department text,
  city text,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  email text,
  website text,
  logo_path text,
  languages text[] not null default '{fr}',
  is_public boolean not null default true,
  verified boolean not null default false,
  claimed_by uuid references public.profiles(id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
alter table public.profiles add constraint profiles_club_fk foreign key (club_id) references public.organizations(id) on delete set null;

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'coach', 'arbiter')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id)
);
create trigger organization_members_updated_at before update on public.organization_members
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indicateurs de fonctionnalité, notifications, demandes RGPD
-- ---------------------------------------------------------------------------
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  enabled boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger feature_flags_updated_at before update on public.feature_flags
  for each row execute function private.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'push', 'in_app')),
  template text not null,
  recipient text,
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider text,
  provider_ref text,
  error text,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications (profile_id, created_at desc);
create trigger notifications_updated_at before update on public.notifications
  for each row execute function private.set_updated_at();

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('export', 'delete', 'rectify')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'refused')),
  details text,
  processed_by uuid references auth.users(id),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger data_requests_updated_at before update on public.data_requests
  for each row execute function private.set_updated_at();

-- Messages du formulaire de contact.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 120),
  email text,
  phone text,
  topic text,
  message text not null check (char_length(message) <= 5000),
  status text not null default 'new' check (status in ('new', 'answered', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger contact_messages_updated_at before update on public.contact_messages
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Vues publiques (colonnes non sensibles uniquement)
-- ---------------------------------------------------------------------------
create or replace function private.display_name(p public.profiles) returns text
language sql stable set search_path = '' as $$
  select case
    when p.is_minor and not p.is_public then p.first_name || ' ' || left(p.last_name, 1) || '.'
    else p.first_name || ' ' || p.last_name
  end
$$;

create view public.public_profiles with (security_barrier = true) as
select p.id, p.first_name, p.last_name, private.display_name(p) as display_name,
  case when p.is_minor then null else p.photo_path end as photo_path,
  p.country, p.department, p.city, p.club_id, p.club_name, p.fide_id, p.titles, p.languages,
  case when p.is_minor then null else p.bio end as bio,
  p.sex, p.verified, p.is_demo,
  case when p.is_minor then null else extract(year from p.birth_date)::int end as birth_year,
  p.is_minor, p.search_text
from public.profiles p
where p.is_public and p.merged_into is null and p.suspended_at is null;
grant select on public.public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Défense en profondeur : aucun privilège anonyme sur les tables de données personnelles.
revoke all on public.profiles, public.user_roles, public.consents, public.audit_logs, public.notifications,
  public.data_requests from anon;
grant insert on public.contact_messages to anon;
revoke select, update, delete on public.contact_messages from anon;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.consents enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.feature_flags enable row level security;
alter table public.notifications enable row level security;
alter table public.data_requests enable row level security;
alter table public.contact_messages enable row level security;

-- profiles : on voit et modifie ses profils gérés ; les admins voient tout.
create policy profiles_select on public.profiles for select to authenticated
  using (private.manages_profile(id) or private.is_admin());
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (
    (user_id = auth.uid() and guardian_id is null)
    or (user_id is null and guardian_id = private.my_profile_id() and source = 'guardian')
    or private.is_admin()
  );
create policy profiles_update on public.profiles for update to authenticated
  using (private.manages_profile(id) or private.is_admin())
  with check (private.manages_profile(id) or private.is_admin());
create policy profiles_delete_admin on public.profiles for delete to authenticated
  using (private.is_admin());

-- Les champs sensibles ne sont modifiables que par un administrateur.
create or replace function private.profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Rôle service, administrateur, ou accès direct à la base (migrations, tâches) sans jeton.
  if coalesce(auth.role(), 'system') in ('service_role', 'system') or private.is_admin() then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
     or new.verified is distinct from old.verified
     or new.merged_into is distinct from old.merged_into
     or new.suspended_at is distinct from old.suspended_at
     or new.claimed is distinct from old.claimed
     or new.source is distinct from old.source
     or new.is_demo is distinct from old.is_demo
     or new.guardian_id is distinct from old.guardian_id then
    raise exception 'forbidden_field' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.profiles_guard();

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or private.is_admin());
create policy user_roles_admin on public.user_roles for all to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());
create trigger user_roles_audit after insert or update or delete on public.user_roles
  for each row execute function private.audit_trigger();

create policy app_settings_public on public.app_settings for select to anon, authenticated
  using (is_public or private.is_admin());
create policy app_settings_admin on public.app_settings for all to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());
create trigger app_settings_audit after insert or update or delete on public.app_settings
  for each row execute function private.audit_trigger();

create policy audit_logs_admin on public.audit_logs for select to authenticated
  using (private.is_admin());

create policy consents_select on public.consents for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin());
create policy consents_insert on public.consents for insert to authenticated
  with check (private.manages_profile(profile_id));
create policy consents_update on public.consents for update to authenticated
  using (private.manages_profile(profile_id)) with check (private.manages_profile(profile_id));

create policy organizations_select on public.organizations for select to anon, authenticated
  using (is_public or private.is_admin()
    or exists (select 1 from public.organization_members m where m.organization_id = id and private.manages_profile(m.profile_id)));
create policy organizations_insert on public.organizations for insert to authenticated
  with check (private.is_admin() or (claimed_by = private.my_profile_id() and verified = false));
create policy organizations_update on public.organizations for update to authenticated
  using (private.is_admin() or exists (
    select 1 from public.organization_members m
    where m.organization_id = id and m.role in ('owner', 'admin') and private.manages_profile(m.profile_id)))
  with check (private.is_admin() or verified = false or verified = (select o.verified from public.organizations o where o.id = organizations.id));
create policy organizations_delete on public.organizations for delete to authenticated
  using (private.is_admin());

create policy org_members_select on public.organization_members for select to anon, authenticated
  using (exists (select 1 from public.organizations o where o.id = organization_id and o.is_public) or private.is_admin());
create policy org_members_admin on public.organization_members for all to authenticated
  using (private.is_admin() or exists (
    select 1 from public.organization_members m
    where m.organization_id = organization_members.organization_id and m.role in ('owner', 'admin') and private.manages_profile(m.profile_id)))
  with check (private.is_admin() or exists (
    select 1 from public.organization_members m
    where m.organization_id = organization_members.organization_id and m.role in ('owner', 'admin') and private.manages_profile(m.profile_id)));

create policy feature_flags_read on public.feature_flags for select to anon, authenticated using (true);
create policy feature_flags_admin on public.feature_flags for all to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());

create policy notifications_own on public.notifications for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (private.manages_profile(profile_id)) with check (private.manages_profile(profile_id));

create policy data_requests_own on public.data_requests for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin());
create policy data_requests_insert on public.data_requests for insert to authenticated
  with check (private.manages_profile(profile_id) and status = 'pending');
create policy data_requests_admin on public.data_requests for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy contact_insert on public.contact_messages for insert to anon, authenticated
  with check (status = 'new');
create policy contact_admin on public.contact_messages for select to authenticated using (private.is_admin());
create policy contact_admin_update on public.contact_messages for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

insert into public.feature_flags (key, enabled, description) values
  ('payments_online', true, 'Paiement en ligne (fournisseur configuré par PAYMENT_PROVIDER)'),
  ('google_login', false, 'Connexion avec Google (nécessite les identifiants OAuth)'),
  ('scoresheet_ocr', false, 'Lecture des feuilles de notation photographiées'),
  ('whatsapp_notifications', false, 'Notifications WhatsApp (nécessite WhatsApp Business)');

set search_path = "$user", public, extensions;

-- ===== Migration 20260927000200_tournaments.sql =====
-- Chesspirit — tournois, inscriptions, rondes, appariements, parties, classements.

create type public.cadence as enum ('blitz', 'rapid', 'classical');
create type public.tournament_status as enum (
  'draft', 'published', 'registration_open', 'registration_closed', 'ongoing', 'finished', 'archived', 'cancelled'
);
create type public.registration_status as enum (
  'pending_payment', 'pending_validation', 'confirmed', 'waitlisted', 'cancelled', 'refused'
);
create type public.payment_status as enum ('not_required', 'pending', 'paid', 'due_on_site', 'refunded', 'failed');
create type public.game_result as enum ('1-0', '0-1', '1/2-1/2', '+-', '-+', '=-=', '0-0');

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 3 and 160),
  edition text,
  summary jsonb not null default '{}', -- {fr, en}
  description jsonb not null default '{}', -- {fr, en}
  venue text,
  address text,
  city text,
  country char(2) not null default 'BJ',
  lat double precision,
  lng double precision,
  starts_at timestamptz not null,
  ends_at timestamptz,
  checkin_opens_at timestamptz,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  cadence public.cadence,
  base_minutes int check (base_minutes between 1 and 240),
  increment_seconds int check (increment_seconds between 0 and 120),
  rounds_count int check (rounds_count between 1 and 40),
  pairing_system text not null default 'swiss_dutch' check (pairing_system in (
    'swiss_dutch', 'swiss_accelerated', 'round_robin', 'double_round_robin', 'knockout',
    'scheveningen', 'team_swiss', 'arena', 'pools_then_knockout', 'simul')),
  tiebreaks text[] not null default '{buchholz_cut1,buchholz,sonneborn_berger}',
  categories jsonb not null default '[]',
  conditions jsonb not null default '{}', -- {min_rating, max_rating, min_age, max_age, sex, league_id}
  entry_fee_xof int check (entry_fee_xof >= 0), -- null = à confirmer
  entry_fee_notes jsonb not null default '{}',
  capacity int check (capacity >= 1), -- null = non limité / à confirmer
  is_online boolean not null default false,
  rated boolean not null default false,
  counts_for_tour boolean not null default false,
  league_id uuid,
  status public.tournament_status not null default 'draft',
  validation_mode text not null default 'auto' check (validation_mode in ('auto', 'manual')),
  waitlist_enabled boolean not null default true,
  allow_online_payment boolean not null default true,
  allow_on_site_payment boolean not null default true,
  results_published boolean not null default false,
  organizer_profile_id uuid references public.profiles(id),
  organization_id uuid references public.organizations(id),
  poster_path text,
  contact_phone text,
  unconfirmed_fields text[] not null default '{}', -- champs explicitement « À confirmer »
  duplicated_from uuid references public.tournaments(id),
  is_demo boolean not null default false,
  search_text text generated always as (private.unaccent_lower(name || ' ' || coalesce(city, '') || ' ' || coalesce(venue, ''))) stored,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index tournaments_starts_idx on public.tournaments (starts_at);
create index tournaments_status_idx on public.tournaments (status);
create index tournaments_search_idx on public.tournaments using gin (search_text extensions.gin_trgm_ops);
create trigger tournaments_updated_at before update on public.tournaments
  for each row execute function private.set_updated_at();

create table public.tournament_staff (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('organizer', 'chief_arbiter', 'deputy_arbiter', 'operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, profile_id, role)
);
create trigger tournament_staff_updated_at before update on public.tournament_staff
  for each row execute function private.set_updated_at();

create table public.tournament_partners (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  role text not null default 'partner' check (role in ('partner', 'sponsor', 'host', 'media')),
  url text,
  logo_path text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tournament_partners_updated_at before update on public.tournament_partners
  for each row execute function private.set_updated_at();

create table public.prizes (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  kind text not null default 'rank' check (kind in ('rank', 'category', 'special')),
  rank int,
  category text, -- u18, women, veteran…
  label jsonb not null default '{}',
  amount_xof int check (amount_xof >= 0), -- null = à confirmer / en nature
  awarded_profile_id uuid references public.profiles(id),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger prizes_updated_at before update on public.prizes
  for each row execute function private.set_updated_at();

create table public.registration_forms (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null unique references public.tournaments(id) on delete cascade,
  fields jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger registration_forms_updated_at before update on public.registration_forms
  for each row execute function private.set_updated_at();

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  registered_by uuid references auth.users(id) default auth.uid(),
  status public.registration_status not null,
  payment_status public.payment_status not null default 'not_required',
  payment_method text not null default 'free' check (payment_method in ('online', 'on_site', 'free')),
  amount_xof int check (amount_xof >= 0),
  answers jsonb not null default '{}',
  ticket_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  seed_rating int,
  category text,
  waitlist_position int,
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id),
  notes text,
  source text not null default 'online' check (source in ('online', 'group', 'import', 'on_site', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, player_id)
);
create index registrations_tournament_idx on public.registrations (tournament_id, status);
create index registrations_player_idx on public.registrations (player_id);
create trigger registrations_updated_at before update on public.registrations
  for each row execute function private.set_updated_at();

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  number int not null check (number >= 1),
  status text not null default 'pending' check (status in ('pending', 'paired', 'ongoing', 'finished')),
  starts_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, number)
);
create trigger rounds_updated_at before update on public.rounds
  for each row execute function private.set_updated_at();

create table public.pairings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  board int not null check (board >= 0),
  white_id uuid not null references public.profiles(id),
  black_id uuid references public.profiles(id), -- null = exempt (bye)
  result public.game_result,
  bye_type text check (bye_type in ('full', 'half', 'zero')),
  is_manual boolean not null default false,
  updated_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((black_id is null) = (bye_type is not null)),
  check (black_id is null or black_id <> white_id)
);
create index pairings_round_idx on public.pairings (round_id, board);
create index pairings_players_idx on public.pairings (tournament_id, white_id, black_id);
create trigger pairings_updated_at before update on public.pairings
  for each row execute function private.set_updated_at();
create trigger pairings_audit after insert or update or delete on public.pairings
  for each row execute function private.audit_trigger();

create table public.games (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete set null,
  round_id uuid references public.rounds(id) on delete set null,
  pairing_id uuid references public.pairings(id) on delete set null,
  round_number int,
  board int,
  white_id uuid references public.profiles(id),
  black_id uuid references public.profiles(id),
  white_name text not null,
  black_name text not null,
  white_rating int,
  black_rating int,
  result text not null check (result in ('1-0', '0-1', '1/2-1/2', '*')),
  pgn text not null check (char_length(pgn) < 200000),
  eco text check (eco is null or eco ~ '^[A-E][0-9]{2}$'),
  opening text,
  moves_count int,
  played_on date,
  cadence public.cadence,
  source text not null default 'upload' check (source in ('upload', 'board_entry', 'lichess', 'import', 'ocr')),
  is_public boolean not null default true,
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index games_tournament_idx on public.games (tournament_id, round_number, board);
create index games_white_idx on public.games (white_id);
create index games_black_idx on public.games (black_id);
create index games_eco_idx on public.games (eco);
create trigger games_updated_at before update on public.games
  for each row execute function private.set_updated_at();

create table public.game_annotations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ply int not null default 0,
  comment text not null check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger game_annotations_updated_at before update on public.game_annotations
  for each row execute function private.set_updated_at();

create table public.standings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  rank int not null check (rank >= 1),
  points numeric(5, 1) not null check (points >= 0),
  games int,
  tiebreaks jsonb not null default '{}',
  performance int,
  rating_before int,
  rating_after int,
  rating_delta int,
  prize text,
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, player_id)
);
create index standings_tournament_idx on public.standings (tournament_id, rank);
create trigger standings_updated_at before update on public.standings
  for each row execute function private.set_updated_at();
create trigger standings_audit after insert or update or delete on public.standings
  for each row execute function private.audit_trigger();

create table public.posters (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  format text not null check (format in ('a3', 'a4', 'instagram_post', 'instagram_story', 'whatsapp_status', 'facebook_banner', 'results')),
  path text,
  template text not null default 'chesspirit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger posters_updated_at before update on public.posters
  for each row execute function private.set_updated_at();

-- Journal propre au tournoi (actions d'arbitrage lisibles par le staff).
create table public.tournament_audit (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  actor_user_id uuid default auth.uid(),
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tournament_audit_idx on public.tournament_audit (tournament_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Autorisations spécifiques aux tournois
-- ---------------------------------------------------------------------------
create or replace function private.can_manage_tournament(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin_of('competitions')
    or exists (select 1 from public.tournaments t where t.id = tid and t.organizer_profile_id = private.my_profile_id())
    or exists (select 1 from public.tournament_staff s
               where s.tournament_id = tid and s.role = 'organizer' and s.profile_id = private.my_profile_id())
$$;

-- Arbitres et opérateurs : appariements, résultats, pointage.
create or replace function private.can_arbitrate(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_manage_tournament(tid)
    or exists (select 1 from public.tournament_staff s
               where s.tournament_id = tid and s.profile_id = private.my_profile_id()
                 and s.role in ('chief_arbiter', 'deputy_arbiter', 'operator'))
$$;

create or replace function private.tournament_is_public(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tournaments t where t.id = tid and t.status <> 'draft')
$$;

create or replace function private.tournament_results_public(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tournaments t where t.id = tid and t.status <> 'draft'
                 and (t.results_published or t.status in ('ongoing', 'finished', 'archived')))
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
revoke all on public.registrations, public.tournament_audit, public.game_annotations from anon;

alter table public.tournaments enable row level security;
alter table public.tournament_staff enable row level security;
alter table public.tournament_partners enable row level security;
alter table public.prizes enable row level security;
alter table public.registration_forms enable row level security;
alter table public.registrations enable row level security;
alter table public.rounds enable row level security;
alter table public.pairings enable row level security;
alter table public.games enable row level security;
alter table public.game_annotations enable row level security;
alter table public.standings enable row level security;
alter table public.posters enable row level security;
alter table public.tournament_audit enable row level security;

create policy tournaments_select on public.tournaments for select to anon, authenticated
  using (status <> 'draft' or private.can_arbitrate(id));
create policy tournaments_insert on public.tournaments for insert to authenticated
  with check (private.is_admin_of('competitions')
    or (private.has_role('organizer') and organizer_profile_id = private.my_profile_id()));
create policy tournaments_update on public.tournaments for update to authenticated
  using (private.can_manage_tournament(id)) with check (private.can_manage_tournament(id));
create policy tournaments_delete on public.tournaments for delete to authenticated
  using (private.is_admin_of('competitions') or (status = 'draft' and private.can_manage_tournament(id)));
create trigger tournaments_audit after insert or update or delete on public.tournaments
  for each row execute function private.audit_trigger();

create policy staff_select on public.tournament_staff for select to anon, authenticated
  using (private.tournament_is_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy staff_write on public.tournament_staff for all to authenticated
  using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));
create trigger tournament_staff_audit after insert or update or delete on public.tournament_staff
  for each row execute function private.audit_trigger();

create policy partners_select on public.tournament_partners for select to anon, authenticated
  using (private.tournament_is_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy partners_write on public.tournament_partners for all to authenticated
  using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));

create policy prizes_select on public.prizes for select to anon, authenticated
  using (private.tournament_is_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy prizes_write on public.prizes for all to authenticated
  using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));

create policy forms_select on public.registration_forms for select to anon, authenticated
  using (private.tournament_is_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy forms_write on public.registration_forms for all to authenticated
  using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));

-- Inscriptions : lecture par le joueur (ou son parent) et le staff ; écriture via fonctions.
create policy registrations_select on public.registrations for select to authenticated
  using (private.manages_profile(player_id) or registered_by = auth.uid() or private.can_arbitrate(tournament_id));
create policy registrations_staff_update on public.registrations for update to authenticated
  using (private.can_arbitrate(tournament_id)) with check (private.can_arbitrate(tournament_id));
create policy registrations_staff_delete on public.registrations for delete to authenticated
  using (private.can_manage_tournament(tournament_id));
create trigger registrations_audit after update or delete on public.registrations
  for each row execute function private.audit_trigger();

create policy rounds_select on public.rounds for select to anon, authenticated
  using (private.tournament_results_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy rounds_write on public.rounds for all to authenticated
  using (private.can_arbitrate(tournament_id)) with check (private.can_arbitrate(tournament_id));

create policy pairings_select on public.pairings for select to anon, authenticated
  using (
    (private.tournament_results_public(tournament_id)
      and exists (select 1 from public.rounds r where r.id = round_id and r.published_at is not null))
    or private.can_arbitrate(tournament_id));
create policy pairings_write on public.pairings for all to authenticated
  using (private.can_arbitrate(tournament_id)) with check (private.can_arbitrate(tournament_id));

create policy games_select on public.games for select to anon, authenticated
  using (
    (is_public and (tournament_id is null or private.tournament_results_public(tournament_id)))
    or private.manages_profile(white_id) or private.manages_profile(black_id)
    or (tournament_id is not null and private.can_arbitrate(tournament_id))
    or private.is_admin());
create policy games_write on public.games for all to authenticated
  using ((tournament_id is not null and private.can_arbitrate(tournament_id)) or private.is_admin())
  with check ((tournament_id is not null and private.can_arbitrate(tournament_id)) or private.is_admin());
create trigger games_audit after update or delete on public.games
  for each row execute function private.audit_trigger();

create policy annotations_own on public.game_annotations for all to authenticated
  using (private.manages_profile(profile_id)) with check (private.manages_profile(profile_id));

create policy standings_select on public.standings for select to anon, authenticated
  using (private.tournament_results_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy standings_write on public.standings for all to authenticated
  using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));

create policy posters_select on public.posters for select to anon, authenticated
  using (private.tournament_is_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy posters_write on public.posters for all to authenticated
  using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));

create policy tournament_audit_select on public.tournament_audit for select to authenticated
  using (private.can_arbitrate(tournament_id));
create policy tournament_audit_insert on public.tournament_audit for insert to authenticated
  with check (private.can_arbitrate(tournament_id) and actor_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Vues publiques
-- ---------------------------------------------------------------------------
create view public.public_registrations with (security_barrier = true) as
select r.tournament_id, r.id as registration_id, p.id as player_id, private.display_name(p) as display_name,
  coalesce(p.club_name, o.name) as club, p.city, r.seed_rating, p.titles, p.fide_id,
  case when p.is_minor then null else p.sex end as sex, r.status, r.created_at
from public.registrations r
join public.profiles p on p.id = r.player_id
left join public.organizations o on o.id = p.club_id
join public.tournaments t on t.id = r.tournament_id and t.status <> 'draft'
where r.status in ('confirmed', 'pending_validation', 'waitlisted', 'pending_payment');
grant select on public.public_registrations to anon, authenticated;

create view public.public_standings with (security_barrier = true) as
select s.tournament_id, s.rank, s.points, s.games, s.tiebreaks, s.performance, s.rating_before, s.rating_after,
  s.rating_delta, s.prize, s.is_final, p.id as player_id, private.display_name(p) as display_name,
  coalesce(p.club_name, o.name) as club, p.titles, p.fide_id,
  case when p.is_minor then null else p.sex end as sex
from public.standings s
join public.profiles p on p.id = s.player_id
left join public.organizations o on o.id = p.club_id
join public.tournaments t on t.id = s.tournament_id and t.status <> 'draft'
  and (t.results_published or t.status in ('ongoing', 'finished', 'archived'));
grant select on public.public_standings to anon, authenticated;

create view public.public_pairings with (security_barrier = true) as
select pr.id, pr.tournament_id, r.number as round_number, pr.board, pr.result, pr.bye_type,
  pr.white_id, private.display_name(w) as white_name,
  pr.black_id, case when b.id is null then null else private.display_name(b) end as black_name
from public.pairings pr
join public.rounds r on r.id = pr.round_id and r.published_at is not null
join public.profiles w on w.id = pr.white_id
left join public.profiles b on b.id = pr.black_id
join public.tournaments t on t.id = pr.tournament_id and t.status <> 'draft';
grant select on public.public_pairings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions métier
-- ---------------------------------------------------------------------------

-- Inscription : vérifie les droits, les conditions, la capacité (verrou), calcule le montant.
create or replace function public.register_for_tournament(
  p_tournament_id uuid,
  p_player_id uuid,
  p_answers jsonb default '{}',
  p_payment_method text default 'online'
) returns public.registrations
language plpgsql security definer set search_path = '' as $$
declare
  t public.tournaments;
  p public.profiles;
  r public.registrations;
  v_confirmed int;
  v_status public.registration_status;
  v_payment public.payment_status;
  v_age int;
  v_is_staff boolean;
  v_amount int;
  v_rating int;
  v_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  select * into t from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'tournament_not_found' using errcode = 'P0002';
  end if;
  v_is_staff := private.can_arbitrate(t.id);
  if not (private.manages_profile(p_player_id) or v_is_staff) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if t.status <> 'registration_open' and not v_is_staff then
    raise exception 'registration_closed' using errcode = 'P0001';
  end if;
  if not v_is_staff and (
    (t.registration_opens_at is not null and now() < t.registration_opens_at)
    or (t.registration_closes_at is not null and now() > t.registration_closes_at)) then
    raise exception 'registration_closed' using errcode = 'P0001';
  end if;
  select * into p from public.profiles where id = p_player_id;
  if p.birth_date is null or p.sex is null then
    raise exception 'profile_incomplete' using errcode = 'P0001';
  end if;
  v_age := extract(year from age(t.starts_at::date, p.birth_date))::int;
  if (t.conditions ? 'min_age' and v_age < (t.conditions ->> 'min_age')::int)
     or (t.conditions ? 'max_age' and v_age > (t.conditions ->> 'max_age')::int)
     or (t.conditions ? 'sex' and p.sex::text <> t.conditions ->> 'sex') then
    raise exception 'conditions_not_met' using errcode = 'P0001';
  end if;
  if p_payment_method not in ('online', 'on_site', 'free') then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  select * into r from public.registrations where tournament_id = t.id and player_id = p.id;
  v_exists := found;
  if v_exists and r.status not in ('cancelled', 'refused') then
    return r; -- déjà inscrit : idempotent
  end if;

  select count(*) into v_confirmed from public.registrations
    where tournament_id = t.id and status in ('confirmed', 'pending_payment', 'pending_validation');

  v_amount := t.entry_fee_xof;
  if coalesce(v_amount, 0) = 0 and v_amount is not null then
    v_payment := 'not_required';
    p_payment_method := 'free';
  elsif p_payment_method = 'online' and t.allow_online_payment and v_amount is not null then
    v_payment := 'pending';
  elsif p_payment_method = 'on_site' and t.allow_on_site_payment then
    v_payment := 'due_on_site';
  elsif v_amount is null and t.allow_on_site_payment then
    -- Frais « à confirmer » : réglés sur place.
    v_payment := 'due_on_site';
    p_payment_method := 'on_site';
  else
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  if t.capacity is not null and v_confirmed >= t.capacity then
    if not t.waitlist_enabled then
      raise exception 'tournament_full' using errcode = 'P0001';
    end if;
    v_status := 'waitlisted';
  elsif v_payment = 'pending' then
    v_status := 'pending_payment';
  elsif t.validation_mode = 'manual' and not v_is_staff then
    v_status := 'pending_validation';
  else
    v_status := 'confirmed';
  end if;

  v_rating := coalesce(
    (select rt.rating from public.ratings rt where rt.profile_id = p.id and rt.type = t.cadence::text::public.rating_type),
    (select case t.cadence when 'blitz' then fr.blitz when 'rapid' then fr.rapid else fr.standard end
       from public.fide_ratings fr where fr.fide_id = p.fide_id order by fr.period desc limit 1));

  if v_exists then
    update public.registrations set status = v_status, payment_status = v_payment, payment_method = p_payment_method,
      amount_xof = v_amount, answers = coalesce(p_answers, '{}'), seed_rating = v_rating,
      waitlist_position = case when v_status = 'waitlisted' then v_confirmed - t.capacity + 1 end
    where id = r.id returning * into r;
  else
    insert into public.registrations (tournament_id, player_id, status, payment_status, payment_method, amount_xof,
      answers, seed_rating, waitlist_position, source)
    values (t.id, p.id, v_status, v_payment, p_payment_method, v_amount, coalesce(p_answers, '{}'), v_rating,
      case when v_status = 'waitlisted' then v_confirmed - t.capacity + 1 end,
      case when v_is_staff and not private.manages_profile(p.id) then 'on_site' else 'online' end)
    returning * into r;
  end if;
  return r;
end $$;
revoke execute on function public.register_for_tournament from anon, public;
grant execute on function public.register_for_tournament to authenticated;

create or replace function public.cancel_registration(p_registration_id uuid) returns public.registrations
language plpgsql security definer set search_path = '' as $$
declare
  r public.registrations;
begin
  select * into r from public.registrations where id = p_registration_id for update;
  if not found or not (private.manages_profile(r.player_id) or private.can_arbitrate(r.tournament_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.registrations set status = 'cancelled' where id = r.id returning * into r;
  -- Promotion du premier de la liste d'attente.
  update public.registrations set status = case when payment_status = 'pending' then 'pending_payment'::public.registration_status else 'confirmed'::public.registration_status end,
    waitlist_position = null
  where id = (select id from public.registrations where tournament_id = r.tournament_id and status = 'waitlisted'
              order by waitlist_position nulls last, created_at limit 1);
  return r;
end $$;
revoke execute on function public.cancel_registration from anon, public;
grant execute on function public.cancel_registration to authenticated;

-- Pointage par QR code (arbitres, organisateurs, administrateurs).
create or replace function public.check_in(p_ticket_code text, p_mark_paid boolean default false)
returns table (registration_id uuid, tournament_id uuid, display_name text, status public.registration_status,
  payment_status public.payment_status, checked_in_at timestamptz, already boolean)
language plpgsql security definer set search_path = '' as $$
declare
  r public.registrations;
  v_already boolean;
begin
  select * into r from public.registrations where ticket_code = upper(trim(p_ticket_code)) for update;
  if not found then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;
  if not private.can_arbitrate(r.tournament_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_already := r.checked_in_at is not null;
  update public.registrations set
    checked_in_at = coalesce(r.checked_in_at, now()),
    checked_in_by = coalesce(r.checked_in_by, auth.uid()),
    payment_status = case when p_mark_paid and r.payment_status = 'due_on_site' then 'paid' else r.payment_status end
  where id = r.id returning * into r;
  insert into public.tournament_audit (tournament_id, action, details)
    values (r.tournament_id, 'check_in', jsonb_build_object('registration_id', r.id, 'mark_paid', p_mark_paid));
  return query select r.id, r.tournament_id, private.display_name(p), r.status, r.payment_status, r.checked_in_at, v_already
    from public.profiles p where p.id = r.player_id;
end $$;
revoke execute on function public.check_in from anon, public;
grant execute on function public.check_in to authenticated;

-- Billet : informations minimales accessibles avec le code (non devinable).
create or replace function public.ticket_info(p_ticket_code text)
returns table (display_name text, tournament_name text, tournament_slug text, starts_at timestamptz, venue text,
  status public.registration_status, payment_status public.payment_status, checked_in boolean)
language sql stable security definer set search_path = '' as $$
  select private.display_name(p), t.name, t.slug, t.starts_at, t.venue, r.status, r.payment_status, r.checked_in_at is not null
  from public.registrations r
  join public.profiles p on p.id = r.player_id
  join public.tournaments t on t.id = r.tournament_id
  where r.ticket_code = upper(trim(p_ticket_code))
$$;
grant execute on function public.ticket_info to anon, authenticated;

-- Import du classement final (CSV ou saisie) : rapproche ou crée des profils « importés ».
create or replace function public.import_standings(p_tournament_id uuid, p_rows jsonb, p_publish boolean default true)
returns int language plpgsql security definer set search_path = '' as $$
declare
  row jsonb;
  v_pid uuid;
  v_first text;
  v_last text;
  v_name text;
  n int := 0;
begin
  if not private.can_manage_tournament(p_tournament_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.standings where tournament_id = p_tournament_id;
  for row in select * from jsonb_array_elements(p_rows) loop
    v_pid := nullif(row ->> 'player_id', '')::uuid;
    v_name := trim(row ->> 'name');
    if v_pid is null and nullif(row ->> 'fide_id', '') is not null then
      select id into v_pid from public.profiles where fide_id = row ->> 'fide_id' and merged_into is null limit 1;
    end if;
    if v_pid is null then
      -- Rapprochement par inscription au tournoi puis par nom exact normalisé.
      select p.id into v_pid from public.registrations r join public.profiles p on p.id = r.player_id
        where r.tournament_id = p_tournament_id
          and private.unaccent_lower(p.first_name || ' ' || p.last_name) in (private.unaccent_lower(v_name),
            private.unaccent_lower(split_part(v_name, ',', 2) || ' ' || split_part(v_name, ',', 1)))
        limit 1;
    end if;
    if v_pid is null then
      if position(',' in v_name) > 0 then
        v_last := trim(split_part(v_name, ',', 1)); v_first := trim(split_part(v_name, ',', 2));
      else
        v_first := split_part(v_name, ' ', 1); v_last := nullif(trim(substr(v_name, length(v_first) + 1)), '');
      end if;
      insert into public.profiles (first_name, last_name, source, club_name, fide_id, phone)
      values (coalesce(nullif(v_first, ''), v_name), coalesce(v_last, '—'), 'import', nullif(row ->> 'club', ''),
        nullif(row ->> 'fide_id', ''), nullif(row ->> 'phone', ''))
      returning id into v_pid;
    end if;
    insert into public.standings (tournament_id, player_id, rank, points, games, tiebreaks, rating_before, prize, is_final)
    values (p_tournament_id, v_pid, (row ->> 'rank')::int, (row ->> 'points')::numeric,
      nullif(row ->> 'games', '')::int, coalesce(row -> 'tiebreaks', '{}'), nullif(row ->> 'rating', '')::int,
      nullif(row ->> 'prize', ''), true)
    on conflict (tournament_id, player_id) do update set rank = excluded.rank, points = excluded.points;
    n := n + 1;
  end loop;
  if p_publish then
    update public.tournaments set results_published = true,
      status = case when status in ('ongoing', 'registration_closed', 'registration_open', 'published') then 'finished' else status end
    where id = p_tournament_id;
  end if;
  insert into public.tournament_audit (tournament_id, action, details)
    values (p_tournament_id, 'import_standings', jsonb_build_object('rows', n));
  return n;
end $$;
revoke execute on function public.import_standings from anon, public;
grant execute on function public.import_standings to authenticated;

-- Le staff d'un tournoi voit la fiche des joueurs inscrits (pointage, contact, appariements).
create or replace function private.staff_sees_profile(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.registrations r where r.player_id = pid and private.can_arbitrate(r.tournament_id))
$$;
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (private.manages_profile(id) or private.is_admin() or private.staff_sees_profile(id));

set search_path = "$user", public, extensions;

-- ===== Migration 20260927000300_ratings_payments.sql =====
-- Chesspirit — cotes et paiements.

create type public.rating_type as enum ('blitz', 'rapid', 'classical', 'online');

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type public.rating_type not null,
  rating int not null,
  games int not null default 0,
  provisional boolean not null default true,
  peak int,
  last_game_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, type)
);
create index ratings_type_idx on public.ratings (type, rating desc);
create trigger ratings_updated_at before update on public.ratings
  for each row execute function private.set_updated_at();

create table public.rating_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type public.rating_type not null,
  tournament_id uuid references public.tournaments(id) on delete set null,
  game_id uuid references public.games(id) on delete set null,
  rating_before int not null,
  rating_after int not null,
  delta int generated always as (rating_after - rating_before) stored,
  games int not null default 0,
  effective_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rating_history_profile_idx on public.rating_history (profile_id, type, effective_on);

create table public.fide_ratings (
  id uuid primary key default gen_random_uuid(),
  fide_id text not null,
  period date not null, -- premier jour du mois de la liste
  name text,
  federation char(3),
  title text,
  standard int,
  rapid int,
  blitz int,
  birth_year int,
  sex char(1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fide_id, period)
);

create table public.rating_lists (
  id uuid primary key default gen_random_uuid(),
  period date not null,
  type public.rating_type not null,
  published_at timestamptz,
  entries jsonb not null default '[]', -- [{profile_id, rank, rating, games}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period, type)
);

alter table public.ratings enable row level security;
alter table public.rating_history enable row level security;
alter table public.fide_ratings enable row level security;
alter table public.rating_lists enable row level security;

-- Les cotes sont publiques pour les profils publics ; le détail reste visible par le joueur.
create policy ratings_select on public.ratings for select to anon, authenticated
  using (exists (select 1 from public.public_profiles pp where pp.id = profile_id)
    or private.manages_profile(profile_id) or private.is_admin());
create policy ratings_admin on public.ratings for all to authenticated
  using (private.is_admin_of('competitions')) with check (private.is_admin_of('competitions'));
create policy rating_history_select on public.rating_history for select to anon, authenticated
  using (exists (select 1 from public.public_profiles pp where pp.id = profile_id)
    or private.manages_profile(profile_id) or private.is_admin());
create policy rating_history_admin on public.rating_history for all to authenticated
  using (private.is_admin_of('competitions')) with check (private.is_admin_of('competitions'));
create policy fide_ratings_select on public.fide_ratings for select to anon, authenticated using (true);
create policy fide_ratings_admin on public.fide_ratings for all to authenticated
  using (private.is_admin_of('competitions')) with check (private.is_admin_of('competitions'));
create policy rating_lists_select on public.rating_lists for select to anon, authenticated
  using (published_at is not null or private.is_admin());
create policy rating_lists_admin on public.rating_lists for all to authenticated
  using (private.is_admin_of('competitions')) with check (private.is_admin_of('competitions'));

create view public.public_ratings with (security_barrier = true) as
select r.type, r.rating, r.games, r.provisional, r.peak, pp.id as profile_id, pp.display_name, pp.club_name,
  pp.city, pp.department, pp.sex, pp.birth_year, pp.titles, pp.fide_id, pp.is_demo,
  rank() over (partition by r.type order by r.rating desc) as rank
from public.ratings r
join public.public_profiles pp on pp.id = r.profile_id
where not r.provisional;
grant select on public.public_ratings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Paiements : aucun numéro de carte ne transite ici. Un paiement n'est « succeeded »
-- qu'après un webhook signé (fonction confirm_payment réservée au rôle service).
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('fake', 'fedapay', 'kkiapay', 'on_site', 'manual')),
  amount_xof int not null check (amount_xof >= 0),
  currency char(3) not null default 'XOF',
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'cancelled', 'refunded')),
  provider_ref text,
  checkout_url text,
  object_type text not null check (object_type in ('registration', 'order', 'booking', 'membership', 'league_license', 'gift_card')),
  object_id uuid not null,
  payer_profile_id uuid references public.profiles(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  description text,
  confirmed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_object_idx on public.payments (object_type, object_id);
create unique index payments_provider_ref_idx on public.payments (provider, provider_ref) where provider_ref is not null;
create trigger payments_updated_at before update on public.payments
  for each row execute function private.set_updated_at();

create table public.payment_webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text,
  signature_valid boolean not null,
  payment_id uuid references public.payments(id),
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  amount_xof int not null check (amount_xof > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  requested_by uuid references auth.users(id) default auth.uid(),
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger refunds_updated_at before update on public.refunds
  for each row execute function private.set_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  payment_id uuid references public.payments(id),
  profile_id uuid references public.profiles(id),
  amount_xof int not null,
  lines jsonb not null default '[]',
  pdf_path text,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.payments, public.payment_webhooks, public.refunds, public.invoices from anon;

alter table public.payments enable row level security;
alter table public.payment_webhooks enable row level security;
alter table public.refunds enable row level security;
alter table public.invoices enable row level security;

create policy payments_select on public.payments for select to authenticated
  using (user_id = auth.uid() or private.manages_profile(payer_profile_id) or private.is_admin()
    or (object_type = 'registration' and exists (
      select 1 from public.registrations r where r.id = object_id
        and (private.manages_profile(r.player_id) or private.can_manage_tournament(r.tournament_id)))));
-- Aucune écriture directe par les utilisateurs : création et confirmation passent par le serveur (rôle service).
create policy payments_admin_update on public.payments for update to authenticated
  using (private.is_admin_of('shop') or private.is_admin_of('competitions'))
  with check (private.is_admin_of('shop') or private.is_admin_of('competitions'));
create trigger payments_audit after update or delete on public.payments
  for each row execute function private.audit_trigger();

create policy payment_webhooks_admin on public.payment_webhooks for select to authenticated using (private.is_admin());
create policy refunds_select on public.refunds for select to authenticated
  using (private.is_admin() or exists (select 1 from public.payments p where p.id = payment_id and p.user_id = auth.uid()));
create policy refunds_admin on public.refunds for insert to authenticated with check (private.is_admin());
create policy invoices_select on public.invoices for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin());

-- Confirmation d'un paiement (appelée par le webhook, rôle service uniquement).
create or replace function public.confirm_payment(p_payment_id uuid, p_status text, p_provider_ref text, p_reason text default null)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;
  if pay.status = 'succeeded' then
    return pay; -- idempotent
  end if;
  update public.payments set status = p_status, provider_ref = coalesce(p_provider_ref, provider_ref),
    confirmed_at = case when p_status = 'succeeded' then now() end, failure_reason = p_reason
  where id = pay.id returning * into pay;
  if pay.object_type = 'registration' then
    if p_status = 'succeeded' then
      update public.registrations set payment_status = 'paid',
        status = case when status = 'pending_payment' then
          case when (select validation_mode from public.tournaments t where t.id = registrations.tournament_id) = 'manual'
            then 'pending_validation'::public.registration_status else 'confirmed'::public.registration_status end
          else status end
      where id = pay.object_id;
    elsif p_status in ('failed', 'cancelled') then
      update public.registrations set payment_status = 'failed' where id = pay.object_id and payment_status = 'pending';
    end if;
  end if;
  return pay;
end $$;
revoke execute on function public.confirm_payment from anon, authenticated, public;
grant execute on function public.confirm_payment to service_role;

set search_path = "$user", public, extensions;

-- ===== Migration 20260927000400_newsletter.sql =====
-- Lettre d'information (consentement explicite : l'inscription vaut consentement, horodaté).
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  consented_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger newsletter_updated_at before update on public.newsletter_subscribers
  for each row execute function private.set_updated_at();
alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon;
grant insert on public.newsletter_subscribers to anon;
create policy newsletter_insert on public.newsletter_subscribers for insert to anon, authenticated
  with check (unsubscribed_at is null);
create policy newsletter_admin on public.newsletter_subscribers for select to authenticated using (private.is_admin());
create policy newsletter_admin_update on public.newsletter_subscribers for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

set search_path = "$user", public, extensions;

-- ===== Migration 20260927000500_public_stats.sql =====
-- Chiffres clés publics (agrégats uniquement, aucune donnée personnelle).
create or replace function public.public_stats()
returns table (rated_players bigint, tournaments bigint, games bigint, demo boolean)
language sql stable security definer set search_path = '' as $$
  select
    (select count(distinct profile_id) from public.ratings r where not r.provisional),
    (select count(*) from public.tournaments t where t.status in ('finished', 'archived')),
    (select count(*) from public.games g where g.is_public),
    exists (select 1 from public.tournaments t where t.is_demo)
$$;
grant execute on function public.public_stats to anon, authenticated;

set search_path = "$user", public, extensions;

-- ===== Migration 20260927000600_onboarding.sql =====
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

set search_path = "$user", public, extensions;

-- ===== Migration 20260927000700_admin.sql =====
-- Administration : journal des consultations, statistiques de base.

-- Journalise la consultation d'une liste contenant des données personnelles (staff ou admin).
create or replace function public.log_admin_view(p_object_type text, p_object_id text, p_context text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (private.is_admin() or (p_object_type = 'tournaments' and private.can_arbitrate(p_object_id::uuid))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform private.audit('view_personal_data', p_object_type, p_object_id, null, jsonb_build_object('context', p_context));
end $$;
revoke execute on function public.log_admin_view from anon, public;
grant execute on function public.log_admin_view to authenticated;

-- Tableau de bord administrateur (agrégats).
create or replace function public.admin_overview()
returns table (users bigint, profiles bigint, registrations bigint, payments_succeeded bigint, revenue_xof bigint,
  pending_data_requests bigint, contact_new bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select
    (select count(*) from auth.users),
    (select count(*) from public.profiles where merged_into is null),
    (select count(*) from public.registrations where status not in ('cancelled', 'refused')),
    (select count(*) from public.payments where status = 'succeeded'),
    (select coalesce(sum(amount_xof), 0)::bigint from public.payments where status = 'succeeded'),
    (select count(*) from public.data_requests where status = 'pending'),
    (select count(*) from public.contact_messages where status = 'new');
end $$;
revoke execute on function public.admin_overview from anon, public;
grant execute on function public.admin_overview to authenticated;

-- Tournois gérés par l'utilisateur (admin : tous ; staff : les siens).
create or replace function public.my_managed_tournaments()
returns setof public.tournaments language sql stable security definer set search_path = '' as $$
  select t.* from public.tournaments t where private.can_arbitrate(t.id) order by t.starts_at desc
$$;
revoke execute on function public.my_managed_tournaments from anon, public;
grant execute on function public.my_managed_tournaments to authenticated;

set search_path = "$user", public, extensions;

-- ===== Migration 20260928000100_tournament_engine.sql =====
-- Moteur de tournoi : numéros de départ, forfaits, byes demandés, rondes, publication en direct.

alter table public.registrations
  add column start_number int,
  add column withdrawn_at timestamptz,
  add column bye_requests jsonb not null default '{}'; -- {"3": "half"} : bye demandé à la ronde 3
create unique index registrations_start_number_idx on public.registrations (tournament_id, start_number) where start_number is not null;

alter table public.rounds
  add column pairing_engine text check (pairing_engine in ('bbp', 'fallback', 'round_robin', 'knockout', 'manual')),
  add column notes text;

alter table public.pairings
  add column stage text not null default 'main' check (stage in ('main', 'blitz', 'armageddon')),
  add column result_entered_by uuid references auth.users(id),
  add column result_entered_at timestamptz;

alter table public.tournaments
  add column initial_color text not null default 'white1' check (initial_color in ('white1', 'black1')),
  add column bye_points numeric(2, 1) not null default 1.0 check (bye_points in (0, 0.5, 1));

-- Les arbitres tiennent le classement provisoire à jour (le classement final reste réservé à l'organisateur).
drop policy standings_write on public.standings;
create policy standings_write on public.standings for all to authenticated
  using (private.can_arbitrate(tournament_id)) with check (private.can_arbitrate(tournament_id));

-- Numéros de départ : par cote décroissante puis nom (non modifiés une fois attribués).
create or replace function public.assign_start_numbers(p_tournament_id uuid, p_only_checked_in boolean default false)
returns int language plpgsql security definer set search_path = '' as $$
declare
  n int := 0;
  base int;
  r record;
begin
  if not private.can_arbitrate(p_tournament_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(max(start_number), 0) into base from public.registrations where tournament_id = p_tournament_id;
  for r in
    select reg.id from public.registrations reg join public.profiles p on p.id = reg.player_id
    where reg.tournament_id = p_tournament_id and reg.status = 'confirmed' and reg.start_number is null
      and reg.withdrawn_at is null and (not p_only_checked_in or reg.checked_in_at is not null)
    order by reg.seed_rating desc nulls last, p.last_name, p.first_name
  loop
    n := n + 1;
    update public.registrations set start_number = base + n where id = r.id;
  end loop;
  insert into public.tournament_audit (tournament_id, action, details)
    values (p_tournament_id, 'assign_start_numbers', jsonb_build_object('count', n));
  return n;
end $$;
revoke execute on function public.assign_start_numbers from anon, public;
grant execute on function public.assign_start_numbers to authenticated;

-- Publication en direct (Supabase Realtime) des rondes, appariements et classements.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rounds, public.pairings, public.standings;
  end if;
end $$;

-- Le numéro de départ et le nom figurent dans la vue publique des appariements.
create or replace view public.public_pairings with (security_barrier = true) as
select pr.id, pr.tournament_id, r.number as round_number, pr.board, pr.result, pr.bye_type,
  pr.white_id, private.display_name(w) as white_name,
  pr.black_id, case when b.id is null then null else private.display_name(b) end as black_name, pr.stage,
  (select reg.start_number from public.registrations reg where reg.tournament_id = pr.tournament_id and reg.player_id = pr.white_id) as white_start,
  (select reg.start_number from public.registrations reg where reg.tournament_id = pr.tournament_id and reg.player_id = pr.black_id) as black_start
from public.pairings pr
join public.rounds r on r.id = pr.round_id and r.published_at is not null
join public.profiles w on w.id = pr.white_id
left join public.profiles b on b.id = pr.black_id
join public.tournaments t on t.id = pr.tournament_id and t.status <> 'draft';
grant select on public.public_pairings to anon, authenticated;

set search_path = "$user", public, extensions;

-- ===== Migration 20260928000200_tournament_admin.sql =====
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

set search_path = "$user", public, extensions;

-- ===== Migration 20260928000300_coaching.sql =====
-- Coaching : coachs, offres, disponibilités, réservations, suivi des élèves, candidatures, devis.

create table public.coach_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  headline jsonb not null default '{}',
  bio jsonb not null default '{}',
  languages text[] not null default '{fr}' check (languages <@ array['fr', 'en', 'fon']),
  modalities text[] not null default '{in_person}' check (modalities <@ array['in_person', 'online']),
  levels text[] not null default '{}' check (levels <@ array['discovery', 'beginner', 'intermediate', 'advanced', 'competition']),
  specialties text[] not null default '{}',
  city text,
  zone text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  is_chesspirit boolean not null default false,
  rating_avg numeric(2, 1),
  reviews_count int not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger coach_profiles_updated_at before update on public.coach_profiles for each row execute function private.set_updated_at();

-- Coordonnées de versement : données sensibles séparées (coach et administrateurs uniquement).
create table public.coach_payout_details (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null unique references public.coach_profiles(id) on delete cascade,
  method text not null default 'mobile_money' check (method in ('mobile_money', 'bank')),
  account text not null,
  holder_name text,
  ifu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger coach_payout_details_updated_at before update on public.coach_payout_details for each row execute function private.set_updated_at();

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  title jsonb not null,
  description jsonb not null default '{}',
  language text not null check (language in ('fr', 'en', 'fon')),
  modality text not null check (modality in ('in_person', 'online')),
  level text not null check (level in ('discovery', 'beginner', 'intermediate', 'advanced', 'competition')),
  format text not null check (format in ('individual', 'group')),
  duration_min int not null default 60 check (duration_min between 15 and 480),
  price_xof int not null check (price_xof >= 0),
  capacity int not null default 1 check (capacity between 1 and 60),
  pack_sessions int check (pack_sessions between 2 and 50),
  pack_price_xof int check (pack_price_xof >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index offers_filters_idx on public.offers (is_active, language, modality, level, format);
create trigger offers_updated_at before update on public.offers for each row execute function private.set_updated_at();

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete cascade, -- null = toutes les offres du coach
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  modality text not null check (modality in ('in_person', 'online')),
  location text,
  capacity int not null default 1 check (capacity >= 1),
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index availability_slots_coach_idx on public.availability_slots (coach_id, starts_at);
create trigger availability_slots_updated_at before update on public.availability_slots for each row execute function private.set_updated_at();

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id),
  slot_id uuid not null references public.availability_slots(id),
  coach_id uuid not null references public.coach_profiles(id),
  student_id uuid not null references public.profiles(id) on delete cascade,
  booked_by uuid references auth.users(id) default auth.uid(),
  status text not null check (status in ('pending_payment', 'confirmed', 'cancelled', 'completed', 'no_show')),
  amount_xof int not null,
  commission_xof int not null default 0,
  meeting_url text,
  student_notes text check (char_length(student_notes) <= 1000),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_student_idx on public.bookings (student_id);
create index bookings_coach_idx on public.bookings (coach_id, status);
create unique index bookings_unique_active on public.bookings (slot_id, student_id) where status in ('pending_payment', 'confirmed');
create trigger bookings_updated_at before update on public.bookings for each row execute function private.set_updated_at();

create table public.homework (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  title text not null,
  details text,
  due_on date,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger homework_updated_at before update on public.homework for each row execute function private.set_updated_at();

create table public.progress_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  note text not null check (char_length(note) <= 4000),
  level text check (level in ('discovery', 'beginner', 'intermediate', 'advanced', 'competition')),
  replay_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger progress_notes_updated_at before update on public.progress_notes for each row execute function private.set_updated_at();

create table public.placement_results (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  score int not null,
  total int not null,
  level text not null,
  answers jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coach_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id),
  period_start date not null,
  period_end date not null,
  gross_xof int not null,
  commission_xof int not null,
  net_xof int not null,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coach_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  experience text not null check (char_length(experience) <= 4000),
  languages text[] not null default '{fr}',
  modalities text[] not null default '{in_person}',
  city text,
  credentials_note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('school', 'company', 'club', 'event', 'group_order', 'rental')),
  organization text not null,
  contact_name text not null,
  phone text,
  email text,
  city text,
  participants int,
  message text check (char_length(message) <= 4000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'sent', 'won', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Autorisations
-- ---------------------------------------------------------------------------
create or replace function private.my_coach_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select c.id from public.coach_profiles c where c.profile_id = private.my_profile_id()
$$;

alter table public.coach_profiles enable row level security;
alter table public.coach_payout_details enable row level security;
alter table public.offers enable row level security;
alter table public.availability_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.homework enable row level security;
alter table public.progress_notes enable row level security;
alter table public.placement_results enable row level security;
alter table public.coach_reviews enable row level security;
alter table public.payouts enable row level security;
alter table public.coach_applications enable row level security;
alter table public.quote_requests enable row level security;
revoke all on public.coach_payout_details, public.bookings, public.homework, public.progress_notes, public.placement_results,
  public.payouts, public.coach_applications from anon;
revoke select, update, delete on public.quote_requests from anon;

create policy coach_profiles_read on public.coach_profiles for select to anon, authenticated
  using (status = 'approved' or id = private.my_coach_id() or private.is_admin());
create policy coach_profiles_self on public.coach_profiles for update to authenticated
  using (id = private.my_coach_id()) with check (id = private.my_coach_id());
create policy coach_profiles_admin on public.coach_profiles for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create or replace function private.coach_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), 'system') in ('service_role', 'system') or private.is_admin() then return new; end if;
  if new.status is distinct from old.status or new.is_chesspirit is distinct from old.is_chesspirit
     or new.rating_avg is distinct from old.rating_avg or new.reviews_count is distinct from old.reviews_count then
    raise exception 'forbidden_field' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger coach_profiles_guard before update on public.coach_profiles for each row execute function private.coach_guard();

create policy payout_details_own on public.coach_payout_details for all to authenticated
  using (coach_id = private.my_coach_id() or private.is_admin()) with check (coach_id = private.my_coach_id() or private.is_admin());

create policy offers_read on public.offers for select to anon, authenticated
  using ((is_active and exists (select 1 from public.coach_profiles c where c.id = coach_id and c.status = 'approved'))
    or coach_id = private.my_coach_id() or private.is_admin());
create policy offers_write on public.offers for all to authenticated
  using (coach_id = private.my_coach_id() or private.is_admin()) with check (coach_id = private.my_coach_id() or private.is_admin());

create policy slots_read on public.availability_slots for select to anon, authenticated
  using ((status = 'open' and starts_at > now() and exists (select 1 from public.coach_profiles c where c.id = coach_id and c.status = 'approved'))
    or coach_id = private.my_coach_id() or private.is_admin());
create policy slots_write on public.availability_slots for all to authenticated
  using (coach_id = private.my_coach_id() or private.is_admin()) with check (coach_id = private.my_coach_id() or private.is_admin());

create policy bookings_read on public.bookings for select to authenticated
  using (private.manages_profile(student_id) or booked_by = auth.uid() or coach_id = private.my_coach_id() or private.is_admin());
create policy bookings_coach_update on public.bookings for update to authenticated
  using (coach_id = private.my_coach_id() or private.is_admin()) with check (coach_id = private.my_coach_id() or private.is_admin());

create policy homework_read on public.homework for select to authenticated
  using (private.manages_profile(student_id) or coach_id = private.my_coach_id() or private.is_admin());
create policy homework_coach on public.homework for all to authenticated
  using (coach_id = private.my_coach_id()) with check (coach_id = private.my_coach_id()
    and exists (select 1 from public.bookings b where b.coach_id = homework.coach_id and b.student_id = homework.student_id));
create policy homework_student_done on public.homework for update to authenticated
  using (private.manages_profile(student_id)) with check (private.manages_profile(student_id));

create policy notes_read on public.progress_notes for select to authenticated
  using (private.manages_profile(student_id) or coach_id = private.my_coach_id() or private.is_admin());
create policy notes_coach on public.progress_notes for all to authenticated
  using (coach_id = private.my_coach_id()) with check (coach_id = private.my_coach_id()
    and exists (select 1 from public.bookings b where b.coach_id = progress_notes.coach_id and b.student_id = progress_notes.student_id));

create policy placement_own on public.placement_results for all to authenticated
  using (private.manages_profile(profile_id) or private.is_admin()) with check (private.manages_profile(profile_id));

create policy reviews_read on public.coach_reviews for select to anon, authenticated
  using (status = 'published' or private.is_admin());
create policy reviews_insert on public.coach_reviews for insert to authenticated
  with check (private.manages_profile(student_id)
    and exists (select 1 from public.bookings b where b.id = booking_id and b.student_id = coach_reviews.student_id and b.status = 'completed'));
create policy reviews_admin on public.coach_reviews for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy payouts_read on public.payouts for select to authenticated using (coach_id = private.my_coach_id() or private.is_admin());
create policy payouts_admin on public.payouts for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy applications_own on public.coach_applications for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin());
create policy applications_insert on public.coach_applications for insert to authenticated
  with check (private.manages_profile(profile_id) and status = 'pending');
create policy applications_admin on public.coach_applications for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy quotes_insert on public.quote_requests for insert to anon, authenticated with check (status = 'new');
create policy quotes_admin on public.quote_requests for select to authenticated using (private.is_admin());
create policy quotes_admin_update on public.quote_requests for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- Vue publique des coachs (nom affiché, sans coordonnées).
create view public.public_coaches with (security_barrier = true) as
select c.id, c.slug, c.headline, c.bio, c.languages, c.modalities, c.levels, c.specialties, c.city, c.zone, c.is_chesspirit,
  c.rating_avg, c.reviews_count, c.is_demo, p.first_name || ' ' || p.last_name as display_name, p.titles,
  (select min(o.price_xof) from public.offers o where o.coach_id = c.id and o.is_active) as price_from
from public.coach_profiles c join public.profiles p on p.id = c.profile_id
where c.status = 'approved';
grant select on public.public_coaches to anon, authenticated;

-- Places restantes d'un créneau.
create or replace function public.slot_remaining(p_slot_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select s.capacity - (select count(*)::int from public.bookings b where b.slot_id = s.id and b.status in ('pending_payment', 'confirmed'))
  from public.availability_slots s where s.id = p_slot_id
$$;
grant execute on function public.slot_remaining to anon, authenticated;

-- Réservation : vérifie le créneau (verrou), calcule le montant et la commission paramétrable.
create or replace function public.book_slot(p_slot_id uuid, p_offer_id uuid, p_student_id uuid, p_notes text default null)
returns public.bookings language plpgsql security definer set search_path = '' as $$
declare
  s public.availability_slots;
  o public.offers;
  b public.bookings;
  v_taken int;
  v_rate numeric;
  v_commission int := 0;
  v_is_team boolean;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '28000'; end if;
  if not private.manages_profile(p_student_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into s from public.availability_slots where id = p_slot_id for update;
  select * into o from public.offers where id = p_offer_id;
  if s.id is null or o.id is null or not o.is_active or s.coach_id <> o.coach_id or (s.offer_id is not null and s.offer_id <> o.id)
     or s.status <> 'open' or s.starts_at <= now() then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;
  select count(*) into v_taken from public.bookings where slot_id = s.id and status in ('pending_payment', 'confirmed');
  if v_taken >= least(s.capacity, o.capacity) then raise exception 'slot_full' using errcode = 'P0001'; end if;
  select is_chesspirit into v_is_team from public.coach_profiles where id = o.coach_id;
  if coalesce((private.setting('coaching_commission_enabled'))::boolean, true) and not v_is_team then
    v_rate := coalesce((private.setting('coaching_commission_rate') #>> '{}')::numeric, 0);
    v_commission := round(o.price_xof * v_rate);
  end if;
  insert into public.bookings (offer_id, slot_id, coach_id, student_id, status, amount_xof, commission_xof, student_notes, meeting_url)
  values (o.id, s.id, o.coach_id, p_student_id, case when o.price_xof = 0 then 'confirmed' else 'pending_payment' end,
    o.price_xof, v_commission, left(p_notes, 1000),
    case when s.modality = 'online' then 'https://meet.jit.si/chesspirit-' || replace(gen_random_uuid()::text, '-', '') end)
  returning * into b;
  return b;
end $$;
revoke execute on function public.book_slot from anon, public;
grant execute on function public.book_slot to authenticated;

create or replace function public.cancel_booking(p_booking_id uuid) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or not (private.manages_profile(b.student_id) or b.coach_id = private.my_coach_id() or private.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.bookings set status = 'cancelled' where id = b.id returning * into b;
  return b;
end $$;
revoke execute on function public.cancel_booking from anon, public;
grant execute on function public.cancel_booking to authenticated;

-- Candidature acceptée : crée la fiche coach (en attente de publication par l'admin).
create or replace function public.approve_coach_application(p_application_id uuid) returns public.coach_profiles
language plpgsql security definer set search_path = '' as $$
declare a public.coach_applications; p public.profiles; c public.coach_profiles; v_slug text;
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into a from public.coach_applications where id = p_application_id for update;
  select * into p from public.profiles where id = a.profile_id;
  v_slug := trim(both '-' from regexp_replace(lower(private.unaccent_lower(p.first_name || '-' || p.last_name)), '[^a-z0-9]+', '-', 'g'));
  if exists (select 1 from public.coach_profiles where slug = v_slug) then v_slug := v_slug || '-' || substr(p.id::text, 1, 4); end if;
  insert into public.coach_profiles (profile_id, slug, languages, modalities, city, status, bio)
  values (p.id, v_slug, a.languages, a.modalities, a.city, 'approved', jsonb_build_object('fr', a.experience))
  on conflict (profile_id) do update set status = 'approved'
  returning * into c;
  update public.coach_applications set status = 'approved', reviewed_by = auth.uid() where id = a.id;
  if p.user_id is not null then
    insert into public.user_roles (user_id, role, granted_by) values (p.user_id, 'coach', auth.uid()) on conflict do nothing;
  end if;
  return c;
end $$;
revoke execute on function public.approve_coach_application from anon, public;
grant execute on function public.approve_coach_application to authenticated;

-- Paiement confirmé d'une réservation (extension de confirm_payment).
create or replace function public.confirm_payment(p_payment_id uuid, p_status text, p_provider_ref text, p_reason text default null)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if pay.status = 'succeeded' then return pay; end if;
  update public.payments set status = p_status, provider_ref = coalesce(p_provider_ref, provider_ref),
    confirmed_at = case when p_status = 'succeeded' then now() end, failure_reason = p_reason
  where id = pay.id returning * into pay;
  if pay.object_type = 'registration' then
    if p_status = 'succeeded' then
      update public.registrations set payment_status = 'paid',
        status = case when status = 'pending_payment' then
          case when (select validation_mode from public.tournaments t where t.id = registrations.tournament_id) = 'manual'
            then 'pending_validation'::public.registration_status else 'confirmed'::public.registration_status end
          else status end
      where id = pay.object_id;
    elsif p_status in ('failed', 'cancelled') then
      update public.registrations set payment_status = 'failed' where id = pay.object_id and payment_status = 'pending';
    end if;
  elsif pay.object_type = 'booking' and p_status = 'succeeded' then
    update public.bookings set status = 'confirmed' where id = pay.object_id and status = 'pending_payment';
  elsif pay.object_type = 'order' and p_status = 'succeeded' then
    perform private.order_paid(pay.object_id);
  end if;
  return pay;
end $$;
revoke execute on function public.confirm_payment from anon, authenticated, public;
grant execute on function public.confirm_payment to service_role;

-- Défini ici, complété par la migration boutique.
create or replace function private.order_paid(p_order_id uuid) returns void language plpgsql as $$ begin null; end $$;

update public.app_settings set value = '0.15' where key = 'coaching_commission_rate';

set search_path = "$user", public, extensions;

-- ===== Migration 20260928000400_coach_students.sql =====
-- Un coach voit la fiche des élèves qui ont réservé un cours avec lui (moindre privilège).
create or replace function private.coach_sees_profile(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bookings b where b.student_id = pid and b.coach_id = private.my_coach_id())
$$;
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (private.manages_profile(id) or private.is_admin() or private.staff_sees_profile(id) or private.coach_sees_profile(id));

set search_path = "$user", public, extensions;

-- ===== Migration 20260929000100_shop.sql =====
-- Boutique : catalogue, variantes et stock, avis, liste de souhaits, codes promo,
-- cartes cadeaux, points de fidélité, commandes, livraison et suivi.

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name jsonb not null,
  description jsonb not null default '{}',
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.product_categories(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null default 'physical' check (kind in ('physical', 'gift_card')),
  name jsonb not null,
  description jsonb not null default '{}',
  price_xof int not null check (price_xof >= 0),
  compare_at_xof int check (compare_at_xof >= 0),
  art text not null default 'board',
  image_url text check (image_url is null or image_url ~ '^(https://|/)'),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_preorder boolean not null default false,
  preorder_date date,
  rating_avg numeric(2, 1),
  reviews_count int not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category_id, is_active);
create trigger products_updated_at before update on public.products for each row execute function private.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name jsonb not null default '{}',
  sku text unique,
  price_xof int check (price_xof >= 0),
  stock int not null default 0 check (stock >= 0),
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id);
create trigger product_variants_updated_at before update on public.product_variants for each row execute function private.set_updated_at();

create table public.wishlists (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, product_id)
);

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{3,32}$'),
  kind text not null check (kind in ('percent', 'amount', 'free_shipping')),
  value int not null default 0 check (value >= 0),
  min_subtotal_xof int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses int,
  uses int not null default 0,
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value between 1 and 100)
);

create type public.order_status as enum (
  'pending_payment', 'paid', 'preparing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled', 'refunded'
);

create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('CS-' || to_char(now(), 'YYYY') || '-' || nextval('public.order_number_seq')),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  profile_id uuid references public.profiles(id) on delete set null,
  status public.order_status not null default 'pending_payment',
  delivery_method text not null check (delivery_method in ('pickup', 'cotonou', 'subregion', 'none')),
  delivery_address jsonb not null default '{}',
  contact_name text not null,
  contact_phone text not null,
  contact_email text,
  subtotal_xof int not null,
  discount_xof int not null default 0,
  shipping_xof int not null default 0,
  gift_card_xof int not null default 0,
  loyalty_xof int not null default 0,
  total_xof int not null check (total_xof >= 0),
  promo_code_id uuid references public.promo_codes(id) on delete set null,
  gift_card_id uuid,
  loyalty_points_used int not null default 0,
  loyalty_points_earned int not null default 0,
  has_preorder boolean not null default false,
  notes text check (char_length(notes) <= 1000),
  tracking_note text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create trigger orders_updated_at before update on public.orders for each row execute function private.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  name text not null,
  variant_name text,
  unit_price_xof int not null,
  quantity int not null check (quantity between 1 and 50),
  total_xof int not null,
  is_preorder boolean not null default false,
  gift jsonb
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  initial_xof int not null check (initial_xof > 0),
  balance_xof int not null check (balance_xof >= 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'used', 'cancelled')),
  purchase_order_id uuid references public.orders(id) on delete set null,
  recipient_name text,
  recipient_contact text,
  message text check (char_length(message) <= 500),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger gift_cards_updated_at before update on public.gift_cards for each row execute function private.set_updated_at();
alter table public.orders add constraint orders_gift_card_fk foreign key (gift_card_id) references public.gift_cards(id) on delete set null;

create table public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  points int not null,
  reason text not null check (reason in ('order_earned', 'order_spent', 'order_refund', 'adjustment')),
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index loyalty_ledger_profile_idx on public.loyalty_ledger (profile_id);

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  unique (product_id, profile_id)
);

insert into public.app_settings (key, value, is_public, description) values
  ('shop_shipping_cotonou_xof', '1500', true, 'Frais de livraison à Cotonou (valeur de démonstration, à confirmer)'),
  ('shop_shipping_subregion_xof', '10000', true, 'Frais d''expédition dans la sous-région (valeur de démonstration, à confirmer)'),
  ('shop_free_shipping_from_xof', '50000', true, 'Livraison gratuite à Cotonou à partir de ce montant (démonstration, à confirmer)'),
  ('shop_pickup_address', '"À confirmer"', true, 'Adresse du point de retrait'),
  ('shop_loyalty_points_per_100_xof', '1', true, 'Points de fidélité gagnés par tranche de 100 F CFA payés'),
  ('shop_loyalty_point_value_xof', '1', true, 'Valeur d''un point de fidélité en F CFA'),
  ('shop_order_expiry_hours', '48', false, 'Délai avant annulation automatique d''une commande impayée');

-- ---------------------------------------------------------------------------
-- Autorisations
-- ---------------------------------------------------------------------------
create or replace function private.is_shop_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin_of('shop')
$$;

create or replace function private.owns_order(p_order uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orders o where o.id = p_order and o.user_id = auth.uid())
$$;

create or replace function private.has_bought(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.order_items i join public.orders o on o.id = i.order_id
    where i.product_id = p_product and o.user_id = auth.uid()
      and o.status in ('paid', 'preparing', 'ready_for_pickup', 'shipped', 'delivered'))
$$;

alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.wishlists enable row level security;
alter table public.promo_codes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.gift_cards enable row level security;
alter table public.loyalty_ledger enable row level security;
alter table public.product_reviews enable row level security;
revoke all on public.wishlists, public.promo_codes, public.orders, public.order_items, public.order_events,
  public.gift_cards, public.loyalty_ledger from anon;
revoke insert, update, delete on public.product_categories, public.products, public.product_variants,
  public.product_reviews from anon;

create policy categories_read on public.product_categories for select to anon, authenticated
  using (is_active or private.is_shop_admin());
create policy categories_admin on public.product_categories for all to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());
create policy products_read on public.products for select to anon, authenticated
  using (is_active or private.is_shop_admin());
create policy products_admin on public.products for all to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());
create policy variants_read on public.product_variants for select to anon, authenticated
  using (is_active or private.is_shop_admin());
create policy variants_admin on public.product_variants for all to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());

create policy wishlists_own on public.wishlists for all to authenticated
  using (profile_id = private.my_profile_id()) with check (profile_id = private.my_profile_id());

-- Codes promo : jamais listés publiquement (vérification par fonction).
create policy promo_admin on public.promo_codes for all to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());

-- Commandes : lecture par l'acheteur ; toute écriture passe par les fonctions ci-dessous
-- ou par l'administration de la boutique.
create policy orders_read on public.orders for select to authenticated
  using (user_id = auth.uid() or private.is_shop_admin());
create policy orders_admin on public.orders for update to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());
create policy order_items_read on public.order_items for select to authenticated
  using (private.owns_order(order_id) or private.is_shop_admin());
create policy order_events_read on public.order_events for select to authenticated
  using (private.owns_order(order_id) or private.is_shop_admin());
create policy gift_cards_read on public.gift_cards for select to authenticated
  using ((purchase_order_id is not null and private.owns_order(purchase_order_id)) or private.is_shop_admin());
create policy gift_cards_admin on public.gift_cards for update to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());
create policy loyalty_read on public.loyalty_ledger for select to authenticated
  using (profile_id = private.my_profile_id() or private.is_shop_admin());

create policy reviews_read on public.product_reviews for select to anon, authenticated
  using (status = 'published' or profile_id = private.my_profile_id() or private.is_shop_admin());
create policy reviews_insert on public.product_reviews for insert to authenticated
  with check (profile_id = private.my_profile_id() and private.has_bought(product_id));
create policy reviews_update_own on public.product_reviews for update to authenticated
  using (profile_id = private.my_profile_id()) with check (profile_id = private.my_profile_id() and status = 'published');
create policy reviews_admin on public.product_reviews for update to authenticated
  using (private.is_shop_admin()) with check (private.is_shop_admin());
create policy reviews_delete on public.product_reviews for delete to authenticated
  using (profile_id = private.my_profile_id() or private.is_shop_admin());

-- Note moyenne des produits.
create or replace function private.refresh_product_rating() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    rating_avg = (select round(avg(rating)::numeric, 1) from public.product_reviews r where r.product_id = pid and r.status = 'published'),
    reviews_count = (select count(*) from public.product_reviews r where r.product_id = pid and r.status = 'published')
  where p.id = pid;
  return null;
end $$;
create trigger product_reviews_rating after insert or update or delete on public.product_reviews
  for each row execute function private.refresh_product_rating();

-- ---------------------------------------------------------------------------
-- Fonctions
-- ---------------------------------------------------------------------------
create or replace function public.loyalty_balance() returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(points), 0)::int from public.loyalty_ledger where profile_id = private.my_profile_id()
$$;

-- Remise d'un code promo pour un sous-total (0 si invalide). Ne révèle rien d'autre.
create or replace function public.check_promo(p_code text, p_subtotal int)
returns table (valid boolean, kind text, discount_xof int)
language plpgsql stable security definer set search_path = '' as $$
declare pc public.promo_codes;
begin
  select * into pc from public.promo_codes c where c.code = upper(trim(p_code)) and c.is_active
    and (c.starts_at is null or c.starts_at <= now()) and (c.ends_at is null or c.ends_at > now())
    and (c.max_uses is null or c.uses < c.max_uses) and c.min_subtotal_xof <= p_subtotal;
  if not found then return query select false, null::text, 0; return; end if;
  return query select true, pc.kind,
    case pc.kind when 'percent' then (p_subtotal * pc.value / 100)
                 when 'amount' then least(pc.value, p_subtotal) else 0 end;
end $$;

create or replace function public.gift_card_balance(p_code text) returns int
language sql stable security definer set search_path = '' as $$
  select balance_xof from public.gift_cards
  where code = upper(trim(p_code)) and status = 'active' and (expires_at is null or expires_at > now())
$$;

create or replace function private.gift_code() returns text language sql volatile set search_path = '' as $$
  select 'CAD-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4))
    || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4))
$$;

/*
 * Passe une commande. Les prix, remises, frais et stocks viennent exclusivement de la base.
 * p_items : [{ "variant_id": uuid, "quantity": int, "gift": { recipient_name, recipient_contact, message } }]
 * Le stock est réservé immédiatement et restitué en cas d'annulation ou d'expiration.
 */
create or replace function public.place_order(
  p_items jsonb, p_delivery text, p_address jsonb, p_contact_name text, p_contact_phone text,
  p_contact_email text default null, p_promo text default null, p_gift_code text default null,
  p_use_points int default 0, p_notes text default null
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.my_profile_id();
  o public.orders;
  it jsonb;
  v record;
  qty int;
  unit int;
  subtotal int := 0;
  physical boolean := false;
  preorder boolean := false;
  promo record;
  promo_kind text;
  promo_id uuid;
  discount int := 0;
  shipping int := 0;
  gc public.gift_cards;
  gc_amount int := 0;
  pts int := 0;
  pt_value int := coalesce((private.setting('shop_loyalty_point_value_xof'))::int, 1);
  balance int;
  remaining int;
  lines jsonb := '[]';
begin
  if auth.uid() is null or me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'empty_cart' using errcode = '22023';
  end if;
  if p_delivery not in ('pickup', 'cotonou', 'subregion') then raise exception 'invalid_delivery' using errcode = '22023'; end if;
  if coalesce(trim(p_contact_name), '') = '' or coalesce(trim(p_contact_phone), '') !~ '^\+?[0-9 ]{8,20}$' then
    raise exception 'invalid_contact' using errcode = '22023';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    qty := coalesce((it ->> 'quantity')::int, 0);
    if qty < 1 or qty > 50 then raise exception 'invalid_quantity' using errcode = '22023'; end if;
    select pv.id, pv.stock, pv.name as vname, coalesce(pv.price_xof, p.price_xof) as price, p.id as pid, p.name, p.kind,
      p.is_preorder
      into v
      from public.product_variants pv join public.products p on p.id = pv.product_id
      where pv.id = (it ->> 'variant_id')::uuid and pv.is_active and p.is_active
      for update of pv;
    if not found then raise exception 'product_unavailable' using errcode = 'P0002'; end if;
    if not v.is_preorder and v.kind = 'physical' then
      if v.stock < qty then raise exception 'out_of_stock' using errcode = '23514'; end if;
      update public.product_variants set stock = stock - qty where id = v.id;
    end if;
    if v.kind = 'physical' then physical := true; end if;
    if v.is_preorder then preorder := true; end if;
    unit := v.price;
    subtotal := subtotal + unit * qty;
    lines := lines || jsonb_build_object('pid', v.pid, 'vid', v.id, 'name', coalesce(v.name ->> 'fr', ''),
      'vname', nullif(v.vname ->> 'fr', ''), 'unit', unit, 'qty', qty, 'pre', v.is_preorder,
      'gift', case when v.kind = 'gift_card' then coalesce(it -> 'gift', '{}'::jsonb) end);
  end loop;

  if p_promo is not null and trim(p_promo) <> '' then
    select * into promo from public.check_promo(p_promo, subtotal);
    if not promo.valid then raise exception 'invalid_promo' using errcode = '22023'; end if;
    discount := promo.discount_xof;
    promo_kind := promo.kind;
    select id into promo_id from public.promo_codes where code = upper(trim(p_promo));
  end if;

  if physical then
    shipping := case p_delivery
      when 'pickup' then 0
      when 'cotonou' then case when subtotal - discount >= coalesce((private.setting('shop_free_shipping_from_xof'))::int, 2147483647)
        then 0 else coalesce((private.setting('shop_shipping_cotonou_xof'))::int, 0) end
      else coalesce((private.setting('shop_shipping_subregion_xof'))::int, 0) end;
    if promo_kind = 'free_shipping' then shipping := 0; end if;
  else
    p_delivery := 'none';
  end if;
  if p_delivery in ('cotonou', 'subregion') and coalesce(trim(p_address ->> 'line'), '') = '' then
    raise exception 'address_required' using errcode = '22023';
  end if;

  remaining := subtotal - discount + shipping;

  if p_gift_code is not null and trim(p_gift_code) <> '' then
    select * into gc from public.gift_cards where code = upper(trim(p_gift_code)) and status = 'active'
      and (expires_at is null or expires_at > now()) for update;
    if not found then raise exception 'invalid_gift_card' using errcode = '22023'; end if;
    gc_amount := least(gc.balance_xof, remaining);
    update public.gift_cards set balance_xof = balance_xof - gc_amount,
      status = case when balance_xof - gc_amount = 0 then 'used' else 'active' end where id = gc.id;
    remaining := remaining - gc_amount;
  end if;

  if coalesce(p_use_points, 0) > 0 then
    select coalesce(sum(points), 0) into balance from public.loyalty_ledger where profile_id = me;
    pts := least(p_use_points, balance, remaining / greatest(pt_value, 1));
    remaining := remaining - pts * pt_value;
  end if;

  insert into public.orders (user_id, profile_id, delivery_method, delivery_address, contact_name, contact_phone, contact_email,
    subtotal_xof, discount_xof, shipping_xof, gift_card_xof, loyalty_xof, total_xof, promo_code_id, gift_card_id,
    loyalty_points_used, has_preorder, notes)
  values (auth.uid(), me, p_delivery, coalesce(p_address, '{}'), trim(p_contact_name), trim(p_contact_phone),
    nullif(trim(p_contact_email), ''), subtotal, discount, shipping, gc_amount, pts * pt_value, remaining, promo_id,
    case when gc_amount > 0 then gc.id end, pts, preorder, left(p_notes, 1000))
  returning * into o;

  insert into public.order_items (order_id, product_id, variant_id, name, variant_name, unit_price_xof, quantity, total_xof, is_preorder, gift)
  select o.id, (l ->> 'pid')::uuid, (l ->> 'vid')::uuid, l ->> 'name', l ->> 'vname', (l ->> 'unit')::int,
    (l ->> 'qty')::int, (l ->> 'unit')::int * (l ->> 'qty')::int, (l ->> 'pre')::boolean,
    case when l -> 'gift' = 'null'::jsonb then null else l -> 'gift' end
  from jsonb_array_elements(lines) l;

  if pts > 0 then
    insert into public.loyalty_ledger (profile_id, points, reason, order_id) values (me, -pts, 'order_spent', o.id);
  end if;
  insert into public.order_events (order_id, status) values (o.id, 'pending_payment');

  if o.total_xof = 0 then
    perform private.order_paid(o.id);
    select * into o from public.orders where id = o.id;
  end if;
  return o;
end $$;
revoke execute on function public.place_order from anon, public;
grant execute on function public.place_order to authenticated;

-- Commande payée (appelée par confirm_payment ou quand le total est nul).
create or replace function private.order_paid(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  it record;
  i int;
  per100 int := coalesce((private.setting('shop_loyalty_points_per_100_xof'))::int, 0);
  earned int;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.status <> 'pending_payment' then return; end if;
  earned := (o.total_xof / 100) * per100;
  update public.orders set status = 'paid', paid_at = now(), loyalty_points_earned = earned where id = o.id;
  insert into public.order_events (order_id, status, created_by) values (o.id, 'paid', null);
  if earned > 0 and o.profile_id is not null then
    insert into public.loyalty_ledger (profile_id, points, reason, order_id) values (o.profile_id, earned, 'order_earned', o.id);
  end if;
  if o.promo_code_id is not null then
    update public.promo_codes set uses = uses + 1 where id = o.promo_code_id;
  end if;
  -- Cartes cadeaux achetées : une carte active par unité.
  for it in select oi.* from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = o.id and p.kind = 'gift_card' loop
    for i in 1 .. it.quantity loop
      insert into public.gift_cards (code, initial_xof, balance_xof, status, purchase_order_id, recipient_name,
        recipient_contact, message, expires_at)
      values (private.gift_code(), it.unit_price_xof, it.unit_price_xof, 'active', o.id, it.gift ->> 'recipient_name',
        it.gift ->> 'recipient_contact', left(it.gift ->> 'message', 500), now() + interval '1 year');
    end loop;
  end loop;
  -- Commande uniquement composée de cartes cadeaux : livrée immédiatement.
  if o.delivery_method = 'none' then
    update public.orders set status = 'delivered' where id = o.id;
    insert into public.order_events (order_id, status, created_by) values (o.id, 'delivered', null);
  end if;
end $$;

-- Restitution (stock, carte cadeau, points) d'une commande annulée.
create or replace function private.release_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id;
  update public.product_variants pv set stock = pv.stock + oi.quantity
    from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = o.id and oi.variant_id = pv.id and p.kind = 'physical' and not oi.is_preorder;
  if o.gift_card_id is not null and o.gift_card_xof > 0 then
    update public.gift_cards set balance_xof = balance_xof + o.gift_card_xof, status = 'active' where id = o.gift_card_id;
  end if;
  if o.loyalty_points_used > 0 and o.profile_id is not null then
    insert into public.loyalty_ledger (profile_id, points, reason, order_id) values (o.profile_id, o.loyalty_points_used, 'order_refund', o.id);
  end if;
end $$;

-- Annulation par l'acheteur (avant paiement) ou par l'administration de la boutique.
create or replace function public.cancel_order(p_order_id uuid, p_note text default null) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (private.is_shop_admin() or (o.user_id = auth.uid() and o.status = 'pending_payment')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if o.status in ('cancelled', 'refunded', 'delivered', 'shipped') then raise exception 'not_cancellable' using errcode = '22023'; end if;
  perform private.release_order(o.id);
  if o.status <> 'pending_payment' and o.loyalty_points_earned > 0 and o.profile_id is not null then
    insert into public.loyalty_ledger (profile_id, points, reason, order_id) values (o.profile_id, -o.loyalty_points_earned, 'adjustment', o.id);
  end if;
  update public.orders set status = 'cancelled' where id = o.id returning * into o;
  insert into public.order_events (order_id, status, note) values (o.id, 'cancelled', left(p_note, 500));
  update public.payments set status = 'cancelled' where object_type = 'order' and object_id = o.id and status = 'pending';
  return o;
end $$;
revoke execute on function public.cancel_order from anon, public;
grant execute on function public.cancel_order to authenticated;

-- Suivi logistique par l'administration de la boutique.
create or replace function public.set_order_status(p_order_id uuid, p_status public.order_status, p_note text default null)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if not private.is_shop_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status in ('pending_payment', 'paid', 'cancelled') then raise exception 'invalid_status' using errcode = '22023'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if o.status in ('pending_payment', 'cancelled', 'refunded') then raise exception 'invalid_transition' using errcode = '22023'; end if;
  update public.orders set status = p_status, tracking_note = coalesce(nullif(trim(p_note), ''), tracking_note)
    where id = o.id returning * into o;
  insert into public.order_events (order_id, status, note) values (o.id, p_status, left(p_note, 500));
  return o;
end $$;
revoke execute on function public.set_order_status from anon, public;
grant execute on function public.set_order_status to authenticated;

-- Suivi public : numéro de commande + téléphone de contact.
create or replace function public.track_order(p_number text, p_phone text)
returns table (number text, status public.order_status, delivery_method text, created_at timestamptz, events jsonb)
language sql stable security definer set search_path = '' as $$
  select o.number, o.status, o.delivery_method, o.created_at,
    (select coalesce(jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'at', e.created_at) order by e.created_at), '[]')
       from public.order_events e where e.order_id = o.id)
  from public.orders o
  where o.number = upper(trim(p_number))
    and regexp_replace(o.contact_phone, '[^0-9]', '', 'g') = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
    and length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) >= 8
$$;

-- Commandes impayées expirées (tâche planifiée).
create or replace function private.expire_orders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in select id from public.orders where status = 'pending_payment'
    and created_at < now() - make_interval(hours => coalesce((private.setting('shop_order_expiry_hours'))::int, 48)) loop
    perform private.release_order(r.id);
    update public.orders set status = 'cancelled' where id = r.id;
    insert into public.order_events (order_id, status, note, created_by) values (r.id, 'cancelled', 'expired', null);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Tableau de bord boutique.
create or replace function public.shop_overview()
returns table (orders_to_process bigint, revenue_xof bigint, low_stock bigint, pending_payment bigint)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.orders where status in ('paid', 'preparing')),
    (select coalesce(sum(total_xof), 0) from public.orders where status not in ('pending_payment', 'cancelled', 'refunded')),
    (select count(*) from public.product_variants pv join public.products p on p.id = pv.product_id
       where p.kind = 'physical' and p.is_active and not p.is_preorder and pv.stock <= 3),
    (select count(*) from public.orders where status = 'pending_payment')
  where private.is_shop_admin()
$$;

set search_path = "$user", public, extensions;

-- ===== Migration 20260929000200_admin_v1.sql =====
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

set search_path = "$user", public, extensions;

-- ===== Migration 20260930000100_leagues_tour.sql =====
-- Ligues individuelles (3 divisions × 3 cadences) et Chesspirit Tour.
-- Toutes les règles (formats, montées, descentes, barèmes, coefficients) sont en base et modifiables.

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'closed')),
  -- Règles de ligue : montées, descentes, barrage, règle de Sofia, forfaits, licence.
  league_rules jsonb not null default '{"promoted": 2, "relegated": 2, "playoff": {"upper_rank": 10, "lower_rank": 3}, "sofia_rule": false, "max_unjustified_forfeits": 2, "postpone_deadline_days": 7}',
  license_fee_xof int check (license_fee_xof >= 0), -- null = à confirmer
  tour_best_results int not null default 6 check (tour_best_results between 1 and 20),
  masters_qualified int not null default 8,
  masters_invited int not null default 2,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on)
);
create trigger seasons_updated_at before update on public.seasons for each row execute function private.set_updated_at();

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  division text not null check (division in ('l1', 'l2', 'amateur')),
  cadence public.cadence not null,
  format text not null check (format in ('round_robin', 'double_round_robin', 'swiss')),
  size int check (size between 2 and 500),
  base_minutes int not null,
  increment_seconds int not null,
  rounds_count int,
  schedule_note jsonb not null default '{}',
  status text not null default 'planned' check (status in ('planned', 'ongoing', 'finished')),
  champion_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, division, cadence)
);
create trigger leagues_updated_at before update on public.leagues for each row execute function private.set_updated_at();
alter table public.tournaments add constraint tournaments_league_fk foreign key (league_id) references public.leagues(id) on delete set null;
create index tournaments_league_idx on public.tournaments (league_id);

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  seed int,
  status text not null default 'active' check (status in ('active', 'withdrawn', 'excluded')),
  unjustified_forfeits int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, profile_id)
);
create trigger league_members_updated_at before update on public.league_members for each row execute function private.set_updated_at();

-- Journées : une journée = un tournoi (ronde(s) d'une ligue fermée ou tournoi suisse mensuel de la Ligue Amateur).
create table public.league_matchdays (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  number int not null check (number >= 1),
  scheduled_on date,
  rounds text, -- ex. « 1-6 » pour les journées de rapide
  tournament_id uuid references public.tournaments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, number)
);
create trigger league_matchdays_updated_at before update on public.league_matchdays for each row execute function private.set_updated_at();

create table public.league_licenses (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  cadences public.cadence[] not null default '{blitz,rapid,classical}',
  status text not null default 'pending_payment' check (status in ('pending_payment', 'active', 'exempt', 'cancelled')),
  amount_xof int not null default 0,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, profile_id)
);
create trigger league_licenses_updated_at before update on public.league_licenses for each row execute function private.set_updated_at();

create table public.league_postponements (
  id uuid primary key default gen_random_uuid(),
  pairing_id uuid not null references public.pairings(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  reason text check (char_length(reason) <= 1000),
  proposed_date date,
  opponent_agreed boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
  decided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pairing_id)
);
create trigger league_postponements_updated_at before update on public.league_postponements for each row execute function private.set_updated_at();

-- Chesspirit Tour -----------------------------------------------------------
create table public.scoring_scales (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  places int[] not null,
  participation numeric(4, 1) not null default 5,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index scoring_scales_default_idx on public.scoring_scales (is_default) where is_default;
create trigger scoring_scales_updated_at before update on public.scoring_scales for each row execute function private.set_updated_at();
insert into public.scoring_scales (name, places, participation, is_default) values
  ('Barème Chesspirit', array[100, 80, 65, 55, 50, 45, 40, 36, 32, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 5, true);

create table public.tour_stages (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  tournament_id uuid unique references public.tournaments(id) on delete set null,
  number int not null,
  name text not null,
  city text,
  planned_on date,
  kind text not null default 'regular' check (kind in ('regular', 'major', 'online', 'masters')),
  coefficient numeric(3, 2) not null default 1 check (coefficient between 0 and 3),
  scale_id uuid references public.scoring_scales(id),
  status text not null default 'planned' check (status in ('planned', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, number)
);
create trigger tour_stages_updated_at before update on public.tour_stages for each row execute function private.set_updated_at();

create table public.tour_points (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.tour_stages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rank int not null,
  points numeric(6, 1) not null,
  created_at timestamptz not null default now(),
  unique (stage_id, profile_id)
);

create table public.masters_invitations (
  season_id uuid not null references public.seasons(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (season_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- Autorisations
-- ---------------------------------------------------------------------------
alter table public.seasons enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_matchdays enable row level security;
alter table public.league_licenses enable row level security;
alter table public.league_postponements enable row level security;
alter table public.scoring_scales enable row level security;
alter table public.tour_stages enable row level security;
alter table public.tour_points enable row level security;
alter table public.masters_invitations enable row level security;
revoke insert, update, delete on public.seasons, public.leagues, public.league_members, public.league_matchdays,
  public.scoring_scales, public.tour_stages, public.tour_points, public.masters_invitations from anon;
revoke all on public.league_licenses, public.league_postponements from anon;

do $$
declare t text;
begin
  foreach t in array array['seasons', 'leagues', 'league_matchdays', 'scoring_scales', 'tour_stages', 'tour_points', 'masters_invitations'] loop
    execute format('create policy %1$s_read on public.%1$s for select to anon, authenticated using (true)', t);
    execute format('create policy %1$s_admin on public.%1$s for all to authenticated using (private.is_admin_of(''competitions'')) with check (private.is_admin_of(''competitions''))', t);
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$s for each row execute function private.audit_trigger()', t);
  end loop;
end $$;

-- Membres : la composition des ligues est publique (via la vue public_league_members), la table reste réservée.
create policy league_members_read on public.league_members for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin_of('competitions'));
create policy league_members_admin on public.league_members for all to authenticated
  using (private.is_admin_of('competitions')) with check (private.is_admin_of('competitions'));
create trigger league_members_audit after insert or update or delete on public.league_members
  for each row execute function private.audit_trigger();

create policy league_licenses_read on public.league_licenses for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin_of('competitions'));
create policy league_licenses_admin on public.league_licenses for all to authenticated
  using (private.is_admin_of('competitions')) with check (private.is_admin_of('competitions'));

create or replace function private.pairing_player(p_pairing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pairings pr where pr.id = p_pairing
    and (private.manages_profile(pr.white_id) or private.manages_profile(pr.black_id)))
$$;
create or replace function private.pairing_arbiter(p_pairing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pairings pr where pr.id = p_pairing and private.can_arbitrate(pr.tournament_id))
$$;

create policy postponements_read on public.league_postponements for select to authenticated
  using (private.pairing_player(pairing_id) or private.pairing_arbiter(pairing_id));
create policy postponements_insert on public.league_postponements for insert to authenticated
  with check (private.manages_profile(requested_by) and private.pairing_player(pairing_id) and status = 'pending'
    and not opponent_agreed and decided_by is null);
create policy postponements_arbiter on public.league_postponements for update to authenticated
  using (private.pairing_arbiter(pairing_id)) with check (private.pairing_arbiter(pairing_id));

-- Accord de l'adversaire (seul champ modifiable par lui).
create or replace function public.agree_postponement(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare lp public.league_postponements; pr public.pairings;
begin
  select * into lp from public.league_postponements where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into pr from public.pairings where id = lp.pairing_id;
  if not ((private.manages_profile(pr.white_id) and pr.white_id <> lp.requested_by)
       or (private.manages_profile(pr.black_id) and pr.black_id <> lp.requested_by)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.league_postponements set opponent_agreed = true where id = lp.id;
end $$;
revoke execute on function public.agree_postponement from anon, public;
grant execute on function public.agree_postponement to authenticated;

-- ---------------------------------------------------------------------------
-- Vues publiques
-- ---------------------------------------------------------------------------
create view public.public_league_members with (security_barrier = true) as
select m.league_id, m.profile_id, m.seed, m.status, private.display_name(p) as display_name,
  coalesce(p.club_name, o.name) as club, p.titles
from public.league_members m
join public.profiles p on p.id = m.profile_id
left join public.organizations o on o.id = p.club_id;
grant select on public.public_league_members to anon, authenticated;

-- Classement de ligue : somme des points et du Sonneborn-Berger sur les journées (tournois) de la ligue.
create view public.league_standings with (security_barrier = true) as
with agg as (
  select t.league_id, s.player_id,
    sum(s.points) as points,
    sum(coalesce((s.tiebreaks ->> 'sonneborn_berger')::numeric, 0)) as sonneborn_berger,
    sum(coalesce(s.games, 0)) as games,
    count(distinct s.tournament_id) as matchdays
  from public.standings s
  join public.tournaments t on t.id = s.tournament_id and t.league_id is not null and t.status <> 'draft'
    and (t.results_published or t.status in ('ongoing', 'finished', 'archived'))
  group by t.league_id, s.player_id
)
select a.league_id, a.player_id, a.points, a.sonneborn_berger, a.games, a.matchdays,
  rank() over (partition by a.league_id order by a.points desc, a.sonneborn_berger desc) as rank,
  private.display_name(p) as display_name, coalesce(p.club_name, o.name) as club, p.titles
from agg a
join public.profiles p on p.id = a.player_id
left join public.organizations o on o.id = p.club_id;
grant select on public.league_standings to anon, authenticated;

-- Classement du Tour : meilleurs résultats de la saison (nombre défini par la saison), données pour les catégories.
create view public.tour_standings with (security_barrier = true) as
with ranked as (
  select st.season_id, tp.profile_id, tp.points,
    row_number() over (partition by st.season_id, tp.profile_id order by tp.points desc) as n
  from public.tour_points tp join public.tour_stages st on st.id = tp.stage_id and st.kind <> 'masters'
), totals as (
  select r.season_id, r.profile_id,
    sum(r.points) filter (where r.n <= se.tour_best_results) as total,
    count(*) as stages
  from ranked r join public.seasons se on se.id = r.season_id
  group by r.season_id, r.profile_id
)
select t.season_id, t.profile_id, t.total, t.stages,
  rank() over (partition by t.season_id order by t.total desc) as rank,
  private.display_name(p) as display_name, coalesce(p.club_name, o.name) as club, p.titles,
  case when p.is_minor then null else p.sex end as sex,
  -- Âge au début de la saison (pour les catégories), sans exposer la date de naissance.
  case when p.birth_date is null then null else extract(year from age(se.starts_on, p.birth_date))::int end as age,
  p.sex = 'F' as is_woman,
  (select r.rating from public.ratings r where r.profile_id = p.id and r.type = 'rapid') as rapid_rating
from totals t
join public.profiles p on p.id = t.profile_id
join public.seasons se on se.id = t.season_id
left join public.organizations o on o.id = p.club_id;
grant select on public.tour_standings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Calculs
-- ---------------------------------------------------------------------------
-- Points du Tour d'une étape, depuis le classement final du tournoi lié (idempotent).
create or replace function public.compute_tour_points(p_tournament uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare st public.tour_stages; sc public.scoring_scales; n int;
begin
  if not (private.is_admin_of('competitions') or private.can_manage_tournament(p_tournament)
          or coalesce(auth.role(), 'system') in ('service_role', 'system')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into st from public.tour_stages where tournament_id = p_tournament;
  if not found then return 0; end if;
  select * into sc from public.scoring_scales where id = st.scale_id;
  if not found then select * into sc from public.scoring_scales where is_default; end if;
  delete from public.tour_points where stage_id = st.id;
  insert into public.tour_points (stage_id, profile_id, rank, points)
  select st.id, s.player_id, s.rank,
    round(((coalesce(sc.places[s.rank], 0) + sc.participation) * st.coefficient)::numeric, 1)
  from public.standings s where s.tournament_id = p_tournament;
  get diagnostics n = row_count;
  update public.tour_stages set status = 'done' where id = st.id;
  return n;
end $$;
revoke execute on function public.compute_tour_points from anon, public;
grant execute on function public.compute_tour_points to authenticated;

-- Forfaits non justifiés d'un membre de ligue (recalculés depuis les appariements) ; exclusion au seuil.
create or replace function public.refresh_league_forfeits(p_league uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare lim int; n int;
begin
  if not (private.is_admin_of('competitions') or exists (
    select 1 from public.tournaments t where t.league_id = p_league and private.can_arbitrate(t.id))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce((se.league_rules ->> 'max_unjustified_forfeits')::int, 2) into lim
    from public.leagues l join public.seasons se on se.id = l.season_id where l.id = p_league;
  update public.league_members m set unjustified_forfeits = (
    select count(*) from public.pairings pr join public.tournaments t on t.id = pr.tournament_id
    where t.league_id = p_league
      and ((pr.white_id = m.profile_id and pr.result = '-+') or (pr.black_id = m.profile_id and pr.result = '+-'))
      and not exists (select 1 from public.league_postponements lp where lp.pairing_id = pr.id and lp.status = 'approved'))
  where m.league_id = p_league;
  update public.league_members set status = 'excluded'
    where league_id = p_league and status = 'active' and unjustified_forfeits >= lim;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.refresh_league_forfeits from anon, public;
grant execute on function public.refresh_league_forfeits to authenticated;

-- Licence de ligue : demande par le joueur (montant fixé par la saison, jamais par le navigateur).
create or replace function public.request_league_license(p_season uuid, p_profile uuid) returns public.league_licenses
language plpgsql security definer set search_path = '' as $$
declare se public.seasons; lic public.league_licenses;
begin
  if not private.manages_profile(p_profile) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into se from public.seasons where id = p_season;
  if not found or se.status = 'closed' then raise exception 'season_closed' using errcode = '22023'; end if;
  if se.license_fee_xof is null then raise exception 'fee_not_set' using errcode = '22023'; end if;
  insert into public.league_licenses (season_id, profile_id, amount_xof, status)
  values (se.id, p_profile, se.license_fee_xof, case when se.license_fee_xof = 0 then 'active' else 'pending_payment' end)
  on conflict (season_id, profile_id) do update set amount_xof = excluded.amount_xof
    where public.league_licenses.status = 'pending_payment'
  returning * into lic;
  if lic.id is null then select * into lic from public.league_licenses where season_id = se.id and profile_id = p_profile; end if;
  return lic;
end $$;
revoke execute on function public.request_league_license from anon, public;
grant execute on function public.request_league_license to authenticated;

-- Paiement des licences (extension de confirm_payment).
create or replace function public.confirm_payment(p_payment_id uuid, p_status text, p_provider_ref text, p_reason text default null)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if pay.status = 'succeeded' then return pay; end if;
  update public.payments set status = p_status, provider_ref = coalesce(p_provider_ref, provider_ref),
    confirmed_at = case when p_status = 'succeeded' then now() end, failure_reason = p_reason
  where id = pay.id returning * into pay;
  if pay.object_type = 'registration' then
    if p_status = 'succeeded' then
      update public.registrations set payment_status = 'paid',
        status = case when status = 'pending_payment' then
          case when (select validation_mode from public.tournaments t where t.id = registrations.tournament_id) = 'manual'
            then 'pending_validation'::public.registration_status else 'confirmed'::public.registration_status end
          else status end
      where id = pay.object_id;
    elsif p_status in ('failed', 'cancelled') then
      update public.registrations set payment_status = 'failed' where id = pay.object_id and payment_status = 'pending';
    end if;
  elsif pay.object_type = 'booking' and p_status = 'succeeded' then
    update public.bookings set status = 'confirmed' where id = pay.object_id and status = 'pending_payment';
  elsif pay.object_type = 'order' and p_status = 'succeeded' then
    perform private.order_paid(pay.object_id);
  elsif pay.object_type = 'league_license' and p_status = 'succeeded' then
    update public.league_licenses set status = 'active' where id = pay.object_id and status = 'pending_payment';
  end if;
  return pay;
end $$;
revoke execute on function public.confirm_payment from anon, authenticated, public;
grant execute on function public.confirm_payment to service_role;

set search_path = "$user", public, extensions;

-- ===== Migration 20260930000200_security_fixes.sql =====
-- Correctifs de la revue de sécurité de fin de phase 1.

-- H2 : colonnes protégées sur les inscriptions et réservations (le staff ou le coach ne peut
-- pas rattacher une ligne à une autre personne ni modifier les montants). Fonction d'appelant :
-- les fonctions SECURITY DEFINER (propriétaire) et le rôle service ne sont pas concernés.
create or replace function private.registrations_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') or private.is_admin() then return new; end if;
  if new.player_id is distinct from old.player_id or new.tournament_id is distinct from old.tournament_id
     or new.amount_xof is distinct from old.amount_xof or new.ticket_code is distinct from old.ticket_code
     or new.registered_by is distinct from old.registered_by then
    raise exception 'forbidden_field' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger registrations_guard before update on public.registrations
  for each row execute function private.registrations_guard();

create or replace function private.bookings_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') or private.is_admin() then return new; end if;
  if new.student_id is distinct from old.student_id or new.coach_id is distinct from old.coach_id
     or new.offer_id is distinct from old.offer_id or new.slot_id is distinct from old.slot_id
     or new.amount_xof is distinct from old.amount_xof or new.commission_xof is distinct from old.commission_xof
     or new.booked_by is distinct from old.booked_by then
    raise exception 'forbidden_field' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (old.status = 'confirmed' and new.status in ('completed', 'no_show', 'cancelled')) then
    raise exception 'forbidden_status' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger bookings_guard before update on public.bookings
  for each row execute function private.bookings_guard();

-- M6 : champs d'identité. Titres réservés aux administrateurs ; identifiant FIDE unique ;
-- à la création, les indicateurs de vérification ne peuvent pas être forcés.
create or replace function private.profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), 'system') in ('service_role', 'system') or private.is_admin() then
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

create or replace function private.profiles_insert_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), 'system') in ('service_role', 'system') or private.is_admin() then
    return new;
  end if;
  new.verified := false;
  new.claimed := false;
  new.is_demo := false;
  new.merged_into := null;
  new.suspended_at := null;
  new.titles := '{}';
  return new;
end $$;
create trigger profiles_insert_guard before insert on public.profiles
  for each row execute function private.profiles_insert_guard();

create unique index profiles_fide_unique_idx on public.profiles (fide_id)
  where fide_id is not null and merged_into is null;

-- M6 : le staff est désigné par un identifiant vérifié du compte (pas par un champ de profil libre).
create or replace function public.add_tournament_staff(p_tournament_id uuid, p_identifier text, p_role text)
returns public.tournament_staff language plpgsql security definer set search_path = '' as $$
declare
  p public.profiles;
  s public.tournament_staff;
  v_id text := lower(trim(p_identifier));
  v_digits text := regexp_replace(v_id, '\D', '', 'g');
begin
  if not private.can_manage_tournament(p_tournament_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('organizer', 'chief_arbiter', 'deputy_arbiter', 'operator') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  select pr.* into p from auth.users u
    join public.profiles pr on pr.user_id = u.id and pr.merged_into is null
    where (u.email is not null and lower(u.email) = v_id and u.email_confirmed_at is not null)
       or (u.phone is not null and length(v_digits) >= 8 and u.phone_confirmed_at is not null
           and (u.phone = v_digits or u.phone = '229' || v_digits))
    limit 1;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  insert into public.tournament_staff (tournament_id, profile_id, role) values (p_tournament_id, p.id, p_role)
    on conflict (tournament_id, profile_id, role) do update set role = excluded.role
    returning * into s;
  insert into public.user_roles (user_id, role, granted_by)
    values (p.user_id, case when p_role = 'organizer' then 'organizer'::public.app_role else 'arbiter'::public.app_role end, auth.uid())
    on conflict do nothing;
  insert into public.tournament_audit (tournament_id, action, details)
    values (p_tournament_id, 'add_staff', jsonb_build_object('profile', p.id, 'role', p_role));
  return s;
end $$;
revoke execute on function public.add_tournament_staff from anon, public;
grant execute on function public.add_tournament_staff to authenticated;

-- M4 : une annulation ne libère une place (et ne promeut la liste d'attente) qu'une seule fois.
create or replace function public.cancel_registration(p_registration_id uuid) returns public.registrations
language plpgsql security definer set search_path = '' as $$
declare
  r public.registrations;
  freed boolean;
begin
  select * into r from public.registrations where id = p_registration_id for update;
  if not found or not (private.manages_profile(r.player_id) or private.can_arbitrate(r.tournament_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if r.status in ('cancelled', 'refused') then return r; end if;
  freed := r.status in ('confirmed', 'pending_payment', 'pending_validation');
  update public.registrations set status = 'cancelled', waitlist_position = null where id = r.id returning * into r;
  if freed then
    update public.registrations set status = case when payment_status = 'pending' then 'pending_payment'::public.registration_status else 'confirmed'::public.registration_status end,
      waitlist_position = null
    where id = (select id from public.registrations where tournament_id = r.tournament_id and status = 'waitlisted'
                order by waitlist_position nulls last, created_at limit 1 for update);
  end if;
  return r;
end $$;
revoke execute on function public.cancel_registration from anon, public;
grant execute on function public.cancel_registration to authenticated;

-- M3 : limite d'utilisation par client.
alter table public.promo_codes add column max_uses_per_user int default 1 check (max_uses_per_user is null or max_uses_per_user >= 1);

-- M2, M3 : commande (verrou par client, code promo réservé à la commande, cartes cadeaux non remisées).
create or replace function public.place_order(
  p_items jsonb, p_delivery text, p_address jsonb, p_contact_name text, p_contact_phone text,
  p_contact_email text default null, p_promo text default null, p_gift_code text default null,
  p_use_points int default 0, p_notes text default null
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.my_profile_id();
  o public.orders;
  it jsonb;
  v record;
  qty int;
  unit int;
  subtotal int := 0;
  gift_subtotal int := 0;
  used_by_me int;
  pc public.promo_codes;
  physical boolean := false;
  preorder boolean := false;
  promo record;
  promo_kind text;
  promo_id uuid;
  discount int := 0;
  shipping int := 0;
  gc public.gift_cards;
  gc_amount int := 0;
  pts int := 0;
  pt_value int := coalesce((private.setting('shop_loyalty_point_value_xof'))::int, 1);
  balance int;
  remaining int;
  lines jsonb := '[]';
begin
  if auth.uid() is null or me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  -- Une commande à la fois par client : points et codes promo ne peuvent pas être dépensés deux fois.
  perform pg_advisory_xact_lock(hashtext('place_order:' || me::text));
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'empty_cart' using errcode = '22023';
  end if;
  if p_delivery not in ('pickup', 'cotonou', 'subregion') then raise exception 'invalid_delivery' using errcode = '22023'; end if;
  if coalesce(trim(p_contact_name), '') = '' or coalesce(trim(p_contact_phone), '') !~ '^\+?[0-9 ]{8,20}$' then
    raise exception 'invalid_contact' using errcode = '22023';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    qty := coalesce((it ->> 'quantity')::int, 0);
    if qty < 1 or qty > 50 then raise exception 'invalid_quantity' using errcode = '22023'; end if;
    select pv.id, pv.stock, pv.name as vname, coalesce(pv.price_xof, p.price_xof) as price, p.id as pid, p.name, p.kind,
      p.is_preorder
      into v
      from public.product_variants pv join public.products p on p.id = pv.product_id
      where pv.id = (it ->> 'variant_id')::uuid and pv.is_active and p.is_active
      for update of pv;
    if not found then raise exception 'product_unavailable' using errcode = 'P0002'; end if;
    if not v.is_preorder and v.kind = 'physical' then
      if v.stock < qty then raise exception 'out_of_stock' using errcode = '23514'; end if;
      update public.product_variants set stock = stock - qty where id = v.id;
    end if;
    if v.kind = 'physical' then physical := true; end if;
    if v.is_preorder then preorder := true; end if;
    unit := v.price;
    subtotal := subtotal + unit * qty;
    if v.kind = 'gift_card' then gift_subtotal := gift_subtotal + unit * qty; end if;
    lines := lines || jsonb_build_object('pid', v.pid, 'vid', v.id, 'name', coalesce(v.name ->> 'fr', ''),
      'vname', nullif(v.vname ->> 'fr', ''), 'unit', unit, 'qty', qty, 'pre', v.is_preorder,
      'gift', case when v.kind = 'gift_card' then coalesce(it -> 'gift', '{}'::jsonb) end);
  end loop;

  -- Les cartes cadeaux ne sont jamais remisées (sinon la remise se convertit en crédit).
  if p_promo is not null and trim(p_promo) <> '' then
    select * into pc from public.promo_codes where code = upper(trim(p_promo)) for update;
    select * into promo from public.check_promo(p_promo, subtotal - gift_subtotal);
    if pc.id is null or not promo.valid then raise exception 'invalid_promo' using errcode = '22023'; end if;
    select count(*) into used_by_me from public.orders
      where promo_code_id = pc.id and user_id = auth.uid() and status not in ('cancelled');
    if pc.max_uses_per_user is not null and used_by_me >= pc.max_uses_per_user then
      raise exception 'invalid_promo' using errcode = '22023';
    end if;
    discount := promo.discount_xof;
    promo_kind := promo.kind;
    promo_id := pc.id;
    -- Utilisation réservée dès la commande (restituée si elle est annulée).
    update public.promo_codes set uses = uses + 1 where id = pc.id;
  end if;

  if physical then
    shipping := case p_delivery
      when 'pickup' then 0
      when 'cotonou' then case when subtotal - discount >= coalesce((private.setting('shop_free_shipping_from_xof'))::int, 2147483647)
        then 0 else coalesce((private.setting('shop_shipping_cotonou_xof'))::int, 0) end
      else coalesce((private.setting('shop_shipping_subregion_xof'))::int, 0) end;
    if promo_kind = 'free_shipping' then shipping := 0; end if;
  else
    p_delivery := 'none';
  end if;
  if p_delivery in ('cotonou', 'subregion') and coalesce(trim(p_address ->> 'line'), '') = '' then
    raise exception 'address_required' using errcode = '22023';
  end if;

  remaining := subtotal - discount + shipping;

  if p_gift_code is not null and trim(p_gift_code) <> '' then
    select * into gc from public.gift_cards where code = upper(trim(p_gift_code)) and status = 'active'
      and (expires_at is null or expires_at > now()) for update;
    if not found then raise exception 'invalid_gift_card' using errcode = '22023'; end if;
    gc_amount := least(gc.balance_xof, remaining);
    update public.gift_cards set balance_xof = balance_xof - gc_amount,
      status = case when balance_xof - gc_amount = 0 then 'used' else 'active' end where id = gc.id;
    remaining := remaining - gc_amount;
  end if;

  if coalesce(p_use_points, 0) > 0 then
    select coalesce(sum(points), 0) into balance from public.loyalty_ledger where profile_id = me;
    -- Les points ne paient pas les cartes cadeaux.
    pts := greatest(0, least(p_use_points, balance, greatest(0, remaining - gift_subtotal) / greatest(pt_value, 1)));
    remaining := remaining - pts * pt_value;
  end if;

  insert into public.orders (user_id, profile_id, delivery_method, delivery_address, contact_name, contact_phone, contact_email,
    subtotal_xof, discount_xof, shipping_xof, gift_card_xof, loyalty_xof, total_xof, promo_code_id, gift_card_id,
    loyalty_points_used, has_preorder, notes)
  values (auth.uid(), me, p_delivery, coalesce(p_address, '{}'), trim(p_contact_name), trim(p_contact_phone),
    nullif(trim(p_contact_email), ''), subtotal, discount, shipping, gc_amount, pts * pt_value, remaining, promo_id,
    case when gc_amount > 0 then gc.id end, pts, preorder, left(p_notes, 1000))
  returning * into o;

  insert into public.order_items (order_id, product_id, variant_id, name, variant_name, unit_price_xof, quantity, total_xof, is_preorder, gift)
  select o.id, (l ->> 'pid')::uuid, (l ->> 'vid')::uuid, l ->> 'name', l ->> 'vname', (l ->> 'unit')::int,
    (l ->> 'qty')::int, (l ->> 'unit')::int * (l ->> 'qty')::int, (l ->> 'pre')::boolean,
    case when l -> 'gift' = 'null'::jsonb then null else l -> 'gift' end
  from jsonb_array_elements(lines) l;

  if pts > 0 then
    insert into public.loyalty_ledger (profile_id, points, reason, order_id) values (me, -pts, 'order_spent', o.id);
  end if;
  insert into public.order_events (order_id, status) values (o.id, 'pending_payment');

  if o.total_xof = 0 then
    perform private.order_paid(o.id);
    select * into o from public.orders where id = o.id;
  end if;
  return o;
end $$;
revoke execute on function public.place_order from anon, public;
grant execute on function public.place_order to authenticated;

-- Commande payée : l'utilisation du code promo est déjà comptée à la commande.
create or replace function private.order_paid(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  it record;
  i int;
  per100 int := coalesce((private.setting('shop_loyalty_points_per_100_xof'))::int, 0);
  earned int;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.status <> 'pending_payment' then return; end if;
  earned := (o.total_xof / 100) * per100;
  update public.orders set status = 'paid', paid_at = now(), loyalty_points_earned = earned where id = o.id;
  insert into public.order_events (order_id, status, created_by) values (o.id, 'paid', null);
  if earned > 0 and o.profile_id is not null then
    insert into public.loyalty_ledger (profile_id, points, reason, order_id) values (o.profile_id, earned, 'order_earned', o.id);
  end if;
  for it in select oi.* from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = o.id and p.kind = 'gift_card' loop
    for i in 1 .. it.quantity loop
      insert into public.gift_cards (code, initial_xof, balance_xof, status, purchase_order_id, recipient_name,
        recipient_contact, message, expires_at)
      values (private.gift_code(), it.unit_price_xof, it.unit_price_xof, 'active', o.id, it.gift ->> 'recipient_name',
        it.gift ->> 'recipient_contact', left(it.gift ->> 'message', 500), now() + interval '1 year');
    end loop;
  end loop;
  if o.delivery_method = 'none' then
    update public.orders set status = 'delivered' where id = o.id;
    insert into public.order_events (order_id, status, created_by) values (o.id, 'delivered', null);
  end if;
end $$;

-- Restitution : stock, carte cadeau utilisée, points dépensés, utilisation du code promo.
create or replace function private.release_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id;
  update public.product_variants pv set stock = pv.stock + oi.quantity
    from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = o.id and oi.variant_id = pv.id and p.kind = 'physical' and not oi.is_preorder;
  if o.gift_card_id is not null and o.gift_card_xof > 0 then
    update public.gift_cards set balance_xof = balance_xof + o.gift_card_xof, status = 'active' where id = o.gift_card_id;
  end if;
  if o.loyalty_points_used > 0 and o.profile_id is not null then
    insert into public.loyalty_ledger (profile_id, points, reason, order_id) values (o.profile_id, o.loyalty_points_used, 'order_refund', o.id);
  end if;
  if o.promo_code_id is not null then
    update public.promo_codes set uses = greatest(uses - 1, 0) where id = o.promo_code_id;
  end if;
end $$;

-- L3 : annulation ou remboursement d'une commande payée : points gagnés repris, cartes émises annulées.
create or replace function private.unwind_paid_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id;
  if o.loyalty_points_earned > 0 and o.profile_id is not null then
    insert into public.loyalty_ledger (profile_id, points, reason, order_id) values (o.profile_id, -o.loyalty_points_earned, 'adjustment', o.id);
  end if;
  update public.gift_cards set status = 'cancelled' where purchase_order_id = o.id and status in ('active', 'pending');
end $$;

create or replace function public.cancel_order(p_order_id uuid, p_note text default null) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (private.is_shop_admin() or (o.user_id = auth.uid() and o.status = 'pending_payment')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if o.status in ('cancelled', 'refunded', 'delivered', 'shipped') then raise exception 'not_cancellable' using errcode = '22023'; end if;
  perform private.release_order(o.id);
  if o.status <> 'pending_payment' then perform private.unwind_paid_order(o.id); end if;
  update public.orders set status = 'cancelled' where id = o.id returning * into o;
  insert into public.order_events (order_id, status, note) values (o.id, 'cancelled', left(p_note, 500));
  update public.payments set status = 'cancelled' where object_type = 'order' and object_id = o.id and status = 'pending';
  return o;
end $$;
revoke execute on function public.cancel_order from anon, public;
grant execute on function public.cancel_order to authenticated;

-- M1 : expiration sans course avec un paiement qui se confirme au même moment.
create or replace function private.expire_orders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in select id from public.orders where status = 'pending_payment'
    and created_at < now() - make_interval(hours => coalesce((private.setting('shop_order_expiry_hours'))::int, 48))
    for update skip locked loop
    perform private.release_order(r.id);
    update public.orders set status = 'cancelled' where id = r.id and status = 'pending_payment';
    insert into public.order_events (order_id, status, note, created_by) values (r.id, 'cancelled', 'expired', null);
    update public.payments set status = 'cancelled' where object_type = 'order' and object_id = r.id and status = 'pending';
    n := n + 1;
  end loop;
  return n;
end $$;

-- L3 : remboursement complet d'une commande : restitution et annulation des cartes émises.
create or replace function public.admin_record_refund(p_payment uuid, p_amount int, p_reason text)
returns public.refunds language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
  already int;
  rf public.refunds;
  o public.orders;
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
      select * into o from public.orders where id = pay.object_id for update;
      if o.status not in ('cancelled', 'refunded') then
        -- Stock restitué seulement si la marchandise n'est pas partie.
        if o.status in ('paid', 'preparing', 'ready_for_pickup') then perform private.release_order(o.id); end if;
        perform private.unwind_paid_order(o.id);
        update public.orders set status = 'refunded' where id = o.id;
        insert into public.order_events (order_id, status, note) values (o.id, 'refunded', left(p_reason, 500));
      end if;
    elsif pay.object_type = 'registration' then
      update public.registrations set payment_status = 'refunded' where id = pay.object_id;
    elsif pay.object_type = 'booking' then
      update public.bookings set status = 'cancelled' where id = pay.object_id and status = 'confirmed';
    elsif pay.object_type = 'league_license' then
      update public.league_licenses set status = 'cancelled' where id = pay.object_id;
    end if;
  end if;
  return rf;
end $$;
revoke execute on function public.admin_record_refund from anon, public;
grant execute on function public.admin_record_refund to authenticated;

-- M1 : un paiement confirmé pour un objet qui n'est plus payable est signalé pour remboursement.
create or replace function public.confirm_payment(p_payment_id uuid, p_status text, p_provider_ref text, p_reason text default null)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
  payable boolean := true;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if pay.status in ('succeeded', 'refunded') then return pay; end if;
  update public.payments set status = p_status, provider_ref = coalesce(p_provider_ref, provider_ref),
    confirmed_at = case when p_status = 'succeeded' then now() end, failure_reason = p_reason
  where id = pay.id returning * into pay;
  if pay.object_type = 'registration' then
    if p_status = 'succeeded' then
      payable := exists (select 1 from public.registrations where id = pay.object_id and status not in ('cancelled', 'refused'));
      update public.registrations set payment_status = 'paid',
        status = case when status = 'pending_payment' then
          case when (select validation_mode from public.tournaments t where t.id = registrations.tournament_id) = 'manual'
            then 'pending_validation'::public.registration_status else 'confirmed'::public.registration_status end
          else status end
      where id = pay.object_id and status not in ('cancelled', 'refused');
    elsif p_status in ('failed', 'cancelled') then
      update public.registrations set payment_status = 'failed' where id = pay.object_id and payment_status = 'pending';
    end if;
  elsif pay.object_type = 'booking' and p_status = 'succeeded' then
    update public.bookings set status = 'confirmed' where id = pay.object_id and status = 'pending_payment';
    payable := found;
  elsif pay.object_type = 'order' and p_status = 'succeeded' then
    payable := exists (select 1 from public.orders where id = pay.object_id and status = 'pending_payment');
    perform private.order_paid(pay.object_id);
  elsif pay.object_type = 'league_license' and p_status = 'succeeded' then
    update public.league_licenses set status = 'active' where id = pay.object_id and status = 'pending_payment';
    payable := found;
  end if;
  if p_status = 'succeeded' and not payable then
    update public.payments set metadata = metadata || '{"needs_refund": true}' where id = pay.id returning * into pay;
    perform private.audit('payment_needs_refund', 'payments', pay.id::text, null,
      jsonb_build_object('object_type', pay.object_type, 'object_id', pay.object_id));
  end if;
  return pay;
end $$;
revoke execute on function public.confirm_payment from anon, authenticated, public;
grant execute on function public.confirm_payment to service_role;

-- Fusion : l'identifiant FIDE (désormais unique) est libéré sur le doublon avant report.
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
  -- Identifiants uniques libérés sur le doublon avant d'être reportés.
  update public.profiles set user_id = null, fide_id = null where id = dup.id;
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

-- L4 : fonctions internes non appelables par les rôles d'API.
revoke execute on function private.order_paid(uuid), private.release_order(uuid), private.unwind_paid_order(uuid),
  private.expire_orders(), private.audit(text, text, text, jsonb, jsonb), private.gift_code()
  from public, anon, authenticated;

set search_path = "$user", public, extensions;

-- ===== Migration 20260930000300_league_admin.sql =====
-- Administration des ligues : répartition initiale, création des journées, clôture.

-- Répartition par la cote des licenciés d'une saison (première saison) : pour chaque cadence,
-- 12 premiers en Ligue 1, 12 suivants en Ligue 2, les autres en Ligue Amateur.
-- Sans effet sur une cadence dont les ligues ont déjà des membres.
create or replace function public.allocate_season_by_rating(p_season uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  c public.cadence;
  n int := 0;
  k int;
  start_rating int := coalesce((private.setting('default_start_rating'))::int, 1200);
begin
  if not private.is_admin_of('competitions') then raise exception 'forbidden' using errcode = '42501'; end if;
  foreach c in array array['classical', 'rapid', 'blitz']::public.cadence[] loop
    if exists (select 1 from public.league_members m join public.leagues l on l.id = m.league_id
               where l.season_id = p_season and l.cadence = c) then
      continue;
    end if;
    with ranked as (
      select lic.profile_id,
        row_number() over (order by coalesce(r.rating, start_rating) desc, p.last_name, p.first_name) as pos
      from public.league_licenses lic
      join public.profiles p on p.id = lic.profile_id and p.merged_into is null
      left join public.ratings r on r.profile_id = lic.profile_id and r.type::text = c::text
      where lic.season_id = p_season and lic.status in ('active', 'exempt') and c = any (lic.cadences)
    )
    insert into public.league_members (league_id, profile_id, seed)
    select l.id, ranked.profile_id, case when ranked.pos <= 24 then ((ranked.pos - 1) % 12) + 1 else ranked.pos - 24 end
    from ranked
    join public.leagues l on l.season_id = p_season and l.cadence = c
      and l.division = case when ranked.pos <= 12 then 'l1' when ranked.pos <= 24 then 'l2' else 'amateur' end;
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return n;
end $$;
revoke execute on function public.allocate_season_by_rating from anon, public;
grant execute on function public.allocate_season_by_rating to authenticated;

-- Crée la journée suivante d'une ligue : tournoi en brouillon aux paramètres de la ligue,
-- membres actifs inscrits d'office (licence réglée), rattachement à la ligue.
create or replace function public.create_league_matchday(p_league uuid, p_date date default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  l public.leagues;
  se public.seasons;
  num int;
  tid uuid;
  lname text;
begin
  if not private.is_admin_of('competitions') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into l from public.leagues where id = p_league;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into se from public.seasons where id = l.season_id;
  select coalesce(max(number), 0) + 1 into num from public.league_matchdays where league_id = l.id;
  lname := case l.division when 'l1' then 'Ligue 1' when 'l2' then 'Ligue 2' else 'Ligue Amateur' end || ' '
    || case l.cadence when 'classical' then 'classique' when 'rapid' then 'rapide' else 'blitz' end;
  insert into public.tournaments (slug, name, edition, starts_at, cadence, base_minutes, increment_seconds, rounds_count,
    pairing_system, tiebreaks, rated, league_id, status, organizer_profile_id, is_demo, capacity, entry_fee_xof,
    allow_online_payment, allow_on_site_payment)
  values (l.slug || '-j' || num, lname || ' — journée ' || num, se.name,
    coalesce(p_date, current_date + 7)::timestamptz + interval '9 hours',
    l.cadence, l.base_minutes, l.increment_seconds,
    case when l.format = 'swiss' then 5 else l.rounds_count end,
    l.format, '{sonneborn_berger,wins}', true, l.id, 'draft', private.my_profile_id(), se.is_demo,
    case when l.format = 'swiss' then null else l.size end, 0, false, false)
  returning id into tid;
  insert into public.registrations (tournament_id, player_id, status, payment_status, seed_rating, source)
  select tid, m.profile_id, 'confirmed', 'not_required',
    (select r.rating from public.ratings r where r.profile_id = m.profile_id and r.type::text = l.cadence::text), 'admin'
  from public.league_members m where m.league_id = l.id and m.status = 'active';
  insert into public.league_matchdays (league_id, number, scheduled_on, tournament_id) values (l.id, num, p_date, tid);
  update public.leagues set status = 'ongoing' where id = l.id and status = 'planned';
  return tid;
end $$;
revoke execute on function public.create_league_matchday from anon, public;
grant execute on function public.create_league_matchday to authenticated;

-- Clôture d'une ligue : champion = premier du classement cumulé.
create or replace function public.close_league(p_league uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare champ uuid;
begin
  if not private.is_admin_of('competitions') then raise exception 'forbidden' using errcode = '42501'; end if;
  select player_id into champ from public.league_standings where league_id = p_league order by rank, points desc limit 1;
  update public.leagues set status = 'finished', champion_id = champ where id = p_league;
  return champ;
end $$;
revoke execute on function public.close_league from anon, public;
grant execute on function public.close_league to authenticated;

set search_path = "$user", public, extensions;

-- ===== Migration 20261001000100_online_teams.sql =====
-- Compétitions en ligne (Lichess) et tournois par équipes.

-- Comptes Lichess liés (OAuth PKCE : seule l'identité est conservée, pas de jeton).
create table public.lichess_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  username text not null,
  lichess_id text not null unique,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger lichess_accounts_updated_at before update on public.lichess_accounts for each row execute function private.set_updated_at();
alter table public.lichess_accounts enable row level security;
revoke all on public.lichess_accounts from anon;
create policy lichess_read on public.lichess_accounts for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin_of('competitions'));
create policy lichess_delete on public.lichess_accounts for delete to authenticated
  using (private.manages_profile(profile_id) or private.is_admin_of('competitions'));
-- L'écriture passe par le serveur après vérification OAuth (rôle service) ou par l'administration.
create policy lichess_admin on public.lichess_accounts for all to authenticated
  using (private.is_admin_of('competitions')) with check (private.is_admin_of('competitions'));

create view public.public_lichess_accounts with (security_barrier = true) as
select la.profile_id, la.username from public.lichess_accounts la
join public.profiles p on p.id = la.profile_id and p.is_public;
grant select on public.public_lichess_accounts to anon, authenticated;

alter table public.tournaments
  add column lichess_kind text check (lichess_kind in ('arena', 'swiss')),
  add column lichess_id text check (lichess_id ~ '^[A-Za-z0-9]{4,16}$'),
  add column lichess_imported_at timestamptz,
  add column team_scoring text not null default 'match_points' check (team_scoring in ('match_points', 'game_points')),
  add column team_size int not null default 4 check (team_size between 2 and 10);

-- Équipes ---------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  organization_id uuid references public.organizations(id) on delete set null,
  captain_id uuid references public.profiles(id) on delete set null,
  seed int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, name)
);
create trigger teams_updated_at before update on public.teams for each row execute function private.set_updated_at();

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  board_order int not null check (board_order >= 1),
  is_substitute boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, profile_id),
  unique (team_id, board_order)
);
create trigger team_members_updated_at before update on public.team_members for each row execute function private.set_updated_at();

create table public.team_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number int not null check (round_number >= 1),
  table_number int not null check (table_number >= 1),
  home_team_id uuid not null references public.teams(id) on delete cascade,
  away_team_id uuid references public.teams(id) on delete cascade, -- null = exempt
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, round_number, table_number)
);
create trigger team_matches_updated_at before update on public.team_matches for each row execute function private.set_updated_at();

create table public.board_results (
  id uuid primary key default gen_random_uuid(),
  team_match_id uuid not null references public.team_matches(id) on delete cascade,
  board int not null check (board >= 1),
  white_id uuid references public.profiles(id),
  black_id uuid references public.profiles(id),
  home_is_white boolean not null,
  result public.game_result,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_match_id, board)
);
create trigger board_results_updated_at before update on public.board_results for each row execute function private.set_updated_at();

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_matches enable row level security;
alter table public.board_results enable row level security;
revoke insert, update, delete on public.teams, public.team_members, public.team_matches, public.board_results from anon;

create policy teams_read on public.teams for select to anon, authenticated
  using (private.tournament_is_public(tournament_id) or private.can_arbitrate(tournament_id));
create policy teams_write on public.teams for all to authenticated
  using (private.can_arbitrate(tournament_id)) with check (private.can_arbitrate(tournament_id));
create policy team_members_write on public.team_members for all to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and private.can_arbitrate(t.tournament_id)))
  with check (exists (select 1 from public.teams t where t.id = team_id and private.can_arbitrate(t.tournament_id)));
create policy team_members_read_staff on public.team_members for select to authenticated
  using (private.manages_profile(profile_id)
    or exists (select 1 from public.teams t where t.id = team_id and private.can_arbitrate(t.tournament_id)));
create policy team_matches_read on public.team_matches for select to anon, authenticated
  using ((published and private.tournament_is_public(tournament_id)) or private.can_arbitrate(tournament_id));
create policy team_matches_write on public.team_matches for all to authenticated
  using (private.can_arbitrate(tournament_id)) with check (private.can_arbitrate(tournament_id));
create policy board_results_read_staff on public.board_results for select to authenticated
  using (exists (select 1 from public.team_matches m where m.id = team_match_id and private.can_arbitrate(m.tournament_id)));
create policy board_results_write on public.board_results for all to authenticated
  using (exists (select 1 from public.team_matches m where m.id = team_match_id and private.can_arbitrate(m.tournament_id)))
  with check (exists (select 1 from public.team_matches m where m.id = team_match_id and private.can_arbitrate(m.tournament_id)));
do $$
declare t text;
begin
  foreach t in array array['teams', 'team_members', 'team_matches', 'board_results'] loop
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$s for each row execute function private.audit_trigger()', t);
  end loop;
end $$;

-- Vues publiques : composition (noms réduits pour les mineurs) et résultats par échiquier des rencontres publiées.
create view public.public_team_members with (security_barrier = true) as
select tm.team_id, t.tournament_id, tm.profile_id, tm.board_order, tm.is_substitute,
  private.display_name(p) as display_name, p.titles
from public.team_members tm
join public.teams t on t.id = tm.team_id
join public.profiles p on p.id = tm.profile_id
where private.tournament_is_public(t.tournament_id);
grant select on public.public_team_members to anon, authenticated;

create view public.public_board_results with (security_barrier = true) as
select br.team_match_id, br.board, br.home_is_white, br.result,
  private.display_name(w) as white_name, private.display_name(b) as black_name
from public.board_results br
join public.team_matches m on m.id = br.team_match_id and m.published
left join public.profiles w on w.id = br.white_id
left join public.profiles b on b.id = br.black_id
where private.tournament_is_public(m.tournament_id);
grant select on public.public_board_results to anon, authenticated;

set search_path = "$user", public, extensions;

-- ===== Migration 20261001000200_directory.sql =====
-- Annuaire : arbitres, structures proposées et revendiquées, offres d'emploi, carte.

-- Mineurs : le nom de famille n'est jamais exposé en entier dans la vue publique.
create or replace view public.public_profiles with (security_barrier = true) as
select p.id, p.first_name,
  case when p.is_minor then left(p.last_name, 1) || '.' else p.last_name end as last_name,
  private.display_name(p) as display_name,
  case when p.is_minor then null else p.photo_path end as photo_path,
  p.country, p.department, p.city, p.club_id, p.club_name, p.fide_id, p.titles, p.languages,
  case when p.is_minor then null else p.bio end as bio,
  p.sex, p.verified, p.is_demo,
  case when p.is_minor then null else extract(year from p.birth_date)::int end as birth_year,
  p.is_minor,
  case when p.is_minor then private.unaccent_lower(p.first_name || ' ' || coalesce(p.city, '')) else p.search_text end as search_text
from public.profiles p
where p.is_public and p.merged_into is null and p.suspended_at is null;

-- Arbitres ----------------------------------------------------------------------
create table public.arbiter_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  title text check (title in ('IA', 'FA', 'NA', 'regional', 'club', 'trainee')),
  zone text,
  availability text check (char_length(availability) <= 500),
  languages text[] not null default '{fr}',
  is_public boolean not null default true,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger arbiter_profiles_updated_at before update on public.arbiter_profiles for each row execute function private.set_updated_at();
alter table public.arbiter_profiles enable row level security;
revoke all on public.arbiter_profiles from anon;
create policy arbiter_self on public.arbiter_profiles for all to authenticated
  using (private.manages_profile(profile_id) or private.is_admin())
  with check ((private.manages_profile(profile_id) and verified = false) or private.is_admin());
-- Le badge « vérifié » n'est jamais conservé lors d'une modification par l'arbitre lui-même.
create or replace function private.arbiter_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), 'system') in ('service_role', 'system') or private.is_admin() then return new; end if;
  new.verified := coalesce(old.verified, false) and new.title is not distinct from old.title;
  return new;
end $$;
create trigger arbiter_profiles_guard before insert or update on public.arbiter_profiles
  for each row execute function private.arbiter_guard();

create view public.public_arbiters with (security_barrier = true) as
select a.profile_id, a.title, a.zone, a.availability, a.languages, a.verified,
  private.display_name(p) as display_name, p.city, p.department, p.country, p.is_demo
from public.arbiter_profiles a
join public.profiles p on p.id = a.profile_id and p.merged_into is null and p.suspended_at is null and not p.is_minor
where a.is_public;
grant select on public.public_arbiters to anon, authenticated;

-- Structures proposées par les utilisateurs : publiées après modération ----------------
create or replace function private.organizations_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), 'system') in ('service_role', 'system') or private.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.is_public := false;
    new.verified := false;
    new.is_demo := false;
  elsif new.verified is distinct from old.verified or new.claimed_by is distinct from old.claimed_by
     or new.is_demo is distinct from old.is_demo then
    raise exception 'forbidden_field' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger organizations_guard before insert or update on public.organizations
  for each row execute function private.organizations_guard();

-- Le proposant devient propriétaire de la fiche (en attente de publication).
create or replace function public.propose_organization(p_org jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.my_profile_id();
  oid uuid;
  base text;
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if coalesce(trim(p_org ->> 'name'), '') = '' or length(p_org ->> 'name') > 120 then
    raise exception 'invalid' using errcode = '22023';
  end if;
  base := trim(both '-' from regexp_replace(private.unaccent_lower(p_org ->> 'name'), '[^a-z0-9]+', '-', 'g'));
  insert into public.organizations (type, name, slug, description, department, city, address, phone, email, website,
    lat, lng, is_public, verified, claimed_by)
  values ((p_org ->> 'type')::public.org_type, trim(p_org ->> 'name'),
    left(base, 60) || '-' || substr(md5(gen_random_uuid()::text), 1, 5),
    left(p_org ->> 'description', 2000), p_org ->> 'department', p_org ->> 'city', left(p_org ->> 'address', 200),
    p_org ->> 'phone', p_org ->> 'email', p_org ->> 'website',
    nullif(p_org ->> 'lat', '')::double precision, nullif(p_org ->> 'lng', '')::double precision,
    false, false, me)
  returning id into oid;
  insert into public.organization_members (organization_id, profile_id, role) values (oid, me, 'owner');
  return oid;
end $$;
revoke execute on function public.propose_organization from anon, public;
grant execute on function public.propose_organization to authenticated;

-- Revendication d'une fiche existante --------------------------------------------------
create table public.listing_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_in_org text not null check (char_length(role_in_org) between 2 and 80),
  message text check (char_length(message) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
  decided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id)
);
create trigger listing_claims_updated_at before update on public.listing_claims for each row execute function private.set_updated_at();
alter table public.listing_claims enable row level security;
revoke all on public.listing_claims from anon;
create policy claims_own on public.listing_claims for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin());
create policy claims_insert on public.listing_claims for insert to authenticated
  with check (profile_id = private.my_profile_id() and status = 'pending' and decided_by is null);
create policy claims_admin on public.listing_claims for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Validation d'une revendication : le demandeur devient propriétaire, la fiche est vérifiée.
create or replace function public.decide_listing_claim(p_claim uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.listing_claims;
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.listing_claims where id = p_claim for update;
  if not found or c.status <> 'pending' then raise exception 'not_pending' using errcode = '22023'; end if;
  update public.listing_claims set status = case when p_approve then 'approved' else 'refused' end, decided_by = auth.uid()
    where id = c.id;
  if p_approve then
    update public.organizations set claimed_by = c.profile_id, verified = true where id = c.organization_id;
    insert into public.organization_members (organization_id, profile_id, role) values (c.organization_id, c.profile_id, 'owner')
      on conflict (organization_id, profile_id) do update set role = 'owner';
  end if;
end $$;
revoke execute on function public.decide_listing_claim from anon, public;
grant execute on function public.decide_listing_claim to authenticated;

-- Offres d'emploi (coachs, arbitres…) ---------------------------------------------------
create table public.job_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  posted_by uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('coach', 'arbiter', 'organizer', 'other')),
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 20 and 4000),
  city text,
  department text,
  contract text check (contract in ('volunteer', 'freelance', 'part_time', 'full_time', 'mission')),
  pay_note text check (char_length(pay_note) <= 200),
  contact text not null check (char_length(contact) between 5 and 200),
  status text not null default 'pending' check (status in ('pending', 'published', 'closed', 'refused')),
  expires_on date,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_posts_status_idx on public.job_posts (status, created_at desc);
create trigger job_posts_updated_at before update on public.job_posts for each row execute function private.set_updated_at();
alter table public.job_posts enable row level security;
revoke insert, update, delete on public.job_posts from anon;
create policy jobs_read on public.job_posts for select to anon, authenticated
  using ((status = 'published' and (expires_on is null or expires_on >= current_date))
    or private.manages_profile(posted_by) or private.is_admin());
create policy jobs_insert on public.job_posts for insert to authenticated
  with check (private.manages_profile(posted_by) and status = 'pending' and not is_demo);
create policy jobs_owner_update on public.job_posts for update to authenticated
  using (private.manages_profile(posted_by)) with check (private.manages_profile(posted_by) and status in ('pending', 'closed'));
create policy jobs_admin on public.job_posts for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Politiques des structures sans récursion (organizations ↔ organization_members).
create or replace function private.org_is_public(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_public from public.organizations where id = p_org), false)
$$;
create or replace function private.org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members m
    where m.organization_id = p_org and private.manages_profile(m.profile_id))
$$;
create or replace function private.org_manager(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members m
    where m.organization_id = p_org and m.role in ('owner', 'admin') and private.manages_profile(m.profile_id))
$$;

drop policy organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to anon, authenticated
  using (is_public or private.is_admin() or private.org_member(id));
drop policy organizations_update on public.organizations;
create policy organizations_update on public.organizations for update to authenticated
  using (private.is_admin() or private.org_manager(id))
  with check (private.is_admin() or private.org_manager(id));
drop policy org_members_select on public.organization_members;
create policy org_members_select on public.organization_members for select to anon, authenticated
  using (private.org_is_public(organization_id) or private.is_admin() or private.manages_profile(profile_id));
drop policy org_members_admin on public.organization_members;
create policy org_members_admin on public.organization_members for all to authenticated
  using (private.is_admin() or private.org_manager(organization_id))
  with check (private.is_admin() or private.org_manager(organization_id));

set search_path = "$user", public, extensions;

-- ===== Migration 20261002000100_content.sql =====
-- Contenus : articles, émissions et épisodes (vidéo, podcast, direct), leçons, puzzles et défis,
-- ressources, glossaire et lexique (fr, en, fon).

create or replace function private.can_edit_content() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin_of('content') or private.has_role('editor')
$$;

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title jsonb not null,
  excerpt jsonb not null default '{}',
  body jsonb not null default '{}',
  tags text[] not null default '{}',
  tournament_id uuid references public.tournaments(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index articles_published_idx on public.articles (status, published_at desc);
create trigger articles_updated_at before update on public.articles for each row execute function private.set_updated_at();

create table public.media_series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null check (kind in ('show', 'podcast', 'live')),
  title jsonb not null,
  description jsonb not null default '{}',
  language text not null default 'fr' check (language in ('fr', 'en', 'fon', 'multi')),
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger media_series_updated_at before update on public.media_series for each row execute function private.set_updated_at();

create table public.media_episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.media_series(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  season int not null default 1 check (season >= 1),
  number int not null check (number >= 1),
  title jsonb not null,
  description jsonb not null default '{}',
  format text not null check (format in ('video', 'audio', 'live')),
  video_url text check (video_url ~ '^https://(www\.youtube\.com/watch\?v=|youtu\.be/|vimeo\.com/)[A-Za-z0-9_-]+'),
  audio_url text check (audio_url ~ '^https://'),
  live_at timestamptz,
  duration_min int check (duration_min between 1 and 600),
  language text not null default 'fr' check (language in ('fr', 'en', 'fon')),
  level text check (level in ('discovery', 'beginner', 'intermediate', 'advanced', 'competition')),
  theme text,
  transcript text check (char_length(transcript) <= 100000),
  positions jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, season, number)
);
create index media_episodes_pub_idx on public.media_episodes (status, published_at desc);
create trigger media_episodes_updated_at before update on public.media_episodes for each row execute function private.set_updated_at();

create table public.lessons_library (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  level text not null check (level in ('discovery', 'beginner', 'intermediate', 'advanced', 'competition')),
  theme text not null,
  title jsonb not null,
  summary jsonb not null default '{}',
  body jsonb not null default '{}',
  positions jsonb not null default '[]',
  position int not null default 0,
  is_premium boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger lessons_library_updated_at before update on public.lessons_library for each row execute function private.set_updated_at();

create table public.puzzles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  fen text not null,
  solution text[] not null check (array_length(solution, 1) >= 1),
  theme text not null,
  mate_in int,
  rating int,
  source text not null default 'chesspirit',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger puzzles_updated_at before update on public.puzzles for each row execute function private.set_updated_at();

create table public.weekly_challenges (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique check (extract(isodow from week_start) = 1),
  title jsonb not null,
  puzzle_ids uuid[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger weekly_challenges_updated_at before update on public.weekly_challenges for each row execute function private.set_updated_at();

create table public.puzzle_attempts (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  solved boolean not null,
  context text not null default 'daily' check (context in ('daily', 'challenge', 'lesson', 'placement')),
  attempted_on date not null default (now() at time zone 'Africa/Porto-Novo')::date,
  created_at timestamptz not null default now(),
  unique (puzzle_id, profile_id, context, attempted_on)
);
create index puzzle_attempts_profile_idx on public.puzzle_attempts (profile_id, attempted_on desc);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title jsonb not null,
  description jsonb not null default '{}',
  kind text not null check (kind in ('pdf', 'worksheet', 'pgn', 'rules', 'video', 'link')),
  url text not null check (url ~ '^(https://|/)'),
  level text check (level in ('discovery', 'beginner', 'intermediate', 'advanced', 'competition')),
  language text not null default 'fr' check (language in ('fr', 'en', 'fon')),
  is_premium boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger resources_updated_at before update on public.resources for each row execute function private.set_updated_at();

-- Glossaire trilingue : le terme fon n'est affiché qu'une fois validé par un locuteur.
create table public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  term_fr text not null unique,
  term_en text not null,
  term_fon text,
  fon_status text not null default 'missing' check (fon_status in ('missing', 'proposed', 'validated')),
  definition jsonb not null default '{}',
  category text not null default 'general' check (category in ('general', 'pieces', 'rules', 'tactics', 'strategy', 'openings', 'endgames', 'competition')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger glossary_terms_updated_at before update on public.glossary_terms for each row execute function private.set_updated_at();

-- Propositions de traduction en fon par la communauté (validées par l'équipe éditoriale).
create table public.glossary_suggestions (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.glossary_terms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  term_fon text not null check (char_length(term_fon) between 1 and 120),
  note text check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'refused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id, profile_id)
);
create trigger glossary_suggestions_updated_at before update on public.glossary_suggestions for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Autorisations : lecture publique du contenu publié, écriture par l'équipe éditoriale.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['articles', 'media_series', 'media_episodes', 'lessons_library', 'puzzles', 'weekly_challenges',
    'resources', 'glossary_terms'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke insert, update, delete on public.%I from anon', t);
    execute format('create policy %1$s_edit on public.%1$s for all to authenticated using (private.can_edit_content()) with check (private.can_edit_content())', t);
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$s for each row execute function private.audit_trigger()', t);
  end loop;
end $$;
create policy articles_read on public.articles for select to anon, authenticated using (status = 'published');
create policy series_read on public.media_series for select to anon, authenticated using (is_active);
create policy episodes_read on public.media_episodes for select to anon, authenticated using (status = 'published');
create policy lessons_read on public.lessons_library for select to anon, authenticated using (status = 'published');
create policy puzzles_read on public.puzzles for select to anon, authenticated using (is_active);
create policy challenges_read on public.weekly_challenges for select to anon, authenticated using (true);
create policy resources_read on public.resources for select to anon, authenticated using (status = 'published');
create policy glossary_read on public.glossary_terms for select to anon, authenticated using (true);

alter table public.puzzle_attempts enable row level security;
revoke all on public.puzzle_attempts from anon;
create policy attempts_own on public.puzzle_attempts for select to authenticated
  using (private.manages_profile(profile_id) or private.can_edit_content());
create policy attempts_insert on public.puzzle_attempts for insert to authenticated
  with check (profile_id = private.my_profile_id());

alter table public.glossary_suggestions enable row level security;
revoke all on public.glossary_suggestions from anon;
create policy suggestions_own on public.glossary_suggestions for select to authenticated
  using (profile_id = private.my_profile_id() or private.can_edit_content());
create policy suggestions_insert on public.glossary_suggestions for insert to authenticated
  with check (profile_id = private.my_profile_id() and status = 'pending');
create policy suggestions_edit on public.glossary_suggestions for update to authenticated
  using (private.can_edit_content()) with check (private.can_edit_content());

-- Puzzle du jour : choix déterministe parmi les puzzles actifs (même puzzle pour tous, un par jour).
create or replace function public.daily_puzzle(p_day date default null) returns public.puzzles
language sql stable security definer set search_path = '' as $$
  with active as (select * from public.puzzles where is_active order by code),
  n as (select count(*) as c from active)
  select a.* from active a, n
  order by a.code
  offset (select ((coalesce(p_day, (now() at time zone 'Africa/Porto-Novo')::date) - date '2026-01-01') % greatest(n.c, 1))
          from n)
  limit 1
$$;
grant execute on function public.daily_puzzle to anon, authenticated;

-- Classement du défi de la semaine : puzzles résolus (première tentative de chaque jour comptée).
create or replace function public.challenge_leaderboard(p_challenge uuid)
returns table (display_name text, solved bigint)
language sql stable security definer set search_path = '' as $$
  select private.display_name(p), count(distinct a.puzzle_id)
  from public.weekly_challenges c
  join public.puzzle_attempts a on a.puzzle_id = any (c.puzzle_ids) and a.context = 'challenge' and a.solved
    and a.attempted_on between c.week_start and c.week_start + 6
  join public.profiles p on p.id = a.profile_id and p.is_public
  where c.id = p_challenge
  group by p.id
  order by 2 desc, 1
  limit 20
$$;
grant execute on function public.challenge_leaderboard to anon, authenticated;

set search_path = "$user", public, extensions;

-- ===== Migration 20261003000100_ops.sql =====
-- Exploitation : tâches planifiées, liste mensuelle des cotes, statistiques et alertes d'administration.

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  details jsonb not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index job_runs_job_idx on public.job_runs (job, started_at desc);
alter table public.job_runs enable row level security;
revoke all on public.job_runs from anon;
create policy job_runs_admin on public.job_runs for select to authenticated using (private.is_admin());

-- Maintenance appelée par les tâches planifiées (rôle service uniquement).
create or replace function public.run_maintenance(p_job text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  v_period date := date_trunc('month', (now() at time zone 'Africa/Porto-Novo'))::date;
  t public.rating_type;
begin
  if p_job = 'expire_orders' then
    return jsonb_build_object('expired', private.expire_orders());
  elsif p_job = 'refresh_minors' then
    -- Majorité atteinte : le déclencheur recalcule is_minor ; le profil reste privé jusqu'au choix de la personne.
    update public.profiles set birth_date = birth_date
      where is_minor and birth_date <= (current_date - interval '18 years');
    get diagnostics n = row_count;
    return jsonb_build_object('became_adult', n);
  elsif p_job = 'publish_rating_lists' then
    -- Liste officielle du mois : instantané des cotes des profils publics, par type.
    foreach t in array array['rapid', 'blitz', 'classical', 'online']::public.rating_type[] loop
      insert into public.rating_lists (period, type, published_at, entries)
      select v_period, t, now(), coalesce(jsonb_agg(jsonb_build_object('profile_id', x.profile_id, 'rank', x.rk,
        'rating', x.rating, 'games', x.games, 'provisional', x.provisional) order by x.rk), '[]')
      from (
        select r.profile_id, r.rating, r.games, r.provisional, rank() over (order by r.rating desc) as rk
        from public.ratings r join public.profiles p on p.id = r.profile_id and p.is_public and p.merged_into is null
        where r.type = t and r.games > 0
      ) x
      on conflict (period, type) do nothing;
    end loop;
    return jsonb_build_object('period', v_period);
  end if;
  raise exception 'unknown_job' using errcode = '22023';
end $$;
revoke execute on function public.run_maintenance from anon, authenticated, public;
grant execute on function public.run_maintenance to service_role;

-- Statistiques d'administration sur une période (agrégats uniquement, pas de données nominatives).
create or replace function public.admin_stats(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles where merged_into is null and not is_demo),
      'accounts', (select count(*) from public.profiles where user_id is not null and merged_into is null),
      'new', (select count(*) from public.profiles where created_at::date between p_from and p_to and not is_demo),
      'active', (select count(distinct user_id) from auth.sessions where updated_at::date between p_from and p_to),
      'by_department', (select coalesce(jsonb_object_agg(coalesce(department, '—'), c), '{}') from (
        select department, count(*) c from public.profiles where merged_into is null and not is_demo group by 1) d),
      'by_sex', (select coalesce(jsonb_object_agg(coalesce(sex::text, '—'), c), '{}') from (
        select sex, count(*) c from public.profiles where merged_into is null and not is_demo group by 1) d),
      'by_age', (select coalesce(jsonb_object_agg(g, c), '{}') from (
        select case when birth_date is null then '—'
          when birth_date > current_date - interval '14 years' then '<14'
          when birth_date > current_date - interval '18 years' then '14-17'
          when birth_date > current_date - interval '30 years' then '18-29'
          when birth_date > current_date - interval '50 years' then '30-49' else '50+' end g, count(*) c
        from public.profiles where merged_into is null and not is_demo group by 1) d),
      'by_city', (select coalesce(jsonb_object_agg(city, c), '{}') from (
        select coalesce(city, '—') city, count(*) c from public.profiles where merged_into is null and not is_demo
        group by 1 order by 2 desc limit 10) d)
    ),
    'competitions', jsonb_build_object(
      'tournaments', (select count(*) from public.tournaments where starts_at::date between p_from and p_to and status <> 'draft'),
      'registrations', (select count(*) from public.registrations where created_at::date between p_from and p_to and status not in ('cancelled', 'refused')),
      'players', (select count(distinct player_id) from public.registrations r join public.tournaments t on t.id = r.tournament_id
        where t.starts_at::date between p_from and p_to and r.status not in ('cancelled', 'refused')),
      'games', (select count(*) from public.games where played_on between p_from and p_to),
      'by_month', (select coalesce(jsonb_object_agg(m, c), '{}') from (
        select to_char(starts_at, 'YYYY-MM') m, count(*) c from public.tournaments
        where starts_at::date between p_from and p_to and status <> 'draft' group by 1) d)
    ),
    'finance', jsonb_build_object(
      'revenue', (select coalesce(sum(amount_xof), 0) from public.payments where status = 'succeeded' and confirmed_at::date between p_from and p_to),
      'refunds', (select coalesce(sum(amount_xof), 0) from public.refunds where status = 'succeeded' and created_at::date between p_from and p_to),
      'by_object', (select coalesce(jsonb_object_agg(object_type, s), '{}') from (
        select object_type, sum(amount_xof) s from public.payments where status = 'succeeded' and confirmed_at::date between p_from and p_to group by 1) d),
      'by_month', (select coalesce(jsonb_object_agg(m, s), '{}') from (
        select to_char(confirmed_at, 'YYYY-MM') m, sum(amount_xof) s from public.payments
        where status = 'succeeded' and confirmed_at::date between p_from and p_to group by 1) d),
      'failed', (select count(*) from public.payments where status = 'failed' and created_at::date between p_from and p_to)
    ),
    'coaching', jsonb_build_object(
      'bookings', (select count(*) from public.bookings where created_at::date between p_from and p_to and status in ('confirmed', 'completed')),
      'commission', (select coalesce(sum(commission_xof), 0) from public.bookings where created_at::date between p_from and p_to and status in ('confirmed', 'completed'))
    ),
    'shop', jsonb_build_object(
      'orders', (select count(*) from public.orders where created_at::date between p_from and p_to and status not in ('pending_payment', 'cancelled')),
      'top_products', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'qty', q) order by q desc), '[]') from (
        select oi.name, sum(oi.quantity) q from public.order_items oi join public.orders o on o.id = oi.order_id
        where o.created_at::date between p_from and p_to and o.status not in ('pending_payment', 'cancelled')
        group by 1 order by 2 desc limit 5) d)
    ),
    'content', jsonb_build_object(
      'puzzle_attempts', (select count(*) from public.puzzle_attempts where attempted_on between p_from and p_to),
      'puzzle_solvers', (select count(distinct profile_id) from public.puzzle_attempts where attempted_on between p_from and p_to and solved),
      'articles', (select count(*) from public.articles where published_at::date between p_from and p_to),
      'episodes', (select count(*) from public.media_episodes where published_at::date between p_from and p_to)
    )
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_stats from anon, public;
grant execute on function public.admin_stats to authenticated;

-- Alertes : stock bas, tournoi presque complet, paiements échoués, demandes en attente.
create or replace function public.admin_alerts()
returns table (kind text, count bigint, detail text)
language sql stable security definer set search_path = '' as $$
  select * from (
    select 'low_stock'::text, count(*), string_agg(p.name ->> 'fr', ', ')
      from public.product_variants pv join public.products p on p.id = pv.product_id
      where p.kind = 'physical' and p.is_active and not p.is_preorder and pv.is_active and pv.stock <= 3
    union all
    select 'tournament_almost_full', count(*), string_agg(t.name, ', ')
      from public.tournaments t
      where t.status = 'registration_open' and t.capacity is not null
        and (select count(*) from public.registrations r where r.tournament_id = t.id
             and r.status in ('confirmed', 'pending_payment', 'pending_validation')) >= t.capacity * 0.9
    union all
    select 'payment_failed', count(*), null from public.payments where status = 'failed' and created_at > now() - interval '7 days'
    union all
    select 'needs_refund', count(*), null from public.payments where (metadata ->> 'needs_refund')::boolean
      and status = 'succeeded' and not exists (select 1 from public.refunds rf where rf.payment_id = payments.id)
    union all
    select 'pending_requests', (select count(*) from public.data_requests where status = 'pending')
      + (select count(*) from public.contact_messages where status = 'new')
      + (select count(*) from public.listing_claims where status = 'pending'), null
  ) a (kind, count, detail)
  where private.is_admin() and a.count > 0
$$;
revoke execute on function public.admin_alerts from anon, public;
grant execute on function public.admin_alerts to authenticated;

set search_path = "$user", public, extensions;

-- ===== Migration 20261003000200_reminders.sql =====
-- Rappels : une seule relance par inscription (la veille du tournoi).
alter table public.registrations add column reminder_sent_at timestamptz;

set search_path = "$user", public, extensions;

-- ===== Migration 20261003000300_ops_service.sql =====
-- Statistiques et alertes accessibles aussi au rôle service (tâches planifiées : synthèse et rapport mensuel).

create or replace function public.admin_stats(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not (private.is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles where merged_into is null and not is_demo),
      'accounts', (select count(*) from public.profiles where user_id is not null and merged_into is null),
      'new', (select count(*) from public.profiles where created_at::date between p_from and p_to and not is_demo),
      'active', (select count(distinct user_id) from auth.sessions where updated_at::date between p_from and p_to),
      'by_department', (select coalesce(jsonb_object_agg(coalesce(department, '—'), c), '{}') from (
        select department, count(*) c from public.profiles where merged_into is null and not is_demo group by 1) d),
      'by_sex', (select coalesce(jsonb_object_agg(coalesce(sex::text, '—'), c), '{}') from (
        select sex, count(*) c from public.profiles where merged_into is null and not is_demo group by 1) d),
      'by_age', (select coalesce(jsonb_object_agg(g, c), '{}') from (
        select case when birth_date is null then '—'
          when birth_date > current_date - interval '14 years' then '<14'
          when birth_date > current_date - interval '18 years' then '14-17'
          when birth_date > current_date - interval '30 years' then '18-29'
          when birth_date > current_date - interval '50 years' then '30-49' else '50+' end g, count(*) c
        from public.profiles where merged_into is null and not is_demo group by 1) d),
      'by_city', (select coalesce(jsonb_object_agg(city, c), '{}') from (
        select coalesce(city, '—') city, count(*) c from public.profiles where merged_into is null and not is_demo
        group by 1 order by 2 desc limit 10) d)
    ),
    'competitions', jsonb_build_object(
      'tournaments', (select count(*) from public.tournaments where starts_at::date between p_from and p_to and status <> 'draft'),
      'registrations', (select count(*) from public.registrations where created_at::date between p_from and p_to and status not in ('cancelled', 'refused')),
      'players', (select count(distinct player_id) from public.registrations r join public.tournaments t on t.id = r.tournament_id
        where t.starts_at::date between p_from and p_to and r.status not in ('cancelled', 'refused')),
      'games', (select count(*) from public.games where played_on between p_from and p_to),
      'by_month', (select coalesce(jsonb_object_agg(m, c), '{}') from (
        select to_char(starts_at, 'YYYY-MM') m, count(*) c from public.tournaments
        where starts_at::date between p_from and p_to and status <> 'draft' group by 1) d)
    ),
    'finance', jsonb_build_object(
      'revenue', (select coalesce(sum(amount_xof), 0) from public.payments where status = 'succeeded' and confirmed_at::date between p_from and p_to),
      'refunds', (select coalesce(sum(amount_xof), 0) from public.refunds where status = 'succeeded' and created_at::date between p_from and p_to),
      'by_object', (select coalesce(jsonb_object_agg(object_type, s), '{}') from (
        select object_type, sum(amount_xof) s from public.payments where status = 'succeeded' and confirmed_at::date between p_from and p_to group by 1) d),
      'by_month', (select coalesce(jsonb_object_agg(m, s), '{}') from (
        select to_char(confirmed_at, 'YYYY-MM') m, sum(amount_xof) s from public.payments
        where status = 'succeeded' and confirmed_at::date between p_from and p_to group by 1) d),
      'failed', (select count(*) from public.payments where status = 'failed' and created_at::date between p_from and p_to)
    ),
    'coaching', jsonb_build_object(
      'bookings', (select count(*) from public.bookings where created_at::date between p_from and p_to and status in ('confirmed', 'completed')),
      'commission', (select coalesce(sum(commission_xof), 0) from public.bookings where created_at::date between p_from and p_to and status in ('confirmed', 'completed'))
    ),
    'shop', jsonb_build_object(
      'orders', (select count(*) from public.orders where created_at::date between p_from and p_to and status not in ('pending_payment', 'cancelled')),
      'top_products', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'qty', q) order by q desc), '[]') from (
        select oi.name, sum(oi.quantity) q from public.order_items oi join public.orders o on o.id = oi.order_id
        where o.created_at::date between p_from and p_to and o.status not in ('pending_payment', 'cancelled')
        group by 1 order by 2 desc limit 5) d)
    ),
    'content', jsonb_build_object(
      'puzzle_attempts', (select count(*) from public.puzzle_attempts where attempted_on between p_from and p_to),
      'puzzle_solvers', (select count(distinct profile_id) from public.puzzle_attempts where attempted_on between p_from and p_to and solved),
      'articles', (select count(*) from public.articles where published_at::date between p_from and p_to),
      'episodes', (select count(*) from public.media_episodes where published_at::date between p_from and p_to)
    )
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_stats from anon, public;
grant execute on function public.admin_stats to authenticated, service_role;

-- Alertes : stock bas, tournoi presque complet, paiements échoués, demandes en attente.
create or replace function public.admin_alerts()
returns table (kind text, count bigint, detail text)
language sql stable security definer set search_path = '' as $$
  select * from (
    select 'low_stock'::text, count(*), string_agg(p.name ->> 'fr', ', ')
      from public.product_variants pv join public.products p on p.id = pv.product_id
      where p.kind = 'physical' and p.is_active and not p.is_preorder and pv.is_active and pv.stock <= 3
    union all
    select 'tournament_almost_full', count(*), string_agg(t.name, ', ')
      from public.tournaments t
      where t.status = 'registration_open' and t.capacity is not null
        and (select count(*) from public.registrations r where r.tournament_id = t.id
             and r.status in ('confirmed', 'pending_payment', 'pending_validation')) >= t.capacity * 0.9
    union all
    select 'payment_failed', count(*), null from public.payments where status = 'failed' and created_at > now() - interval '7 days'
    union all
    select 'needs_refund', count(*), null from public.payments where (metadata ->> 'needs_refund')::boolean
      and status = 'succeeded' and not exists (select 1 from public.refunds rf where rf.payment_id = payments.id)
    union all
    select 'pending_requests', (select count(*) from public.data_requests where status = 'pending')
      + (select count(*) from public.contact_messages where status = 'new')
      + (select count(*) from public.listing_claims where status = 'pending'), null
  ) a (kind, count, detail)
  where (private.is_admin() or coalesce(auth.role(), '') = 'service_role') and a.count > 0
$$;
revoke execute on function public.admin_alerts from anon, public;
grant execute on function public.admin_alerts to authenticated, service_role;

set search_path = "$user", public, extensions;

-- ===== Migration 20261004000100_community.sql =====
-- Communauté : adhésion (gratuite ou premium), carte de membre, badges, parrainage, ambassadeurs,
-- Chesspirit Awards, pronostics gratuits, partie « Le public contre le maître ».

-- Adhésion -------------------------------------------------------------------------
create table public.membership_plans (
  code text primary key check (code in ('free', 'premium')),
  name jsonb not null,
  description jsonb not null default '{}',
  benefits jsonb not null default '[]',
  price_xof int check (price_xof >= 0), -- null = à confirmer
  duration_months int check (duration_months between 1 and 36),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger membership_plans_updated_at before update on public.membership_plans for each row execute function private.set_updated_at();
insert into public.membership_plans (code, name, description, benefits, price_xof, duration_months) values
  ('free', '{"fr":"Membre","en":"Member"}', '{"fr":"Adhésion gratuite à la communauté Chesspirit.","en":"Free membership of the Chesspirit community."}',
   '[{"fr":"Carte de membre numérique","en":"Digital member card"},{"fr":"Niveaux, badges et pronostics","en":"Levels, badges and predictions"},{"fr":"Leçons gratuites et puzzle du jour","en":"Free lessons and daily puzzle"}]', 0, null),
  ('premium', '{"fr":"Membre premium","en":"Premium member"}', '{"fr":"Tout le contenu premium de l''académie.","en":"All premium academy content."}',
   '[{"fr":"Cours et ressources premium","en":"Premium courses and resources"},{"fr":"Badge premium","en":"Premium badge"},{"fr":"Tous les avantages membre","en":"All member benefits"}]', null, 12);

create sequence public.member_card_seq start 1001;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null references public.membership_plans(code),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'active', 'expired', 'cancelled')),
  card_number text not null unique default ('CSP-' || lpad(nextval('public.member_card_seq')::text, 6, '0')),
  amount_xof int not null default 0,
  starts_on date,
  ends_on date,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index memberships_profile_idx on public.memberships (profile_id, status);
create trigger memberships_updated_at before update on public.memberships for each row execute function private.set_updated_at();

create or replace function private.has_premium(p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.profile_id = p_profile and m.plan = 'premium'
    and m.status = 'active' and (m.ends_on is null or m.ends_on >= current_date))
$$;

-- Demande d'adhésion : gratuite immédiatement active, premium au tarif fixé par la base.
create or replace function public.request_membership(p_plan text) returns public.memberships
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.my_profile_id();
  pl public.membership_plans;
  m public.memberships;
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select * into pl from public.membership_plans where code = p_plan and is_active;
  if not found then raise exception 'invalid_plan' using errcode = '22023'; end if;
  if pl.price_xof is null then raise exception 'price_not_set' using errcode = '22023'; end if;
  select * into m from public.memberships where profile_id = me and plan = p_plan
    and (status = 'pending_payment' or (status = 'active' and (ends_on is null or ends_on >= current_date)))
    order by created_at desc limit 1;
  if found then return m; end if;
  insert into public.memberships (profile_id, plan, status, amount_xof, starts_on, ends_on)
  values (me, p_plan, case when pl.price_xof = 0 then 'active' else 'pending_payment' end, pl.price_xof,
    case when pl.price_xof = 0 then current_date end,
    case when pl.price_xof = 0 and pl.duration_months is not null then current_date + make_interval(months => pl.duration_months) end)
  returning * into m;
  return m;
end $$;
revoke execute on function public.request_membership from anon, public;
grant execute on function public.request_membership to authenticated;

create or replace function private.membership_paid(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare m public.memberships; dur int;
begin
  select * into m from public.memberships where id = p_id for update;
  if not found or m.status <> 'pending_payment' then return false; end if;
  select duration_months into dur from public.membership_plans where code = m.plan;
  update public.memberships set status = 'active', starts_on = current_date,
    ends_on = case when dur is null then null else current_date + make_interval(months => dur) end
  where id = m.id;
  return true;
end $$;
revoke execute on function private.membership_paid(uuid) from public, anon, authenticated;

-- Contenu premium : le texte n'est lisible qu'avec l'adhésion premium (catalogue public sans le texte).
drop policy lessons_read on public.lessons_library;
create policy lessons_read on public.lessons_library for select to anon, authenticated
  using (status = 'published' and (not is_premium or private.has_premium(private.my_profile_id())));
drop policy resources_read on public.resources;
create policy resources_read on public.resources for select to anon, authenticated
  using (status = 'published' and (not is_premium or private.has_premium(private.my_profile_id())));
create view public.lesson_catalog with (security_barrier = true) as
select id, slug, level, theme, title, summary, position, is_premium from public.lessons_library where status = 'published';
grant select on public.lesson_catalog to anon, authenticated;
create view public.resource_catalog with (security_barrier = true) as
select id, title, description, kind, level, language, is_premium, created_at,
  case when is_premium then null else url end as url
from public.resources where status = 'published';
grant select on public.resource_catalog to anon, authenticated;

-- Badges -------------------------------------------------------------------------------
create table public.badges (
  code text primary key check (code ~ '^[a-z0-9_:-]{2,60}$'),
  name jsonb not null,
  description jsonb not null default '{}',
  category text not null default 'general' check (category in ('general', 'competition', 'academy', 'community', 'tour')),
  icon text not null default 'p' check (icon in ('p', 'n', 'b', 'r', 'q', 'k')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create table public.user_badges (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  badge_code text not null references public.badges(code) on delete cascade,
  awarded_at timestamptz not null default now(),
  context text,
  primary key (profile_id, badge_code)
);
insert into public.badges (code, name, description, category, icon, position) values
  ('member', '{"fr":"Membre","en":"Member"}', '{"fr":"A rejoint la communauté Chesspirit.","en":"Joined the Chesspirit community."}', 'community', 'p', 1),
  ('premium', '{"fr":"Premium","en":"Premium"}', '{"fr":"Membre premium.","en":"Premium member."}', 'community', 'q', 2),
  ('first_tournament', '{"fr":"Premier tournoi","en":"First tournament"}', '{"fr":"A joué un premier tournoi.","en":"Played a first tournament."}', 'competition', 'p', 10),
  ('ten_tournaments', '{"fr":"Habitué","en":"Regular"}', '{"fr":"Dix tournois joués.","en":"Ten tournaments played."}', 'competition', 'r', 11),
  ('podium', '{"fr":"Podium","en":"Podium"}', '{"fr":"Termine dans les trois premiers d''un tournoi.","en":"Finished in the top three of a tournament."}', 'competition', 'b', 12),
  ('winner', '{"fr":"Vainqueur","en":"Winner"}', '{"fr":"A remporté un tournoi.","en":"Won a tournament."}', 'competition', 'k', 13),
  ('league_player', '{"fr":"Joueur de ligue","en":"League player"}', '{"fr":"Membre d''une ligue Chesspirit.","en":"Member of a Chesspirit league."}', 'competition', 'n', 14),
  ('puzzle_10', '{"fr":"Chercheur","en":"Solver"}', '{"fr":"Dix puzzles résolus.","en":"Ten puzzles solved."}', 'academy', 'n', 20),
  ('puzzle_100', '{"fr":"Tacticien","en":"Tactician"}', '{"fr":"Cent puzzles résolus.","en":"A hundred puzzles solved."}', 'academy', 'q', 21),
  ('ambassador', '{"fr":"Ambassadeur","en":"Ambassador"}', '{"fr":"Ambassadeur de Chesspirit.","en":"Chesspirit ambassador."}', 'community', 'k', 30),
  ('referrer_3', '{"fr":"Parrain","en":"Referrer"}', '{"fr":"Trois personnes parrainées.","en":"Three people referred."}', 'community', 'b', 31);

-- Passeport du circuit : un badge par ville d'étape du Tour jouée.
create or replace function public.refresh_badges(p_profile uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; k int; c record;
begin
  if not (private.manages_profile(p_profile) or private.is_admin() or coalesce(auth.role(), 'system') in ('service_role', 'system')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.user_badges (profile_id, badge_code)
  select p_profile, b from (values
    ('member', exists (select 1 from public.memberships where profile_id = p_profile and status = 'active')),
    ('premium', private.has_premium(p_profile)),
    ('first_tournament', (select count(*) from public.standings where player_id = p_profile) >= 1),
    ('ten_tournaments', (select count(*) from public.standings where player_id = p_profile) >= 10),
    ('podium', exists (select 1 from public.standings s join public.tournaments t on t.id = s.tournament_id
      where s.player_id = p_profile and s.rank <= 3 and s.is_final and not t.is_online)),
    ('winner', exists (select 1 from public.standings s where s.player_id = p_profile and s.rank = 1 and s.is_final)),
    ('league_player', exists (select 1 from public.league_members where profile_id = p_profile)),
    ('puzzle_10', (select count(distinct puzzle_id) from public.puzzle_attempts where profile_id = p_profile and solved) >= 10),
    ('puzzle_100', (select count(distinct puzzle_id) from public.puzzle_attempts where profile_id = p_profile and solved) >= 100),
    ('ambassador', exists (select 1 from public.ambassadors where profile_id = p_profile and status = 'approved')),
    ('referrer_3', (select count(*) from public.referrals where referrer_id = p_profile) >= 3)
  ) as x(b, ok)
  where ok on conflict do nothing;
  get diagnostics k = row_count;
  n := n + k;
  for c in
    select distinct lower(regexp_replace(st.city, '[^A-Za-z0-9]+', '-', 'g')) as slug, st.city
    from public.tour_points tp join public.tour_stages st on st.id = tp.stage_id
    where tp.profile_id = p_profile and st.city is not null
  loop
    insert into public.badges (code, name, description, category, icon, position)
    values ('tour:' || c.slug, jsonb_build_object('fr', 'Tour : ' || c.city, 'en', 'Tour: ' || c.city),
      jsonb_build_object('fr', 'A joué l''étape de ' || c.city || '.', 'en', 'Played the ' || c.city || ' stage.'), 'tour', 'r', 50)
    on conflict (code) do nothing;
    insert into public.user_badges (profile_id, badge_code, context) values (p_profile, 'tour:' || c.slug, c.city)
    on conflict do nothing;
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return n;
end $$;
revoke execute on function public.refresh_badges from anon, public;
grant execute on function public.refresh_badges to authenticated, service_role;

-- Parrainage et ambassadeurs ----------------------------------------------------------------
create table public.referral_codes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz not null default now()
);
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);
create table public.ambassadors (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  city text,
  motivation text check (char_length(motivation) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger ambassadors_updated_at before update on public.ambassadors for each row execute function private.set_updated_at();

create or replace function public.my_referral_code() returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := private.my_profile_id(); c text;
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select code into c from public.referral_codes where profile_id = me;
  if c is null then
    loop
      c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      exit when length(c) = 8 and not exists (select 1 from public.referral_codes where code = c);
    end loop;
    insert into public.referral_codes (profile_id, code) values (me, c);
  end if;
  return c;
end $$;
revoke execute on function public.my_referral_code from anon, public;
grant execute on function public.my_referral_code to authenticated;

-- Parrainage enregistré une seule fois, dans les 30 jours suivant la création du profil.
create or replace function public.claim_referral(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me public.profiles; ref uuid;
begin
  select * into me from public.profiles where id = private.my_profile_id();
  if me.id is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select profile_id into ref from public.referral_codes where code = upper(trim(p_code));
  if ref is null or ref = me.id or me.created_at < now() - interval '30 days' then return false; end if;
  insert into public.referrals (referrer_id, referred_id) values (ref, me.id) on conflict (referred_id) do nothing;
  return found;
end $$;
revoke execute on function public.claim_referral from anon, public;
grant execute on function public.claim_referral to authenticated;

-- Chesspirit Awards ------------------------------------------------------------------------
create table public.award_editions (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'voting', 'closed')),
  voting_ends_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger award_editions_updated_at before update on public.award_editions for each row execute function private.set_updated_at();
create table public.award_categories (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.award_editions(id) on delete cascade,
  name jsonb not null,
  description jsonb not null default '{}',
  position int not null default 0
);
create table public.award_nominees (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.award_categories(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  description text check (char_length(description) <= 500)
);
create table public.award_votes (
  category_id uuid not null references public.award_categories(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  nominee_id uuid not null references public.award_nominees(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (category_id, voter_id)
);

-- Vote : une voix par catégorie et par compte, modifiable tant que le vote est ouvert.
create or replace function public.cast_award_vote(p_nominee uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := private.my_profile_id(); n public.award_nominees; e public.award_editions;
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select * into n from public.award_nominees where id = p_nominee;
  select ed.* into e from public.award_editions ed join public.award_categories c on c.edition_id = ed.id where c.id = n.category_id;
  if e.id is null or e.status <> 'voting' or (e.voting_ends_at is not null and e.voting_ends_at < now()) then
    raise exception 'voting_closed' using errcode = '22023';
  end if;
  insert into public.award_votes (category_id, voter_id, nominee_id) values (n.category_id, me, n.id)
  on conflict (category_id, voter_id) do update set nominee_id = excluded.nominee_id, created_at = now();
end $$;
revoke execute on function public.cast_award_vote from anon, public;
grant execute on function public.cast_award_vote to authenticated;

-- Résultats publiés seulement après la clôture.
create or replace function public.award_results(p_edition uuid)
returns table (category_id uuid, nominee_id uuid, votes bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, n.id, count(v.voter_id)
  from public.award_categories c
  join public.award_editions e on e.id = c.edition_id
  join public.award_nominees n on n.category_id = c.id
  left join public.award_votes v on v.nominee_id = n.id
  where c.edition_id = p_edition and (e.status = 'closed' or private.is_admin())
  group by c.id, n.id
$$;
grant execute on function public.award_results to anon, authenticated;

-- Pronostics (gratuits, sans enjeu d'argent) ---------------------------------------------------
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  pairing_id uuid not null references public.pairings(id) on delete cascade,
  predicted text not null check (predicted in ('1-0', '1/2-1/2', '0-1')),
  points int not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, pairing_id)
);
create index predictions_pairing_idx on public.predictions (pairing_id);

-- Pronostic possible tant que la partie n'a pas de résultat et au plus 15 min après la publication de la ronde.
create or replace function public.predict(p_pairing uuid, p_result text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := private.my_profile_id(); ok boolean;
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select pr.result is null and pr.black_id is not null and r.published_at is not null
      and r.published_at > now() - interval '15 minutes' and pr.white_id <> me and pr.black_id <> me
    into ok
    from public.pairings pr join public.rounds r on r.id = pr.round_id where pr.id = p_pairing;
  if not coalesce(ok, false) then raise exception 'prediction_closed' using errcode = '22023'; end if;
  insert into public.predictions (profile_id, pairing_id, predicted) values (me, p_pairing, p_result)
  on conflict (profile_id, pairing_id) do update set predicted = excluded.predicted, created_at = now();
end $$;
revoke execute on function public.predict from anon, public;
grant execute on function public.predict to authenticated;

-- Points attribués à la saisie du résultat (1 point par bon pronostic).
create or replace function private.score_predictions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.predictions set points = case when new.result::text = predicted then 1 else 0 end
  where pairing_id = new.id;
  return new;
end $$;
create trigger pairings_score_predictions after update of result on public.pairings
  for each row execute function private.score_predictions();

create view public.prediction_leaderboard with (security_barrier = true) as
select p.id as profile_id, private.display_name(p) as display_name, sum(pr.points) as points, count(*) as predictions
from public.predictions pr join public.profiles p on p.id = pr.profile_id and p.is_public
group by p.id;
grant select on public.prediction_leaderboard to anon, authenticated;

-- Le public contre le maître ------------------------------------------------------------------
create table public.pvm_games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title jsonb not null,
  master_name text not null,
  master_profile_id uuid references public.profiles(id) on delete set null,
  public_color char(1) not null default 'w' check (public_color in ('w', 'b')),
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves text[] not null default '{}',
  status text not null default 'open' check (status in ('draft', 'open', 'finished')),
  result text,
  vote_minutes int not null default 1440 check (vote_minutes between 5 and 10080),
  vote_ends_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger pvm_games_updated_at before update on public.pvm_games for each row execute function private.set_updated_at();
create table public.pvm_votes (
  game_id uuid not null references public.pvm_games(id) on delete cascade,
  ply int not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  move text not null check (move ~ '^[a-h][1-8][a-h][1-8][qrbn]?$'),
  created_at timestamptz not null default now(),
  primary key (game_id, ply, profile_id)
);

-- Vote du public pour le coup à jouer (la légalité est vérifiée à la clôture du vote).
create or replace function public.pvm_vote(p_game uuid, p_move text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := private.my_profile_id(); g public.pvm_games;
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select * into g from public.pvm_games where id = p_game;
  if g.id is null or g.status <> 'open' or split_part(g.fen, ' ', 2) <> g.public_color
     or (g.vote_ends_at is not null and g.vote_ends_at < now()) then
    raise exception 'vote_closed' using errcode = '22023';
  end if;
  insert into public.pvm_votes (game_id, ply, profile_id, move) values (g.id, coalesce(array_length(g.moves, 1), 0), me, p_move)
  on conflict (game_id, ply, profile_id) do update set move = excluded.move, created_at = now();
end $$;
revoke execute on function public.pvm_vote from anon, public;
grant execute on function public.pvm_vote to authenticated;

create or replace function public.pvm_tally(p_game uuid)
returns table (move text, votes bigint)
language sql stable security definer set search_path = '' as $$
  select v.move, count(*) from public.pvm_votes v join public.pvm_games g on g.id = v.game_id
  where v.game_id = p_game and v.ply = coalesce(array_length(g.moves, 1), 0)
  group by v.move order by 2 desc, 1
$$;
grant execute on function public.pvm_tally to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Autorisations
-- ---------------------------------------------------------------------------
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.ambassadors enable row level security;
alter table public.award_editions enable row level security;
alter table public.award_categories enable row level security;
alter table public.award_nominees enable row level security;
alter table public.award_votes enable row level security;
alter table public.predictions enable row level security;
alter table public.pvm_games enable row level security;
alter table public.pvm_votes enable row level security;
revoke insert, update, delete on public.membership_plans, public.badges, public.user_badges, public.award_editions,
  public.award_categories, public.award_nominees, public.pvm_games from anon;
revoke all on public.memberships, public.referral_codes, public.referrals, public.ambassadors, public.award_votes,
  public.predictions, public.pvm_votes from anon;

-- Points d'expérience (niveaux du Pion au Roi calculés par l'application).
create or replace function public.member_progress(p_profile uuid)
returns table (tournaments bigint, games bigint, puzzles bigint, lessons_booked bigint, predictions bigint)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.standings where player_id = p_profile),
    (select count(*) from public.pairings where (white_id = p_profile or black_id = p_profile) and result is not null),
    (select count(distinct puzzle_id) from public.puzzle_attempts where profile_id = p_profile and solved),
    (select count(*) from public.bookings where student_id = p_profile and status in ('confirmed', 'completed')),
    (select count(*) from public.predictions where profile_id = p_profile and points > 0)
  where exists (select 1 from public.public_profiles pp where pp.id = p_profile) or private.manages_profile(p_profile) or private.is_admin()
$$;
grant execute on function public.member_progress to anon, authenticated;


create policy plans_read on public.membership_plans for select to anon, authenticated using (true);
create policy plans_admin on public.membership_plans for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy memberships_read on public.memberships for select to authenticated
  using (private.manages_profile(profile_id) or private.is_admin());
create policy memberships_admin on public.memberships for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy badges_read on public.badges for select to anon, authenticated using (true);
create policy badges_admin on public.badges for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy user_badges_read on public.user_badges for select to anon, authenticated
  using (exists (select 1 from public.public_profiles pp where pp.id = profile_id) or private.manages_profile(profile_id) or private.is_admin());
create policy referral_codes_own on public.referral_codes for select to authenticated using (profile_id = private.my_profile_id() or private.is_admin());
create policy referrals_own on public.referrals for select to authenticated
  using (referrer_id = private.my_profile_id() or referred_id = private.my_profile_id() or private.is_admin());
create policy ambassadors_read on public.ambassadors for select to anon, authenticated
  using (status = 'approved' or profile_id = private.my_profile_id() or private.is_admin());
create policy ambassadors_apply on public.ambassadors for insert to authenticated
  with check (profile_id = private.my_profile_id() and status = 'pending');
create policy ambassadors_admin on public.ambassadors for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy editions_read on public.award_editions for select to anon, authenticated using (status <> 'draft' or private.is_admin());
create policy editions_admin on public.award_editions for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy categories_read on public.award_categories for select to anon, authenticated
  using (exists (select 1 from public.award_editions e where e.id = edition_id and (e.status <> 'draft' or private.is_admin())));
create policy categories_admin on public.award_categories for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy nominees_read on public.award_nominees for select to anon, authenticated
  using (exists (select 1 from public.award_categories c join public.award_editions e on e.id = c.edition_id
    where c.id = category_id and (e.status <> 'draft' or private.is_admin())));
create policy nominees_admin on public.award_nominees for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy votes_own on public.award_votes for select to authenticated using (voter_id = private.my_profile_id());
create policy predictions_own on public.predictions for select to authenticated using (profile_id = private.my_profile_id() or private.is_admin());
create policy pvm_read on public.pvm_games for select to anon, authenticated using (status <> 'draft' or private.is_admin());
create policy pvm_admin on public.pvm_games for all to authenticated
  using (private.is_admin() or (master_profile_id is not null and private.manages_profile(master_profile_id)))
  with check (private.is_admin() or (master_profile_id is not null and private.manages_profile(master_profile_id)));
create policy pvm_votes_own on public.pvm_votes for select to authenticated using (profile_id = private.my_profile_id());

-- Paiement de l'adhésion (extension de confirm_payment).
create or replace function public.confirm_payment(p_payment_id uuid, p_status text, p_provider_ref text, p_reason text default null)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
  payable boolean := true;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if pay.status in ('succeeded', 'refunded') then return pay; end if;
  update public.payments set status = p_status, provider_ref = coalesce(p_provider_ref, provider_ref),
    confirmed_at = case when p_status = 'succeeded' then now() end, failure_reason = p_reason
  where id = pay.id returning * into pay;
  if pay.object_type = 'registration' then
    if p_status = 'succeeded' then
      payable := exists (select 1 from public.registrations where id = pay.object_id and status not in ('cancelled', 'refused'));
      update public.registrations set payment_status = 'paid',
        status = case when status = 'pending_payment' then
          case when (select validation_mode from public.tournaments t where t.id = registrations.tournament_id) = 'manual'
            then 'pending_validation'::public.registration_status else 'confirmed'::public.registration_status end
          else status end
      where id = pay.object_id and status not in ('cancelled', 'refused');
    elsif p_status in ('failed', 'cancelled') then
      update public.registrations set payment_status = 'failed' where id = pay.object_id and payment_status = 'pending';
    end if;
  elsif pay.object_type = 'booking' and p_status = 'succeeded' then
    update public.bookings set status = 'confirmed' where id = pay.object_id and status = 'pending_payment';
    payable := found;
  elsif pay.object_type = 'order' and p_status = 'succeeded' then
    payable := exists (select 1 from public.orders where id = pay.object_id and status = 'pending_payment');
    perform private.order_paid(pay.object_id);
  elsif pay.object_type = 'league_license' and p_status = 'succeeded' then
    update public.league_licenses set status = 'active' where id = pay.object_id and status = 'pending_payment';
    payable := found;
  elsif pay.object_type = 'membership' and p_status = 'succeeded' then
    payable := private.membership_paid(pay.object_id);
  end if;
  if p_status = 'succeeded' and not payable then
    update public.payments set metadata = metadata || '{"needs_refund": true}' where id = pay.id returning * into pay;
    perform private.audit('payment_needs_refund', 'payments', pay.id::text, null,
      jsonb_build_object('object_type', pay.object_type, 'object_id', pay.object_id));
  end if;
  return pay;
end $$;
revoke execute on function public.confirm_payment from anon, authenticated, public;
grant execute on function public.confirm_payment to service_role;

set search_path = "$user", public, extensions;

-- ===== Migration 20261005000100_archives.sql =====
-- Archives : index des positions des parties (recherche par position, explorateur d'ouvertures),
-- journal des messages reçus par l'assistant WhatsApp.

alter table public.games add column positions_indexed_at timestamptz;

-- Une ligne par demi-coup : position (4 premiers champs de la FEN) et coup joué ensuite.
create table public.game_positions (
  game_id uuid not null references public.games(id) on delete cascade,
  ply int not null check (ply >= 0),
  fen_key text not null check (char_length(fen_key) <= 100),
  next_san text check (char_length(next_san) <= 10),
  primary key (game_id, ply)
);
create index game_positions_key_idx on public.game_positions (fen_key);
alter table public.game_positions enable row level security;
revoke insert, update, delete on public.game_positions from anon, authenticated;
-- Visible exactement quand la partie l'est (les règles d'accès de games s'appliquent à la sous-requête).
create policy game_positions_read on public.game_positions for select to anon, authenticated
  using (exists (select 1 from public.games g where g.id = game_id));

-- Explorateur : coups joués depuis une position et résultats (parties visibles seulement).
create or replace function public.position_explorer(p_fen_key text)
returns table (next_san text, games bigint, white_wins bigint, draws bigint, black_wins bigint)
language sql stable security invoker set search_path = '' as $$
  select gp.next_san, count(distinct g.id),
    count(distinct g.id) filter (where g.result = '1-0'),
    count(distinct g.id) filter (where g.result = '1/2-1/2'),
    count(distinct g.id) filter (where g.result = '0-1')
  from public.game_positions gp join public.games g on g.id = gp.game_id
  where gp.fen_key = p_fen_key and gp.next_san is not null
  group by gp.next_san
  order by 2 desc, 1
  limit 30
$$;
grant execute on function public.position_explorer to anon, authenticated;

-- Assistant WhatsApp : messages reçus (déduplication des renvois de Meta), accès administration.
create table public.whatsapp_inbound (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique check (char_length(message_id) <= 200),
  wa_from text not null check (wa_from ~ '^[0-9]{6,15}$'),
  body text check (char_length(body) <= 4096),
  intent text,
  created_at timestamptz not null default now()
);
create index whatsapp_inbound_created_idx on public.whatsapp_inbound (created_at);
alter table public.whatsapp_inbound enable row level security;
revoke all on public.whatsapp_inbound from anon;
create policy whatsapp_inbound_admin on public.whatsapp_inbound for select to authenticated using (private.is_admin());

insert into public.feature_flags (key, enabled, description) values
  ('whatsapp_assistant', false, 'Assistant WhatsApp (réponses automatiques ; nécessite WhatsApp Business)')
on conflict (key) do nothing;

-- Maintenance : conservation limitée des messages reçus (90 jours).
create or replace function public.purge_whatsapp_inbound() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.whatsapp_inbound where created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_whatsapp_inbound from anon, authenticated, public;
grant execute on function public.purge_whatsapp_inbound to service_role;

set search_path = "$user", public, extensions;

-- ===== Migration 20261006000100_mobile_region.sql =====
-- Application mobile (jetons de notification) et préparation de l'extension à la sous-région.

create table public.push_tokens (
  token text primary key check (token ~ '^ExponentPushToken\[[A-Za-z0-9_-]{10,100}\]$'),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_tokens_profile_idx on public.push_tokens (profile_id);
create trigger push_tokens_updated_at before update on public.push_tokens for each row execute function private.set_updated_at();
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon;
create policy push_tokens_own on public.push_tokens for all to authenticated
  using (profile_id = private.my_profile_id()) with check (profile_id = private.my_profile_id());

-- Pays : le Bénin est ouvert ; les autres pays de la sous-région sont préparés mais fermés.
create table public.countries (
  code char(2) primary key check (code ~ '^[A-Z]{2}$'),
  name jsonb not null,
  phone_prefix text not null check (phone_prefix ~ '^\+[0-9]{1,4}$'),
  currency char(3) not null default 'XOF',
  timezone text not null,
  enabled boolean not null default false,
  position int not null default 0,
  updated_at timestamptz not null default now()
);
create trigger countries_updated_at before update on public.countries for each row execute function private.set_updated_at();
alter table public.countries enable row level security;
revoke insert, update, delete on public.countries from anon;
create policy countries_read on public.countries for select to anon, authenticated using (true);
create policy countries_admin on public.countries for update to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
insert into public.countries (code, name, phone_prefix, currency, timezone, enabled, position) values
  ('BJ', '{"fr":"Bénin","en":"Benin"}', '+229', 'XOF', 'Africa/Porto-Novo', true, 1),
  ('TG', '{"fr":"Togo","en":"Togo"}', '+228', 'XOF', 'Africa/Lome', false, 2),
  ('BF', '{"fr":"Burkina Faso","en":"Burkina Faso"}', '+226', 'XOF', 'Africa/Ouagadougou', false, 3),
  ('NE', '{"fr":"Niger","en":"Niger"}', '+227', 'XOF', 'Africa/Niamey', false, 4),
  ('CI', '{"fr":"Côte d''Ivoire","en":"Côte d''Ivoire"}', '+225', 'XOF', 'Africa/Abidjan', false, 5),
  ('SN', '{"fr":"Sénégal","en":"Senegal"}', '+221', 'XOF', 'Africa/Dakar', false, 6),
  ('ML', '{"fr":"Mali","en":"Mali"}', '+223', 'XOF', 'Africa/Bamako', false, 7),
  ('NG', '{"fr":"Nigéria","en":"Nigeria"}', '+234', 'NGN', 'Africa/Lagos', false, 8),
  ('GH', '{"fr":"Ghana","en":"Ghana"}', '+233', 'GHS', 'Africa/Accra', false, 9);

-- Le pays d'une fiche doit exister ; un pays fermé reste utilisable par l'administration (préparation).
alter table public.profiles add constraint profiles_country_fk foreign key (country) references public.countries(code);
alter table public.tournaments add constraint tournaments_country_fk foreign key (country) references public.countries(code);
alter table public.organizations add constraint organizations_country_fk foreign key (country) references public.countries(code);

set search_path = "$user", public, extensions;

-- ===== Migration 20261007000100_import_participants.sql =====
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

set search_path = "$user", public, extensions;

-- ===== Migration 20261008000100_security_final.sql =====
-- Revue de sécurité finale (docs/SECURITE.md, constats M1 à M4 et F2 à F4).

-- M1 : une structure proposée ne peut pas se publier elle-même (publication réservée à la modération).
create or replace function private.organizations_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), 'system') in ('service_role', 'system') or private.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.is_public := false;
    new.verified := false;
    new.is_demo := false;
  elsif new.verified is distinct from old.verified or new.claimed_by is distinct from old.claimed_by
     or new.is_demo is distinct from old.is_demo or new.is_public is distinct from old.is_public then
    raise exception 'forbidden_field' using errcode = '42501';
  end if;
  return new;
end $$;

-- F3 : adresse de site web en http(s) uniquement.
alter table public.organizations add constraint organizations_website_http
  check (website is null or website ~ '^https?://');

-- M2 : création et suppression des parties « public contre le maître » réservées à l'administration ;
-- le maître rattaché ne peut que jouer (position, coups, statut), sans changer l'identité de la partie.
drop policy pvm_admin on public.pvm_games;
create policy pvm_insert_admin on public.pvm_games for insert to authenticated with check (private.is_admin());
create policy pvm_delete_admin on public.pvm_games for delete to authenticated using (private.is_admin());
create policy pvm_update on public.pvm_games for update to authenticated
  using (private.is_admin() or (master_profile_id is not null and private.manages_profile(master_profile_id)))
  with check (private.is_admin() or (master_profile_id is not null and private.manages_profile(master_profile_id)));
create or replace function private.pvm_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), 'system') in ('service_role', 'system') or private.is_admin() then return new; end if;
  if new.slug is distinct from old.slug or new.title is distinct from old.title
     or new.master_name is distinct from old.master_name or new.master_profile_id is distinct from old.master_profile_id
     or new.public_color is distinct from old.public_color or new.is_demo is distinct from old.is_demo
     or new.vote_minutes is distinct from old.vote_minutes then
    raise exception 'forbidden_field' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger pvm_games_guard before update on public.pvm_games for each row execute function private.pvm_guard();

-- M3 : nom de famille d'un mineur toujours réduit à l'initiale dans les affichages publics.
create or replace function private.display_name(p public.profiles) returns text
language sql stable set search_path = '' as $$
  select case
    when p.is_minor then p.first_name || ' ' || left(p.last_name, 1) || '.'
    else p.first_name || ' ' || p.last_name
  end
$$;

-- M4 : pas d'âge exact des mineurs dans le classement du Tour, seulement leur tranche d'âge.
create or replace view public.tour_standings with (security_barrier = true) as
with ranked as (
  select st.season_id, tp.profile_id, tp.points,
    row_number() over (partition by st.season_id, tp.profile_id order by tp.points desc) as n
  from public.tour_points tp join public.tour_stages st on st.id = tp.stage_id and st.kind <> 'masters'
), totals as (
  select r.season_id, r.profile_id,
    sum(r.points) filter (where r.n <= se.tour_best_results) as total,
    count(*) as stages
  from ranked r join public.seasons se on se.id = r.season_id
  group by r.season_id, r.profile_id
), aged as (
  select t.*, case when p.birth_date is null then null else extract(year from age(se.starts_on, p.birth_date))::int end as years
  from totals t
  join public.profiles p on p.id = t.profile_id
  join public.seasons se on se.id = t.season_id
)
select t.season_id, t.profile_id, t.total, t.stages,
  rank() over (partition by t.season_id order by t.total desc) as rank,
  private.display_name(p) as display_name, coalesce(p.club_name, o.name) as club, p.titles,
  case when p.is_minor then null else p.sex end as sex,
  -- Âge au début de la saison pour les adultes ; tranche seulement pour les moins de 18 ans.
  case when t.years is null or t.years < 18 then null else t.years end as age,
  -- Catégorie féminine du Tour (dossier de projet), y compris pour les joueuses mineures.
  p.sex = 'F' as is_woman,
  (select r.rating from public.ratings r where r.profile_id = p.id and r.type = 'rapid') as rapid_rating,
  case when t.years is null then null when t.years < 14 then 'u14' when t.years < 18 then 'u18' end as age_group
from aged t
join public.profiles p on p.id = t.profile_id
left join public.organizations o on o.id = p.club_id;
grant select on public.tour_standings to anon, authenticated;

-- F2 : les tentatives de puzzle ne sont plus écrites directement ; le serveur vérifie la solution.
drop policy attempts_insert on public.puzzle_attempts;
revoke insert on public.puzzle_attempts from authenticated;

-- F4 : un report de ligue n'est approuvé qu'avec l'accord de l'adversaire, même par l'API.
drop policy postponements_arbiter on public.league_postponements;
create policy postponements_arbiter on public.league_postponements for update to authenticated
  using (private.pairing_arbiter(pairing_id))
  with check (private.pairing_arbiter(pairing_id) and (status <> 'approved' or opponent_agreed));

set search_path = "$user", public, extensions;

-- ===== Migration 20261009000100_production_hardening.sql =====
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

set search_path = "$user", public, extensions;

-- ===== Historique des migrations (compatible avec la CLI Supabase) =====
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values ('20260927000000', 'api_default_privileges') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260927000100', 'foundation') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260927000200', 'tournaments') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260927000300', 'ratings_payments') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260927000400', 'newsletter') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260927000500', 'public_stats') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260927000600', 'onboarding') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260927000700', 'admin') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260928000100', 'tournament_engine') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260928000200', 'tournament_admin') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260928000300', 'coaching') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260928000400', 'coach_students') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260929000100', 'shop') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260929000200', 'admin_v1') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260930000100', 'leagues_tour') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260930000200', 'security_fixes') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20260930000300', 'league_admin') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20261001000100', 'online_teams') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20261001000200', 'directory') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20261002000100', 'content') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20261003000100', 'ops') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20261003000200', 'reminders') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20261003000300', 'ops_service') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20261004000100', 'community') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20261005000100', 'archives') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20261006000100', 'mobile_region') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20261007000100', 'import_participants') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20261008000100', 'security_final') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name) values ('20261009000100', 'production_hardening') on conflict (version) do nothing;

-- ===== Données de référence (sans démonstration) =====
--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

--
-- Data for Name: glossary_terms; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('d61b67e5-5e3d-4c40-9855-0f9571bfb87b', 'Échiquier', 'Chessboard', NULL, 'missing', '{"en": "Board of 64 alternating light and dark squares.", "fr": "Plateau de 64 cases alternativement claires et foncées."}', 'pieces', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('d38544ee-cbde-40b6-b8ba-5279906c1eab', 'Roi', 'King', NULL, 'missing', '{"en": "The most important piece: the game is lost when it is checkmated.", "fr": "Pièce la plus importante : la partie se perd quand il est mat."}', 'pieces', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('883dd800-29c1-410c-b526-a9545d354431', 'Dame', 'Queen', NULL, 'missing', '{"en": "The most powerful piece, moves like a rook and a bishop.", "fr": "Pièce la plus puissante, se déplace comme une tour et un fou."}', 'pieces', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('12c56b59-d09d-4867-8569-aa5dcdc3a59c', 'Tour', 'Rook', NULL, 'missing', '{"en": "Moves in straight lines along files and ranks.", "fr": "Se déplace en ligne droite sur les colonnes et les rangées."}', 'pieces', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('a146895f-423c-436a-9671-5ef13ab02613', 'Fou', 'Bishop', NULL, 'missing', '{"en": "Moves diagonally.", "fr": "Se déplace en diagonale."}', 'pieces', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('7bb29aa1-c454-4a0b-bb37-16179f0ce65f', 'Cavalier', 'Knight', NULL, 'missing', '{"en": "Moves in an L shape and can jump over pieces.", "fr": "Se déplace en L et peut sauter par-dessus les pièces."}', 'pieces', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('d9106b31-8df7-423e-baf2-97a39bda70c7', 'Pion', 'Pawn', NULL, 'missing', '{"en": "Moves forward one square (two on its first move) and captures diagonally.", "fr": "Avance d''une case (deux au premier coup) et prend en diagonale."}', 'pieces', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('d717c14e-0ee6-4674-8dcd-009200967096', 'Échec', 'Check', NULL, 'missing', '{"en": "The king is attacked and must be protected at once.", "fr": "Le roi est attaqué et doit être protégé immédiatement."}', 'rules', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('ca3654ff-1c1f-4ce5-a002-038dfac5304c', 'Échec et mat', 'Checkmate', NULL, 'missing', '{"en": "The king is in check with no way out: the game is over.", "fr": "Le roi est en échec sans aucun moyen d''y échapper : la partie est terminée."}', 'rules', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('21bd8099-73db-4f01-b118-94840480ebc8', 'Pat', 'Stalemate', NULL, 'missing', '{"en": "The player to move has no legal move and is not in check: the game is drawn.", "fr": "Le joueur au trait n''a aucun coup légal sans être en échec : partie nulle."}', 'rules', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('5d74d882-2897-436a-97f6-b769b4dc3cb9', 'Roque', 'Castling', NULL, 'missing', '{"en": "Special move of the king and a rook to bring the king to safety.", "fr": "Coup spécial du roi et d''une tour, pour mettre le roi à l''abri."}', 'rules', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('ba1b9d11-4918-4adf-820b-f762e1d8c7af', 'Prise en passant', 'En passant', NULL, 'missing', '{"en": "Special capture of a pawn that has just advanced two squares.", "fr": "Prise spéciale d''un pion qui vient d''avancer de deux cases."}', 'rules', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('17464549-da44-4c7e-9438-0a86dd13c05d', 'Promotion', 'Promotion', NULL, 'missing', '{"en": "A pawn reaching the last rank becomes another piece.", "fr": "Un pion qui atteint la dernière rangée devient une autre pièce."}', 'rules', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('390209ef-aefa-4eb1-9d68-05436ca3cfde', 'Nulle', 'Draw', NULL, 'missing', '{"en": "A game without a winner (agreement, stalemate, repetition, insufficient material…).", "fr": "Partie sans vainqueur (accord, pat, répétition, matériel insuffisant…)."}', 'rules', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('2bdc4eda-5ba0-4046-b9f6-9139cd14e5ad', 'Pièce touchée, pièce jouée', 'Touch-move', NULL, 'missing', '{"en": "A piece deliberately touched must be moved if possible.", "fr": "Une pièce touchée volontairement doit être jouée si possible."}', 'rules', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('865a79b9-c678-46ac-9ffb-ea3fdf82d385', 'Fourchette', 'Fork', NULL, 'missing', '{"en": "One piece attacks two targets at once.", "fr": "Une pièce attaque deux cibles à la fois."}', 'tactics', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('65071acb-d9cf-4208-9712-b8cc5efc924c', 'Clouage', 'Pin', NULL, 'missing', '{"en": "A piece cannot move without exposing a more valuable piece behind it.", "fr": "Une pièce ne peut bouger sans exposer une pièce plus importante derrière elle."}', 'tactics', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('25fb94f3-61c9-4693-863d-80b0c1ed8c08', 'Enfilade', 'Skewer', NULL, 'missing', '{"en": "Attack on a valuable piece which, when it moves, exposes the piece behind.", "fr": "Attaque d''une pièce importante qui, en s''écartant, laisse prendre celle de derrière."}', 'tactics', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('57dfdf7f-0d6f-4b2e-8fe0-2b684bb4523d', 'Attaque à la découverte', 'Discovered attack', NULL, 'missing', '{"en": "A piece moves and unmasks an attack by another.", "fr": "Une pièce se déplace et démasque l''attaque d''une autre."}', 'tactics', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('848b6647-a407-4298-9c22-7d4a061fd1f9', 'Sacrifice', 'Sacrifice', NULL, 'missing', '{"en": "Deliberately giving up material to gain an advantage.", "fr": "Abandon volontaire de matériel pour obtenir un avantage."}', 'tactics', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('571bf3ef-d383-4c4e-ad7e-d2a0769ccc52', 'Mat du couloir', 'Back-rank mate', NULL, 'missing', '{"en": "Mate on the back rank of a king trapped by its own pawns.", "fr": "Mat sur la dernière rangée d''un roi enfermé par ses propres pions."}', 'tactics', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('5cfe4078-7257-4c85-a613-830e479d2ee0', 'Mat étouffé', 'Smothered mate', NULL, 'missing', '{"en": "Mate by a knight against a king surrounded by its own pieces.", "fr": "Mat donné par un cavalier à un roi entouré de ses propres pièces."}', 'tactics', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('8f777fd7-a619-4316-ab57-e36a8798a5d2', 'Ouverture', 'Opening', NULL, 'missing', '{"en": "Start of the game: developing pieces and controlling the centre.", "fr": "Début de partie : développement des pièces et contrôle du centre."}', 'openings', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('9ea4ad65-3f2e-4312-a8fe-7e2d91f8f486', 'Gambit', 'Gambit', NULL, 'missing', '{"en": "An opening sacrificing a pawn for faster development.", "fr": "Ouverture où l''on sacrifie un pion pour un avantage de développement."}', 'openings', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('18ed7d70-99f9-47dd-a073-8ae1e5aabeaf', 'Milieu de partie', 'Middlegame', NULL, 'missing', '{"en": "The phase after the opening, rich in plans and combinations.", "fr": "Phase de la partie après l''ouverture, riche en plans et en combinaisons."}', 'strategy', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('d6217f4c-aca6-465d-a394-79dd4054a8c5', 'Finale', 'Endgame', NULL, 'missing', '{"en": "The final phase of the game, with few pieces left.", "fr": "Dernière phase de la partie, avec peu de pièces."}', 'endgames', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('628c0d25-e871-48df-ae37-ac73e3b34a87', 'Opposition', 'Opposition', NULL, 'missing', '{"en": "Kings facing each other one square apart: key to pawn endings.", "fr": "Rois face à face séparés d''une case : clé des finales de pions."}', 'endgames', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('2d65c9a9-4fe1-4211-855e-96a77118fc96', 'Pendule', 'Chess clock', NULL, 'missing', '{"en": "Double timer measuring each player''s thinking time.", "fr": "Double chronomètre qui mesure le temps de réflexion de chaque joueur."}', 'competition', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('02cc89b3-8e7d-4d6b-9dc8-f92745bd682c', 'Cadence', 'Time control', NULL, 'missing', '{"en": "Time given to each player (for example 15 min + 10 s per move).", "fr": "Temps accordé à chaque joueur (par exemple 15 min + 10 s par coup)."}', 'competition', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('56a9d3bd-198d-48d0-a81b-97c22e5192c6', 'Appariement', 'Pairing', NULL, 'missing', '{"en": "Assignment of opponents for each round.", "fr": "Désignation des adversaires de chaque ronde."}', 'competition', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('bad56db1-6f69-44be-bfc2-0bb9a877aef0', 'Système suisse', 'Swiss system', NULL, 'missing', '{"en": "Tournament where players with equal scores meet, without elimination.", "fr": "Tournoi où les joueurs de même score se rencontrent, sans élimination."}', 'competition', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('78bcaa52-15f2-4ce4-8619-bded59702b78', 'Départage', 'Tiebreak', NULL, 'missing', '{"en": "Criterion separating players tied on points.", "fr": "Critère qui sépare les joueurs à égalité de points."}', 'competition', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;
INSERT INTO public.glossary_terms (id, term_fr, term_en, term_fon, fon_status, definition, category, created_at, updated_at) VALUES ('34c2d8bc-8b6b-475d-bc8b-bc2a69241dcb', 'Feuille de notation', 'Scoresheet', NULL, 'missing', '{"en": "Sheet on which each player records the moves.", "fr": "Feuille où chaque joueur note les coups de la partie."}', 'competition', '2026-09-28 05:32:26.575567+00', '2026-09-28 05:32:26.575567+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: seasons; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.seasons (id, slug, name, starts_on, ends_on, status, league_rules, license_fee_xof, tour_best_results, masters_qualified, masters_invited, is_demo, created_at, updated_at) VALUES ('5e5f9c9c-c065-45f0-ae32-71e2c53a698e', '2026-2027', 'Saison 2026-2027', '2026-09-01', '2027-06-30', 'planned', '{"playoff": {"lower_rank": 3, "upper_rank": 10}, "promoted": 2, "relegated": 2, "sofia_rule": false, "postpone_deadline_days": 7, "max_unjustified_forfeits": 2}', NULL, 6, 8, 2, false, '2026-09-28 05:32:26.519381+00', '2026-09-28 05:32:26.519381+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: leagues; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.leagues (id, season_id, slug, division, cadence, format, size, base_minutes, increment_seconds, rounds_count, schedule_note, status, champion_id, created_at, updated_at) VALUES ('0d829b38-60b2-4536-9fd2-879fecb7afd8', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', '2026-2027-l1-classique', 'l1', 'classical', 'round_robin', 12, 60, 30, 11, '{"en": "One round every two weeks", "fr": "Une ronde toutes les deux semaines"}', 'planned', NULL, '2026-09-28 05:32:26.525832+00', '2026-09-28 05:32:26.525832+00') ON CONFLICT DO NOTHING;
INSERT INTO public.leagues (id, season_id, slug, division, cadence, format, size, base_minutes, increment_seconds, rounds_count, schedule_note, status, champion_id, created_at, updated_at) VALUES ('bdfd2b1b-ec0d-4a05-956b-3d02efccc4d5', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', '2026-2027-l1-rapide', 'l1', 'rapid', 'double_round_robin', 12, 15, 10, 22, '{"en": "22 rounds over 4 matchdays", "fr": "22 rondes sur 4 journées"}', 'planned', NULL, '2026-09-28 05:32:26.525832+00', '2026-09-28 05:32:26.525832+00') ON CONFLICT DO NOTHING;
INSERT INTO public.leagues (id, season_id, slug, division, cadence, format, size, base_minutes, increment_seconds, rounds_count, schedule_note, status, champion_id, created_at, updated_at) VALUES ('e6c8bf8e-aed9-46c9-b89e-f4832f07f190', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', '2026-2027-l1-blitz', 'l1', 'blitz', 'double_round_robin', 12, 3, 2, 22, '{"en": "22 rounds over 2 matchdays", "fr": "22 rondes sur 2 journées"}', 'planned', NULL, '2026-09-28 05:32:26.525832+00', '2026-09-28 05:32:26.525832+00') ON CONFLICT DO NOTHING;
INSERT INTO public.leagues (id, season_id, slug, division, cadence, format, size, base_minutes, increment_seconds, rounds_count, schedule_note, status, champion_id, created_at, updated_at) VALUES ('276b6a96-5875-431f-b525-3597d602dacb', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', '2026-2027-l2-classique', 'l2', 'classical', 'round_robin', 12, 60, 30, 11, '{"en": "One round every two weeks", "fr": "Une ronde toutes les deux semaines"}', 'planned', NULL, '2026-09-28 05:32:26.525832+00', '2026-09-28 05:32:26.525832+00') ON CONFLICT DO NOTHING;
INSERT INTO public.leagues (id, season_id, slug, division, cadence, format, size, base_minutes, increment_seconds, rounds_count, schedule_note, status, champion_id, created_at, updated_at) VALUES ('ee0fa187-eda9-45ce-acd0-8020af0bd87f', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', '2026-2027-l2-rapide', 'l2', 'rapid', 'double_round_robin', 12, 15, 10, 22, '{"en": "22 rounds over 4 matchdays", "fr": "22 rondes sur 4 journées"}', 'planned', NULL, '2026-09-28 05:32:26.525832+00', '2026-09-28 05:32:26.525832+00') ON CONFLICT DO NOTHING;
INSERT INTO public.leagues (id, season_id, slug, division, cadence, format, size, base_minutes, increment_seconds, rounds_count, schedule_note, status, champion_id, created_at, updated_at) VALUES ('61e76449-7255-426a-b0e4-0c9ecd89b7f9', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', '2026-2027-l2-blitz', 'l2', 'blitz', 'double_round_robin', 12, 3, 2, 22, '{"en": "22 rounds over 2 matchdays", "fr": "22 rondes sur 2 journées"}', 'planned', NULL, '2026-09-28 05:32:26.525832+00', '2026-09-28 05:32:26.525832+00') ON CONFLICT DO NOTHING;
INSERT INTO public.leagues (id, season_id, slug, division, cadence, format, size, base_minutes, increment_seconds, rounds_count, schedule_note, status, champion_id, created_at, updated_at) VALUES ('d4940592-b2a9-4580-aa58-bbf02068f013', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', '2026-2027-amateur-classique', 'amateur', 'classical', 'swiss', NULL, 60, 30, NULL, '{"en": "Swiss system, one matchday a month", "fr": "Système suisse, une journée par mois"}', 'planned', NULL, '2026-09-28 05:32:26.525832+00', '2026-09-28 05:32:26.525832+00') ON CONFLICT DO NOTHING;
INSERT INTO public.leagues (id, season_id, slug, division, cadence, format, size, base_minutes, increment_seconds, rounds_count, schedule_note, status, champion_id, created_at, updated_at) VALUES ('9791683f-5b95-4518-9e0d-234b0ac53412', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', '2026-2027-amateur-rapide', 'amateur', 'rapid', 'swiss', NULL, 15, 10, NULL, '{"en": "Swiss system, one matchday a month", "fr": "Système suisse, une journée par mois"}', 'planned', NULL, '2026-09-28 05:32:26.525832+00', '2026-09-28 05:32:26.525832+00') ON CONFLICT DO NOTHING;
INSERT INTO public.leagues (id, season_id, slug, division, cadence, format, size, base_minutes, increment_seconds, rounds_count, schedule_note, status, champion_id, created_at, updated_at) VALUES ('604ad619-d83d-435d-84f9-df3299a94d06', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', '2026-2027-amateur-blitz', 'amateur', 'blitz', 'swiss', NULL, 3, 2, NULL, '{"en": "Swiss system, one matchday a month", "fr": "Système suisse, une journée par mois"}', 'planned', NULL, '2026-09-28 05:32:26.525832+00', '2026-09-28 05:32:26.525832+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: lessons_library; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.lessons_library (id, slug, level, theme, title, summary, body, positions, "position", is_premium, status, created_at, updated_at) VALUES ('899700b3-3ee9-4216-b6d8-c741871e055c', 'deplacement-des-pieces', 'discovery', 'rules', '{"en": "How the pieces move", "fr": "Le déplacement des pièces"}', '{"en": "How the king, queen, rook, bishop, knight and pawn move.", "fr": "Comment bougent le roi, la dame, la tour, le fou, le cavalier et le pion."}', '{"en": "## The pieces\n\nEach side starts with 16 pieces: a king, a queen, two rooks, two bishops, two knights and eight pawns.\n\n- **The rook** moves in straight lines along files and ranks.\n- **The bishop** moves diagonally and always stays on the same colour.\n- **The queen** combines the rook and the bishop.\n- **The king** moves one square in any direction.\n- **The knight** moves in an L shape and can jump over other pieces.\n- **The pawn** moves forward one square (two on its first move) and captures diagonally.\n\n## Remember\n\nThe goal of the game is to checkmate the opponent''s king.", "fr": "## Les pièces\n\nChaque camp commence avec 16 pièces : un roi, une dame, deux tours, deux fous, deux cavaliers et huit pions.\n\n- **La tour** se déplace en ligne droite, sur les colonnes et les rangées.\n- **Le fou** se déplace en diagonale et reste toujours sur la même couleur de case.\n- **La dame** combine la tour et le fou.\n- **Le roi** se déplace d''une case dans toutes les directions.\n- **Le cavalier** se déplace en L et peut sauter par-dessus les autres pièces.\n- **Le pion** avance d''une case (deux cases lors de son premier coup) et prend en diagonale.\n\n## À retenir\n\nLe but de la partie est de mettre le roi adverse échec et mat."}', '[{"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "caption": {"en": "Starting position", "fr": "Position de départ"}}]', 0, false, 'published', '2026-09-28 05:32:26.567929+00', '2026-09-28 05:32:26.567929+00') ON CONFLICT DO NOTHING;
INSERT INTO public.lessons_library (id, slug, level, theme, title, summary, body, positions, "position", is_premium, status, created_at, updated_at) VALUES ('1a8cdbcf-8a22-4559-818a-3ff6d9e4d013', 'le-mat-du-couloir', 'beginner', 'tactics', '{"en": "The back-rank mate", "fr": "Le mat du couloir"}', '{"en": "Taking advantage of a king trapped behind its pawns.", "fr": "Profiter d''un roi enfermé derrière ses pions."}', '{"en": "## The idea\n\nWhen the king has castled and its three pawns are still in front of it, it has no escape square. A rook or queen reaching the back rank then gives mate.\n\n## Staying safe\n\nTo avoid this mate, make a “luft” by pushing a pawn (h3 or g3 for White) at the right moment.\n\n## Your turn\n\nFind the mate in one in the position below.", "fr": "## L''idée\n\nQuand le roi a roqué et que ses trois pions sont restés devant lui, il n''a plus de case de fuite. Une tour ou une dame qui arrive sur la dernière rangée donne alors mat.\n\n## Se protéger\n\nPour éviter ce mat, on ouvre une « case d''aération » en avançant un pion (h3 ou g3 pour les Blancs) au bon moment.\n\n## À vous\n\nTrouvez le mat en un coup dans la position ci-dessous."}', '[{"fen": "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "caption": {"en": "White to play and mate", "fr": "Les Blancs jouent et font mat"}, "solution": ["d1d8"]}]', 1, false, 'published', '2026-09-28 05:32:26.567929+00', '2026-09-28 05:32:26.567929+00') ON CONFLICT DO NOTHING;
INSERT INTO public.lessons_library (id, slug, level, theme, title, summary, body, positions, "position", is_premium, status, created_at, updated_at) VALUES ('c4b5c625-31fc-42a3-b7e2-c766a5d7d08d', 'principes-de-l-ouverture', 'beginner', 'openings', '{"en": "Opening principles", "fr": "Les principes de l''ouverture"}', '{"en": "Three simple rules to start a game well.", "fr": "Trois règles simples pour bien commencer une partie."}', '{"en": "## 1. Control the centre\n\nThe squares d4, e4, d5 and e5 matter most: pawns and pieces controlling them have more influence.\n\n## 2. Develop your pieces\n\nBring out the knights and bishops before moving the same piece several times. Avoid bringing the queen out too early.\n\n## 3. Keep the king safe\n\nCastle early to protect your king and connect your rooks.", "fr": "## 1. Contrôler le centre\n\nLes cases d4, e4, d5 et e5 sont les plus importantes : les pions et les pièces qui les contrôlent ont plus d''influence.\n\n## 2. Développer ses pièces\n\nSortez les cavaliers et les fous avant de déplacer plusieurs fois la même pièce. Évitez de sortir la dame trop tôt.\n\n## 3. Mettre le roi à l''abri\n\nRoquez tôt pour protéger votre roi et relier vos tours."}', '[{"fen": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", "caption": {"en": "Harmonious development", "fr": "Développement harmonieux"}}]', 2, false, 'published', '2026-09-28 05:32:26.567929+00', '2026-09-28 05:32:26.567929+00') ON CONFLICT DO NOTHING;
INSERT INTO public.lessons_library (id, slug, level, theme, title, summary, body, positions, "position", is_premium, status, created_at, updated_at) VALUES ('ea73d710-039e-4480-8b62-e52974f65909', 'la-fourchette-du-cavalier', 'intermediate', 'tactics', '{"en": "The knight fork", "fr": "La fourchette du cavalier"}', '{"en": "Attacking two pieces at once with a knight.", "fr": "Attaquer deux pièces à la fois avec un cavalier."}', '{"en": "## The principle\n\nThe knight attacks up to eight squares and cannot be blocked. It is ideal for attacking two pieces at once: the fork.\n\n## Spotting targets\n\nLook for the enemy king, queen and rooks on squares of the same colour, a knight''s jump away from each other.", "fr": "## Le principe\n\nLe cavalier attaque jusqu''à huit cases et ne peut pas être bloqué. Il est idéal pour attaquer deux pièces à la fois : c''est la fourchette.\n\n## Repérer les cibles\n\nCherchez le roi, la dame et les tours adverses placés sur des cases de même couleur, à distance de saut de cavalier l''une de l''autre."}', '[]', 3, false, 'published', '2026-09-28 05:32:26.567929+00', '2026-09-28 05:32:26.567929+00') ON CONFLICT DO NOTHING;
INSERT INTO public.lessons_library (id, slug, level, theme, title, summary, body, positions, "position", is_premium, status, created_at, updated_at) VALUES ('74aae482-0d49-469e-b564-219802d77a1f', 'finale-de-lucena', 'advanced', 'endgames', '{"en": "The Lucena position: building the bridge", "fr": "La position de Lucena : construire le pont"}', '{"en": "The reference winning technique in rook and pawn versus rook endgames.", "fr": "La technique gagnante de référence dans les finales tour et pion contre tour."}', '{"en": "## The position\n\nWhite''s pawn is on the seventh rank, protected by its king standing in front of it; the black king is cut off by one file.\n\n## The method\n\n1. **Rf1+ or Rd1+**: the check pushes the enemy king away.\n2. **Rd4!**: the rook goes to the fourth rank to prepare the “bridge”.\n3. The white king walks out; when the rook checks along the file, the white rook blocks on the fourth rank.\n\n## Remember\n\nThe rook on the fourth rank shelters the king: that is the bridge.", "fr": "## La position\n\nLe pion blanc est sur la septième rangée, protégé par son roi placé devant lui ; le roi noir est coupé d''une colonne.\n\n## La méthode\n\n1. **Tf1+ ou Td1+** : l''échec repousse le roi adverse.\n2. **Td4 !** : la tour monte sur la quatrième rangée pour préparer le « pont ».\n3. Le roi blanc sort de sa prison ; aux échecs sur la colonne, la tour s''interpose sur la quatrième rangée.\n\n## À retenir\n\nLa tour sur la quatrième rangée sert d''abri au roi : c''est le pont."}', '[{"fen": "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1", "caption": {"en": "Lucena position, White to play and win", "fr": "Position de Lucena, les blancs jouent et gagnent"}}]', 50, true, 'published', '2026-09-28 05:32:26.594321+00', '2026-09-28 05:32:26.594321+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: media_series; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.media_series (id, slug, kind, title, description, language, "position", is_active, created_at, updated_at) VALUES ('1f3dea82-31a5-4187-ad9e-ca7773fbd43c', 'le-coup-de-la-semaine', 'show', '{"en": "Move of the Week", "fr": "Le Coup de la semaine"}', '{"en": "A striking position of the week, explained step by step.", "fr": "Une position marquante de la semaine, expliquée pas à pas."}', 'fr', 1, true, '2026-09-28 05:32:26.546024+00', '2026-09-28 05:32:26.546024+00') ON CONFLICT DO NOTHING;
INSERT INTO public.media_series (id, slug, kind, title, description, language, "position", is_active, created_at, updated_at) VALUES ('ae0478dc-c683-464e-abf9-64dad3044c9c', 'echecs-en-fon', 'show', '{"en": "Chess in Fon", "fr": "Échecs en fon"}', '{"en": "Chess explained in Fon.", "fr": "Les échecs expliqués en fon."}', 'fon', 2, true, '2026-09-28 05:32:26.546024+00', '2026-09-28 05:32:26.546024+00') ON CONFLICT DO NOTHING;
INSERT INTO public.media_series (id, slug, kind, title, description, language, "position", is_active, created_at, updated_at) VALUES ('5b13a8bf-3069-43d8-86c0-1f27b0bda6ba', 'au-coeur-de-la-ligue', 'show', '{"en": "Inside the League", "fr": "Au cœur de la Ligue"}', '{"en": "Behind the scenes and key games of the Chesspirit leagues.", "fr": "Les coulisses et les parties clés des ligues Chesspirit."}', 'fr', 3, true, '2026-09-28 05:32:26.546024+00', '2026-09-28 05:32:26.546024+00') ON CONFLICT DO NOTHING;
INSERT INTO public.media_series (id, slug, kind, title, description, language, "position", is_active, created_at, updated_at) VALUES ('de4c8148-fe9d-4cd1-9626-9281c2373745', 'portraits', 'show', '{"en": "Portraits", "fr": "Portraits"}', '{"en": "Meeting the players, coaches and arbiters of Benin.", "fr": "Rencontres avec les joueurs, coachs et arbitres du Bénin."}', 'fr', 4, true, '2026-09-28 05:32:26.546024+00', '2026-09-28 05:32:26.546024+00') ON CONFLICT DO NOTHING;
INSERT INTO public.media_series (id, slug, kind, title, description, language, "position", is_active, created_at, updated_at) VALUES ('68abdf05-0441-4160-8367-e360287b3dc0', 'chesspirit-live', 'live', '{"en": "Chesspirit Live", "fr": "Chesspirit Live"}', '{"en": "Tournaments commented live.", "fr": "Les tournois commentés en direct."}', 'fr', 5, true, '2026-09-28 05:32:26.546024+00', '2026-09-28 05:32:26.546024+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: product_categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.product_categories (id, slug, name, description, "position", is_active, created_at) VALUES ('58aa375a-fec3-48d1-9822-acf763084939', 'echiquiers', '{"en": "Boards and pieces", "fr": "Échiquiers et pièces"}', '{}', 1, true, '2026-09-28 05:32:26.507919+00') ON CONFLICT DO NOTHING;
INSERT INTO public.product_categories (id, slug, name, description, "position", is_active, created_at) VALUES ('e0c16a55-c4ee-4d61-8c11-ee9e917adcf4', 'pendules-livres', '{"en": "Clocks and books", "fr": "Pendules et livres"}', '{}', 2, true, '2026-09-28 05:32:26.507919+00') ON CONFLICT DO NOTHING;
INSERT INTO public.product_categories (id, slug, name, description, "position", is_active, created_at) VALUES ('e51f8c3d-97a1-4e39-97a7-ab78a9c5a588', 'accessoires', '{"en": "Accessories", "fr": "Accessoires"}', '{}', 3, true, '2026-09-28 05:32:26.507919+00') ON CONFLICT DO NOTHING;
INSERT INTO public.product_categories (id, slug, name, description, "position", is_active, created_at) VALUES ('017ba7e3-4cb6-4ccb-b71c-40922bdb351d', 'packs', '{"en": "Bundles", "fr": "Packs"}', '{}', 4, true, '2026-09-28 05:32:26.507919+00') ON CONFLICT DO NOTHING;
INSERT INTO public.product_categories (id, slug, name, description, "position", is_active, created_at) VALUES ('0a0116ac-79e5-4b1d-99e7-7a097e78934b', 'cartes-cadeaux', '{"en": "Gift cards", "fr": "Cartes cadeaux"}', '{}', 5, true, '2026-09-28 05:32:26.507919+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: puzzles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.puzzles (id, code, fen, solution, theme, mate_in, rating, source, is_active, created_at, updated_at) VALUES ('0bc6fc16-f100-4fc5-bbfd-70151215ee98', 'philidor', '5r1k/6pp/7N/8/2Q5/8/5PPP/6K1 w - - 0 1', '{c4g8,f8g8,h6f7}', 'smothered', 2, NULL, 'chesspirit', true, '2026-09-28 05:32:26.555678+00', '2026-09-28 05:32:26.555678+00') ON CONFLICT DO NOTHING;
INSERT INTO public.puzzles (id, code, fen, solution, theme, mate_in, rating, source, is_active, created_at, updated_at) VALUES ('d896fe9d-e861-4935-bd96-03226c18fb5c', 'back-rank', '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', '{d1d8}', 'backRank', 1, NULL, 'chesspirit', true, '2026-09-28 05:32:26.555678+00', '2026-09-28 05:32:26.555678+00') ON CONFLICT DO NOTHING;
INSERT INTO public.puzzles (id, code, fen, solution, theme, mate_in, rating, source, is_active, created_at, updated_at) VALUES ('e9c6ec0f-ebde-4ea4-922f-c7ac03c00403', 'philidor-black', '6k1/5ppp/8/2q5/8/7n/6PP/5R1K b - - 0 1', '{c5g1,f1g1,h3f2}', 'smothered', 2, NULL, 'chesspirit', true, '2026-09-28 05:32:26.555678+00', '2026-09-28 05:32:26.555678+00') ON CONFLICT DO NOTHING;
INSERT INTO public.puzzles (id, code, fen, solution, theme, mate_in, rating, source, is_active, created_at, updated_at) VALUES ('d6b32832-c890-4a56-b56a-2f216f008057', 'scholar', 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', '{h5f7}', 'scholar', 1, NULL, 'chesspirit', true, '2026-09-28 05:32:26.555678+00', '2026-09-28 05:32:26.555678+00') ON CONFLICT DO NOTHING;
INSERT INTO public.puzzles (id, code, fen, solution, theme, mate_in, rating, source, is_active, created_at, updated_at) VALUES ('ee9d583e-75f9-4a1b-b3db-b4eef4e1f859', 'back-rank-2', '6k1/pp3ppp/8/8/8/1Q6/5PPP/2R3K1 w - - 0 1', '{c1c8}', 'backRank', 1, NULL, 'chesspirit', true, '2026-09-28 05:32:26.555678+00', '2026-09-28 05:32:26.555678+00') ON CONFLICT DO NOTHING;
INSERT INTO public.puzzles (id, code, fen, solution, theme, mate_in, rating, source, is_active, created_at, updated_at) VALUES ('d1073d6f-706e-4074-b3dd-688adb372f1c', 'anastasia', '5r2/4N1pk/8/8/8/3R4/5PPP/6K1 w - - 0 1', '{d3h3}', 'anastasia', 1, NULL, 'chesspirit', true, '2026-09-28 05:32:26.555678+00', '2026-09-28 05:32:26.555678+00') ON CONFLICT DO NOTHING;
INSERT INTO public.puzzles (id, code, fen, solution, theme, mate_in, rating, source, is_active, created_at, updated_at) VALUES ('ec246d66-41cf-4c36-968f-e415873baf9a', 'arabian', '7k/4R3/5N2/8/8/8/6PP/7K w - - 0 1', '{e7h7}', 'arabian', 1, NULL, 'chesspirit', true, '2026-09-28 05:32:26.555678+00', '2026-09-28 05:32:26.555678+00') ON CONFLICT DO NOTHING;
INSERT INTO public.puzzles (id, code, fen, solution, theme, mate_in, rating, source, is_active, created_at, updated_at) VALUES ('1a6f41fe-5f5b-4630-a80d-7548a8fcc83e', 'boden', '2kr4/p2n1ppp/8/8/5B2/3B4/PPP2PPP/6K1 w - - 0 1', '{d3a6}', 'boden', 1, NULL, 'chesspirit', true, '2026-09-28 05:32:26.555678+00', '2026-09-28 05:32:26.555678+00') ON CONFLICT DO NOTHING;
INSERT INTO public.puzzles (id, code, fen, solution, theme, mate_in, rating, source, is_active, created_at, updated_at) VALUES ('57f0f8ac-5dbd-4695-b31e-0364f0f86f2d', 'fools-mate', 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', '{d8h4}', 'foolsMate', 1, NULL, 'chesspirit', true, '2026-09-28 05:32:26.555678+00', '2026-09-28 05:32:26.555678+00') ON CONFLICT DO NOTHING;
INSERT INTO public.puzzles (id, code, fen, solution, theme, mate_in, rating, source, is_active, created_at, updated_at) VALUES ('295a982c-3e7c-407b-ac51-b89f6ec7dcb7', 'damiano', '5rk1/5p2/6P1/8/8/8/6K1/7Q w - - 0 1', '{h1h7}', 'damiano', 1, NULL, 'chesspirit', true, '2026-09-28 05:32:26.555678+00', '2026-09-28 05:32:26.555678+00') ON CONFLICT DO NOTHING;
INSERT INTO public.puzzles (id, code, fen, solution, theme, mate_in, rating, source, is_active, created_at, updated_at) VALUES ('fa8daa79-aa32-4992-8cb2-407e52155e6f', 'back-rank-queen', '6k1/5ppp/8/8/8/8/Q4PPP/6K1 w - - 0 1', '{a2a8}', 'backRank', 1, NULL, 'chesspirit', true, '2026-09-28 05:32:26.555678+00', '2026-09-28 05:32:26.555678+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: tournaments; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tournaments (id, slug, name, edition, summary, description, venue, address, city, country, lat, lng, starts_at, ends_at, checkin_opens_at, registration_opens_at, registration_closes_at, cadence, base_minutes, increment_seconds, rounds_count, pairing_system, tiebreaks, categories, conditions, entry_fee_xof, entry_fee_notes, capacity, is_online, rated, counts_for_tour, league_id, status, validation_mode, waitlist_enabled, allow_online_payment, allow_on_site_payment, results_published, organizer_profile_id, organization_id, poster_path, contact_phone, unconfirmed_fields, duplicated_from, is_demo, created_by, created_at, updated_at, initial_color, bye_points, lichess_kind, lichess_id, lichess_imported_at, team_scoring, team_size) VALUES ('66081b28-258b-4d83-bbe3-6ffe1fd10d55', 'tournoi-chesspirit-2026', 'Tournoi Chesspirit', '1re édition', '{"en": "The first Chesspirit tournament, a rapid event at the FSS in Cotonou.", "fr": "Le premier tournoi Chesspirit, en cadence rapide, à la FSS de Cotonou."}', '{"en": "Chesspirit''s first tournament, played at rapid time control on Saturday 3 October 2026 at the FSS in Cotonou, with the FSS and Ayelade Chess as partners. The schedule, exact time control, number of rounds, fees and prizes will be published here once confirmed.", "fr": "Premier tournoi organisé par Chesspirit, en cadence rapide, le samedi 3 octobre 2026 à la FSS de Cotonou, avec la FSS et Ayelade Chess comme partenaires. Le programme, la cadence exacte, le nombre de rondes, les frais et les dotations seront publiés ici dès qu''ils seront confirmés."}', 'FSS', NULL, 'Cotonou', 'BJ', NULL, NULL, '2026-10-02 23:00:00+00', NULL, NULL, NULL, NULL, 'rapid', NULL, NULL, NULL, 'swiss_dutch', '{buchholz_cut1,buchholz,sonneborn_berger}', '[]', '{}', NULL, '{}', NULL, false, false, false, NULL, 'registration_open', 'auto', true, true, true, false, NULL, NULL, NULL, NULL, '{schedule,time_control,rounds,pairing_system,fee,prizes,capacity,rated}', NULL, false, NULL, '2026-09-28 05:32:26.483796+00', '2026-09-28 05:32:26.483796+00', 'white1', 1.0, NULL, NULL, NULL, 'match_points', 4) ON CONFLICT DO NOTHING;


--
-- Data for Name: registration_forms; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.registration_forms (id, tournament_id, fields, created_at, updated_at) VALUES ('e92be1ea-4a0c-48ab-b119-a17fb88f9f1c', '66081b28-258b-4d83-bbe3-6ffe1fd10d55', '[]', '2026-09-28 05:32:26.501498+00', '2026-09-28 05:32:26.501498+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: resources; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.resources (id, title, description, kind, url, level, language, is_premium, status, created_at, updated_at) VALUES ('f87d6481-257f-48fa-aa7b-e4cceb25dad1', '{"en": "FIDE Laws of Chess", "fr": "Règles du jeu d''échecs de la FIDE"}', '{"en": "The official rules (FIDE website).", "fr": "Le texte officiel des règles (site de la FIDE, en anglais)."}', 'rules', 'https://handbook.fide.com/chapter/E012023', NULL, 'en', false, 'published', '2026-09-28 05:32:26.584732+00', '2026-09-28 05:32:26.584732+00') ON CONFLICT DO NOTHING;
INSERT INTO public.resources (id, title, description, kind, url, level, language, is_premium, status, created_at, updated_at) VALUES ('2cdb2a33-ed46-4a77-8ed1-372c1a12a2fc', '{"en": "Chesspirit tournament rules", "fr": "Règlement type des tournois Chesspirit"}', '{"en": "Draft rules, to be validated.", "fr": "Projet de règlement, à faire valider."}', 'rules', '/legal/reglement-tournois', NULL, 'fr', false, 'published', '2026-09-28 05:32:26.584732+00', '2026-09-28 05:32:26.584732+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: tour_stages; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tour_stages (id, season_id, tournament_id, number, name, city, planned_on, kind, coefficient, scale_id, status, created_at, updated_at) VALUES ('6b54716f-82f5-4288-9dec-1b5f94eb6441', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', NULL, 1, 'Étape de Cotonou (pressentie)', 'Cotonou', NULL, 'regular', 1.00, NULL, 'planned', '2026-09-28 05:32:26.534351+00', '2026-09-28 05:32:26.534351+00') ON CONFLICT DO NOTHING;
INSERT INTO public.tour_stages (id, season_id, tournament_id, number, name, city, planned_on, kind, coefficient, scale_id, status, created_at, updated_at) VALUES ('7f7fcf51-6040-4cbf-811d-490686c85c0d', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', NULL, 2, 'Étape de Porto-Novo (pressentie)', 'Porto-Novo', NULL, 'regular', 1.00, NULL, 'planned', '2026-09-28 05:32:26.534351+00', '2026-09-28 05:32:26.534351+00') ON CONFLICT DO NOTHING;
INSERT INTO public.tour_stages (id, season_id, tournament_id, number, name, city, planned_on, kind, coefficient, scale_id, status, created_at, updated_at) VALUES ('d48cbb8e-b8aa-4ce4-9fec-f09f25b15287', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', NULL, 3, 'Étape de Abomey-Calavi (pressentie)', 'Abomey-Calavi', NULL, 'regular', 1.00, NULL, 'planned', '2026-09-28 05:32:26.534351+00', '2026-09-28 05:32:26.534351+00') ON CONFLICT DO NOTHING;
INSERT INTO public.tour_stages (id, season_id, tournament_id, number, name, city, planned_on, kind, coefficient, scale_id, status, created_at, updated_at) VALUES ('618c7a07-616b-4a88-92e2-b75044543608', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', NULL, 4, 'Étape de Bohicon (pressentie)', 'Bohicon', NULL, 'regular', 1.00, NULL, 'planned', '2026-09-28 05:32:26.534351+00', '2026-09-28 05:32:26.534351+00') ON CONFLICT DO NOTHING;
INSERT INTO public.tour_stages (id, season_id, tournament_id, number, name, city, planned_on, kind, coefficient, scale_id, status, created_at, updated_at) VALUES ('5eedfadf-6270-4ecb-8104-bbe87c4c88f2', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', NULL, 5, 'Étape de Parakou (pressentie)', 'Parakou', NULL, 'regular', 1.00, NULL, 'planned', '2026-09-28 05:32:26.534351+00', '2026-09-28 05:32:26.534351+00') ON CONFLICT DO NOTHING;
INSERT INTO public.tour_stages (id, season_id, tournament_id, number, name, city, planned_on, kind, coefficient, scale_id, status, created_at, updated_at) VALUES ('d5fd398f-e397-4395-b9ea-971136fde1b3', '5e5f9c9c-c065-45f0-ae32-71e2c53a698e', NULL, 6, 'Étape de Natitingou (pressentie)', 'Natitingou', NULL, 'regular', 1.00, NULL, 'planned', '2026-09-28 05:32:26.534351+00', '2026-09-28 05:32:26.534351+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: tournament_partners; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tournament_partners (id, tournament_id, name, role, url, logo_path, "position", created_at, updated_at) VALUES ('12cc2fad-bf83-469c-b019-a3c8061d371f', '66081b28-258b-4d83-bbe3-6ffe1fd10d55', 'FSS', 'host', NULL, NULL, 1, '2026-09-28 05:32:26.494723+00', '2026-09-28 05:32:26.494723+00') ON CONFLICT DO NOTHING;
INSERT INTO public.tournament_partners (id, tournament_id, name, role, url, logo_path, "position", created_at, updated_at) VALUES ('ed8f6d41-bedd-4c5f-9c37-793e0733982b', '66081b28-258b-4d83-bbe3-6ffe1fd10d55', 'Ayelade Chess', 'partner', NULL, NULL, 2, '2026-09-28 05:32:26.494723+00', '2026-09-28 05:32:26.494723+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: weekly_challenges; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.weekly_challenges (id, week_start, title, puzzle_ids, created_at, updated_at) VALUES ('4f2b10dd-2d0b-42be-92c2-514d672a286d', '2026-09-28', '{"en": "Weekly challenge: mates in one", "fr": "Défi de la semaine : mats en un coup"}', '{d1073d6f-706e-4074-b3dd-688adb372f1c,ec246d66-41cf-4c36-968f-e415873baf9a,1a6f41fe-5f5b-4630-a80d-7548a8fcc83e}', '2026-09-28 05:32:26.562313+00', '2026-09-28 05:32:26.562313+00') ON CONFLICT DO NOTHING;


--
-- PostgreSQL database dump complete
--



commit;
select 'Chesspirit installé' as resultat, (select count(*) from public.feature_flags) as indicateurs, (select count(*) from public.leagues) as ligues;
