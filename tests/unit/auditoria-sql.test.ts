/**
 * Invariantes SQL que no se pueden dejar solo al criterio de quien pegue el SQL
 * en el SQL Editor. El verificador fuerte (con Postgres real) está en
 * scripts/verify_cupo_planes_sql.py; estos tests son la red rápida de `npm test`.
 */
import * as fs from 'fs'
import * as path from 'path'

const raiz = path.join(__dirname, '../../supabase/migrations')
const sql = (nombre: string) => fs.readFileSync(path.join(raiz, nombre), 'utf8')

const DUNNING = '202610220001_planes_prueba_gracia_dunning.sql'
const PERMISOS = '202610270001_permisos_aplicar_cupo_planes.sql'
const RATE_IP = '202610270002_rate_limit_compuesto.sql'
const PRECIO = '202609170001_rename_legado_camperocasion.sql'
const SPECS = '025_categorias_faltantes_y_especificaciones.sql'

describe('P0 · aplicar_cupo_planes solo service_role', () => {
  it('la migración original ya nombra anon y authenticated en el revoke', () => {
    expect(sql(DUNNING)).toMatch(
      /revoke all on function public\.aplicar_cupo_planes\(timestamptz\)\s+from public, anon, authenticated/i,
    )
  })

  it('el parche recrea la función con guardia de JWT y revoca de los tres roles', () => {
    const texto = sql(PERMISOS)
    expect(texto).toMatch(/create or replace function public\.aplicar_cupo_planes/i)
    expect(texto).toMatch(/request\.jwt\.claim\.role/)
    expect(texto).toMatch(/errcode\s*=\s*'42501'/)
    expect(texto).toMatch(/from public, anon, authenticated/i)
    expect(texto).toMatch(/grant execute on function public\.aplicar_cupo_planes\(timestamptz\) to service_role/i)
  })
})

describe('P0 · idempotencia de la pausa por cupo (punto 2)', () => {
  it('el CTE orden solo cuenta anuncios ACTIVOS', () => {
    // Si los pausados por la pasada anterior entraran en el row_number(), el
    // ranking se desplazaría y se pausarían anuncios que deberían seguir activos.
    const texto = sql(DUNNING)
    expect(texto).toMatch(/from public\.productos pr[\s\S]*?where pr\.activo is true/i)
    expect(texto).toMatch(/set activo = false,\s*pausado_por_plan = true/i)
  })
})

describe('P1 · precio (punto 4)', () => {
  it('las tres columnas son numeric(12,2) y el trigger ya sincroniza', () => {
    const texto = sql(PRECIO)
    expect(texto).toMatch(/add column if not exists precio numeric\(12,2\)/i)
    expect(texto).toMatch(/add column if not exists precio_eur numeric\(12,2\)/i)
    expect(texto).toMatch(/create or replace function public\.fn_sync_producto_precio/i)
    expect(texto).toMatch(/create trigger trg_sync_producto_precio/i)
  })
})

describe('P1 · especificaciones (punto 3)', () => {
  it('la columna es JSONB nullable: un anuncio sin specs es válido, no corrupto', () => {
    const texto = sql(SPECS)
    expect(texto).toMatch(/add column if not exists especificaciones jsonb/i)
    expect(texto).not.toMatch(/especificaciones jsonb not null/i)
  })
})

describe('P2 · rate limit compuesto (punto 7)', () => {
  it('la RPC dual existe y no es ejecutable desde el navegador', () => {
    const texto = sql(RATE_IP)
    expect(texto).toMatch(/create or replace function public\.check_rate_limit_dual/i)
    expect(texto).toMatch(/from public, anon, authenticated/i)
    expect(texto).toMatch(/to service_role/i)
  })
})
