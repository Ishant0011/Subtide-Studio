-- Ensure service_role has explicit full DML privileges on server-controlled tables
-- while keeping anon and authenticated strictly locked down.

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.projects to service_role;
grant select, insert, update, delete on table public.media_assets to service_role;
