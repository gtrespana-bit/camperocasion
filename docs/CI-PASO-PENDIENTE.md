# Paso pendiente en el workflow de CI — copiar y pegar

El agente no puede editar `.github/workflows/ci.yml` (el token de GitHub no
tiene el permiso `workflows`). Este es el único cambio que hay que hacer a mano.

## Qué hay que hacer

1. Abre `.github/workflows/ci.yml` en GitHub (o en tu editor).
2. Busca el job **`sql`** y, dentro de `steps:`, localiza el paso
   **«Garantías de la reserva con señal»**.
3. Pega **justo detrás** de ese paso el bloque de abajo, respetando la
   indentación (6 espacios antes del guion).

## Bloque a pegar

```yaml
      - name: Promoción sin doble cobro
        run: python3 scripts/verify_boost_sql.py

      - name: Cobro con Stripe (idempotencia e importes)
        run: python3 scripts/verify_stripe_sql.py
```

## Cómo comprobar que quedó bien

La indentación tiene que coincidir con la de los pasos que ya existen. Debería
verse así (los nombres de los pasos vecinos pueden variar ligeramente):

```yaml
  sql:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Garantías de la reserva con señal
        run: python3 scripts/verify_reservas_sql.py

      - name: Promoción sin doble cobro
        run: python3 scripts/verify_boost_sql.py

      - name: Cobro con Stripe (idempotencia e importes)
        run: python3 scripts/verify_stripe_sql.py
```

Los dos scripts ya están en el repositorio (`scripts/verify_boost_sql.py` y
`scripts/verify_stripe_sql.py`), así que en cuanto pegues el bloque y hagas
commit, la CI los ejecuta.

## Por qué importa

`verify_boost_sql.py` comprueba que la promoción no cobre dos créditos por una
subida que sigue vigente. `verify_stripe_sql.py` comprueba que la migración de
Stripe conserve el índice único sobre `stripe_session_id` y que la RPC siga
siendo `security definer` y vedada a `anon`/`authenticated`. Si alguien toca esa
migración y se carga cualquiera de las dos cosas, se duplicarían créditos o un
usuario podría regalárselos: son fallos de dinero, y por eso los vigila la CI en
lugar de confiar en la revisión manual.

---

## Nota sobre las dependencias

Los scripts de verificación SQL necesitan `pgserver`, `psycopg2-binary` y
`pglast`. El workflow ya los instala en el job `sql`:

```yaml
      - run: pip install --no-cache-dir pgserver psycopg2-binary pglast
```

Si ese paso ya existe (lo tiene), no hay que tocar nada más.
