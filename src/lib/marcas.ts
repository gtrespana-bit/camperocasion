/**
 * Catálogo maestro de marcas y modelos camper de CamperOcasión.
 *
 * Aquí vive la lista completa y organizada de fabricantes (Fiat, Benimar,
 * Hymer…) y sus modelos (Ducato, Tessoro, B-Class…), cada uno etiquetado con
 * las subcategorías para las que es apto (gran volumen, camper mediana,
 * minicamper, perfilada, capuchina, integral, 4x4 overland).
 *
 * Reglas importantes:
 *
 *  - `valor` es el CANÓNICO: es lo que se guarda en `productos.marca` y lo
 *    que viaja en el filtro `?marca=…` del catálogo. Los valores antiguos
 *    ('Fiat Ducato', 'Mercedes Marco Polo', 'Adria'…) NO se pueden renombrar
 *    sin romper la coincidencia con los anuncios ya publicados.
 *  - `fabricante` agrupa (Fiat → Ducato / Doblò / Scudo): es la capa que
 *    faltaba cuando "estaba todo junto mezclado".
 *  - `modelo` es el nombre del modelo dentro del fabricante. Puede estar
 *    vacío cuando el valor canónico ya ES el fabricante ('Benimar', 'Hymer').
 *
 * De este único listado beben: el filtro de marca del catálogo y del
 * buscador (agrupado por fabricante con <optgroup>), el paso 2 de /publicar,
 * la página /marcas y las tarjetas de subcategoría de la portada.
 */

export const SUBCATEGORIAS_SLUG = [
  'gran-volumen',
  'camper-mediana',
  'minicamper',
  'perfilada',
  'capuchina',
  'integral',
  'overland',
] as const

export type SubSlug = (typeof SUBCATEGORIAS_SLUG)[number]

export interface MarcaModelo {
  /** Fabricante para agrupar: 'Fiat', 'Benimar', 'Hymer'… */
  fabricante: string
  /** Modelo dentro del fabricante: 'Ducato', 'Tessoro'… '' si el valor ya es el fabricante. */
  modelo: string
  /** Valor canónico guardado en `productos.marca` y usado por el filtro `?marca=`. */
  valor: string
  /** Slugs de subcategoría para los que este modelo es apto. */
  aptoPara: SubSlug[]
  /** Nota breve para la página /marcas: para qué sirve, familias de modelos, etc. */
  nota?: string
}

// ── Helper de construcción (mantiene la lista compacta y tipada) ────────
const mm = (
  fabricante: string,
  modelo: string,
  valor: string,
  aptoPara: SubSlug[],
  nota?: string
): MarcaModelo => ({ fabricante, modelo, valor, aptoPara, nota })

/**
 * Catálogo maestro. Ordenado por fabricante y luego por modelo; los valores
 * canónicos (`valor`) son únicos en toda la lista.
 */
