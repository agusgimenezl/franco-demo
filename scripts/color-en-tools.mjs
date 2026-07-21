#!/usr/bin/env node
// Expone `color` en las tools de stock (2026-07-21).
//
//   node scripts/color-en-tools.mjs            # escribe franco-n8n-v10.json
//   node scripts/color-en-tools.mjs --check    # solo valida, no escribe
//
// REQUISITO PREVIO: correr scripts/color-metadata.sql, que agrega la clave `color` al
// metadata. Sin eso, las columnas nuevas salen NULL.
//
// POR QUÉ: `color` estaba sólo en el texto de `content`; las tools leen `metadata`. Franco
// contestaba literalmente "no tengo un filtro por color en el stock" (eval `color-gris`,
// 0/3 antes del cambio). Los 5 grises son Cronos(1), Etios(4), Corolla(5), Duster(11) y
// Ranger(14).
//
// El filtro va por DOS caminos a propósito: un parámetro `color` explícito, y además el
// color sumado al concat del ILIKE de `marca_o_modelo`. Así, mande el agente "gris" en el
// campo de texto o en el de color, la query responde igual. Un solo camino era una apuesta
// a que el modelo elija bien el parámetro.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v9.json')
const OUT = join(ROOT, 'franco-n8n-v10.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`✗ ASERCIÓN FALLIDA: ${msg}`)
    process.exit(1)
  }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => wf.nodes.find((x) => x.name === n)

const listar = nodo('Listar stock')
const buscar = nodo('Buscar auto')
const detalle = nodo('Detalle auto')
for (const [n, x] of [['Listar stock', listar], ['Buscar auto', buscar], ['Detalle auto', detalle]]) {
  assert(x, `no existe el nodo "${n}"`)
  assert(x.type === 'n8n-nodes-base.postgresTool', `"${n}" no es un postgresTool (es ${x.type})`)
}
assert(
  buscar.parameters.query.includes('marca_o_modelo'),
  '"Buscar auto" no es la versión postgresTool de C2 — correr primero c2-buscar-auto-postgres.mjs',
)

// Ninguna debe tener color ya.
for (const [n, x] of [['Listar stock', listar], ['Buscar auto', buscar], ['Detalle auto', detalle]]) {
  assert(!/AS color/.test(x.parameters.query), `"${n}" ya expone color — ¿el cambio ya se aplicó?`)
}

// ---------------------------------------------------------------- 1) columna `color`
// Se engancha después de `carroceria`, que existe en las tres queries.
const ANCLA = "  metadata->>'carroceria' AS carroceria,"
const ANCLA_DETALLE = "  metadata->>'carroceria'   AS carroceria,"

for (const [n, x, ancla] of [
  ['Listar stock', listar, ANCLA],
  ['Buscar auto', buscar, ANCLA],
  ['Detalle auto', detalle, ANCLA_DETALLE],
]) {
  const q = x.parameters.query
  assert(q.includes(ancla), `no encuentro el ancla de carroceria en "${n}"`)
  assert(q.split(ancla).length === 2, `el ancla de carroceria aparece más de una vez en "${n}"`)
  x.parameters.query = q.replace(ancla, `${ancla}\n  metadata->>'color' AS color,`)
}

// ---------------------------------------------------------------- 2) filtro en Buscar auto
const D_COLOR =
  'El color que pidio el cliente (gris, blanco, negro, azul, rojo, verde). Poner vacio si no menciono ninguno.'
const TXT_COLOR =
  `{{ $fromAI('color', '${D_COLOR}', 'string').replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g, '').trim() }}`

// El concat del ILIKE de marca_o_modelo pasa a incluir el color.
const CONCAT_VIEJO =
  "   (metadata->>'marca' || ' ' || (metadata->>'modelo') || ' ' || COALESCE(metadata->>'carroceria', ''))"
const CONCAT_NUEVO =
  "   (metadata->>'marca' || ' ' || (metadata->>'modelo') || ' ' || COALESCE(metadata->>'carroceria', '') || ' ' || COALESCE(metadata->>'color', ''))"

