#!/usr/bin/env python3
"""Comprueba las garantías de la reserva con señal (Fase 1.2).

Ejecuta `setup-camperocasion.sql` en un Postgres de verdad (mismo arnés que
`validate_setup_sql.py`) y verifica:

  - Un anuncio no puede tener dos reservas vivas a la vez.
  - El flag `productos.reservado` se propaga desde la reserva y se limpia al
    cancelar, expirar o vender.
  - Marcar el anuncio como vendido cierra las reservas vivas.
  - RLS: solo el comprador, el vendedor y el admin ven la reserva.
  - Storage: cada parte sube/lee su carpeta, el vendedor lee el comprobante de su
    anuncio (helper SECURITY DEFINER) y un tercero no ve nada.

Uso:  python3 scripts/verify_reservas_sql.py
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
U_VENDEDOR = '22222222-2222-4222-8222-222222222222'
U_TERCERO = '33333333-3333-4333-8333-333333333333'
U_ADMIN = '44444444-4444-4444-8444-444444444444'
# Segundo comprador: reserva tras cancelar la primera. Separado del "tercero"
# para que la comprobación de RLS sea inequívoca.
U_COMPRADOR2 = '55555555-5555-4555-8555-555555555555'
P_VENTA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
P_OTRO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
R_VIVA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

cur.execute(
    "insert into auth.users (id, email) values (%s,'c@x.es'),(%s,'v@x.es'),(%s,'t@x.es'),(%s,'admin@x.es'),(%s,'c2@x.es')",
    (U_COMPRADOR, U_VENDEDOR, U_TERCERO, U_ADMIN, U_COMPRADOR2),
)
cur.execute("insert into public.admins (email) values ('admin@x.es') on conflict do nothing")
cur.execute(
    "insert into public.productos (id, titulo, user_id) values (%s,'Camper en venta',%s),(%s,'Otro anuncio',%s)",
    (P_VENTA, U_VENDEDOR, P_OTRO, U_VENDEDOR),
)
cur.execute(
    """insert into public.reservas (id, producto_id, comprador_id, vendedor_id, importe, estado, expira_en)
       values (%s, %s, %s, %s, 300, 'en_revision', now() + interval '5 days')""",
    (R_VIVA, P_VENTA, U_COMPRADOR, U_VENDEDOR),
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


def contar_o_sin_permiso(sql, params=()):
    """Devuelve (n, error). `anon` no tiene ni GRANT sobre la tabla: que falle con
    "permission denied" es un resultado válido (y más fuerte) que ver 0 filas."""
    try:
        cur.execute(sql, params)
        return cur.fetchone()[0], None
    except Exception as e:
        return None, str(e).splitlines()[0][:60]


def check(ok, nombre, valor=''):
    checks.append((bool(ok), nombre, valor))


# ── Propagación a productos ────────────────────────────────────────────────
check(
    contar("select reservado from public.productos where id=%s", (P_VENTA,)) is True,
    'la reserva viva marca el anuncio como reservado',
)
check(
    contar("select reservado_hasta is not null from public.productos where id=%s", (P_VENTA,)) is True,
    'la fecha de reserva se propaga al anuncio',
)
check(
    contar("select reservado from public.productos where id=%s", (P_OTRO,)) is False,
    'otros anuncios no se ven afectados',
)

# ── Una reserva viva por anuncio ───────────────────────────────────────────
err = intentar(
    """insert into public.reservas (producto_id, comprador_id, vendedor_id, importe, estado)
       values (%s,%s,%s,300,'pendiente_pago')""",
    (P_VENTA, U_TERCERO, U_VENDEDOR),
)
check(err is not None and 'duplicate' in err.lower(), 'no se pueden tener dos reservas vivas del mismo anuncio', (err or 'PERMITIDO')[:50])

# ── Cancelar libera el anuncio ─────────────────────────────────────────────
cur.execute("update public.reservas set estado='cancelada', actualizado_en=now() where id=%s", (R_VIVA,))
check(
    contar("select reservado from public.productos where id=%s", (P_VENTA,)) is False,
    'al cancelar la reserva, el anuncio vuelve a estar libre',
)
check(
    contar("select reservado_hasta from public.productos where id=%s", (P_VENTA,)) is None,
    'la fecha de reserva se limpia al cancelar',
)

# Tras cancelar sí se puede reservar de nuevo
err = intentar(
    """insert into public.reservas (producto_id, comprador_id, vendedor_id, importe, estado)
       values (%s,%s,%s,350,'pendiente_pago')""",
    (P_VENTA, U_COMPRADOR2, U_VENDEDOR),
)
check(err is None, 'tras cancelar, otra persona puede reservar', err or 'ok')

# ── Expiración ─────────────────────────────────────────────────────────────
cur.execute(
    """update public.reservas set expira_en = now() - interval '1 day'
        where producto_id=%s and estado='pendiente_pago'""",
    (P_VENTA,),
)
check(
    contar("select reservado from public.productos where id=%s", (P_VENTA,)) is False,
    'una reserva caducada deja de bloquear el anuncio',
)

# ── Vender cierra las reservas vivas ───────────────────────────────────────
cur.execute(
    """update public.reservas set expira_en = now() + interval '5 days' where producto_id=%s""",
    (P_VENTA,),
)
check(contar("select reservado from public.productos where id=%s", (P_VENTA,)) is True, 'reactivar la reserva vuelve a bloquear')
cur.execute("update public.productos set vendido = true, activo = false where id=%s", (P_VENTA,))
check(
    contar("select count(*) from public.reservas where producto_id=%s and estado='completada'", (P_VENTA,)) == 1,
    'vender el anuncio completa la reserva viva',
)
check(
    contar("select reservado from public.productos where id=%s", (P_VENTA,)) is False,
    'un anuncio vendido queda sin marca de reservado',
)

# ── RLS de la tabla ────────────────────────────────────────────────────────
como('anon')
n_anon, err_anon = contar_o_sin_permiso("select count(*) from public.reservas")
check(n_anon == 0 or err_anon is not None, 'anon no puede leer reservas', err_anon or f'{n_anon} filas')

como('authenticated', U_TERCERO)
check(contar("select count(*) from public.reservas") == 0, 'un tercero ajeno a la reserva no ve nada')

como('authenticated', U_COMPRADOR)
check(contar("select count(*) from public.reservas") == 1, 'el primer comprador ve solo su reserva')

como('authenticated', U_COMPRADOR2)
check(contar("select count(*) from public.reservas") == 1, 'el segundo comprador ve solo la suya')

como('authenticated', U_VENDEDOR)
check(contar("select count(*) from public.reservas") == 2, 'el vendedor ve las reservas de su anuncio')

como('authenticated', U_ADMIN)
check(contar("select count(*) from public.reservas") == 2, 'el admin ve todas las reservas')

# El navegador no puede escribir: solo la API con service_role
como('authenticated', U_COMPRADOR)
err = intentar("update public.reservas set estado='activa' where id=%s", (R_VIVA,))
check(err is not None, 'un usuario no puede activarse su propia reserva', (err or 'PERMITIDO')[:50])
err = intentar("delete from public.reservas where id=%s", (R_VIVA,))
check(err is not None, 'un usuario no puede borrar la reserva', (err or 'PERMITIDO')[:50])

# ── Storage del comprobante ────────────────────────────────────────────────
como('authenticated', U_COMPRADOR)
check(
    intentar(
        "insert into storage.objects (bucket_id, name, owner) values ('comprobantes-reserva', %s, %s)",
        (f'{U_COMPRADOR}/{R_VIVA}/bizum.jpg', U_COMPRADOR),
    ) is None,
    'el comprador sube el comprobante a su carpeta',
)
check(
    intentar(
        "insert into storage.objects (bucket_id, name, owner) values ('comprobantes-reserva', %s, %s)",
        (f'{U_TERCERO}/{R_VIVA}/falso.jpg', U_COMPRADOR),
    ) is not None,
    'el comprador no puede subir a la carpeta de otro',
)

como('authenticated', U_VENDEDOR)
check(
    contar("select count(*) from storage.objects where bucket_id='comprobantes-reserva'") == 1,
    'el vendedor ve el comprobante de la reserva de su anuncio',
)

como('authenticated', U_TERCERO)
check(
    contar("select count(*) from storage.objects where bucket_id='comprobantes-reserva'") == 0,
    'un tercero no ve el comprobante',
)

como('authenticated', U_ADMIN)
check(
    contar("select count(*) from storage.objects where bucket_id='comprobantes-reserva'") == 1,
    'el admin ve el comprobante para revisarlo',
)

como('anon')
n_anon_obj, err_anon_obj = contar_o_sin_permiso(
    "select count(*) from storage.objects where bucket_id='comprobantes-reserva'"
)
check(n_anon_obj == 0 or err_anon_obj is not None, 'anon no ve ningún comprobante', err_anon_obj or f'{n_anon_obj} objetos')

cur.execute("reset role")

anchos = max(len(n) for _, n, _ in checks)
for ok, nombre, valor in checks:
    print(f"{'✓' if ok else '✗'} {nombre.ljust(anchos)}  {valor}")

print()
print('TODOS OK' if all(ok for ok, _, _ in checks) else 'HAY FALLOS')
conn.close()
sys.exit(0 if all(ok for ok, _, _ in checks) else 1)
