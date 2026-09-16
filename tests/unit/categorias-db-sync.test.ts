/**
 * Regression test para el error 406 al publicar.
 *
 *   GET /rest/v1/categorias?select=id&nombre=eq.repuestos → 406
 *
 * Causa: `categoriasData` ofrece 8 categorías en el formulario de publicar,
 * pero la migración 001 solo insertó 6. Al publicar un repuesto, la consulta
 * `.eq('nombre','repuestos').single()` encontraba 0 filas y PostgREST devuelve
 * 406 con `.single()`. Peor aún: el producto se guardaba con categoria_id NULL.
 *
 * Este test falla si alguien añade una categoría al front sin añadir la
 * migración SQL correspondiente.
 */
import * as fs from 'fs'
import * as path from 'path'
import { categoriasData } from '@/lib/categorias'

const MIGRATIONS_DIR = path.join(__dirname, '../../supabase/migrations')

/** Nombres de categoría insertados por cualquier migración. */
function categoriasEnMigraciones(): Set<string> {
  const nombres = new Set<string>()
  for (const file of fs.readdirSync(MIGRATIONS_DIR)) {
    if (!file.endsWith('.sql')) continue
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')

    // Captura los bloques `insert into categorias (nombre) values (...);`
    const bloques = sql.matchAll(
      /insert\s+into\s+(?:public\.)?categorias\s*\(\s*nombre\s*\)\s*values([\s\S]*?);/gi
    )
    for (const bloque of bloques) {
      for (const valor of bloque[1].matchAll(/\(\s*'([^']+)'\s*\)/g)) {
        nombres.add(valor[1].toLowerCase())
      }
    }
  }
  return nombres
}

describe('categoriasData ↔ tabla categorias', () => {
  test('toda categoría del formulario existe en las migraciones (evita el 406)', () => {
    const enDb = categoriasEnMigraciones()
    const faltantes = Object.keys(categoriasData).filter(k => !enDb.has(k.toLowerCase()))

    expect(faltantes).toEqual([])
  })

  test('las categorías que provocaban el 406 están cubiertas', () => {
    const enDb = categoriasEnMigraciones()
    expect(enDb.has('repuestos')).toBe(true)
    expect(enDb.has('materiales')).toBe(true)
  })

  test('el seed original de 6 categorías sigue presente', () => {
    const enDb = categoriasEnMigraciones()
    for (const c of ['vehiculos', 'tecnologia', 'moda', 'hogar', 'herramientas', 'otros']) {
      expect(enDb.has(c)).toBe(true)
    }
  })
})