export const MARCAS_MODELOS: MarcaModelo[] = [
  // ══════════ Vehículos base (furgones/chasis para camperizar o carrozar) ══════════

  // Fiat: la base de la mayoría de campers y autocaravanas europeas.
  mm('Fiat', 'Ducato', 'Fiat Ducato', ['gran-volumen'], 'La base más popular de Europa para camperizar y para autocaravanas.'),
  mm('Fiat', 'Ducato Autocaravana', 'Fiat Ducato Autocaravana', ['perfilada'], 'Chasis carrozado por los fabricantes de autocaravanas.'),
  mm('Fiat', 'Ducato Capuchina', 'Fiat Ducato Capuchina', ['capuchina']),
  mm('Fiat', 'Doblò', 'Fiat Doblò', ['minicamper']),
  mm('Fiat', 'Scudo', 'Fiat Scudo', ['camper-mediana']),
  mm('Fiat', 'Talento', 'Fiat Talento', ['camper-mediana']),

  mm('Citroën', 'Jumper', 'Citroën Jumper', ['gran-volumen'], 'Gemela del Ducato: amplia y económica.'),
  mm('Citroën', 'Jumpy', 'Citroën Jumpy Camper', ['camper-mediana']),
  mm('Citroën', 'Berlingo', 'Citroën Berlingo', ['minicamper']),

  mm('Peugeot', 'Boxer', 'Peugeot Boxer', ['gran-volumen'], 'Gemela del Ducato con acabados más turismos.'),
  mm('Peugeot', 'Expert', 'Peugeot Expert Camper', ['camper-mediana']),
  mm('Peugeot', 'Rifter', 'Peugeot Rifter', ['minicamper']),
  mm('Peugeot', 'Partner', 'Peugeot Partner', ['minicamper']),

  mm('Opel', 'Movano', 'Opel Movano', ['gran-volumen']),
  mm('Opel', 'Movano Autocaravana', 'Opel Movano Autocaravana', ['perfilada']),
  mm('Opel', 'Movano Capuchina', 'Opel Movano Capuchina', ['capuchina']),
  mm('Opel', 'Vivaro', 'Opel Vivaro', ['camper-mediana']),
  mm('Opel', 'Combo', 'Opel Combo', ['minicamper']),

  mm('Renault', 'Master', 'Renault Master', ['gran-volumen'], 'Muy usada para camperizaciones y autocaravanas.'),
  mm('Renault', 'Master Autocaravana', 'Renault Master Autocaravana', ['perfilada']),
  mm('Renault', 'Master Capuchina', 'Renault Master Capuchina', ['capuchina']),
  mm('Renault', 'Trafic', 'Renault Trafic', ['camper-mediana']),
  mm('Renault', 'Kangoo', 'Renault Kangoo', ['minicamper']),

  mm('Volkswagen', 'Crafter', 'Volkswagen Crafter', ['gran-volumen']),
  mm('Volkswagen', 'Crafter Autocaravana', 'Volkswagen Crafter Autocaravana', ['perfilada']),
  mm('Volkswagen', 'Crafter Capuchina', 'Volkswagen Crafter Capuchina', ['capuchina']),
  mm('Volkswagen', 'Transporter', 'Volkswagen Transporter', ['camper-mediana']),
  mm('Volkswagen', 'California', 'Volkswagen California', ['camper-mediana'], 'La camper mediana de fábrica más icónica.'),
  mm('Volkswagen', 'Multivan', 'Volkswagen Multivan', ['camper-mediana']),
  mm('Volkswagen', 'Caddy', 'Volkswagen Caddy', ['minicamper'], 'Incluye la versión Caddy California.'),
  mm('Volkswagen', 'Amarok', 'Volkswagen Amarok', ['overland']),

  mm('Mercedes-Benz', 'Sprinter', 'Mercedes-Benz Sprinter', ['gran-volumen'], 'Base premium para campers de gama alta.'),
  mm('Mercedes-Benz', 'Sprinter Autocaravana', 'Mercedes-Benz Sprinter Autocaravana', ['perfilada']),
  mm('Mercedes-Benz', 'Marco Polo', 'Mercedes Marco Polo', ['camper-mediana'], 'Camper de fábrica Mercedes sobre base Vito / Clase V.'),
  mm('Mercedes-Benz', 'Vito', 'Mercedes Vito', ['camper-mediana']),
  mm('Mercedes-Benz', 'Citan', 'Mercedes-Benz Citan', ['minicamper']),

  mm('Ford', 'Transit', 'Ford Transit', ['gran-volumen']),
  mm('Ford', 'Transit Autocaravana', 'Ford Transit Autocaravana', ['perfilada']),
  mm('Ford', 'Transit Capuchina', 'Ford Transit Capuchina', ['capuchina']),
  mm('Ford', 'Transit Custom', 'Ford Transit Custom', ['camper-mediana']),
  mm('Ford', 'Nugget', 'Ford Nugget', ['camper-mediana'], 'Camper oficial Ford fabricada junto a Westfalia.'),
  mm('Ford', 'Tourneo Connect', 'Ford Tourneo Connect', ['minicamper']),
  mm('Ford', 'Ranger', 'Ford Ranger', ['overland']),

  mm('MAN', 'TGE', 'MAN TGE', ['gran-volumen'], 'Gemela de la Crafter con red de talleres MAN.'),

  mm('Iveco', 'Daily', 'Iveco Daily', ['gran-volumen'], 'Chasis pesado de propulsión: base de autocaravanas grandes.'),
  mm('Iveco', 'Daily Autocaravana', 'Iveco Daily Autocaravana', ['perfilada']),

  mm('Nissan', 'Interstar', 'Nissan Interstar', ['gran-volumen']),
  mm('Nissan', 'Primastar', 'Nissan Primastar', ['camper-mediana']),
  mm('Nissan', 'Navara', 'Nissan Navara', ['overland']),

  mm('Toyota', 'Proace', 'Toyota Proace', ['camper-mediana']),
  mm('Toyota', 'Proace City', 'Toyota Proace City', ['minicamper']),
  mm('Toyota', 'Hilux', 'Toyota Hilux Overland', ['overland'], 'Pickup 4x4 con célula desmontable.'),
  mm('Toyota', 'Land Cruiser', 'Toyota Land Cruiser', ['overland']),

  mm('Mitsubishi', 'L200', 'Mitsubishi L200', ['overland']),
  mm('Isuzu', 'D-Max', 'Isuzu D-Max', ['overland']),
  mm('Land Rover', 'Defender', 'Land Rover Defender', ['overland']),

  mm('Dacia', 'Dokker', 'Dacia Dokker', ['minicamper'], 'La base minicamper más económica.'),
  mm('Dacia', 'Pik-Pik', 'Dacia Pik-Pik Célula', ['overland']),
  mm('RAM', 'ProMaster', 'RAM ProMaster Célula', ['overland']),

  // ══════════ Fabricantes de campers de fábrica (furgón camperizado de serie) ══════════

  mm('Pössl', '', 'Pössl', ['gran-volumen'], 'Líder europeo de campers sobre base Ducato.'),
  mm('Globecar', '', 'Globecar', ['gran-volumen']),
  mm('Westfalia', '', 'Westfalia', ['camper-mediana', 'gran-volumen'], 'Camperizador histórico: Amundsen, Kepler, Jules Verne…'),
  mm('Malibu', '', 'Malibu', ['camper-mediana', 'gran-volumen'], 'División de furgonetas camper de Carthago.'),
  mm('Randger', '', 'Randger', ['camper-mediana', 'gran-volumen']),
  mm('Dreamer', '', 'Dreamer', ['gran-volumen'], 'Fabricante francés de furgonetas camper.'),
  mm('Benivan', '', 'Benivan', ['camper-mediana', 'gran-volumen'], 'División camper de Benimar.'),

  // ══════════ Fabricantes de autocaravanas (perfiladas, capuchinas e integrales) ══════════

  mm('Adria', '', 'Adria', ['perfilada', 'capuchina', 'integral'], 'Fabricante esloveno: autocaravanas Astra/Coral/Compact y caravanas Altea/Adora.'),
  mm('Arca', '', 'Arca', ['perfilada', 'integral']),
  mm('Autostar', '', 'Autostar', ['perfilada', 'integral']),
  mm('Bavaria', '', 'Bavaria', ['perfilada', 'integral']),
  mm('Benimar', '', 'Benimar', ['perfilada', 'capuchina', 'integral'], 'Fabricante español (Castellón): Tessoro, Mileo, Sport, Arteo, Norte.'),
  mm('Bürstner', '', 'Bürstner', ['perfilada', 'capuchina', 'integral'], 'Fabricante alemán: también caravanas (Premio, Averso).'),
  mm('Carado', '', 'Carado', ['perfilada', 'capuchina', 'integral'], 'Marca de acceso del grupo Hymer.'),
  mm('Caravans International', '', 'Caravans International', ['perfilada', 'capuchina'], 'Fabricante italiano del grupo Trigano.'),
  mm('Carthago', '', 'Carthago', ['perfilada', 'integral'], 'Premium alemán: líneas Chic y Compact.'),
  mm('Challenger', '', 'Challenger', ['perfilada', 'capuchina', 'integral'], 'Fabricante francés del grupo Trigano.'),
  mm('Chausson', '', 'Chausson', ['perfilada', 'capuchina', 'integral'], 'Fabricante francés del grupo Trigano.'),
  mm('Dethleffs', '', 'Dethleffs', ['perfilada', 'capuchina', 'integral'], 'Fabricante alemán: autocaravanas y caravanas.'),
  mm('Elnagh', '', 'Elnagh', ['perfilada', 'capuchina']),
  mm('Hymer', '', 'Hymer', ['perfilada', 'integral'], 'Premium alemán: B-Class, Exsis, Tramp; caravanas Eriba.'),
  mm('Itineo', '', 'Itineo', ['integral'], 'Autocaravanas integrales a precio asequible (grupo Trigano).'),
  mm('Knaus', '', 'Knaus', ['perfilada', 'capuchina', 'integral'], 'Fabricante alemán (Knaus Tabbert): también caravanas.'),
  mm('Laika', '', 'Laika', ['perfilada', 'integral'], 'Premium italiano del grupo Hymer: Ecovip, Kreos.'),
  mm('McLouis', '', 'McLouis', ['perfilada', 'capuchina', 'integral']),
  mm('Mobilvetta', '', 'Mobilvetta', ['perfilada', 'integral']),
  // Valor canónico legado ('Niesmann + Bissel'): se mantiene por compatibilidad
  // con anuncios ya publicados; se muestra con la grafía correcta.
  mm('Niesmann + Bischoff', '', 'Niesmann + Bissel', ['integral'], 'Integrales premium alemanas: Arto, Flair.'),
  mm('Pilote', '', 'Pilote', ['perfilada', 'capuchina', 'integral']),
  mm('PLA', '', 'PLA', ['perfilada', 'capuchina']),
  mm('Rapido', '', 'Rapido', ['perfilada', 'capuchina', 'integral']),
  mm('Rimor', '', 'Rimor', ['perfilada', 'capuchina', 'integral']),
  mm('Roller Team', '', 'Roller Team', ['perfilada', 'capuchina']),
  mm('Sterckeman', '', 'Sterckeman', ['perfilada', 'capuchina'], 'Fabricante francés: también caravanas.'),
  mm('Sun Living', '', 'Sun Living', ['perfilada', 'integral'], 'Marca económica de Adria.'),
  mm('Swift', '', 'Swift', ['perfilada', 'capuchina', 'integral'], 'Fabricante británico.'),
  mm('Weinsberg', '', 'Weinsberg', ['perfilada', 'capuchina', 'integral'], 'Marca calidad-precio de Knaus Tabbert.'),
]

