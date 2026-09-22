#!/usr/bin/env python3
"""Comprueba que el cobro con Stripe no pueda acreditar créditos dos veces.

Contexto (dinero real): Stripe **reintenta** los webhooks hasta recibir un 2xx.
Si la acreditación no fuera idempotente, cada reintento sumaría otra vez los
créditos del mismo pago. La defensa es el índice único sobre
`stripe_session_id` más la RPC `acreditar_pago_stripe`, que detecta la sesión ya
procesada y devuelve `duplicado: true` sin tocar el saldo.

Este script aplica `setup-camperocasion.sql` en un Postgres de verdad (mismo
arnés que `validate_setup_sql.py`) y verifica:

  1. Primer abono: crea la transacción y suma los créditos.
  2. Reintento con la MISMA sesión: `duplicado: true` y **el saldo no cambia**.
  3. Sesión distinta: vuelve a acreditar (no se bloquean pagos legítimos).
  4. El índice único sobre `stripe_session_id` existe.
  5. La RPC rechaza importes/créditos no válidos.
  6. `anon` y `authenticated` NO pueden ejecutar la RPC (si pudieran, cualquier
     usuario logueado se regalaría créditos).

Uso:  python3 scripts/verify_stripe_sql.py
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

U_COMPRADOR = '22222222-2222-4222-8222-222222222222'
SESION_A = 'cs_test_aaaaaaaaaaaaaaaa'
SESION_B = 'cs_test_bbbbbbbbbbbbbbbb'

checks = []


def check(ok, nombre, valor=''):
    checks.append((bool(ok), nombre, str(valor)))


# El arnes compartido fija auth.role() = 'authenticated' a secas. El webhook
# corre como service_role, asi que aqui lo hacemos configurable para poder
# probar los dos lados: quien acredita (service_role) y quien no debe (usuario).
cur.execute("""
    create or replace function auth.role() returns text language sql stable as $$
      select coalesce(nullif(current_setting('app.current_role', true), ''), 'authenticated')
    $$
""")
cur.execute("grant usage on schema auth, public to anon, authenticated")


def como_rol(rol):
    cur.execute("select set_config('app.current_role', %s, false)", (rol,))

cur.execute("insert into auth.users (id, email) values (%s, 'c@x.es')", (U_COMPRADOR,))
cur.execute(
    "insert into public.perfiles (id, nombre, credito_balance) values (%s, 'Comprador', 0) "
    "on conflict (id) do update set credito_balance = 0",
    (U_COMPRADOR,),
)


def acreditar(sesion, creditos=15, importe=5.00):
    # El webhook siempre llega como service_role.
    como_rol('service_role')
    cur.execute(
        "select public.acreditar_pago_stripe(%s, %s, %s, %s, %s, %s)",
        (U_COMPRADOR, creditos, sesion, 'pi_test_1', importe, None),
    )
    return cur.fetchone()[0]


def saldo():
    cur.execute("select credito_balance from public.perfiles where id = %s", (U_COMPRADOR,))
    return cur.fetchone()[0]


# ── 1. Primer abono ─────────────────────────────────────────────────────────
r1 = acreditar(SESION_A)
check(r1.get('ok') is True, 'el primer pago se acredita', r1.get('error', ''))
check(r1.get('duplicado') is False, 'el primer pago no se marca como duplicado')
check(saldo() == 15, 'suma los créditos del paquete (0 → 15)', f'saldo={saldo()}')

# ── 2. Reintento del webhook: NO vuelve a cobrar ────────────────────────────
r2 = acreditar(SESION_A)
check(r2.get('ok') is True, 'el reintento responde ok (Stripe deja de reintentar)')
check(r2.get('duplicado') is True, 'el reintento se detecta como duplicado')
check(saldo() == 15, 'un reintento NO duplica créditos', f'saldo={saldo()}')

cur.execute(
    "select count(*) from public.transacciones_creditos where stripe_session_id = %s",
    (SESION_A,),
)
check(cur.fetchone()[0] == 1, 'solo existe una transacción por sesión de Stripe')

# ── 3. Una sesión distinta sí acredita ──────────────────────────────────────
r3 = acreditar(SESION_B, creditos=40, importe=10.00)
check(r3.get('ok') is True and r3.get('duplicado') is False, 'un pago nuevo sí se acredita')
check(saldo() == 55, 'acumula correctamente (15 → 55)', f'saldo={saldo()}')

# ── 4. El índice único existe (es la defensa de verdad) ─────────────────────
cur.execute(
    "select 1 from pg_indexes where indexname = 'transacciones_creditos_stripe_session_key'"
)
check(cur.fetchone() is not None,
      'existe el índice único sobre stripe_session_id',
      'transacciones_creditos_stripe_session_key')

# ── 5. Entradas no válidas ──────────────────────────────────────────────────
r5 = acreditar('cs_test_cero', creditos=0)
check(r5.get('ok') is False, 'rechaza 0 créditos', r5.get('error', ''))
r6 = acreditar('cs_test_neg', creditos=-10)
check(r6.get('ok') is False, 'rechaza créditos negativos', r6.get('error', ''))
check(saldo() == 55, 'las entradas no válidas no tocan el saldo', f'saldo={saldo()}')

# ── 6. Un usuario normal NO puede acreditarse créditos ──────────────────────
cur.execute("""
    select has_function_privilege('anon',
      'public.acreditar_pago_stripe(uuid, integer, text, text, numeric, text)', 'execute')
""")
check(cur.fetchone()[0] is False, 'anon NO puede ejecutar la RPC')

cur.execute("""
    select has_function_privilege('authenticated',
      'public.acreditar_pago_stripe(uuid, integer, text, text, numeric, text)', 'execute')
""")
check(cur.fetchone()[0] is False, 'authenticated NO puede ejecutar la RPC')

# Y el cuerpo tambien lo impide, aunque alguien conceda el permiso por error.
como_rol('authenticated')
cur.execute(
    "select public.acreditar_pago_stripe(%s, %s, %s, null, null, null)",
    (U_COMPRADOR, 100, 'cs_test_ataque'),
)
r_ataque = cur.fetchone()[0]
check(r_ataque.get('ok') is False,
      'un usuario autenticado NO puede autoacreditarse', r_ataque.get('error', ''))
check(saldo() == 55, 'el intento no cambia el saldo', f'saldo={saldo()}')
como_rol('service_role')

cur.execute("""
    select prosecdef from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'acreditar_pago_stripe'
""")
fila = cur.fetchone()
check(fila is not None and fila[0] is True, 'la RPC es security definer')

conn.close()

anchos = max(len(nombre) for _, nombre, _ in checks)
for ok, nombre, valor in checks:
    print(f"{'✓' if ok else '✗'} {nombre.ljust(anchos)}  {valor}")

print()
print('TODOS OK' if all(ok for ok, _, _ in checks) else 'HAY FALLOS')
sys.exit(0 if all(ok for ok, _, _ in checks) else 1)
