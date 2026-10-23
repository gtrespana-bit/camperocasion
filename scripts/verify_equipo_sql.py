#!/usr/bin/env python3
"""Comprueba las reglas del equipo Flota contra un Postgres real.

`validate_migrations_sql.py` demuestra que la migración se aplica; este script
comprueba lo que de verdad importa y que un `create table` no garantiza:

  · un invitado todavía no es del equipo (sigue siendo su propia cuenta);
  · al aceptar, `fn_cuenta_titular()` devuelve al titular;
  · un usuario no puede estar activo en dos equipos;
  · el tope de 3 comerciales se impone en la base;
  · al revocar, el comercial vuelve a su propia cuenta y libera asiento.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2

import validate_setup_sql as v

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TITULAR = 'aaaaaaaa-1111-1111-1111-111111111111'
OTRO_TITULAR = 'aaaaaaaa-2222-2222-2222-222222222222'
M1 = 'bbbbbbbb-1111-1111-1111-111111111111'
M2 = 'bbbbbbbb-2222-2222-2222-222222222222'
M3 = 'bbbbbbbb-3333-3333-3333-333333333333'
M4 = 'bbbbbbbb-4444-4444-4444-444444444444'


def aplicar_migraciones(cur):
    import glob
    import re

    for patron in ('202609*.sql', '202610*.sql'):
        for archivo in sorted(glob.glob(os.path.join(RAIZ, 'supabase', 'migrations', patron))):
            src = open(archivo, encoding='utf-8').read()
            for _off, stmt in v.split_statements(src):
                if not re.sub(r'(?s)--[^\n]*|/\*.*?\*/', '', stmt).strip():
                    continue
                cur.execute(stmt)


def comprobar(cond, mensaje):
    if not cond:
        print(f'FALLO: {mensaje}')
        sys.exit(1)


def cuenta_titular(cur, user_id):
    cur.execute('select fn_cuenta_titular(%s)', (user_id,))
    return cur.fetchone()[0]


def main():
    v.run(reset=True)
    db = v.pgserver.get_server('/tmp/pgdata')
    conn = psycopg2.connect(db.get_uri().replace('/postgres?', '/camproctest?'))
    conn.autocommit = True
    cur = conn.cursor()

    aplicar_migraciones(cur)

    for uid, email in (
        (TITULAR, 'titular@taller.es'),
        (OTRO_TITULAR, 'otro@taller.es'),
        (M1, 'uno@taller.es'),
        (M2, 'dos@taller.es'),
        (M3, 'tres@taller.es'),
        (M4, 'cuatro@taller.es'),
    ):
        cur.execute('insert into auth.users (id, email) values (%s, %s)', (uid, email))

    # Invitado: aún no pertenece al equipo.
    cur.execute(
        """
        insert into equipo_miembros (titular_id, email, rol, estado)
        values (%s, 'uno@taller.es', 'comercial', 'invitado')
        returning id, token
        """,
        (TITULAR,),
    )
    invitacion_id, token = cur.fetchone()
    comprobar(cuenta_titular(cur, M1) == M1, 'un invitado no debe pertenecer todavía al equipo')
    comprobar(
        cuenta_titular(cur, TITULAR) == TITULAR,
        'el titular debe ser su propia cuenta',
    )

    # Aceptar: ahora su cuenta es la del titular.
    cur.execute(
        """
        update equipo_miembros
           set miembro_id = %s, estado = 'activo', aceptado_en = now()
         where id = %s
        """,
        (M1, invitacion_id),
    )
    comprobar(cuenta_titular(cur, M1) == TITULAR, 'al aceptar debe resolver al titular')

    # Dos comerciales más: se llena el equipo.
    for uid, email in ((M2, 'dos@taller.es'), (M3, 'tres@taller.es')):
        cur.execute(
            """
            insert into equipo_miembros (titular_id, email, miembro_id, rol, estado, aceptado_en)
            values (%s, %s, %s, 'comercial', 'activo', now())
            """,
            (TITULAR, email, uid),
        )

    # El cuarto se rechaza en la base, no solo en la API.
    try:
        cur.execute(
            """
            insert into equipo_miembros (titular_id, email, rol, estado)
            values (%s, 'cuatro@taller.es', 'comercial', 'invitado')
            """,
            (TITULAR,),
        )
        comprobar(False, 'el cuarto asiento debería fallar')
    except psycopg2.errors.CheckViolation:
        conn.rollback()

    # Un miembro activo no puede estar en dos equipos.
    try:
        cur.execute(
            """
            insert into equipo_miembros (titular_id, email, miembro_id, rol, estado, aceptado_en)
            values (%s, 'dos@otro.es', %s, 'comercial', 'activo', now())
            """,
            (OTRO_TITULAR, M2),
        )
        comprobar(False, 'un miembro activo no debe poder unirse a otro equipo')
    except psycopg2.errors.UniqueViolation:
        conn.rollback()

    # El titular no puede ser miembro de su propia cuenta.
    try:
        cur.execute(
            """
            insert into equipo_miembros (titular_id, email, miembro_id, rol, estado)
            values (%s, 'titular@taller.es', %s, 'comercial', 'invitado')
            """,
            (OTRO_TITULAR, OTRO_TITULAR),
        )
        comprobar(False, 'el titular no debe poder ser miembro de sí mismo')
    except psycopg2.errors.CheckViolation:
        conn.rollback()

    # Revocar libera asiento y devuelve al comercial a su propia cuenta.
    cur.execute(
        "update equipo_miembros set estado = 'revocado' where miembro_id = %s",
        (M3,),
    )
    comprobar(cuenta_titular(cur, M3) == M3, 'un revocado vuelve a su propia cuenta')
    cur.execute(
        """
        insert into equipo_miembros (titular_id, email, rol, estado)
        values (%s, 'cuatro@taller.es', 'comercial', 'invitado')
        """,
        (TITULAR,),
    )

    # El token es único y sigue sirviendo para localizar la invitación.
    cur.execute('select count(*) from equipo_miembros where token = %s', (token,))
    comprobar(cur.fetchone()[0] == 1, 'el token debe identificar la invitación')

    # Sin políticas RLS: solo service_role puede leer la tabla.
    cur.execute(
        "select count(*) from pg_policies where tablename = 'equipo_miembros'"
    )
    comprobar(cur.fetchone()[0] == 0, 'la tabla no debe exponer políticas RLS')

    print('OK: equipo Flota — titular, aceptación, tope, doble equipo y revocación.')


if __name__ == '__main__':
    main()
