#!/usr/bin/env node
// Recomendación por criterio blando: sin repetir el criterio al inicio y al final (2026-07-22, cola #4).
// Se apila sobre v35 (#2), así v36 lleva #2 + #4 y Agustina pega una sola vez.
//
//   node scripts/recomendacion-concreta.mjs            # escribe franco-n8n-v36.json
//   node scripts/recomendacion-concreta.mjs --check    # solo valida
//
// LA CAPTURA / MEDIDO EN v34 (repro-4.json, 3/3). A "qué autos me recomendás que sean
// económicos y confiables?" Franco:
//   (1) ABRE repitiendo el criterio: "Para opciones económicas y confiables, te recomiendo..."
//   (2) a veces CIERRA repitiéndolo otra vez: "Todos son autos chicos o medianos con buen
//       consumo, ideales para economizar."
//   (3) dice "estos autos usados" (viola la regla de línea ~201).
// El cliente ya dijo qué busca; devolvérselo al abrir Y al cerrar se lee pesado y robótico.
//
// EL FIX (trampa 6). La línea "No le repitas... andá directo a las opciones" ya existía pero
// pierde: es una regla sin molde. Se REEMPLAZA por el MOLDE concreto — intro directo de una
// línea (con ejemplo), lista con motivo por auto, y cierre simple (con ejemplo) — y se dice
// explícito que el criterio no vuelve ni en el intro ni en un resumen final. Reescribir el
// guion dándole la forma correcta a recitar, no sólo prohibir.
//
// Sección aislada (## Recomendación por criterio). No toca ## Permuta ni la derivación, así que
// convive limpio con #2 y con los fixes de derivación pendientes.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v35.json')
const OUT = join(ROOT, 'franco-n8n-v36.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe "Franco (AI Agent)"')

let m = franco.parameters.options.systemMessage
const antes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
const EXPR = (m.match(/\{\{/g) || []).length
assert(EXPR === 21, `esperaba 21 expresiones {{ }}, hay ${EXPR}`)
// Partimos de v35 (que ya tiene #2 y, por debajo, v34).
assert(cuenta(m, 'un asesor necesita ver el estado del auto en persona') === 1, 'no encuentro el fix #2 — ¿partiste de v35?')
assert(cuenta(m, 'lo único que lo destraba es ese dato') === 1, 'no encuentro el fix de v34 (name-ask)')

const OLD =
  '- No le repitas al cliente lo que él acaba de decirte que busca: andá directo a las opciones.'
assert(cuenta(m, OLD) === 1, `esperaba la regla anti-eco una vez, hay ${cuenta(m, OLD)}`)

const NEW =
  '- El molde de la recomendación: (1) un intro de UNA línea que NO le devuelve el criterio ' +
  'que pidió — abrís directo, "Mirá, estas te pueden servir:", no "para algo económico y ' +
  'confiable te recomiendo..."; (2) la lista, un auto por renglón con su motivo corto; (3) un ' +
  'cierre SIMPLE que invita al próximo paso, "te interesa alguna o preferís que te muestre ' +
  'otras?". El criterio NO se repite: ni en el intro ni en un resumen final ("todas son ' +
  'económicas", "ideales para economizar"), porque la lista ya lo demuestra y repetirlo se lee ' +
  'como relleno.'

m = m.replace(OLD, NEW)

// post-condiciones
assert(m !== antes, 'no se aplicó ningún cambio')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR, 'cambió la cantidad de expresiones {{ }}')
assert(!m.includes(OLD), 'sobrevivió la regla vieja anti-eco')
assert(cuenta(m, 'El molde de la recomendación') === 1, 'el molde nuevo no quedó una sola vez')
// El resto de ## Recomendación intacto.
assert(m.includes('Primero van los que CUMPLEN el criterio'), 'se tocó el punto de "los que cumplen primero"')
assert(m.includes('Cada auto lleva un motivo corto de por qué encaja'), 'se tocó el punto del motivo por auto')
// Los fixes de abajo siguen (v34 name-ask, v35 #2, v23 derivación).
assert(cuenta(m, 'un asesor necesita ver el estado del auto en persona') === 1, 'se perdió #2')
assert(cuenta(m, 'lo único que lo destraba es ese dato') === 1, 'se perdió el name-ask de v34')
assert(cuenta(m, 'LA DERIVACIÓN MANDA') === 1, 'se tocó v23')
assert(cuenta(m, 'TRATO:') === 1, 'se tocó v15')
assert(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)

franco.parameters.options.systemMessage = m

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${m.length} chars (+${m.length - antes.length})`)
console.log('  la recomendación por criterio tiene molde: intro directo, lista con motivo, cierre simple, sin eco del criterio')
console.log('  v36 = #2 (asesor ve estado) + #4 (recomendación concreta), sobre v34')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
