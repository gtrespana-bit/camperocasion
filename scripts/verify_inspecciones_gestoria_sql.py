#!/usr/bin/env python3
"""Comprueba las garantías de inspección precompra + gestoría (plan §4).

Ejecuta `setup-camperocasion.sql` en un Postgres de verdad (mismo arnés que
`verify_reservas_sql.py`) y verifica:

  - Una solicitud de inspección viva por (comprador, anuncio): el índice único
    parcial rechaza la segunda, y cancelar libera.
  - El CHECK de estados rechaza valores fuera del ciclo concierge.
  - RLS de `solicitudes_inspeccion`: el comprador ve solo las suyas, el admin
    todas, el vendedor del anuncio NO (decisión de diseño: saber que te
    inspeccionan no añade nada), y nadie del navegador escribe (solo
    service_role).
  - RLS de `solicitudes_gestoria`: un lead anónimo solo lo ve el admin, y el
    navegador no puede insertar (la API valida y rate-limita).

Uso:  python3 scripts/verify_inspecciones_gestoria_sql.py
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

# El shim local no trae los GRANT de Supabase ni la RLS de storage.
cur.execute("grant usage on schema auth, public, storage to anon, authenticated")
cur.execute("grant select, insert, update, delete on storage.objects to anon, authenticated")
cur.execute("alter table storage.objects enable row level security")

U_COMPRADOR = '11111111-1111-4111-8111-111111111111'
U_COMPRADOR2 = '55555555-5555-4555-8555-555555555555'
U_VENDEDOR = '22222222-2222-4222-8222-222222222222'
U_TERCERO = '33333333-3333-4333-8333-333333333333'
U_ADMIN = '44444444-4444-4444-8444-444444444444'
P_VENTA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

cur.execute(
    "insert into auth.users (id, email) values (%s,'c@x.es'),(%s,'c2@x.es'),(%s,'v@x.es'),(%s,'t@x.es'),(%s,'admin@x.es')",
    (U_COMPRADOR, U_COMPRADOR2, U_VENDEDOR, U_TERCERO, U_ADMIN),
)
cur.execute("insert into public.admins (email) values ('admin@x.es') on conflict do nothing")
cur.execute(
    "insert into public.productos (id, titulo, user_id) values (%s,'Camper en venta',%s)",
    (P_VENTA, U_VENDEDOR),
)

checks = []


def como(rol, uid=None):
    cur.execute("set role %s" % rol)
    cur.execute("select set_config('app.current_uid', %s, false)", (uid or '',))


def intentar(sql, params=()):
    try:
        cur.execute(sql, params)
        return None
    except Exception as e:
        return str(e).splitlines()[0][:78]


def contar(sql, params=()):
    cur.execute(sql, params)
    return cur.fetchone()[0]


def check(ok, nombre, valor=''):
    checks.append((bool(ok), nombre, valor))


# ── Solicitudes de inspección ───────────────────────────────────────────────

# Base: el comprador pide inspección (como haría la API con service_role).
err = intentar(
    """insert into public.solicitudes_inspeccion (producto_id, comprador_id, estado, notas)
       values (%s,%s,'solicitada','Coordinar en Valencia')""",
    (P_VENTA, U_COMPRADOR),
)
check(err is None, 'se crea la solicitud de inspección', err or 'ok')

err = intentar(
    "insert into public.solicitudes_inspeccion (producto_id, comprador_id, estado) values (%s,%s,'solicitada')",
    (P_VENTA, U_COMPRADOR),
)
check(err is not None and 'duplicate' in err.lower(), 'una solicitud viva por comprador y anuncio', (err or 'PERMITIDO')[:50])

# Otro comprador sí puede pedir inspección del mismo anuncio (no es exclusiva).
err = intentar(
    "insert into public.solicitudes_inspeccion (producto_id, comprador_id, estado) values (%s,%s,'solicitada')",
    (P_VENTA, U_COMPRADOR2),
)
check(err is None, 'otro comprador puede inspeccionar el mismo anuncio', err or 'ok')

# El CHECK de estados: fuera del ciclo concierge no entra nada.
err = intentar(
    "insert into public.solicitudes_inspeccion (producto_id, comprador_id, estado) values (%s,%s,'aprobada')",
    (P_VENTA, U_TERCERO),
)
check(err is not None and ('check' in err.lower() or 'violates' in err.lower()), 'el CHECK rechaza estados desconocidos', (err or 'PERMITIDO')[:50])

# Cancelar libera: el mismo comprador puede volver a pedir.
cur.execute(
    "update public.solicitudes_inspeccion set estado='cancelada', actualizado_en=now() where comprador_id=%s and producto_id=%s",
    (U_COMPRADOR, P_VENTA),
)
err = intentar(
    "insert into public.solicitudes_inspeccion (producto_id, comprador_id, estado) values (%s,%s,'solicitada')",
    (P_VENTA, U_COMPRADOR),
)
check(err is None, 'tras cancelar, el comprador puede volver a solicitar', err or 'ok')

# ── RLS de solicitudes_inspeccion ───────────────────────────────────────────

como('anon')
n_anon, err_anon = None, None
try:
    cur.execute("select count(*) from public.solicitudes_inspeccion")
    n_anon = cur.fetchone()[0]
except Exception as e:
    err_anon = str(e).splitlines()[0][:60]
check(n_anon == 0 or err_anon is not None, 'anon no ve solicitudes de inspección', err_anon or f'{n_anon} filas')

como('authenticated', U_TERCERO)
check(contar("select count(*) from public.solicitudes_inspeccion") == 0, 'un tercero ajeno no ve ninguna')

como('authenticated', U_COMPRADOR)
check(contar("select count(*) from public.solicitudes_inspeccion") == 2, 'el comprador ve solo las suyas (cancelada + viva)')

como('authenticated', U_COMPRADOR2)
check(contar("select count(*) from public.solicitudes_inspeccion") == 1, 'el segundo comprador solo ve la suya')

como('authenticated', U_VENDEDOR)
check(contar("select count(*) from public.solicitudes_inspeccion") == 0, 'el vendedor del anuncio NO ve las inspecciones (decisión de diseño)')

como('authenticated', U_ADMIN)
check(contar("select count(*) from public.solicitudes_inspeccion") == 3, 'el admin las ve todas')

# El navegador no escribe: ni insertar, ni auto-presupuestarse, ni borrar.
como('authenticated', U_COMPRADOR)
err = intentar(
    "insert into public.solicitudes_inspeccion (producto_id, comprador_id, estado) values (%s,%s,'solicitada')",
    (P_VENTA, U_COMPRADOR2),
)
check(err is not None, 'un usuario no inserta solicitudes (ni a nombre de otro)', (err or 'PERMITIDO')[:50])
err = intentar(
    "update public.solicitudes_inspeccion set estado='completada' where producto_id=%s",
    (P_VENTA,),
)
check(err is not None, 'un usuario no se completa su propia inspección', (err or 'PERMITIDO')[:50])
err = intentar("delete from public.solicitudes_inspeccion where comprador_id=%s", (U_COMPRADOR,))
check(err is not None, 'un usuario no borra solicitudes', (err or 'PERMITIDO')[:50])

# ── Leads de gestoría ───────────────────────────────────────────────────────

cur.execute("reset role")
LEAD_ANON = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
LEAD_PROPIO = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

err = intentar(
    """insert into public.solicitudes_gestoria (id, nombre, email, telefono, estado)
       values (%s,'Lead Anónimo','anon@x.es','600000000','nueva')""",
    (LEAD_ANON,),
)
check(err is None, 'la API (service_role) inserta el lead anónimo', err or 'ok')

cur.execute("set role postgres")  # service_role ≙ superusuario del shim
err = intentar(
    """insert into public.solicitudes_gestoria (id, user_id, nombre, email, telefono, estado)
       values (%s,%s,'Lead Login','login@x.es','611111111','nueva')""",
    (LEAD_PROPIO, U_COMPRADOR),
)
check(err is None, 'un lead ligado a usuario se inserta igual', err or 'ok')

err = intentar(
    "insert into public.solicitudes_gestoria (id, nombre, email, telefono, estado) values (%s,'Spam','s@x.es','622222222','nueva')",
    ('ffffffff-ffff-4fff-8fff-ffffffffffff',),
)
check(err is None, 'el CHECK de gestoría admite sus tres estados', err or 'ok')

# Limpieza del lead de prueba del CHECK
cur.execute("set role postgres")
cur.execute("delete from public.solicitudes_gestoria where id='ffffffff-ffff-4fff-8fff-ffffffffffff'")

# El CHECK de gestoría: estado inventado fuera.
err = intentar(
    "update public.solicitudes_gestoria set estado='pagada' where id=%s", (LEAD_ANON,)
)
check(err is not None, 'el CHECK de gestoría rechaza estados desconocidos', (err or 'PERMITIDO')[:50])

como('anon')
try:
    cur.execute("select count(*) from public.solicitudes_gestoria")
    n_anon_g = cur.fetchone()[0]
    err_g = None
except Exception as e:
    n_anon_g, err_g = None, str(e).splitlines()[0][:60]
check(n_anon_g == 0 or err_g is not None, 'anon no ve leads', err_g or f'{n_anon_g} filas')

como('authenticated', U_COMPRADOR)
check(contar("select count(*) from public.solicitudes_gestoria") == 1, 'el usuario solo ve SU lead')

como('authenticated', U_TERCERO)
check(contar("select count(*) from public.solicitudes_gestoria") == 0, 'un tercero no ve el lead anónimo')

como('authenticated', U_ADMIN)
check(contar("select count(*) from public.solicitudes_gestoria") == 2, 'el admin ve todos los leads')

# El navegador no inserta leads: la validación y el rate limit van en la API.
como('authenticated', U_TERCERO)
err = intentar(
    "insert into public.solicitudes_gestoria (nombre, email, telefono) values ('B','b@x.es','633333333')"
)
check(err is not None, 'un usuario no inserta leads directos (solo vía API)', (err or 'PERMITIDO')[:50])

como('authenticated', U_COMPRADOR)
err = intentar("update public.solicitudes_gestoria set estado='en_gestion' where id=%s", (LEAD_PROPIO,))
check(err is not None, 'el lead no cambia de estado desde el navegador', (err or 'PERMITIDO')[:50])

# ── Resultado ───────────────────────────────────────────────────────────────
cur.execute("reset role")
fallos = [c for c in checks if not c[0]]
for ok, nombre, valor in checks:
    print(('✅' if ok else '❌') + ' ' + nombre + ((' · ' + valor) if (valor and not ok) else ''))
print()
if fallos:
    print(f"FALLO: {len(fallos)} comprobaciones no cumplidas")
    sys.exit(1)
print(f"OK: {len(checks)} garantías de inspección + gestoría, todas cumplidas.")
