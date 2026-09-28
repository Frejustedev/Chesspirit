-- Aides de test des politiques RLS (chargées dans chaque transaction de test, puis annulées).
create schema if not exists tests;

create or replace function tests.create_user(p_email text, p_phone text default null) returns uuid
language plpgsql as $$
declare
  v uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, phone, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, p_phone, '{}', '{}', now(), now());
  return v;
end $$;

create or replace function tests.login_as(p_user uuid, p_aal text default 'aal1') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

create or replace function tests.as_service() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;

create or replace function tests.reset_role() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function tests.eq(actual anyelement, expected anyelement, label text) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'ÉCHEC % : obtenu %, attendu %', label, actual, expected;
  end if;
  raise notice 'ok - %', label;
end $$;

create or replace function tests.throws(p_sql text, label text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok - % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'ÉCHEC % : aucune erreur levée', label;
end $$;

grant usage on schema tests to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Écriture refusée : l'ordre (update, insert ou delete, sans « returning ») n'écrit aucune ligne
-- (règles d'accès) ou est rejeté (droits, garde, WITH CHECK). Les tables visées doivent contenir
-- des lignes au moment du test, sinon l'assertion ne prouve rien.
create or replace function tests.no_write(p_sql text, label text) returns void
language plpgsql as $$
declare n int;
begin
  begin
    execute format('with w as (%s returning 1) select count(*)::int from w', p_sql) into n;
  exception when insufficient_privilege then
    raise notice 'ok - % (%)', label, sqlerrm;
    return;
  end;
  if n > 0 then raise exception 'ÉCHEC % : % ligne(s) écrite(s)', label, n; end if;
  raise notice 'ok - % (aucune ligne écrite)', label;
end $$;

-- Lecture refusée : la requête ne renvoie aucune ligne ou est rejetée faute de droits.
create or replace function tests.no_read(p_sql text, label text) returns void
language plpgsql as $$
declare n int;
begin
  begin
    execute format('select count(*)::int from (%s) q', p_sql) into n;
  exception when insufficient_privilege then
    raise notice 'ok - % (%)', label, sqlerrm;
    return;
  end;
  if n > 0 then raise exception 'ÉCHEC % : % ligne(s) visible(s)', label, n; end if;
  raise notice 'ok - % (aucune ligne visible)', label;
end $$;