// ── Consultas y utilidades ────────────────────────────────────────────────

/** Modelos aptos para una subcategoría (orden del catálogo maestro). */
export function modelosDeSubcategoria(slug: SubSlug): MarcaModelo[] {
  return MARCAS_MODELOS.filter(m => m.aptoPara.includes(slug))
}

/** Busca una entrada por su valor canónico (el de `productos.marca`). */
export function modeloPorValor(valor: string): MarcaModelo | undefined {
  return MARCAS_MODELOS.find(m => m.valor === valor)
}

export interface GrupoFabricante {
  fabricante: string
  modelos: MarcaModelo[]
}

/**
 * Agrupa una lista de modelos por fabricante, ordenando alfabéticamente los
 * grupos (es-ES) y dentro de cada grupo por modelo. Es la base de los
 * <optgroup> de los selectores y de las tarjetas de la página /marcas.
 */
export function agruparPorFabricante(modelos: MarcaModelo[]): GrupoFabricante[] {
  const grupos = new Map<string, MarcaModelo[]>()
  for (const m of modelos) {
    const lista = grupos.get(m.fabricante)
    if (lista) lista.push(m)
    else grupos.set(m.fabricante, [m])
  }
  return [...grupos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([fabricante, lista]) => ({
      fabricante,
      modelos: [...lista].sort((a, b) =>
        etiquetaModelo(a).localeCompare(etiquetaModelo(b), 'es')
      ),
    }))
}

