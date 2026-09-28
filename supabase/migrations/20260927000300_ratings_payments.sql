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
