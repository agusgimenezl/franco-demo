#!/usr/bin/env node
// Expone `tamano`, `descripcion` y `condicionantes` a Franco a través de las tools
// (2026-07-21). Depende de que scripts/descripcion-metadata.sql ya esté aplicado.
//
//   node scripts/descripcion-en-tools.mjs            # escribe franco-n8n-v17.json
//   node scripts/descripcion-en-tools.mjs --check    # solo valida
//
// REPARTO DESPAREJO, A PROPÓSITO — es una decisión de tokens, no un olvido:
//
//   Listar stock   -> SOLO `tamano`
//   Buscar auto    -> tamano + descripcion + condicionantes
//   Detalle auto   -> tamano + descripcion + condicionantes
//
// `Listar stock` devuelve los 17 autos de una. Sumarle descripcion + condicionantes son
// ~1.500 tokens por llamada, y la trampa 5 de este proyecto es exactamente haber reventado
// un modelo por volumen de tokens (el CRM con el catálogo crudo). Además no aporta: en un
// listado de 17 el cliente no lee prosa, lee precios. La prosa rinde donde Franco habla de
// pocos autos, que es `Detalle auto` y `Buscar auto`.
//
// `tamano` sí va a las tres porque es corto (~2 tokens x 17) y es lo que vuelve
// determinística la comparación "quiero algo del mismo tamaño" — el bug del Cronos (4,36 m)
// recomendado a quien pedía mantener el tamaño de un Mobi (3,57 m). Hoy eso lo sostiene un
// parche de prompt (`## Recomendación por criterio`) que infiere el tamaño de `carroceria`.
// Con la columna, ese parche pasa a tener un dato en vez de una inferencia.
//
// NO TOCA EL PROMPT. A propósito, y es un cambio por vez: primero se mide qué hace Franco
// con los campos nuevos por su cuenta. Si los usa bien, no hace falta regla; si los vuelca
// mecánicamente (leer los condicionantes como una lista de defectos espanta al cliente),
// ahí se escribe la regla sabiendo qué corregir.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v16.json')
const OUT = join(ROOT, 'franco-n8n-v17.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`✗ ASERCIÓN FALLIDA: ${msg}`)
    process.exit(1)
  }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => {
  const x = wf.nodes.find((k) => k.name === n)
  assert(x, `no existe el nodo "${n}"`)
  return x
}

const COLS_PROSA =
  "  metadata->>'tamano' AS tamano,\n" +
  "  metadata->>'descripcion' AS descripcion,\n" +
  "  metadata->>'condicionantes' AS condicionantes"

// ─────────────────────────────────────────── Listar stock: sólo `tamano`
const listar = nodo('Listar stock')
{
  const q = listar.parameters.query
  assert(q.includes('WITH base AS'), 'Listar stock no tiene el CTE de v14 — ¿partiste de v16?')
  assert(!q.includes('tamano'), 'Listar stock ya tiene tamano — ¿ya se aplicó?')

  // (1) columna dentro del CTE, pegada a carroceria
  const ANCLA_CTE = "    metadata->>'carroceria' AS carroceria,\n"
  assert(q.split(ANCLA_CTE).length - 1 === 1, 'Listar stock: la columna carroceria del CTE no aparece 1 vez')

  // (2) proyección final
  const ANCLA_PROY =
    'SELECT id, titulo, precio, foto_principal, carroceria, color, condicion, anio, km,\n' +
    '       combustible, consumo, categoria'
  assert(q.split(ANCLA_PROY).length - 1 === 1, 'Listar stock: la proyección final no aparece 1 vez')

  listar.parameters.query = q
    .replace(ANCLA_CTE, ANCLA_CTE + "    metadata->>'tamano' AS tamano,\n")
    .replace(ANCLA_PROY, ANCLA_PROY + ', tamano')
}

