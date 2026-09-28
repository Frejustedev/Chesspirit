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
