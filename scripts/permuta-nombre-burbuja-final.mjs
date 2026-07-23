#!/usr/bin/env node
// Cerrar el name-ask ~50% de permuta-una-pregunta-por-vez (2026-07-22). Sobre v38 -> v39.
//
//   node scripts/permuta-nombre-burbuja-final.mjs            # escribe franco-n8n-v39.json
//   node scripts/permuta-nombre-burbuja-final.mjs --check
//
// MECÁNICA DEL ~50% (medido v34..v38). En el turno auto+km, cuando ACIERTA Franco pone el pedido
// del nombre en una burbuja aparte al final; cuando FALLA, lista 3+ autos y NO pide el nombre, y
// ahí el guard de `Armar respuesta` (rama product_cards>=3) mete su pregunta de modo-lista
// ("Buscás algo puntual o querés que te ayude...") en lugar del nombre. O sea: la lista larga lo
// mete en modo catálogo y el turno se va de tema.
//
// EL FIX (no es re-enfatizar, es cambiar la mecánica): el pedido del nombre va SÍ O SÍ en una
// burbuja aparte y última, y NO se listan 3+ autos en ese turno (1-2 como mucho). Sin lista larga
// no hay modo-catálogo ni guard de lista; con el nombre como última burbuja ("?") el guard no
// dispara (sólo corre si la última no tiene "?"). Consistente con el patrón de v37 (confirmar y
// cerrar sin volcar cards).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v38.json')
const OUT = join(ROOT, 'franco-n8n-v39.json')
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
// Sobre v38.
assert(cuenta(m, '# Financiación\n') === 1, 'no encuentro el bloque de v38 — ¿partiste de v38?')

const OLD =
  '   · YA TENÉS EL AUTO Y LOS KILÓMETROS -> ya tenés todo del usado. Lo único que falta ' +
  'para derivar es el NOMBRE Y APELLIDO, así que la pregunta con la que cerrás este turno ES ' +
  'esa: la última burbuja es un "?" pidiendo el nombre. Mostrás en una línea las opciones que ' +
  'le entran y cerrás EXACTO así: "con eso ya le puedo pasar todo a un asesor para que ' +
  'coordine la tasación. Me dejás tu nombre y apellido?". Ya lo orientaste y el asesor ya ' +
  'está en camino: lo único que lo destraba es ese dato, así que no cierres con ninguna otra ' +
  'pregunta.'
assert(cuenta(m, OLD) === 1, `esperaba el guion de v34 una vez, hay ${cuenta(m, OLD)}`)

const NEW =
  '   · YA TENÉS EL AUTO Y LOS KILÓMETROS -> ya tenés todo del usado. Este turno es corto y ' +
  'tiene UN objetivo: pedir el NOMBRE Y APELLIDO para derivar. El pedido del nombre va SÍ O SÍ ' +
  'en una burbuja aparte y ES la última: "con eso ya le puedo pasar todo a un asesor para que ' +
  'coordine la tasación. Me dejás tu nombre y apellido?". NO listes 3 o más autos en este ' +
  'turno: una lista larga te mete en modo catálogo y el turno se va de tema (termina en ' +
  '"querés ver más opciones?" en vez del nombre). Si querés mostrar algo, una o dos opciones ' +
  'como mucho, y IGUAL cerrás con la burbuja del nombre. Ya lo orientaste y el asesor ya está ' +
  'en camino: lo único que lo destraba es ese dato.'

m = m.replace(OLD, NEW)

// post-condiciones
assert(m !== antes, 'no se aplicó ningún cambio')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR, 'cambió la cantidad de expresiones {{ }}')
assert(!m.includes(OLD), 'sobrevivió el guion viejo')
assert(cuenta(m, 'Este turno es corto y tiene UN objetivo') === 1, 'el guion nuevo no quedó una sola vez')
assert(cuenta(m, 'Me dejás tu nombre y apellido?') === 2, 'cambió la cantidad de "Me dejás tu nombre y apellido?"')
// fixes previos intactos
assert(cuenta(m, '# Financiación\n') === 1, 'se perdió el bloque de financiación (v38)')
assert(cuenta(m, 'con el Gol 2015 ya le paso todo a un asesor') === 1, 'se perdió v37')
assert(cuenta(m, 'El molde de la recomendación') === 1, 'se perdió #4')
assert(cuenta(m, 'un asesor necesita ver el estado del auto en persona') === 1, 'se perdió #2')
assert(cuenta(m, 'LA DERIVACIÓN MANDA') === 1, 'se tocó v23')
assert(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)

franco.parameters.options.systemMessage = m

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${m.length} chars (${m.length - antes.length})`)
console.log('  turno auto+km: nombre en burbuja final obligatoria, sin listar 3+ autos (mata el modo-lista/guard)')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
