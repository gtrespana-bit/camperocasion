#!/usr/bin/env python3
"""Verifica en un Postgres real los puntos 1, 2 y 7 de la auditoría de 2026-10-27.

Por qué existe
--------------
`validate_migrations_sql.py` comprueba que el SQL se APLICA, no que los
permisos y la semántica sean los que queremos. Un `revoke ... from public` se
aplica perfectamente y deja la función ejecutable por `authenticated` en
Supabase (privilegios por defecto explícitos). Este script fija para siempre:

  1. `aplicar_cupo_planes()` NO es ejecutable por anon/authenticated, SÍ por
     service_role, y además rechaza dentro del cuerpo un JWT de navegador.
  2. La pausa por cupo es idempotente: una segunda pasada del cron no vuelve a
     pausar anuncios y no desplaza el ranking (el CTE solo mira activos).
  3. `check_rate_limit_dual()` decide usuario + IP en una sola transacción y
     no consume el cupo de usuario cuando el de IP está lleno.

Uso:  python3 scripts/verify_cupo_planes_sql.py
"""
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2

import validate_setup_sql as v

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRACIONES = os.path.join(RAIZ, 'supabase', 'migrations')

VENDEDOR = '33333333-3333-4333-8333-333333333333'
PRODUCTOS = [
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03',
]

checks = []


def check(ok, nombre, valor=''):
    checks.append((bool(ok), nombre, valor))


def aplicar(cur, nombres):
    for nombre in nombres:
        src = open(os.path.join(MIGRACIONES, nombre), encoding='utf-8').read()
        for _off, stmt in v.split_statements(src):
            if not re.sub(r'(?s)--[^\n]*|/\*.*?\*/', '', stmt).strip():
                continue
            cur.execute(stmt)


def contar(cur, sql, params=()):
    cur.execute(sql, params)
    return cur.fetchone()[0]


def privilegio(cur, rol, firma):
    cur.execute('select has_function_privilege(%s, %s, \'EXECUTE\')', (rol, firma))
    return cur.fetchone()[0]


