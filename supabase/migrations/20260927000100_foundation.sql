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
