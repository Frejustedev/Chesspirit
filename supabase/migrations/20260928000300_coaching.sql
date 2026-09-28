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
