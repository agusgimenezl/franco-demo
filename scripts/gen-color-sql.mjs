#!/usr/bin/env node
// Genera scripts/color-metadata.sql a partir de stock.csv.
//
// El color YA existía en el texto de `content` (armar_content lo escribe), pero las tools
// leen `metadata`, y armar_metadata() nunca lo guardó. Por eso Franco contestaba "no tengo
// un filtro por color en el stock" (reproducido en el eval `color-gris`, 0/3).
//
// El UPDATE es aditivo: sólo agrega la clave `color` al jsonb. NO toca `content` ni
// `embedding`, así que no hay que revectorizar.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const lineas = readFileSync(join(ROOT, 'stock.csv'), 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim())

const head = lineas[0].split(',')
const iID = head.indexOf('ID')
const iColor = head.indexOf('Color')
if (iID === -1 || iColor === -1) throw new Error('stock.csv no tiene columnas ID y/o Color')

const filas = []
for (let i = 1; i < lineas.length; i++) {
  const celdas = lineas[i].split(',')
  const id = parseInt(celdas[iID], 10)
  const color = String(celdas[iColor] ?? '').trim()
  if (!Number.isInteger(id)) throw new Error(`id inválido en la fila ${i}: ${celdas[iID]}`)
  // Sanitizado, no escapado: los colores son palabras. Si aparece algo raro, aborta en vez
  // de generar SQL con comillas dentro.
  if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$/.test(color)) throw new Error(`color sospechoso en id ${id}: "${color}"`)
  filas.push({ id, color })
}
if (filas.length !== 17) throw new Error(`esperaba 17 autos, hay ${filas.length}`)

const ids = new Set(filas.map((f) => f.id))
if (ids.size !== filas.length) throw new Error('hay ids duplicados en stock.csv')

const values = filas.map((f) => `  (${f.id}, '${f.color}')`).join(',\n')

const sql = `-- Agrega \`color\` al metadata de autos_disponibles (2026-07-21).
-- Generado por scripts/gen-color-sql.mjs desde stock.csv. No editar a mano.
--
-- Idempotente: se puede correr las veces que haga falta.
-- Aditivo: sólo suma la clave \`color\` al jsonb. NO toca \`content\` ni \`embedding\`,
-- así que no hay que revectorizar ni regenerar embeddings.

UPDATE autos_disponibles a
SET metadata = a.metadata || jsonb_build_object('color', v.color)
FROM (VALUES
${values}
) AS v(id, color)
WHERE (a.metadata->>'id')::int = v.id;

-- Verificación: 17 filas, ninguna con color NULL.
SELECT (metadata->>'id')::int AS id,
       metadata->>'marca' || ' ' || (metadata->>'modelo') AS auto,
       metadata->>'color' AS color
FROM autos_disponibles
ORDER BY 1;
`

writeFileSync(join(ROOT, 'scripts', 'color-metadata.sql'), sql)
console.log(`✓ ${filas.length} autos · colores: ${[...new Set(filas.map((f) => f.color))].sort().join(', ')}`)
console.log('  escrito -> scripts/color-metadata.sql')
