#!/usr/bin/env node
// Filtro de kilometraje en las tools de stock (2026-07-21).
//
//   node scripts/km-max-en-tools.mjs            # escribe franco-n8n-v13.json
//   node scripts/km-max-en-tools.mjs --check    # solo valida
//
// Parte de franco-n8n-v11.json A PROPÓSITO: v12 (el bullet de política en el prompt) se
// revierte. Medido: `km-con-presupuesto` 0/4 -> 1/4, que a esa escala es ruido, y en una
// corrida Franco presentó el Cronos de 58.000 km como si cumpliera el pedido de "menos de
// 50.000". El bullet no logró el objetivo y sumaba 645 caracteres a un prompt ya largo,
// con riesgo de yo-yo sin medir.
//
// POR QUÉ SQL Y NO PROMPT: "qué autos tienen menos de 50.000 km" es calculable, así que va
// a la query (regla del proyecto). Con el filtro puesto, la tool devuelve SÓLO los que
// cumplen y Franco no tiene de dónde sacar el Cronos de 58k.
//
// POR QUÉ NO SE VIO ANTES: el eval `km-maximo` (pedir kilometraje SIN presupuesto) pasa 3/3
// sin ningún cambio — ahí Franco filtra bien de cabeza sobre los 17 autos. El bug aparece
// sólo cuando tiene que combinar DOS criterios (presupuesto + km). Mirar el caso simple
// llevó a descartar este filtro por "código muerto"; era el caso equivocado.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v11.json')
const OUT = join(ROOT, 'franco-n8n-v13.json')
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
assert(listar && buscar, 'faltan "Listar stock" y/o "Buscar auto"')

// Confirmamos que partimos de v11: el bullet de v12 NO debe estar (es la reversión).
const sm = nodo('Franco (AI Agent)').parameters.options.systemMessage
assert(
  !sm.includes('Nunca digas que "no hay"'),
  'el prompt trae el bullet de v12: hay que partir de v11, no de v12',
)
assert(sm.startsWith('='), 'el systemMessage perdió el prefijo "=" (trampa 1)')

// El color (v10) sí tiene que estar: v11 lo incluye.
for (const [n, x] of [['Listar stock', listar], ['Buscar auto', buscar]]) {
  assert(/AS color/.test(x.parameters.query), `"${n}" no trae la columna color — ¿v11 correcto?`)
  assert(!/km_max/.test(x.parameters.query), `"${n}" ya tiene km_max — ¿el cambio ya se aplicó?`)
}

// Trampa 3: misma key de $fromAI => descripción y tipo BYTE-IDÉNTICOS en todas sus
// ocurrencias, en los dos nodos.
const D_KM = 'Kilometraje maximo que acepta el cliente, en kilometros (ej: 50000). Poner 0 si no menciono ninguno.'
const KM = `{{ $fromAI('km_max', '${D_KM}', 'number') }}`

// Cast defensivo: si algún km viniera con puntos o texto, un ::int pelado tira y se lleva
// puesta la tool entera (trampa 4). Se limpia a dígitos; si queda vacío, cuenta como 0 y el
// auto no se excluye por un dato faltante.
const COND = `  AND (${KM} = 0 OR COALESCE(NULLIF(regexp_replace(metadata->>'km', '[^0-9]', '', 'g'), '')::int, 0) <= ${KM})`

// --- Listar stock: se engancha después del filtro de precio_max, antes del ORDER BY.
const ANCLA_LISTAR = `ORDER BY (metadata->>'precio')::int DESC;`
for (const [n, x] of [['Listar stock', listar], ['Buscar auto', buscar]]) {
  const q = x.parameters.query
  assert(q.includes(ANCLA_LISTAR), `no encuentro el ORDER BY en "${n}"`)
  assert(q.split(ANCLA_LISTAR).length === 2, `el ORDER BY aparece más de una vez en "${n}"`)
  x.parameters.query = q.replace(ANCLA_LISTAR, `${COND}\n${ANCLA_LISTAR}`)
}

// --- descripciones: que el agente sepa que puede filtrar por km.
const DESC_LISTAR_VIEJO = 'Usala cuando el cliente quiere ver el catálogo o todo lo disponible.'
const DESC_LISTAR_NUEVO =
  'Usala cuando el cliente quiere ver el catálogo o todo lo disponible. Si el cliente puso un tope de kilometraje ("menos de 50.000 km"), pasalo en km_max y la query ya te devuelve SOLO los que cumplen: no lo filtres de cabeza.'
assert(listar.parameters.toolDescription.includes(DESC_LISTAR_VIEJO), 'la descripción de "Listar stock" no es la esperada')
listar.parameters.toolDescription = listar.parameters.toolDescription.replace(DESC_LISTAR_VIEJO, DESC_LISTAR_NUEVO)

const DESC_BUSCAR_VIEJO = 'y opcionalmente por rango de precio.'
const DESC_BUSCAR_NUEVO = 'y opcionalmente por rango de precio o tope de kilometraje (km_max).'
assert(buscar.parameters.toolDescription.includes(DESC_BUSCAR_VIEJO), 'la descripción de "Buscar auto" no es la esperada')
buscar.parameters.toolDescription = buscar.parameters.toolDescription.replace(DESC_BUSCAR_VIEJO, DESC_BUSCAR_NUEVO)

// --- post-condiciones
for (const [n, x] of [['Listar stock', listar], ['Buscar auto', buscar]]) {
  const q = x.parameters.query
  assert(q.includes('km_max'), `"${n}" no quedó con el filtro`)
  assert(q.indexOf('km_max') < q.indexOf(ANCLA_LISTAR), `en "${n}" el filtro quedó después del ORDER BY`)
  assert(q.split(D_KM).length === 3, `"${n}" debería tener km_max exactamente 2 veces (condición + comparación)`)
}

// Trampa 3 sobre TODO el workflow.
const porKey = new Map()
for (const n of wf.nodes) {
  for (const m of String(n.parameters?.query ?? '').matchAll(/\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g)) {
    const [, key, desc, tipo] = m
    const firma = `${desc}||${tipo}`
    if (porKey.has(key)) assert(porKey.get(key) === firma, `trampa 3: la key '${key}' tiene descripciones/tipos distintos`)
    else porKey.set(key, firma)
  }
}

console.log('✓ todas las aserciones pasan')
console.log('  revierte el bullet de v12 (parte de v11)')
console.log('  km_max agregado a: Listar stock, Buscar auto')
console.log(`  keys $fromAI verificadas: ${[...porKey.keys()].join(', ')}`)

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
