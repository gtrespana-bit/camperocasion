#!/usr/bin/env python3
"""Chat real con triggers + RLS: contexto del anuncio, respuestas, aislamiento.
Uso: python3 scripts/verify_chat_sql.py (base LOCAL desechable, nunca producción).
"""
import uuid
import psycopg2
import validate_setup_sql as v

v.run(reset=True)
db = v.pgserver.get_server('/tmp/pgdata')
conn = psycopg2.connect(db.get_uri().replace('/postgres?', '/camproctest?'))
conn.autocommit = True
cur = conn.cursor()
cur.execute('grant usage on schema public, auth to authenticated')
# El shim de Supabase no trae los grants de lectura por defecto.
cur.execute('grant select on conversaciones, mensajes to authenticated')

buyer, seed, admin, third = [str(uuid.uuid4()) for _ in range(4)]
product, conversation = [str(uuid.uuid4()) for _ in range(2)]
for uid, email in [(buyer, 'buyer@test.es'), (seed, 'seed@test.es'), (admin, 'team@test.es'), (third, 'third@test.es')]:
    cur.execute('insert into auth.users (id,email) values (%s,%s)', (uid, email))
cur.execute('insert into productos (id,user_id,titulo,es_demo) values (%s,%s,%s,true)', (product, seed, 'Muestra'))
u1, u2 = sorted([buyer, admin])
cur.execute('insert into conversaciones (id,user1_id,user2_id,producto_id) values (%s,%s,%s,%s)', (conversation, u1, u2, product))
# Mismo payload que enviar-mensaje: el producto procede de la conversación.
for sender, recipient in [(buyer, admin), (admin, buyer)]:
    cur.execute('''insert into mensajes (conversacion_id,producto_id,remitente_id,destinatario_id,contenido)
                   values (%s,%s,%s,%s,'Consulta') returning conversacion_id,producto_id''',
                (conversation, product, sender, recipient))
    assert cur.fetchone() == (conversation, product), 'El trigger movió el mensaje a otro chat'
cur.execute('select count(*) from conversaciones')
assert cur.fetchone()[0] == 1, 'Creó un chat genérico en vez de usar el del vehículo'
print('OK: envío + respuesta conservan chat, anuncio y dos participantes reales')

# Reproduce el fallo anterior en una transacción que se revierte.
cur.execute('begin')
cur.execute('''insert into mensajes (conversacion_id,remitente_id,destinatario_id,contenido)
               values (%s,%s,%s,'Payload antiguo') returning conversacion_id''', (conversation, buyer, admin))
assert cur.fetchone()[0] != conversation, 'La regresión ya no reproduce el trigger legado; revisar test'
cur.execute('rollback')
print('OK: reproducido y revertido el fallo del payload antiguo (sin producto_id)')

for uid, expected in [(buyer, 2), (admin, 2), (seed, 0), (third, 0)]:
    cur.execute("select set_config('app.current_uid', %s, false)", (uid,))
    cur.execute('set role authenticated')
    cur.execute('select count(*) from mensajes')
    assert cur.fetchone()[0] == expected, f'Fuga de mensajes para {uid}'
    cur.execute('select count(*) from conversaciones')
    assert cur.fetchone()[0] == (1 if expected else 0), f'Fuga de conversación para {uid}'
    try:
        cur.execute("update mensajes set contenido='alterado'")
    except psycopg2.errors.InsufficientPrivilege:
        pass
    else:
        raise AssertionError('El navegador pudo modificar mensajes directamente')
    cur.execute('reset role')
print('OK: RLS permite comprador/equipo; excluye vendedor ficticio y terceros; escritura solo por API')
conn.close()
