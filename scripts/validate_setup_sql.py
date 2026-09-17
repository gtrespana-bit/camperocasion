#!/usr/bin/env python3
"""Ejecuta setup-camperocasion.sql statement por statement en un PostgreSQL real
(con stubs de Supabase) y reporta el primer error, emulando el SQL Editor."""
import re
import sys
import pgserver
import psycopg2

SQL_FILE = 'setup-camperocasion.sql'

STUBS = """
-- ===== Stub de entorno Supabase (solo para validación local) =====
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz default now(),
  raw_user_meta_data jsonb default '{}'
);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.current_uid', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create or replace function auth.role() returns text language sql stable as $$ select 'authenticated' $$;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean default false,
  file_size_limit integer,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create or replace function storage.foldername(fullpath text) returns text[]
language sql immutable as $$ select string_to_array(fullpath, '/') $$;

-- Mismo trigger que el Supabase real: prohíbe DELETE por SQL directo sobre
-- storage.buckets/objects (solo vía Storage API). Sin este stub, una migración
-- con `delete from storage.buckets` pasaría en CI y fallaría en producción —
-- exactamente lo que ocurrió con 202609170004. (Los UPDATE sí están permitidos:
-- el setup hace `update storage.buckets set public=false` y es legal.)
create or replace function storage.protect_delete()
returns trigger
language plpgsql as $$
begin
  raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
    using hint = 'This prevents accidental data loss from orphaned objects.';
end $$;
drop trigger if exists protect_storage_buckets_delete on storage.buckets;
create trigger protect_storage_buckets_delete before delete on storage.buckets
  for each row execute function storage.protect_delete();
drop trigger if exists protect_storage_objects_delete on storage.objects;
create trigger protect_storage_objects_delete before delete on storage.objects
  for each row execute function storage.protect_delete();

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;
"""


def split_statements(sql):
    """Divide en statements top-level respetando $$, $tag$, '...', \"...\" y comentarios."""
    stmts, i, n, start = [], 0, len(sql), 0
    while i < n:
        c = sql[i]
        if sql[i:i+2] == '--':
            j = sql.find('\n', i)
            i = n if j == -1 else j + 1
        elif sql[i:i+2] == '/*':
            j = sql.find('*/', i + 2)
            i = n if j == -1 else j + 2
        elif c == "'":
            i += 1
            while i < n:
                if sql[i] == "'":
                    if i + 1 < n and sql[i+1] == "'":
                        i += 2
                    else:
                        i += 1
                        break
                else:
                    i += 1
        elif c == '"':
            i += 1
            while i < n:
                if sql[i] == '"':
                    if i + 1 < n and sql[i+1] == '"':
                        i += 2
                    else:
                        i += 1
                        break
                else:
                    i += 1
        elif c == '$':
            m = re.match(r'\$[A-Za-z_]*\$', sql[i:])
            if m:
                tag = m.group(0)
                j = sql.find(tag, i + len(tag))
                i = n if j == -1 else j + len(tag)
            else:
                i += 1
        elif c == ';':
            stmts.append((start, sql[start:i+1]))
            i += 1
            start = i
        else:
            i += 1
    if sql[start:].strip():
        stmts.append((start, sql[start:]))
    return stmts


def run(reset=True):
    db = pgserver.get_server('/tmp/pgdata')
    if reset:
        # recrear la base de datos desde cero
        admin = psycopg2.connect(db.get_uri())
        admin.autocommit = True
        with admin.cursor() as c:
            c.execute("drop database if exists camproctest with (force)")
            c.execute("create database camproctest")
        admin.close()
    uri = db.get_uri()  # apunta a la db "postgres"
    uri = uri.replace('/postgres?', '/camproctest?')
    conn = psycopg2.connect(uri)
    conn.autocommit = True
    cur = conn.cursor()

    # crear stubs
    cur.execute(STUBS)

    src = open(SQL_FILE, encoding='utf-8').read()
    stmts = split_statements(src)
    total = 0
    for off, stmt in stmts:
        if not stmt.strip():
            continue
        total += 1
        line = src[:off].count('\n') + 1
        try:
            cur.execute(stmt)
        except Exception as e:
            print(f'ERROR en statement {total} (linea {line} del archivo):')
            print('  ' + str(e).strip().replace('\n', '\n  '))
            first_lines = stmt.strip().splitlines()[:6]
            print('  Statement:')
            for l in first_lines:
                print('    | ' + l)
            print(f'\nEjecutados OK hasta ahora: {total - 1} / {len([s for _, s in stmts if s.strip()])}')
            sys.exit(1)
    print(f'OK: los {total} statements se ejecutaron sin error.')
    conn.close()


if __name__ == '__main__':
    run(reset='--no-reset' not in sys.argv)
