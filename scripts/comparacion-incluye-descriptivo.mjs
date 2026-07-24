#!/usr/bin/env node
// BUG-B: al comparar/pedir info de 2+ vehículos, incluir el PORQUÉ descriptivo de la base (campo descripcion),
// no solo la ficha técnica. Base: franco-n8n-v61.json. (2026-07-24)
//
//   node scripts/comparacion-incluye-descriptivo.mjs [--check]
//
// EL BUG (captura + repro `comparacion-incluye-descriptivo`, ~2/3 flaky): "contame de la T-Cross y la Vento" →
//   Franco da motor/HP/transmisión/consumo/equipamiento (ficha técnica) y minimiza o saltea el ángulo de
//   `descripcion` ("la opción de quien quiere 0 km sin esperar", "gama alta sin el costo de patentar"). La data
//   está (Detalle auto ya devuelve descripcion); es comportamiento de prompt: el Paso 3 cubre el detalle de UN
//   auto pero no la comparación de varios, y la lista de specs tapa el porqué.
//
// EL FIX (prompt, Paso 3): regla explícita para comparaciones — por CADA auto el porqué de `descripcion` va sí
//   o sí (es lo que ayuda a elegir), la técnica breve y al servicio de eso.
// NO toca nada más. Solo prompt.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v61.json')
const OUT = join(ROOT, 'franco-n8n-v62.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'trampa 1')
const EXPR = (m.match(/\{\{/g) || []).length

const OLD = "- Fuera de esos dos casos, el condicionante no existe para el cliente.\n- El id de ese auto va en 'auto_ids'."
const NEW = "- Fuera de esos dos casos, el condicionante no existe para el cliente.\n- COMPARACIÓN (el cliente pide info de 2 o más autos: \"contame de las dos\", \"cuál me conviene\", una disyuntiva): para CADA auto el PORQUÉ de su `descripcion` va SÍ O SÍ —es lo que ayuda a elegir entre ellos: qué lo distingue y para quién es (\"la opción de quien quiere 0 km sin esperar\", \"andar de gama alta sin el costo de patentar\")—. La ficha técnica (motor, HP, consumo, equipamiento) va breve y al servicio de ese porqué, no como una planilla seca. Comparar con solo specs no ayuda a decidir: el diferenciador de cada uno es lo que no puede faltar.\n- El id de ese auto va en 'auto_ids'."
unaVez(m, OLD, 'prompt (Paso 3, antes de auto_ids)')
m = m.replace(OLD, NEW)
franco.parameters.options.systemMessage = m

// post
assert(m !== mAntes && m.startsWith('='), 'el prompt no cambió o perdió el =')
assert((m.match(/\{\{/g) || []).length === EXPR, 'cambió el número de expresiones {{ }}')
assert(m.includes('COMPARACIÓN (el cliente pide info de 2 o más autos'), 'no quedó la regla de comparación')
assert(m.includes('el PORQUÉ de su `descripcion` va SÍ O SÍ'), 'no quedó la regla del porqué')
// lo demás sobrevive (chequeos representativos)
assert(m.includes('Las alternativas van SIEMPRE por CARROCERÍA'), 'se perdió BUG-A')
assert(m.includes('querés que te conecte con un asesor para la tasación de tu vehículo, o preferís ver más opciones en stock?'), 'se perdió el embudo')
assert(m.includes('andá directo a pedir el nombre'), 'se perdió el name-ask gate')
assert(m.includes('ARRANCA por el porqué'), 'se perdió el detalle de un auto (Paso 3)')

console.log('✓ todas las aserciones pasan')
console.log('  Paso 3: regla de COMPARACIÓN (2+ autos) — el porqué de descripcion va sí o sí, técnica breve')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
