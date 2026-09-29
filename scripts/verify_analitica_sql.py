#!/usr/bin/env python3
"""Comprueba las garantías de la analítica propia y de los regalos de plan
(migración `202609290001_analitica_visitas.sql`).

Por qué existe: la primera versión de esa migración revocaba permisos y daba por
hecho los privilegios por defecto de Supabase. En un Postgres donde no se cumplen
(el arnés de esta CI), `service_role` —el rol con el que escriben las API— no
podía insertar visitas, ni llamar a la RPC de agregados, ni anotar regalos, y el
fallo no se veía hasta producción. Aquí queda fijado para siempre:

  - `anon` y `authenticated` (el navegador) NO pueden leer visitas, regalos ni
    ejecutar las funciones: ni por permisos ni por RLS.
  - `service_role` (la API) SÍ puede: insertar páginas vistas, actualizar la
    duración, leer los agregados, limpiar por retención y escribir/leer la
    bitácora de regalos.
  - La RPC agrupa bien: totales, visitantes únicos y serie por día/semana/mes.
  - `limpiar_visitas_antiguas` respeta un mínimo de 30 días (no se puede usar
    para vaciar la tabla de un plumazo).
  - `planes_regalos` rechaza planes y modos que no existen.

Uso:  python3 scripts/verify_analitica_sql.py
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

# El shim local no trae los GRANT de Supabase sobre el esquema.
cur.execute("grant usage on schema auth, public to anon, authenticated")

U_PRO = '11111111-1111-4111-8111-111111111111'
P_ANUNCIO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

# El alta en auth.users dispara el trigger que crea el perfil: el insert
# explícito va con `on conflict` (mismo patrón que verify_boost_sql.py).
cur.execute(
    "insert into auth.users (id, email) values (%s,'taller@x.es') on conflict (id) do nothing",
    (U_PRO,),
)
cur.execute(
    "insert into public.perfiles (id, nombre, tipo_vendedor) values (%s,'Taller Norte','profesional') "
    "on conflict (id) do update set nombre = 'Taller Norte', tipo_vendedor = 'profesional'",
    (U_PRO,),
)
cur.execute(
    "insert into public.productos (id, titulo, slug, user_id, activo, vendido, precio_usd, creado_en) "
    "values (%s,'VW California','vw-california',%s,true,false,45000, now() - interval '2 hours')",
    (P_ANUNCIO, U_PRO),
)

checks = []


def como(rol, uid=None):
    cur.execute("set role %s" % rol)
    if uid is not None:
        cur.execute("select set_config('app.current_uid', %s, false)", (uid,))


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


# ── service_role: la API puede hacer su trabajo ─────────────────────────────
como('service_role')
check(
    intentar(
        """insert into public.visitas_pagina
             (creado_en, visitante_id, sesion_id, ruta, tipo, dispositivo, idioma, referrer_host, duracion_segundos, producto_id)
           values
             (now() - interval '1 day',  'vis-a1b2c3d4', 'ses-1', '/',            'home',     'movil',      'es', 'google.com', null, null),
             (now() - interval '1 day',  'vis-a1b2c3d4', 'ses-1', '/catalogo',    'catalogo', 'movil',      'es', null,         null, null),
             (now() - interval '2 hours', 'vis-e5f6g7h8', 'ses-2', '/producto/vw-california', 'producto', 'escritorio', 'es', 'instagram.com', 120, %s)"""
        % ("'" + P_ANUNCIO + "'"),
    )
    is None,
    'service_role inserta páginas vistas',
)

check(
    intentar(
        "update public.visitas_pagina set duracion_segundos = 45 "
        "where visitante_id = 'vis-a1b2c3d4' and ruta = '/' and duracion_segundos is null"
    )
    is None,
    'service_role cierra la duración de la página anterior',
)

rpc = None
try:
    cur.execute("select public.analitica_visitas(now() - interval '7 days', now() + interval '1 day', 'dia') as r")
    rpc = cur.fetchone()[0]
except Exception as e:
    rpc = None
    check(False, 'service_role puede llamar a analitica_visitas', str(e).splitlines()[0][:60])

if rpc:
    check(rpc['visitas'] == 3, 'la RPC cuenta las 3 páginas vistas', str(rpc['visitas']))
    check(rpc['visitantes'] == 2, 'la RPC cuenta 2 visitantes únicos', str(rpc['visitantes']))
    check(rpc['sesiones'] == 2, 'la RPC cuenta 2 sesiones', str(rpc['sesiones']))
    check(
        any(p['clave'] == '/producto/vw-california' and p['visitas'] == 1 for p in rpc['topPaginas']),
        'el top de páginas incluye la ficha del anuncio',
    )
    check(
        len(rpc['topProductos']) == 1 and rpc['topProductos'][0]['titulo'] == 'VW California',
        'el top de anuncios cruza con productos',
    )
    check(
        any(f['clave'] == 'google.com' for f in rpc['fuentes']),
        'las fuentes de tráfico se agrupan por host',
    )
    check(len(rpc['horas']) >= 1 and len(rpc['diasSemana']) >= 1, 'hay horas y días con datos')
    # Las dos primeras páginas vistas se insertaron sin duración; la tercera
    # (120 s) sí la trae, y el `update` de arriba cerró la portada en 45 s.
    check(rpc['duracionMuestras'] == 2, 'solo cuenta las duraciones cerradas', str(rpc['duracionMuestras']))
    check(rpc['duracionTotal'] == 165, 'suma 45 + 120 = 165 s de tiempo en página', str(rpc['duracionTotal']))

    # Agrupación por semana y por mes: la misma visita no puede perderse.
    cur.execute("select public.analitica_visitas(now() - interval '60 days', now() + interval '1 day', 'semana') as r")
    semanal = cur.fetchone()[0]
    cur.execute("select public.analitica_visitas(now() - interval '1 year', now() + interval '1 day', 'mes') as r")
    mensual = cur.fetchone()[0]
    check(semanal['visitas'] == 3, 'la granularidad semanal suma lo mismo', str(semanal['visitas']))
    check(mensual['visitas'] == 3, 'la granularidad mensual suma lo mismo', str(mensual['visitas']))
    check(
        intentar("select public.analitica_visitas(now() - interval '1 day', now(), 'basura') as r") is None,
        'una granularidad inválida no rompe (cae a día)',
    )

check(
    intentar("select public.limpiar_visitas_antiguas(400) as n") is None,
    'service_role puede limpiar por retención',
)
# Un borrado agresivo no puede vaciar la tabla: hay un mínimo de 30 días.
cur.execute("select public.limpiar_visitas_antiguas(0) as n")
check(contar("select count(*) from public.visitas_pagina") == 3, 'la retención mínima es 30 días')

check(
    intentar(
        "insert into public.planes_regalos (user_id, plan, dias, modo, motivo, admin_email) "
        "values (%s,'unlimited',90,'extender','colaboración','admin@camperocasion.online')",
        (U_PRO,),
    )
    is None,
    'service_role anota un regalo en la bitácora',
)
check(contar("select count(*) from public.planes_regalos") == 1, 'la bitácora guarda el regalo')
check(
    intentar(
        "insert into public.planes_regalos (user_id, plan, dias) values (%s,'oro',10)", (U_PRO,)
    )
    is not None,
    'la bitácora rechaza un plan que no existe',
)
check(
    intentar(
        "insert into public.planes_regalos (user_id, plan, dias, modo) values (%s,'plus',10,'inventado')",
        (U_PRO,),
    )
    is not None,
    'la bitácora rechaza un modo que no existe',
)

# ── El navegador no ve nada ─────────────────────────────────────────────────
for rol in ('anon', 'authenticated'):
    como(rol, U_PRO if rol == 'authenticated' else None)
    for nombre, sql in (
        ('la RPC de agregados', "select public.analitica_visitas(now() - interval '1 day', now(), 'dia')"),
        ('la tabla de visitas', 'select count(*) from public.visitas_pagina'),
        ('la bitácora de regalos', 'select count(*) from public.planes_regalos'),
        ('la limpieza por retención', 'select public.limpiar_visitas_antiguas(1)'),
    ):
        check(intentar(sql) is not None, f'{rol} no puede tocar {nombre}')

como('authenticated', U_PRO)
check(
    intentar("insert into public.visitas_pagina (visitante_id, ruta) values ('vis-falso1234','/')") is not None,
    'un usuario no puede inyectarse visitas',
)

cur.execute('reset role')
conn.close()

anchos = max(len(n) for _, n, _ in checks)
for ok, nombre, valor in checks:
    print(f"{'✓' if ok else '✗'} {nombre.ljust(anchos)}  {valor}")

print()
print('TODOS OK' if all(ok for ok, _, _ in checks) else 'HAY FALLOS')
sys.exit(0 if all(ok for ok, _, _ in checks) else 1)