def main():
    v.run(reset=True)
    db = v.pgserver.get_server('/tmp/pgdata')
    conn = psycopg2.connect(db.get_uri().replace('/postgres?', '/camproctest?'))
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute('grant usage on schema auth, public to anon, authenticated')

    # ── Estado VULNERABLE: setup + era 202609 + la migración de dunning ──────
    anteriores = [os.path.basename(p) for p in sorted(glob.glob(os.path.join(MIGRACIONES, '202609*.sql')))]
    aplicar(cur, anteriores + ['202610220001_planes_prueba_gracia_dunning.sql'])

    # Simula los ALTER DEFAULT PRIVILEGES de Supabase sobre el esquema public:
    # grants explícitos que sobreviven a `revoke ... from public`.
    cur.execute('grant execute on function public.aplicar_cupo_planes(timestamptz) to anon, authenticated')
    firma = 'public.aplicar_cupo_planes(timestamptz)'
    check(
        privilegio(cur, 'authenticated', firma) is True,
        'reproduce el fallo: authenticated SÍ podía ejecutar la RPC',
    )

    # ── Estado CORREGIDO ────────────────────────────────────────────────────
    aplicar(cur, [
        '202610270001_permisos_aplicar_cupo_planes.sql',
        '202610270002_rate_limit_compuesto.sql',
    ])

    check(privilegio(cur, 'anon', firma) is False, 'anon NO ejecuta aplicar_cupo_planes')
    check(privilegio(cur, 'authenticated', firma) is False, 'authenticated NO ejecuta aplicar_cupo_planes')
    check(privilegio(cur, 'service_role', firma) is True, 'service_role SÍ ejecuta aplicar_cupo_planes')

    # Defensa en profundidad: aunque se cuele un grant, el cuerpo rechaza el JWT
    # de navegador (SQLSTATE 42501). Simulamos el GUC que pone PostgREST.
    def llamar_con_jwt(rol):
        cur.execute("select set_config('request.jwt.claim.role', %s, false)", (rol,))
        try:
            cur.execute('select count(*) from public.aplicar_cupo_planes(now())')
            cur.fetchone()
            return None
        except Exception as e:
            return getattr(e, 'pgcode', None)
        finally:
            cur.execute("select set_config('request.jwt.claim.role', '', false)")

    check(llamar_con_jwt('authenticated') == '42501', 'el cuerpo rechaza un JWT authenticated (42501)')
    check(llamar_con_jwt('anon') == '42501', 'el cuerpo rechaza un JWT anon (42501)')
    check(llamar_con_jwt('service_role') is None, 'el cuerpo acepta el JWT service_role del cron')

    firma_dual = 'public.check_rate_limit_dual(text, text, text, integer, bigint, integer)'
    check(privilegio(cur, 'authenticated', firma_dual) is False, 'authenticated NO ejecuta el rate limit dual')
    check(privilegio(cur, 'service_role', firma_dual) is True, 'service_role SÍ ejecuta el rate limit dual')

    # ── Punto 2: idempotencia de la pausa por cupo ───────────────────────────
    cur.execute("insert into auth.users (id, email) values (%s, 'vendedor@x.es')", (VENDEDOR,))
    cur.execute(
        "update public.perfiles set tipo_vendedor = 'particular', plan_anuncios = 'gratis', "
        "trial_hasta = null, plan_hasta = null where id = %s",
        (VENDEDOR,),
    )
    cur.execute('select id from public.categorias order by id limit 1')
    fila = cur.fetchone()
    if fila:
        categoria = fila[0]
    else:
        cur.execute("insert into public.categorias (nombre) values ('camper') returning id")
        categoria = cur.fetchone()[0]

    for i, pid in enumerate(PRODUCTOS):
        cur.execute(
            "insert into public.productos (id, titulo, slug, user_id, categoria_id, activo, vendido, "
            "precio, visitas, creado_en) values (%s, %s, %s, %s, %s, true, false, 1000, %s, now() - (%s || ' minutes')::interval)",
            (pid, 'Furgoneta %d' % i, 'furgoneta-%d' % i, VENDEDOR, categoria, i, str(i + 1)),
        )

    primera = contar(cur, 'select count(*) from public.aplicar_cupo_planes(now())')
    activos_1 = contar(cur, 'select count(*) from public.productos where user_id = %s and activo', (VENDEDOR,))
    check(primera == 2 and activos_1 == 1,
          'primera pasada: pausa 2 y deja 1 activo (cupo gratis)', '%d/%d' % (primera, activos_1))

    segunda = contar(cur, 'select count(*) from public.aplicar_cupo_planes(now())')
    activos_2 = contar(cur, 'select count(*) from public.productos where user_id = %s and activo', (VENDEDOR,))
    pausados_marcados = contar(
        cur, 'select count(*) from public.productos where user_id = %s and pausado_por_plan', (VENDEDOR,),
    )
    check(segunda == 0 and activos_2 == 1 and pausados_marcados == 2,
          'segunda pasada (reintento del cron): NO pausa nada más',
          'nuevas=%d activos=%d marcados=%d' % (segunda, activos_2, pausados_marcados))

    # Reactivar uno de los pausados: el ranking debe recalcularse solo con los
    # activos y pausar exactamente uno, no dos.
    cur.execute(
        'update public.productos set activo = true, pausado_por_plan = false, pausado_en = null '
        'where id = (select id from public.productos where user_id = %s and pausado_por_plan order by id limit 1)',
        (VENDEDOR,),
    )
    tercera = contar(cur, 'select count(*) from public.aplicar_cupo_planes(now())')
    activos_3 = contar(cur, 'select count(*) from public.productos where user_id = %s and activo', (VENDEDOR,))
    check(tercera == 1 and activos_3 == 1,
          'tras reactivar un pausado: pausa solo el que sobra',
          'nuevas=%d activos=%d' % (tercera, activos_3))

    # ── Punto 7: rate limit compuesto ───────────────────────────────────────
    cur.execute('delete from public.rate_limit')

    def rl(usuario, ip, limite_usuario=20, limite_ip=3):
        cur.execute(
            'select public.check_rate_limit_dual(%s, %s, %s, %s, 3600000, %s)',
            ('producto:create', usuario, ip, limite_usuario, limite_ip),
        )
        return cur.fetchone()[0]

    # Tres cuentas distintas, misma IP: la cuarta la bloquea el bucket de IP.
    resultados = [rl('user-%d' % i, '203.0.113.7') for i in range(4)]
    check(all(r['ok'] for r in resultados[:3]) and resultados[3]['ok'] is False,
          'la IP frena la cuarta cuenta en la misma hora')
    check(contar(cur, "select count(*) from public.rate_limit where key = 'producto:create'") == 3,
          'al bloquear la IP no se consume el bucket del usuario (atómico)')

    cur.execute('delete from public.rate_limit')
    # Un mismo usuario cambiando de IP: lo frena su propio bucket a los 2 intentos.
    resultados = [rl('user-fijo', '198.51.100.%d' % i, limite_usuario=2, limite_ip=10) for i in range(3)]
    check(all(r['ok'] for r in resultados[:2]) and resultados[2]['ok'] is False,
          'el usuario sigue teniendo su propio límite')
    check(contar(cur, "select count(*) from public.rate_limit where key = 'producto:create:ip'") == 2,
          'al bloquear el usuario no se consume el bucket de IP')

    cur.execute('reset role')
    conn.close()

    ancho = max(len(n) for _, n, _ in checks)
    for ok, nombre, valor in checks:
        print(f"{'✓' if ok else '✗'} {nombre.ljust(ancho)}  {valor}")
    print()
    print('TODOS OK' if all(ok for ok, _, _ in checks) else 'HAY FALLOS')
    return 0 if all(ok for ok, _, _ in checks) else 1


if __name__ == '__main__':
    sys.exit(main())
