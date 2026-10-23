#!/usr/bin/env python3
"""Comprueba la semántica de `rendimiento_vendedor()` contra un Postgres real.

Por qué existe
--------------
`validate_migrations_sql.py` demuestra que las migraciones se APLICAN sin
error, pero no que la función devuelva lo que dice. Un `jsonb_build_object`
con una suma mal puesta se aplica perfectamente y da cifras falsas, que es peor
que un error de sintaxis: nadie se entera.

Este script:
  1. parte del setup completo (`validate_setup_sql`),
  2. aplica las migraciones de la era actual (202609*/202610*),
  3. monta dos vendedores con anuncios, visitas, favoritos, mensajes y ventas,
  4. comprueba los números uno a uno.

Las fechas son relativas a `now()` para que el test no caduque.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2

import validate_setup_sql as v

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

VENDEDOR = '11111111-1111-1111-1111-111111111111'
OTRO = '22222222-2222-2222-2222-222222222222'


def aplicar_migraciones(cur):
    import glob

    for patron in ('202609*.sql', '202610*.sql'):
        for archivo in sorted(glob.glob(os.path.join(RAIZ, 'supabase', 'migrations', patron))):
            src = open(archivo, encoding='utf-8').read()
            for _off, stmt in v.split_statements(src):
                import re

                if not re.sub(r'(?s)--[^\n]*|/\*.*?\*/', '', stmt).strip():
                    continue
                cur.execute(stmt)


def fixtures(cur):
    cur.execute("insert into auth.users (id, email) values (%s, 'taller@example.com')", (VENDEDOR,))
    cur.execute("insert into auth.users (id, email) values (%s, 'otro@example.com')", (OTRO,))
    # El alta en auth.users dispara el trigger que crea el perfil: se actualiza
    # el nombre en vez de insertarlo otra vez.
    cur.execute("update perfiles set nombre = 'Taller' where id = %s", (VENDEDOR,))
    cur.execute("update perfiles set nombre = 'Otro' where id = %s", (OTRO,))

    cur.execute("select id from categorias order by id limit 1")
    fila = cur.fetchone()
    if fila:
        categoria = fila[0]
    else:
        cur.execute("insert into categorias (nombre) values ('camper') returning id")
        categoria = cur.fetchone()[0]

    # Tres anuncios del vendedor: uno activo y bien, uno activísimo sin
    # contactos, uno vendido hace 10 días tras 20 días publicado.
    cur.execute(
        """
        insert into productos (id, user_id, titulo, categoria_id, subcategoria, precio_usd, precio,
                               activo, vendido, vendido_fecha, creado_en)
        values
          ('aaaaaaa1-0000-0000-0000-000000000001', %s, 'Camper A', %s, 'gran-volumen', 30000, 30000,
           true, false, null, now() - interval '60 days'),
          ('aaaaaaa1-0000-0000-0000-000000000002', %s, 'Camper B', %s, 'gran-volumen', 45000, 45000,
           true, false, null, now() - interval '40 days'),
          ('aaaaaaa1-0000-0000-0000-000000000003', %s, 'Camper C', %s, 'gran-volumen', 25000, 25000,
           false, true, now() - interval '10 days', now() - interval '30 days')
        """,
        (VENDEDOR, categoria, VENDEDOR, categoria, VENDEDOR, categoria),
    )

    # Mercado: dos anuncios activos de otro vendedor y dos vendidos.
    cur.execute(
        """
        insert into productos (id, user_id, titulo, categoria_id, subcategoria, precio_usd, precio,
                               activo, vendido, vendido_fecha, creado_en)
        values
          ('bbbbbbb1-0000-0000-0000-000000000001', %s, 'Otra 1', %s, 'gran-volumen', 20000, 20000,
           true, false, null, now() - interval '50 days'),
          ('bbbbbbb1-0000-0000-0000-000000000002', %s, 'Otra 2', %s, 'gran-volumen', 40000, 40000,
           true, false, null, now() - interval '50 days'),
          ('bbbbbbb1-0000-0000-0000-000000000003', %s, 'Otra 3', %s, 'gran-volumen', 30000, 30000,
           false, true, now() - interval '20 days', now() - interval '40 days'),
          ('bbbbbbb1-0000-0000-0000-000000000004', %s, 'Otra 4', %s, 'gran-volumen', 35000, 35000,
           false, true, now() - interval '40 days', now() - interval '80 days')
        """,
        (OTRO, categoria, OTRO, categoria, OTRO, categoria, OTRO, categoria),
    )

    # Visitas de los últimos 30 días: 5 al anuncio A, 2 al B, 1 al C (fuera de
    # periodo: 45 días) y 3 a un anuncio ajeno (no deben sumar).
    cur.execute(
        """
        insert into visitas_pagina (creado_en, dia, visitante_id, ruta, tipo, producto_id)
        select now() - interval '2 days', (now() at time zone 'Europe/Madrid')::date,
               'v1', '/producto/camper-a', 'producto', 'aaaaaaa1-0000-0000-0000-000000000001'
        from generate_series(1, 5)
        """
    )
    cur.execute(
        """
        insert into visitas_pagina (creado_en, dia, visitante_id, ruta, tipo, producto_id)
        select now() - interval '3 days', (now() at time zone 'Europe/Madrid')::date,
               'v2', '/producto/camper-b', 'producto', 'aaaaaaa1-0000-0000-0000-000000000002'
        from generate_series(1, 2)
        """
    )
    cur.execute(
        """
        insert into visitas_pagina (creado_en, dia, visitante_id, ruta, tipo, producto_id)
        values (now() - interval '45 days', (now() - interval '45 days')::date,
                'v3', '/producto/camper-c', 'producto', 'aaaaaaa1-0000-0000-0000-000000000003')
        """
    )
    cur.execute(
        """
        insert into visitas_pagina (creado_en, dia, visitante_id, ruta, tipo, producto_id)
        select now() - interval '1 day', (now() at time zone 'Europe/Madrid')::date,
               'v4', '/producto/otra-1', 'producto', 'bbbbbbb1-0000-0000-0000-000000000001'
        from generate_series(1, 3)
        """
    )

    # Favoritos: 2 en A (uno fuera de periodo), 1 en B.
    cur.execute(
        """
        insert into auth.users (id) values
          ('33333333-3333-3333-3333-333333333333'),
          ('33333333-3333-3333-3333-333333333334'),
          ('33333333-3333-3333-3333-333333333335'),
          ('44444444-4444-4444-4444-444444444444'),
          ('55555555-5555-5555-5555-555555555555')
        """
    )
    cur.execute(
        """
        insert into favoritos (user_id, producto_id, creado_en) values
          ('33333333-3333-3333-3333-333333333333', 'aaaaaaa1-0000-0000-0000-000000000001', now() - interval '1 day'),
          ('33333333-3333-3333-3333-333333333334', 'aaaaaaa1-0000-0000-0000-000000000001', now() - interval '100 days'),
          ('33333333-3333-3333-3333-333333333335', 'aaaaaaa1-0000-0000-0000-000000000002', now() - interval '1 day')
        """
    )

    # Contactos: el comprador 1 escribe 3 veces por A (cuenta 1), el
    # comprador 2 una vez por B. Un mensaje del vendedor a sí mismo no cuenta.
    cur.execute(
        """
        insert into mensajes (conversacion_id, remitente_id, destinatario_id, producto_id, contenido, creado_en)
        values
          (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', %s, 'aaaaaaa1-0000-0000-0000-000000000001', 'hola', now() - interval '2 days'),
          (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', %s, 'aaaaaaa1-0000-0000-0000-000000000001', 'sigue?', now() - interval '2 days'),
          (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', %s, 'aaaaaaa1-0000-0000-0000-000000000001', 'precio?', now() - interval '1 day'),
          (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', %s, 'aaaaaaa1-0000-0000-0000-000000000002', 'me interesa', now() - interval '1 day')
        """,
        (VENDEDOR, VENDEDOR, VENDEDOR, VENDEDOR),
    )

    return categoria


def comprobar(cond, mensaje):
    if not cond:
        print(f'FALLO: {mensaje}')
        sys.exit(1)


def main():
    v.run(reset=True)
    db = v.pgserver.get_server('/tmp/pgdata')
    conn = psycopg2.connect(db.get_uri().replace('/postgres?', '/camproctest?'))
    conn.autocommit = True
    cur = conn.cursor()

    aplicar_migraciones(cur)
    categoria = fixtures(cur)

    cur.execute('select rendimiento_vendedor(%s, 30)', (VENDEDOR,))
    datos = cur.fetchone()[0]

    resumen = datos['resumen']
    comprobar(resumen['visitas'] == 7, f"visitas: {resumen['visitas']} (esperado 7)")
    comprobar(resumen['favoritos'] == 2, f"favoritos: {resumen['favoritos']} (esperado 2)")
    comprobar(resumen['contactos'] == 2, f"contactos: {resumen['contactos']} (esperado 2)")
    comprobar(resumen['activos'] == 2, f"activos: {resumen['activos']} (esperado 2)")
    comprobar(resumen['vendidos'] == 1, f"vendidos: {resumen['vendidos']} (esperado 1)")
    comprobar(resumen['dias'] == 30 if 'dias' in resumen else True, 'dias en resumen')

    por_id = {a['productoId']: a for a in datos['anuncios']}
    a = por_id.get('aaaaaaa1-0000-0000-0000-000000000001')
    comprobar(a is not None, 'el anuncio A no aparece')
    comprobar(a['visitas'] == 5, f"A visitas: {a['visitas']}")
    comprobar(a['favoritos'] == 1, f"A favoritos dentro de periodo: {a['favoritos']}")
    comprobar(a['contactos'] == 1, f"A contactos (compradores distintos): {a['contactos']}")

    b = por_id['aaaaaaa1-0000-0000-0000-000000000002']
    comprobar(b['visitas'] == 2 and b['favoritos'] == 1 and b['contactos'] == 1, f"B mal: {b}")

    c = por_id['aaaaaaa1-0000-0000-0000-000000000003']
    comprobar(c['visitas'] == 0, f"C no debe tener visitas en 30 días: {c['visitas']}")

    # Ventas propias: una vendida en 20 días.
    comprobar(
        round(float(datos['ventas']['diasMediana']), 1) == 20.0,
        f"días hasta vender: {datos['ventas']['diasMediana']}",
    )

    # Mercado: solo los otros (ni las visitas ni los mensajes propios), con su
    # mediana de precio (30.000) y de días (30 y 40 → 35).
    mercado = [m for m in datos['mercado'] if m['categoriaId'] == categoria][0]
    comprobar(mercado['activos'] == 2, f"mercado activos: {mercado['activos']}")
    # 20.000 · 30.000 · 35.000 · 40.000 → la mediana interpola 30.000 y 35.000.
    comprobar(float(mercado['precioMediana']) == 32500.0, f"precio mediana: {mercado['precioMediana']}")
    # 20 y 40 días → 30.
    comprobar(round(float(mercado['diasMediana']), 1) == 30.0, f"días mediana mercado: {mercado['diasMediana']}")

    # La serie solo trae días con visitas (el relleno se hace en la app).
    comprobar(len(datos['serie']) >= 1, 'la serie está vacía')
    comprobar(sum(s['visitas'] for s in datos['serie']) == 7, f"serie: {datos['serie']}")

    # El otro vendedor no ve nada del primero.
    cur.execute('select rendimiento_vendedor(%s, 30)', (OTRO,))
    otro = cur.fetchone()[0]
    comprobar(otro['resumen']['visitas'] == 3, f"otro visitas: {otro['resumen']['visitas']}")
    comprobar(otro['resumen']['contactos'] == 0, f"otro contactos: {otro['resumen']['contactos']}")

    # Un usuario sin anuncios no rompe la función.
    cur.execute("select rendimiento_vendedor(gen_random_uuid(), 30)")
    vacio = cur.fetchone()[0]
    comprobar(vacio['resumen']['visitas'] == 0, 'usuario vacío con visitas')
    comprobar(vacio['serie'] == [], 'usuario vacío con serie')
    comprobar(vacio['mercado'] == [], 'usuario vacío con mercado')

    # La ventana se acota aunque pidan un año.
    cur.execute('select rendimiento_vendedor(%s, 99999)', (VENDEDOR,))
    amplio = cur.fetchone()[0]
    comprobar(amplio['dias'] == 365, f"días acotados: {amplio['dias']}")

    # Un rol de navegador no puede ejecutarla.
    cur.execute("select has_function_privilege('anon', 'rendimiento_vendedor(uuid, integer)', 'execute')")
    comprobar(cur.fetchone()[0] is False, 'anon puede ejecutar rendimiento_vendedor')

    print('OK: rendimiento_vendedor() devuelve las cifras esperadas.')


if __name__ == '__main__':
    main()
