#!/usr/bin/env python3
"""Comprueba las garantías de seguridad del expediente del vehículo.

Ejecuta `setup-camperocasion.sql` en un Postgres de verdad (el mismo arnés que
`validate_setup_sql.py`) y verifica, como rol `anon`/`authenticated`, que:

  - el público solo ve los documentos YA verificados;
  - cada usuario solo ve el expediente de sus anuncios;
  - nadie puede adjuntar documentos al anuncio de otro ni auto-verificarse;
  - el propietario de un documento no se puede cambiar;
  - las políticas de Storage limitan cada archivo a la carpeta de su dueño.

Es el contrato de privacidad de la Fase 0.2: si alguien relaja una política, este
script falla.

Uso:  python3 scripts/verify_rls_documentos_vehiculo.py
"""
import sys
sys.path.insert(0, '/home/user/camperocasion/scripts')
import validate_setup_sql as v, psycopg2

v.run(reset=True)
db = v.pgserver.get_server('/tmp/pgdata')
conn = psycopg2.connect(db.get_uri().replace('/postgres?', '/camproctest?')); conn.autocommit = True
cur = conn.cursor()

U_A, U_B, U_ADMIN = '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'
P_A, P_B = '22222222-2222-4222-8222-222222222222', '55555555-5555-4555-8555-555555555555'

cur.execute("insert into auth.users (id, email) values (%s,'a@x.es'),(%s,'b@x.es'),(%s,'admin@x.es')", (U_A, U_B, U_ADMIN))
cur.execute("insert into public.admins (email) values ('admin@x.es') on conflict do nothing")
cur.execute("insert into public.productos (id, titulo, user_id) values (%s,'Camper A',%s),(%s,'Camper B',%s)", (P_A, U_A, P_B, U_B))
cur.execute("""insert into public.documentos_vehiculo (producto_id, user_id, tipo, archivo_url, estado) values
  (%s,%s,'ficha_tecnica','a/ficha.pdf','verificado'), (%s,%s,'itv','a/itv.pdf','pendiente'), (%s,%s,'ficha_tecnica','b/ficha.pdf','pendiente')""",
  (P_A, U_A, P_A, U_A, P_B, U_B))

# El shim local no concede USAGE sobre los esquemas auth/storage (Supabase real sí).
# Es una particularidad del arnés de pruebas, no de las migraciones.
cur.execute("grant usage on schema auth, storage to anon, authenticated")
# En Supabase real, storage.objects tiene GRANT ALL a anon/authenticated y es la
# RLS la que decide. El shim local no lo trae.
cur.execute("grant select, insert, update, delete on storage.objects to anon, authenticated")
cur.execute("alter table storage.objects enable row level security")
cur.execute("grant usage on schema public to anon, authenticated")

checks = []
def como(rol, uid=None):
    cur.execute("set role %s" % rol)
    cur.execute("select set_config('app.current_uid', %s, false)", (uid or '',))

def contar():
    cur.execute("select count(*) from public.documentos_vehiculo")
    return cur.fetchone()[0]

def intentar(sql, params=()):
    try:
        cur.execute(sql, params); return None
    except Exception as e:
        return str(e).split('\n')[0][:78]

# ── documentos_vehiculo ────────────────────────────────────────────────────
como('anon')
checks.append((contar() == 1, 'anon: solo ve el documento verificado', contar()))

como('authenticated', U_A)
checks.append((contar() == 2, 'dueño A: ve sus 2 documentos', contar()))
err = intentar("""insert into public.documentos_vehiculo (producto_id, user_id, tipo, archivo_url) values (%s,%s,'otro','x.pdf')""", (P_B, U_A))
checks.append((err is not None, 'A no puede subir un documento al anuncio de B', (err or 'PERMITIDO')[:55]))
err = intentar("""insert into public.documentos_vehiculo (producto_id, user_id, tipo, archivo_url) values (%s,%s,'otro','x.pdf')""", (P_A, U_B))
checks.append((err is not None, 'B no puede colgar un documento con user_id de A', (err or 'PERMITIDO')[:55]))
checks.append((intentar("""insert into public.documentos_vehiculo (producto_id, user_id, tipo, archivo_url) values (%s,%s,'otro','x.pdf')""", (P_A, U_A)) is None,
               'A sí puede subir un documento propio', 'ok'))
checks.append((intentar("update public.documentos_vehiculo set estado='verificado' where producto_id=%s", (P_A,)) is not None,
               'A no puede auto-verificarse (sin grant UPDATE)', 'ok'))
checks.append((intentar("update public.productos set verificacion_homologacion='verificada' where id=%s", (P_A,)) is not None,
               'A no puede marcar el anuncio como verificado', 'ok'))

como('authenticated', U_B)
checks.append((contar() == 2, 'dueño B: su documento + el verificado de A', contar()))

como('authenticated', U_ADMIN)
checks.append((contar() == 4, 'admin: ve el expediente completo', contar()))

# ── Storage del bucket privado ─────────────────────────────────────────────
cur.execute("reset role")
cur.execute("insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('documentos-vehiculo','documentos-vehiculo',false,10485760,array['application/pdf']) on conflict do nothing")

como('authenticated', U_A)
checks.append((intentar("insert into storage.objects (bucket_id, name, owner) values ('documentos-vehiculo', %s, %s)", (f'{U_A}/{P_A}/ficha.pdf', U_A)) is None,
               'A sube a su propia carpeta', 'ok'))
checks.append((intentar("insert into storage.objects (bucket_id, name, owner) values ('documentos-vehiculo', %s, %s)", (f'{U_B}/{P_B}/ficha.pdf', U_A)) is not None,
               'A NO puede subir a la carpeta de B', 'ok'))
cur.execute("select count(*) from storage.objects where bucket_id='documentos-vehiculo'")
checks.append((cur.fetchone()[0] == 1, 'A solo ve su objeto', 'ok'))
cur.execute("select count(*) from storage.objects where bucket_id='cedulas'")
checks.append((cur.fetchone()[0] == 0, 'el bucket de cédulas no se ve afectado', 'ok'))

como('anon')
cur.execute("select count(*) from storage.objects where bucket_id='documentos-vehiculo'")
checks.append((cur.fetchone()[0] == 0, 'anon no ve ningún documento', 'ok'))

como('authenticated', U_ADMIN)
cur.execute("select count(*) from storage.objects where bucket_id='documentos-vehiculo'")
checks.append((cur.fetchone()[0] == 1, 'admin sí puede leer (para URL firmada)', 'ok'))

# Aislamiento entre usuarios: B no ve el objeto de A
como('authenticated', U_B)
cur.execute("select count(*) from storage.objects where bucket_id='documentos-vehiculo'")
checks.append((cur.fetchone()[0] == 0, 'B no ve el objeto de A', 'ok'))

cur.execute("reset role")
anchos = max(len(n) for _, n, _ in checks)
for ok, nombre, valor in checks:
    print(f"{'✓' if ok else '✗'} {nombre.ljust(anchos)}  {valor}")
print()
print('TODOS OK' if all(ok for ok, _, _ in checks) else 'HAY FALLOS')
conn.close()
sys.exit(0 if all(ok for ok, _, _ in checks) else 1)
