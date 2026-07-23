#!/usr/bin/env node
// v41: arregla la regresión que introdujo v40 en `permuta-una-pregunta-por-vez`. (2026-07-23)
//
//   node scripts/capacidad-nameask-guard.mjs            # escribe franco-n8n-v41.json
//   node scripts/capacidad-nameask-guard.mjs --check    # solo valida
//
// LA REGRESIÓN (medida en v40: permuta-una-pregunta-por-vez 0/5, era ~45-50% en v39):
// el guion nuevo de tramos/capacidad (## Permuta pto 5) se mete en el TURNO DEL NAME-ASK. Cuando
// Franco ya viene en la progresión (auto → km → nombre) y en el turno 3 debería pedir SÓLO el
// nombre, arranca a mostrar el abanico ("Teniendo en cuenta tu anticipo... financiar hasta el
// 50%... Para entrada..."). Es la trampa 6 al revés: el guion vívido que agregué le gana a la
// regla del cierre ("pedí el nombre"). v40 amplificó de ~50% a 0 la deuda del name-ask.
//
// EL FIX (prompt, dos guardas — el guion del name-ask tiene que GANAR en ese turno):
//   (A1) precondición al inicio del pto 5: si ya tenés auto+km en la progresión, NO corras el
//        punto (ni tramos ni dos caminos), andá al name-ask.
//   (A2) refuerzo en el cierre (## Permuta): con auto+km, el turno es SÓLO el nombre, sin abanico.
//   (B) calidad: dentro de cada tramo, elegí los MEJORES (más nuevos / menos km), no los más
//       baratos — v40 arrancó la entrada con Fiesta 105k / Gol 110k.
// Sólo prompt. El SQL de v40 (financia/tramo) NO se toca.
//
// ⚠️ PEGA A MANO Agustina y verifica byte a byte vs el vivo por MCP. Base: franco-n8n-v40.json.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v40.json')
const OUT = join(ROOT, 'franco-n8n-v41.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((k) => k.name === 'Franco (AI Agent)')
assert(franco, 'no existe Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(m.includes('CAPACIDAD DE COMPRA REAL'), 'no encuentro el guion de v40 — ¿partiste de v40?')
const EXPR_ANTES = (m.match(/\{\{/g) || []).length

// (A1) precondición al inicio del punto 5
{
  const ANCLA = '5. Presentá su CAPACIDAD DE COMPRA REAL,'
  unaVez(m, ANCLA, 'prompt (inicio del pto 5)')
  m = m.replace(
    ANCLA,
    '5. ANTES DE MOSTRAR NADA: si ya venís en la progresión de permuta y tenés el auto y los ' +
      'kilómetros del usado, NO corras este punto ni muestres opciones (ni tramos ni "dos caminos") ' +
      '— ese turno es el name-ask, andá directo a pedir el nombre (ver el cierre de esta sección). ' +
      'Este punto corre cuando el cliente PIDE ver opciones o recién arranca la permuta.\n' +
      '   Presentá su CAPACIDAD DE COMPRA REAL,',
  )
}

// (B) mejores por tramo, no los más baratos
{
  const ANCLA = 'de marcas o segmentos distintos (no dos iguales):'
  unaVez(m, ANCLA, 'prompt (bullet de financiación)')
  m = m.replace(
    ANCLA,
    'de marcas o segmentos distintos (no dos iguales), eligiendo dentro de cada tramo los MEJORES ' +
      '—más nuevos o de menos km—, no los más baratos a secas:',
  )
}

// (A2) refuerzo en el cierre de la progresión
{
  const ANCLA = 'pedir el NOMBRE Y APELLIDO para derivar.'
  unaVez(m, ANCLA, 'prompt (cierre de la progresión)')
  m = m.replace(
    ANCLA,
    'pedir el NOMBRE Y APELLIDO para derivar. NO presentes el abanico de tramos ni la capacidad de ' +
      'compra en este turno: eso va antes, ahora sólo falta el nombre.',
  )
}

franco.parameters.options.systemMessage = m

// ══════════════════ post-condiciones
assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES, 'cambió el número de expresiones {{ }} (no debía)')
assert((m.match(/ANTES DE MOSTRAR NADA/g) || []).length === 1, 'el guard A1 quedó duplicado o ausente')
assert((m.match(/los MEJORES/g) || []).length === 1, 'el ajuste de calidad quedó duplicado o ausente')
assert((m.match(/NO presentes el abanico de tramos/g) || []).length === 1, 'el refuerzo A2 quedó duplicado o ausente')
assert(m.includes('CAPACIDAD DE COMPRA REAL'), 'se perdió el guion de v40')
assert(m.includes('SI PAGA AL CONTADO'), 'se perdió la rama de contado')

for (const [marca, versión] of [
  ['TRATO:', 'v15'], ['SIN PRESUPUESTO DECLARADO', 'v16'], ['LA DERIVACIÓN MANDA', 'v23'],
  ['UNA PREGUNTA POR TURNO', 'v25'], ['ASESOR EN MARCHA', 'v38'], ['CAPACIDAD DE COMPRA REAL', 'v40'],
]) {
  const c = (m.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  assert(c === 1, `problema con la regla de ${versión}: "${marca}" aparece ${c} veces`)
}

// El SQL de v40 no se tocó.
const ls = wf.nodes.find((k) => k.name === 'Listar stock').parameters.query
assert(ls.includes('END AS tramo') && ls.includes('con_financiacion'), 'se perdió el SQL de tramo de v40')

// Trampa 3: una firma por key en todo el workflow.
const porKey = new Map()
for (const n of wf.nodes) {
  for (const mm of String(n.parameters?.query ?? '').matchAll(/\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g)) {
    const [, key, desc, tipo] = mm
    const firma = `${desc}||${tipo}`
    if (porKey.has(key)) assert(porKey.get(key) === firma, `trampa 3: la key '${key}' tiene firmas distintas`)
    else porKey.set(key, firma)
  }
}

console.log('✓ todas las aserciones pasan')
console.log('  (A1) guard al inicio del pto 5: en la progresión con auto+km NO se muestra el abanico')
console.log('  (A2) refuerzo en el cierre: ese turno es sólo el nombre')
console.log('  (B) dentro de cada tramo, los mejores (más nuevos/menos km), no los más baratos')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars · expresiones ${EXPR_ANTES} (sin cambio)`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