/**
 * Slug de URL de un modelo, para /modelo/[slug]. Se deriva del valor canónico
 * (que es lo que está guardado en `productos.marca`), así que la URL y el
 * filtro del catálogo no pueden divergir.
 */
export function slugModelo(m: MarcaModelo): string {
  return m.valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Busca un modelo por su slug de URL. */
export function modeloPorSlug(slug: string): MarcaModelo | undefined {
  return MARCAS_MODELOS.find(m => slugModelo(m) === slug)
}

/** Etiqueta visible de un modelo dentro de su fabricante: 'Ducato', 'Benimar'… */
export function etiquetaModelo(m: MarcaModelo): string {
  return m.modelo || m.valor
}

/** Lista canónica plana (valores de `productos.marca`) sin duplicados. */
export function valoresUnicos(modelos: MarcaModelo[]): string[] {
  const vistos = new Set<string>()
  const valores: string[] = []
  for (const m of modelos) {
    if (!vistos.has(m.valor)) {
      vistos.add(m.valor)
      valores.push(m.valor)
    }
  }
  return valores
}

/** Fabricantes únicos de una lista de modelos, en orden alfabético es-ES. */
export function fabricantesUnicos(modelos: MarcaModelo[]): string[] {
  return agruparPorFabricante(modelos).map(g => g.fabricante)
}

/**
 * Resumen compacto para tarjetas: 'Fiat · Citroën · Peugeot +6'. Devuelve ''
 * si no hay modelos.
 */
export function resumenFabricantes(modelos: MarcaModelo[], max = 3): string {
  const fabs = fabricantesUnicos(modelos)
  if (fabs.length === 0) return ''
  const visibles = fabs.slice(0, max).join(' · ')
  return fabs.length > max ? `${visibles} +${fabs.length - max}` : visibles
}
