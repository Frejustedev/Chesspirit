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
