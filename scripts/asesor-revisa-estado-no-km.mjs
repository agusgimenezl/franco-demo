#!/usr/bin/env node
// El asesor revisa el ESTADO del usado en persona, no los kilómetros (2026-07-22, cola #2).
//
//   node scripts/asesor-revisa-estado-no-km.mjs            # escribe franco-n8n-v35.json
//   node scripts/asesor-revisa-estado-no-km.mjs --check    # solo valida
//
// LA CAPTURA (#2). Al recibir un usado ("Ford Ka Viral 2013 100000 km"), Franco dice
// "un asesor debe revisar estado y kilómetros". Pero los KM los DA el cliente — Franco ya los
// tiene. El asesor no "revisa los km": revisa el ESTADO/condición del auto en persona para
// tasarlo. Decir que revisa los km sugiere que Franco no registró el dato que le acaban de dar.
//
// LA FUENTE (trampa 6). El punto 4 de ## Permuta trae el guion literal que Franco recita:
//     "un asesor necesita ver el estado y los kilómetros"
// Se REEMPLAZA el guion (no se prohíbe): "ver el estado del auto en persona". Sirve igual haya
// dado o no los km, y saca la palabra que genera la contradicción.
//
// NO es lo mismo que la línea 179 ("el asesor necesita saber qué auto es: marca, modelo, año y
// kilómetros"): esa es sobre qué DATOS necesita el asesor (y sí necesita conocer los km, que se
// los pasa Franco). Distinto de "ver/revisar los km en persona", que no tiene sentido. Esa
// línea NO se toca.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v34.json')
const OUT = join(ROOT, 'franco-n8n-v35.json')
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
// Partimos de v34 (fix del name-ask ya aplicado).
assert(cuenta(m, 'lo único que lo destraba es ese dato') === 1, 'no encuentro el fix de v34 — ¿partiste de v34?')

const OLD = 'un asesor necesita ver el estado y los kilómetros'
const NEW = 'un asesor necesita ver el estado del auto en persona'
assert(cuenta(m, OLD) === 1, `esperaba el guion viejo una vez, hay ${cuenta(m, OLD)}`)
m = m.replace(OLD, NEW)

// post-condiciones
assert(m !== antes, 'no se aplicó ningún cambio')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR, 'cambió la cantidad de expresiones {{ }}')
assert(!m.includes(OLD), 'sobrevivió el guion viejo')
assert(cuenta(m, NEW) === 1, 'el guion nuevo no quedó una sola vez')
// La 179 (qué DATOS necesita el asesor) NO se toca: sigue diciendo marca/modelo/año/km.
assert(m.includes('el asesor necesita saber qué auto es: marca, modelo, año y kilómetros'),
  'se tocó la línea 179 (los datos que el asesor necesita conocer) — no debía')
// El resto de la narrativa de permuta intacta.
assert(m.includes('NUNCA estimes vos el valor del usado'), 'se perdió el punto "NUNCA estimes" de Permuta')
assert(cuenta(m, 'LA DERIVACIÓN MANDA') === 1, 'se tocó v23')
assert(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)

franco.parameters.options.systemMessage = m

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${m.length} chars (${m.length - antes.length})`)
console.log('  el asesor "ve el estado del auto en persona" (ya no "el estado y los kilómetros")')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
