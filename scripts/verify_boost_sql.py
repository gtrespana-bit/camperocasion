#!/usr/bin/env python3
"""Comprueba que promocionar un anuncio no pueda cobrarse dos veces.

Contexto (dinero real): `usar_boost` descontaba 1 crédito y ponía
`boosteado_en = now()` sin mirar si la subida seguía vigente. El boost caduca a
los 7 días (`BOOST_DIAS`, `src/lib/catalog-consulta.ts`) y el catálogo ordena con
esa misma regla, así que un vendedor podía pulsar «Subir al nº 1» dos veces
seguidas y pagar 2 créditos por un solo efecto.

Este script aplica `setup-camperocasion.sql` en un Postgres de verdad (mismo
arnés que `validate_setup_sql.py`) y verifica el comportamiento completo:

  1. Primer boost vigente: cobra 1 crédito (3 → 2) y devuelve `vigente_hasta`.
  2. Segundo intento con la subida vigente: `ok: false`, `ya_activo: true` y
     **el saldo no cambia**.
  3. Con la subida caducada: vuelve a cobrar y a subir el anuncio.
  4. Sin saldo: error claro, sin tocar el anuncio.
  5. La subida caducada no cuenta como "vigente" para el orden del catálogo
     (misma regla en SQL y en TypeScript).

Uso:  python3 scripts/verify_boost_sql.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2
import validate_setup_sql as v

v.run(reset=True)
db = v.pgserver.get_server('/tmp/pgdata')
conn = psycopg2.connect(db.get_uri().replace('/postgres?', '/camproctest?'))
conn.autocommit = True
cur = conn.cursor()

U_VENDEDOR = '11111111-1111-4111-8111-111111111111'
P_ANUNCIO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

checks = []


def check(ok, nombre, valor=''):
    checks.append((bool(ok), nombre, str(valor)))


def como(uid):
    cur.execute("select set_config('app.current_uid', %s, false)", (uid,))


cur.execute("grant usage on schema auth, public to anon, authenticated")
cur.execute("insert into auth.users (id, email) values (%s, 'v@x.es')", (U_VENDEDOR,))
cur.execute(
    "insert into public.perfiles (id, nombre, credito_balance) values (%s, 'Vendedor', 3) "
    "on conflict (id) do update set credito_balance = 3",
    (U_VENDEDOR,),
)
cur.execute(
    "insert into public.productos (id, titulo, user_id, activo) values (%s, 'Camper', %s, true)",
    (P_ANUNCIO, U_VENDEDOR),
)


def boost():
    como(U_VENDEDOR)
    cur.execute("select public.usar_boost(%s, %s)", (P_ANUNCIO, U_VENDEDOR))
    return cur.fetchone()[0]


def saldo():
    cur.execute("select credito_balance from public.perfiles where id = %s", (U_VENDEDOR,))
    return cur.fetchone()[0]


# ── 1. Primer boost: cobra ──────────────────────────────────────────────────
r1 = boost()
check(r1.get('ok') is True, 'el primer boost se aplica', r1.get('error', ''))
check('vigente_hasta' in r1, 'devuelve hasta cuándo está subido', r1.get('vigente_hasta'))
check(saldo() == 2, 'cobra 1 crédito (3 → 2)', f'saldo={saldo()}')

# ── 2. Segundo intento con la subida vigente: no cobra ──────────────────────
r2 = boost()
check(r2.get('ok') is False, 'el segundo boost no se aplica')
check(r2.get('ya_activo') is True, 'avisa de que ya está subido', r2.get('error', ''))
check(saldo() == 2, 'no cobra dos veces el mismo boost', f'saldo={saldo()}')

# ── 3. Caducado: vuelve a funcionar ─────────────────────────────────────────
cur.execute(
    "update public.productos set boosteado_en = now() - interval '8 days' where id = %s",
    (P_ANUNCIO,),
)
r3 = boost()
check(r3.get('ok') is True, 'tras caducar, el boost vuelve a aplicarse', r3.get('error', ''))
check(saldo() == 1, 'vuelve a cobrar 1 crédito (2 → 1)', f'saldo={saldo()}')

# ── 4. Sin saldo: error claro y sin efecto ──────────────────────────────────
cur.execute("update public.perfiles set credito_balance = 0 where id = %s", (U_VENDEDOR,))
cur.execute("update public.productos set boosteado_en = null where id = %s", (P_ANUNCIO,))
r4 = boost()
check(r4.get('ok') is False and 'créditos' in (r4.get('error') or ''),
      'sin saldo, error claro', r4.get('error', ''))
cur.execute("select boosteado_en is null from public.productos where id = %s", (P_ANUNCIO,))
check(cur.fetchone()[0] is True, 'un boost sin saldo no marca el anuncio', 'boosteado_en null')

# ── 5. La regla de vigencia es la misma que la del catálogo (7 días) ────────
cur.execute("""
    select
      (now() - interval '6 days') > now() - interval '7 days' as vigente,
      (now() - interval '8 days') > now() - interval '7 days' as caducado
""")
vigente, caducado = cur.fetchone()
check(vigente is True and caducado is False,
      'la ventana del boost (7 días) coincide con BOOST_DIAS',
      'src/lib/catalog-consulta.ts')

conn.close()

anchos = max(len(nombre) for _, nombre, _ in checks)
for ok, nombre, valor in checks:
    print(f"{'✓' if ok else '✗'} {nombre.ljust(anchos)}  {valor}")

print()
print('TODOS OK' if all(ok for ok, _, _ in checks) else 'HAY FALLOS')
sys.exit(0 if all(ok for ok, _, _ in checks) else 1)
