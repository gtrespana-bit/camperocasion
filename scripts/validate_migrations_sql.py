#!/usr/bin/env python3
"""Valida los archivos INDIVIDUALES de migración de la era CamperOcasión
(`supabase/migrations/202609*.sql`) contra un Postgres real, re-aplicándolos
sobre el setup completo para demostrar que son idempotentes y pegables en el
SQL Editor de Supabase.

Por qué existe
--------------
`validate_setup_sql.py` valida SOLO `setup-camperocasion.sql`. Eso dejó un
hueco: un comentario con comillas sueltas en
`202609170003_rangos_numericos.sql` (archivo que se pega a mano en producción)
rompía el SQL Editor con `syntax error at or near "."`, y la CI seguía verde
porque el setup llevaba una versión acortada y válida del mismo comentario.

Qué hace
--------
  1. Aplica `setup-camperocasion.sql` completo (igual que validate_setup_sql).
  2. Aplica, en orden, cada `supabase/migrations/202609*.sql` (idempotencia:
     su contenido ya está en el setup, así que deben re-aplicarse sin error).
  3. Verifica la SEMÁNTICA de los rangos numéricos: que la función de
     extracción normaliza el formato español (145.000 → 145000) y que las
     columnas generadas + el filtro lte/gte comparan números, no texto.

Los archivos históricos del antiguo marketplace (001…026, 20250627, 20260801*
y 20260829*) NO se re-aplican aquí: son el historial acumulativo original y
algunos no son idempotentes (p. ej. cambian defaults de función sin DROP
previo). Sí siguen cubiertos por el setup completo.

Uso:  python3 scripts/validate_migrations_sql.py
"""
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2
import validate_setup_sql as v

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
GLOB_PATRON = os.path.join(RAIZ, 'supabase', 'migrations', '202609*.sql')


def solo_comentarios(stmt: str) -> bool:
    """True si el statement no tiene código ejecutable (solo comentarios)."""
    cuerpo = re.sub(r'(?s)--[^\n]*|/\*.*?\*/', '', stmt).strip()
    return not cuerpo


def main():
    v.run(reset=True)
    db = v.pgserver.get_server('/tmp/pgdata')
    conn = psycopg2.connect(db.get_uri().replace('/postgres?', '/camproctest?'))
    conn.autocommit = True
    cur = conn.cursor()

    archivos = sorted(glob.glob(GLOB_PATRON))
    if not archivos:
        print('FALLO: no hay migraciones que coincidan con supabase/migrations/202609*.sql')
        sys.exit(1)

    total = 0
    for archivo in archivos:
        src = open(archivo, encoding='utf-8').read()
        nombre = os.path.basename(archivo)
        for off, stmt in v.split_statements(src):
            if solo_comentarios(stmt):
                continue
            total += 1
            linea = src[:off].count('\n') + 1
            try:
                cur.execute(stmt)
            except Exception as e:
                print(f'FALLO {nombre} (statement {total}, linea {linea}):')
                print('  ' + str(e).strip().replace('\n', '\n  '))
                sys.exit(1)
        print(f'OK reaplicado: {nombre}')

    # ── Semántica de los rangos numéricos ───────────────────────────────────
    cur.execute("select public.fn_espec_numero('145.000')::bigint")
    assert cur.fetchone()[0] == 145000, 'fn_espec_numero no normaliza puntos de millar'
    cur.execute("select public.fn_espec_numero('150000 km')::bigint")
    assert cur.fetchone()[0] == 150000, 'fn_espec_numero no limpia sufijos'
    cur.execute("select public.fn_espec_numero(null) is null")
    assert cur.fetchone()[0] is True, 'fn_espec_numero(null) debe ser null'

    cur.execute("""
        insert into auth.users (id, email)
        values ('00000000-0000-0000-0000-0000000000ec', 's@e.es')
    """)
    cur.execute("""
        insert into productos (id, user_id, titulo, estado_moderacion, precio_usd, especificaciones)
        values ('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000ec',
                'Camper 145.000 km 2019', 'aprobado', 45000,
                '{"Kilometraje (km)":"145.000", "Año de matriculación":"2019",
                  "Placa solar (watios)":"200", "Inversor 220V (watios)":"1200"}'::jsonb)
    """)
    cur.execute("""
        select espec_km, espec_anio, espec_placa_w, espec_inversor_w
        from productos where id = '00000000-0000-0000-0000-0000000000ba'
    """)
    km, anio, placa, inv = cur.fetchone()
    assert (km, anio, placa, inv) == (145000, 2019, 200, 1200), \
        f'columnas generadas inesperadas: {(km, anio, placa, inv)}'

    cur.execute("""
        select count(*) from productos
        where espec_km <= 150000 and espec_anio >= 2019
          and espec_placa_w >= 180 and espec_inversor_w >= 1000
    """)
    assert cur.fetchone()[0] == 1, 'el filtro numérico lte/gte no encuentra la fila'
    print('OK semántica de rangos: comparación numérica indexada, no texto')

    conn.close()
    print(f'\nOK: {len(archivos)} migraciones 202609* reaplicadas ({total} statements) '
          'sin error sobre el setup completo.')


if __name__ == '__main__':
    main()
