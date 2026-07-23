#!/usr/bin/env node
// v44: pulido del abanico de capacidad. Base: franco-n8n-v43.json. (2026-07-23) · sólo prompt (pto 5 y 6).
//
//   node scripts/valor-usado-interno.mjs [--check]
//
// TRES arrugas de v43, pedidas por Agustina:
//   (1) VALOR INTERNO: Franco recitaba "tu Yaris vale $13.339.898". El valor de Valuar usado es
//       SOLO interno (para saber qué ofrecer); al cliente NO se le dice ningún monto por su usado.
//   (2) KM OBLIGATORIO: Franco mostraba el abanico sin pedir el km (la valuación no lo usa, así que
//       lo saltea). Agustina: hay que pedir el km igual, ANTES de dar opciones.
//   (3) PRESENTACIÓN: mezclaba "estirar entregando tu usado" (dos caminos viejo) con los tramos y no
//       llegaba al techo. Ahora: 3 bloques con encabezado (entrada/intermedio/alto), sin "estirar".
// ⚠️ PEGA A MANO Agustina + verificación byte a byte por MCP.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v43.json')
const OUT = join(ROOT, 'franco-n8n-v44.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
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
const EXPR_ANTES = (m.match(/\{\{/g) || []).length

// (2) km obligatorio antes de mostrar
{
  const ANCLA = 'pedí el que falte (uno por turno) y recién con los 4 seguís.'
  unaVez(m, ANCLA, 'prompt (gate de 4 datos)')
  m = m.replace(ANCLA, ANCLA + ' EL KILOMETRAJE ES OBLIGATORIO aunque no cambie el cálculo del valor: NO lo saltees — si no te lo dieron, pedilo ANTES de mostrar cualquier opción.')
}

// (3) presentación en 3 bloques, sin "estirar", llegando al techo
{
  const ANCLA = 'Mostrás DOS autos por cada tramo (entrada, intermedio, alto), de CARROCERÍAS distintas (hatchback, sedán, SUV), eligiendo los mejores de cada uno; los "tramo"="fuera" NO se muestran.'
  unaVez(m, ANCLA, 'prompt (molde del abanico)')
  m = m.replace(ANCLA, 'Mostrás el abanico en TRES bloques con encabezado, DOS autos por bloque, de CARROCERÍAS distintas: 1) Entrada (los que vienen "tramo"="entrada"), 2) Intermedio ("tramo"="intermedio"), 3) Alto ("tramo"="alto" — acá van los MÁS CAROS que llegan a tu techo, NO te quedes corto ni cortes antes). Elegí los mejores de cada bloque; los "tramo"="fuera" NO se muestran. NO uses lenguaje de "estirar entregando tu usado": son tramos de TU CAPACIDAD, no un extra.')
}

// (1) el valor del usado es interno
{
  const OLD_6 = '6. El valor del usado sale de Valuar usado (referencia de mercado), NO lo inventás vos. Ese valor lo usás para armar el abanico, pero NO se lo afirmás al cliente como un valor cerrado ni prometas que "con eso te alcanza seguro": es preliminar y de referencia, y la tasación real la hace el asesor al inspeccionar el auto.'
  const NEW_6 = '6. El valor que te da Valuar usado es INTERNO Y SOLO TUYO: lo usás para saber QUÉ AUTOS ofrecerle, pero NUNCA se lo decís al cliente — ni exacto, ni redondeado, ni "aproximadamente", ni "según el mercado". Al cliente NO le mencionás NINGÚN monto por su usado: cuánto se lo toman lo define el asesor cuando lo inspecciona en persona. Armás el abanico y listo; si te pregunta cuánto vale, le respondés que la tasación la hace el asesor al ver el auto. Tampoco prometas que "con eso te alcanza seguro".'
  unaVez(m, OLD_6, 'prompt (pto 6)')
  m = m.replace(OLD_6, NEW_6)
}

franco.parameters.options.systemMessage = m

// post
assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES, 'cambió el número de expresiones {{ }} (no debía)')
assert((m.match(/EL KILOMETRAJE ES OBLIGATORIO/g) || []).length === 1, 'falta/duplicado el refuerzo del km')
assert((m.match(/TRES bloques con encabezado/g) || []).length === 1, 'falta/duplicado el molde de 3 bloques')
assert((m.match(/INTERNO Y SOLO TUYO/g) || []).length === 1, 'falta/duplicado el valor interno')
assert(!m.includes('Mostrás DOS autos por cada tramo'), 'quedó el molde viejo')
assert(!m.includes('NO se lo afirmás al cliente como un valor cerrado'), 'quedó el pto 6 viejo')
assert((m.match(/Valuar usado/g) || []).length === 2, 'Valuar usado tiene que seguir 2 veces (ptos 5 y 6)')
assert(m.includes('DESLINDE obligatorio'), 'se perdió el deslinde')
for (const [marca, v] of [['SIN PRESUPUESTO DECLARADO', 'v16'], ['LA DERIVACIÓN MANDA', 'v23'], ['ASESOR EN MARCHA', 'v38'], ['CAPACIDAD DE COMPRA REAL', 'v42']]) {
  assert((m.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length === 1, `regla ${v} rota: "${marca}"`)
}
assert(wf.nodes.find((n) => n.name === 'Valuar usado').parameters.query.includes('valor_ref_2020'), 'se tocó Valuar usado')
assert(wf.nodes.find((n) => n.name === 'Listar stock').parameters.query.includes('END AS tramo'), 'se tocó Listar stock')

console.log('✓ todas las aserciones pasan')
console.log('  (1) valor del usado interno (no recita monto)')
console.log('  (2) km obligatorio antes de mostrar')
console.log('  (3) abanico en 3 bloques (entrada/intermedio/alto), sin "estirar", llegando al techo')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars · expresiones ${EXPR_ANTES} (sin cambio)`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
