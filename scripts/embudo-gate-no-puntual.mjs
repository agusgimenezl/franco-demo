#!/usr/bin/env node
// BUG-embudo (fix de regresión de v58): el gate del abanico condicionaba en "pidió ver opciones EN GENERAL",
// demasiado estricto: suprimía el abanico de capacidad cuando el cliente daba un anticipo pero no decía
// literalmente "mostrame el catálogo" (regresó `capacidad-de-compra-financiada` a name-ask 3/3, log 7612:
// Franco ni llama a Listar stock). Base: franco-n8n-v59.json. (2026-07-24)
//
//   node scripts/embudo-gate-no-puntual.mjs [--check]
//
// FIX: la condición (a) del gate pasa de "pidió ver opciones EN GENERAL" a "NO vino por autos PUNTUALES
//   (no nombró modelos específicos)". Así:
//   - PUNTUAL (nombró modelos) + permuta → embudo (mata el dump — se mantiene el fix de v58/v59).
//   - NO-PUNTUAL + anticipo/presupuesto → abanico de capacidad (vuelve; dar un anticipo YA es pedir opciones).
//   - NO-PUNTUAL + sin presupuesto → embudo (el guard SQL de v59 devuelve 0 filas igual).
// Solo reword del prompt; NO toca el guard SQL, el guion del embudo, ni nada más.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v59.json')
const OUT = join(ROOT, 'franco-n8n-v60.json')
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
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
const EXPR = (m.match(/\{\{/g) || []).length

// (A) gate del abanico: condición (a) = no puntual
const A_OLD = 'Este punto (el abanico de capacidad) corre SOLO si se cumplen DOS cosas a la vez: (a) el cliente pidió ver opciones EN GENERAL —no vino por autos puntuales— Y (b) declaró un presupuesto o anticipo.'
const A_NEW = 'Este punto (el abanico de capacidad) corre SOLO si se cumplen DOS cosas a la vez: (a) el cliente NO vino por autos puntuales (no te nombró modelos específicos que quiere) Y (b) declaró un presupuesto o anticipo. OJO: dar un anticipo/efectivo y querer ver qué le entra YA es pedir opciones —no le exijas que diga "mostrame el catálogo" para armar el abanico; con anticipo declarado y sin modelo puntual, el abanico VA.'
unaVez(m, A_OLD, 'prompt (gate condición a)')
m = m.replace(A_OLD, A_NEW)

// (B) narrativa de capacidad: mismo reword
const B_OLD = 'SOLO si el cliente pidió opciones EN GENERAL Y declaró un anticipo/presupuesto (si vino por autos puntuales o no dio presupuesto, seguí el embudo de arriba, NO esto), presentás su CAPACIDAD DE COMPRA REAL.'
const B_NEW = 'SOLO si el cliente NO vino por autos puntuales Y declaró un anticipo/presupuesto (si vino por autos puntuales o no dio presupuesto, seguí el embudo de arriba, NO esto), presentás su CAPACIDAD DE COMPRA REAL.'
unaVez(m, B_OLD, 'prompt (narrativa capacidad)')
m = m.replace(B_OLD, B_NEW)

franco.parameters.options.systemMessage = m

// post-condiciones
assert(m !== mAntes && m.startsWith('='), 'el prompt no cambió o perdió el =')
assert((m.match(/\{\{/g) || []).length === EXPR, 'cambió el número de expresiones {{ }}')
assert(m.includes('(a) el cliente NO vino por autos puntuales (no te nombró modelos específicos'), 'no quedó el reword de la condición a')
assert(m.includes('con anticipo declarado y sin modelo puntual, el abanico VA'), 'no quedó la aclaración pro-abanico')
assert(!m.includes('(a) el cliente pidió ver opciones EN GENERAL —no vino por autos puntuales—'), 'quedó la condición vieja')
assert(m.includes('SOLO si el cliente NO vino por autos puntuales Y declaró un anticipo/presupuesto'), 'no quedó el reword de la narrativa')
// lo demás sobrevive
assert(m.includes('querés que te conecte con un asesor para la tasación de tu vehículo, o preferís ver más opciones en stock?'), 'se perdió el guion del embudo')
assert(m.includes('NO listás un abanico de autos (sin presupuesto'), 'se perdió el ajuste de línea 135 (v59)')
assert(m.includes('andá directo a pedir el nombre'), 'se perdió el name-ask gate')
const lsq = wf.nodes.find((n) => n.name === 'Listar stock').parameters.query
assert(lsq.includes('AND NOT (' + "{{ $fromAI('precio_objetivo', 'El techo de presupuesto real del cliente en pesos, sin estirar. Poner 0 si no dio presupuesto.', 'number') }}" + ' = 0 AND ('), 'se perdió el guard SQL (v59)')

console.log('✓ todas las aserciones pasan')
console.log('  gate condición (a): "pidió ver opciones EN GENERAL" -> "NO vino por autos puntuales"')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
