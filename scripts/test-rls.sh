#!/usr/bin/env bash
# Disposable local DB only. Never points at a real Supabase project.
set -euo pipefail
cd "$(dirname "$0")/.."
container_name="road-mvp-rls-$$"
cleanup() { docker rm -f "$container_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# No host port or filesystem mount is exposed.
docker run --detach --name "$container_name" --env POSTGRES_PASSWORD=local-test-only postgres:17 >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
SQL
for migration in supabase/migrations/*.sql; do
  docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 < "$migration"
done
docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/rls.sql
docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/zoom.sql
printf 'RLS tests passed (owner / other user / anonymous / revision conflict).\n'
