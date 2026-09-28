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
