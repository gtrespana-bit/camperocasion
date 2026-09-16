#!/usr/bin/env python3
"""Verificación de despliegue: comprueba que las fases 0.1, 0.2 y 1.2 están aplicadas.

Ejecuta `setup-camperocasion.sql` en un Postgres real y luego lanza
`scripts/verificar_despliegue.sql`, que mira el catálogo del sistema (columnas,
índices, tablas, funciones, triggers, RLS, políticas y buckets) y devuelve una
fila por pieza con ✅ o ❌.

Es el mismo SQL que se pega en el editor de Supabase para comprobar producción,
así que si esto pasa, la comprobación manual también. Sale con código 1 si algo
falta, para que la CI se ponga en rojo.

Uso:  python3 scripts/verificar_despliegue_sql.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2
import validate_setup_sql as v

AQUI = os.path.dirname(os.path.abspath(__file__))

v.run(reset=True)
db = v.pgserver.get_server('/tmp/pgdata')
conn = psycopg2.connect(db.get_uri().replace('/postgres?', '/camproctest?'))
conn.autocommit = True
cur = conn.cursor()

with open(os.path.join(AQUI, 'verificar_despliegue.sql'), encoding='utf-8') as f:
    cur.execute(f.read())
filas = cur.fetchall()

for estado, nombre in filas:
    print(f'{estado} · {nombre}')

fallos = [nombre for estado, nombre in filas if 'OK' not in estado]
print()
if fallos:
    print(f'FALLO: {len(fallos)} de {len(filas)} comprobaciones sin cumplir:')
    for nombre in fallos:
        print(f'  - {nombre}')
    sys.exit(1)

print(f'OK: {len(filas)} comprobaciones de despliegue, todas cumplidas.')