assert(buscar.parameters.query.includes(CONCAT_VIEJO), 'no encuentro el concat del ILIKE en "Buscar auto"')
assert(
  buscar.parameters.query.split(CONCAT_VIEJO).length === 2,
  'el concat del ILIKE aparece más de una vez en "Buscar auto"',
)
buscar.parameters.query = buscar.parameters.query.replace(CONCAT_VIEJO, CONCAT_NUEVO)

// Y se agrega la condición explícita de color, antes de los filtros de precio.
const PRECIO_ANCLA = '  AND ({{ $fromAI(\'precio_min\''
assert(buscar.parameters.query.includes(PRECIO_ANCLA), 'no encuentro el filtro de precio_min en "Buscar auto"')
buscar.parameters.query = buscar.parameters.query.replace(
  PRECIO_ANCLA,
  `  AND ('${TXT_COLOR}' = '' OR metadata->>'color' ILIKE '${TXT_COLOR}')\n${PRECIO_ANCLA}`,
)

// ---------------------------------------------------------------- 3) descripciones
const descs = [
  [listar, 'carroceria, condicion', 'carroceria, color, condicion'],
  [detalle, 'carroceria, condicion', 'carroceria, color, condicion'],
]
for (const [x, viejo, nuevo] of descs) {
  if (x.parameters.toolDescription.includes(viejo)) {
    x.parameters.toolDescription = x.parameters.toolDescription.replace(viejo, nuevo)
  }
}
const DESC_BUSCAR_VIEJO = 'Busca autos del stock por marca, modelo o carroceria, y opcionalmente por rango de precio.'
const DESC_BUSCAR_NUEVO =
  'Busca autos del stock por marca, modelo, carroceria o COLOR, y opcionalmente por rango de precio. Para "que tenes en gris" pasa color=gris y deja marca_o_modelo vacio: devuelve TODOS los de ese color.'
assert(
  buscar.parameters.toolDescription.includes(DESC_BUSCAR_VIEJO),
  'la descripción de "Buscar auto" no es la esperada',
)
buscar.parameters.toolDescription = buscar.parameters.toolDescription.replace(
  DESC_BUSCAR_VIEJO,
  DESC_BUSCAR_NUEVO,
)

// ---------------------------------------------------------------- post-condiciones
for (const [n, x] of [['Listar stock', listar], ['Buscar auto', buscar], ['Detalle auto', detalle]]) {
  assert(/AS color/.test(x.parameters.query), `"${n}" no quedó exponiendo color`)
  assert(x.parameters.query.split('AS color').length === 2, `"${n}" quedó con color duplicado`)
}
assert(buscar.parameters.query.includes("metadata->>'color' ILIKE"), 'falta el filtro explícito de color')
assert(buscar.parameters.query.includes("COALESCE(metadata->>'color', '')"), 'falta el color en el concat del ILIKE')

// Trampa 3: cada key de $fromAI tiene que usar SIEMPRE la misma descripción y tipo.
const todas = wf.nodes.flatMap((n) => [...String(n.parameters?.query ?? '').matchAll(
  /\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g,
)])
const porKey = new Map()
for (const m of todas) {
  const [, key, desc, tipo] = m
  const firma = `${desc}||${tipo}`
  if (porKey.has(key)) {
    assert(porKey.get(key) === firma, `trampa 3: la key $fromAI '${key}' tiene descripciones/tipos distintos`)
  } else porKey.set(key, firma)
}

console.log('✓ todas las aserciones pasan')
console.log(`  color expuesto en: Listar stock, Buscar auto, Detalle auto`)
console.log(`  filtro de color en Buscar auto (parámetro explícito + concat del ILIKE)`)
console.log(`  keys $fromAI verificadas: ${[...porKey.keys()].join(', ')}`)

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
  console.log('\n--- QUERY NUEVA DE "Buscar auto" ---\n')
  console.log(buscar.parameters.query)
}
