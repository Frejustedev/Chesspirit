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