// ─────────────────────────────────────────── Buscar auto: los tres
const buscar = nodo('Buscar auto')
{
  const q = buscar.parameters.query
  assert(buscar.type === 'n8n-nodes-base.postgresTool', 'Buscar auto no es postgresTool — ¿partiste de v8+?')
  assert(!q.includes('descripcion'), 'Buscar auto ya tiene descripcion — ¿ya se aplicó?')

  const ANCLA = "  metadata->>'consumo' AS consumo\nFROM autos_disponibles"
  assert(q.split(ANCLA).length - 1 === 1, 'Buscar auto: no encuentro el final de la lista de columnas')

  buscar.parameters.query = q.replace(
    ANCLA,
    "  metadata->>'consumo' AS consumo,\n" + COLS_PROSA + '\nFROM autos_disponibles',
  )
}

// ─────────────────────────────────────────── Detalle auto: los tres
const detalle = nodo('Detalle auto')
{
  const q = detalle.parameters.query
  assert(!q.includes('descripcion'), 'Detalle auto ya tiene descripcion — ¿ya se aplicó?')

  const ANCLA = '  content AS ficha_completa\nFROM autos_disponibles'
  assert(q.split(ANCLA).length - 1 === 1, 'Detalle auto: no encuentro ficha_completa')

  detalle.parameters.query = q.replace(ANCLA, COLS_PROSA + ',\n' + '  content AS ficha_completa\nFROM autos_disponibles')
}

// ─────────────────────────────────────────── post-condiciones
for (const [n, esperadas] of [['Listar stock', ['tamano']], ['Buscar auto', ['tamano', 'descripcion', 'condicionantes']], ['Detalle auto', ['tamano', 'descripcion', 'condicionantes']]]) {
  const q = nodo(n).parameters.query
  for (const c of esperadas) assert(q.includes(`AS ${c}`), `${n}: falta la columna ${c}`)
}
// El listado NO debe llevar prosa: es el punto del cambio.
for (const c of ['descripcion', 'condicionantes']) {
  assert(!listar.parameters.query.includes(c), `Listar stock no debe traer ${c} (tokens)`)
}
// Lo que ya funcionaba sigue igual.
assert(listar.parameters.query.includes('END AS categoria'), 'se perdió la categoría de Listar stock')
assert(listar.parameters.query.includes('NOT EXISTS (SELECT 1 FROM en_presupuesto)'), 'se perdió el fallback de v14')
// precio_num tiene que quedar DENTRO del CTE: en el ORDER BY final es legítimo, en la
// proyección sumaría tokens al agente. Se mira sólo el tramo de la proyección.
{
  const q = listar.parameters.query
  const proy = q.slice(q.indexOf('SELECT id, titulo'), q.indexOf('FROM (\n'))
  assert(proy.length > 0, 'no encuentro la proyección final de Listar stock')
  assert(!proy.includes('precio_num'), 'precio_num se filtró a la proyección y suma tokens al agente')
  assert(proy.includes('tamano'), 'tamano no quedó en la proyección final')
}
assert(detalle.parameters.query.includes('jsonb_typeof'), 'se perdió el fallback de fotos de Detalle auto')
assert(buscar.parameters.query.includes("metadata->>'color' ILIKE"), 'se perdió el filtro de color de Buscar auto')

// Trampa 3 en todo el workflow.
const porKey = new Map()
for (const n of wf.nodes) {
  for (const m of String(n.parameters?.query ?? '').matchAll(/\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g)) {
    const [, key, desc, tipo] = m
    const firma = `${desc}||${tipo}`
    if (porKey.has(key)) assert(porKey.get(key) === firma, `trampa 3: la key '${key}' difiere`)
    else porKey.set(key, firma)
  }
}

console.log('✓ todas las aserciones pasan')
console.log('  Listar stock  -> + tamano')
console.log('  Buscar auto   -> + tamano, descripcion, condicionantes')
console.log('  Detalle auto  -> + tamano, descripcion, condicionantes')
console.log(`  trampa 3: ${porKey.size} keys $fromAI, todas con firma única`)

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
