#!/usr/bin/env node
// BUG-A.1: al ofrecer alternativas por carrocería, mostrar TODAS las de esa carrocería (no 3 con "querés ver
// más"), y recién después preguntar si quiere el detalle de alguna o el stock completo.
// Base: franco-n8n-v63.json. (2026-07-24)
//
//   node scripts/buga-mostrar-todas-las-alternativas.mjs [--check]
//
// EL BUG (captura Agustina): pidió Amarok (pickup). Franco mostró 3 pickups (Amarok/S10/Hilux) y ofreció
//   "más pickups", omitiendo la Ranger. Debe mostrar TODAS las pickups (las 4) y después ofrecer detalle o
//   stock completo. La herramienta ya devuelve TODAS (match_tipo='alternativa'); es Franco que capa a 3.
// FIX (prompt ## Buscar auto): mostrar TODAS las alternativas de la carrocería; cerrar con detalle/stock completo.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v63.json')
const OUT = join(ROOT, 'franco-n8n-v64.json')
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

const OLD = '3) Las alternativas van SIEMPRE por CARROCERÍA (pidió una pickup → le ofrecés las pickups; una SUV → las SUV), NUNCA otra marca al azar de otra carrocería. 4) Cerrás ofreciendo ver todo el stock o el detalle de algún modelo.'
const NEW = '3) Las alternativas van SIEMPRE por CARROCERÍA y van TODAS las de esa carrocería que trae la herramienta (match_tipo="alternativa"): si hay 4 pickups, mostrás las 4, NO una muestra de 3 con "querés ver más". NUNCA otra marca al azar de otra carrocería. 4) Recién después de mostrarlas TODAS, cerrás preguntando si quiere el detalle de alguna o prefiere ver el stock completo.'
unaVez(m, OLD, 'prompt (## Buscar auto, regla de alternativas)')
m = m.replace(OLD, NEW)
franco.parameters.options.systemMessage = m

// post
assert(m !== mAntes && m.startsWith('='), 'el prompt no cambió o perdió el =')
assert((m.match(/\{\{/g) || []).length === EXPR, 'cambió el número de expresiones {{ }}')
assert(m.includes('van TODAS las de esa carrocería que trae la herramienta'), 'no quedó la regla de TODAS')
assert(m.includes('cerrás preguntando si quiere el detalle de alguna o prefiere ver el stock completo'), 'no quedó el cierre')
assert(!m.includes('4) Cerrás ofreciendo ver todo el stock o el detalle de algún modelo.'), 'quedó el cierre viejo')
// sobrevive
assert(m.includes('DECÍLO en vez de esconderlo'), 'se perdió BUG-A (no ocultar modelo)')
assert(m.includes('COMPARACIÓN (el cliente pide info de 2 o más autos'), 'se perdió BUG-B')
assert(m.includes('querés que te conecte con un asesor para la tasación de tu vehículo, o preferís ver más opciones en stock?'), 'se perdió el embudo')

console.log('✓ todas las aserciones pasan')
console.log('  ## Buscar auto: mostrar TODAS las alternativas de la carrocería; cerrar con detalle/stock completo')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
