#!/usr/bin/env node
// El color se dice "es blanco", no "está blanco" (2026-07-21).
//
//   node scripts/color-es-no-esta.mjs            # escribe franco-n8n-v22.json
//   node scripts/color-es-no-esta.mjs --check    # solo valida
//
// Captura de Agustina: "Está blanco y cuesta $29.500.000". Es un error de ser/estar — el
// color es una propiedad del auto, no un estado circunstancial. Suena mal en una demo que
// se muestra a dueños de concesionaria.
//
// ES UNA MICRO-REGLA Y LO ASUMO. La regla del proyecto manda lo mecánico a código, pero acá
// no hay nada determinístico que arreglar: la tool devuelve `color: "Blanco"` y la frase la
// compone el modelo. Post-procesar el texto para corregir gramática sería más frágil que el
// bug. Va al prompt, en el mismo bullet donde ya se define cómo presentar la ficha, que es
// el punto de uso.
//
// Expectativa honesta: una regla de este tamaño reduce la frecuencia, no la lleva a cero. El
// check en `descripcion-que-aporta` (turno del Vento) lo deja medido en vez de supuesto.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v21.json')
const OUT = join(ROOT, 'franco-n8n-v22.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe "Franco (AI Agent)"')

const antes = franco.parameters.options.systemMessage
assert(antes.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(antes.includes('SI EL CLIENTE ENTREGA UN USADO'), 'falta la regla de v21 — ¿partiste de v21?')
const EXPR = (antes.match(/\{\{/g) || []).length
assert(EXPR === 19, `esperaba 19 expresiones {{ }}, hay ${EXPR}`)
assert(!antes.includes('nunca "está blanco"'), '¿ya se aplicó este cambio?')

// Va pegado al bullet del detalle, que es donde se arma la frase con el color.
const ANCLA = 'Solo datos de la ficha.'
const n = antes.split(ANCLA).length - 1
assert(n === 1, `el ancla del detalle aparece ${n} veces, esperaba 1`)

const REGLA =
  ' El color es una propiedad del auto, no un estado: se dice "es blanco" o "de color ' +
  'blanco", nunca "está blanco".'

const despues = antes.replace(ANCLA, ANCLA + REGLA)

// --- post-condiciones
assert(despues !== antes, 'no se aplicó ningún cambio')
assert(despues.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert(despues.length === antes.length + REGLA.length, 'cambió más texto del esperado')
assert((despues.match(/\{\{/g) || []).length === EXPR, 'se perdió alguna expresión {{ }}')
assert((despues.match(/nunca "está blanco"/g) || []).length === 1, 'la regla quedó duplicada')

// Lo de las versiones anteriores, intacto.
for (const [marca, versión] of [
  ['TRATO:', 'v15'],
  ['SIN PRESUPUESTO DECLARADO', 'v16'],
  ['ARRANCA por el porqué', 'v18'],
  ['viñeta "- "', 'v18'],
  ['(se pasa del presupuesto', 'v19'],
  ['NO se cuenta solo', 'v20'],
  ['SI EL CLIENTE ENTREGA UN USADO', 'v21'],
]) {
  const c = (despues.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  assert(c === 1, `se tocó la regla de ${versión}: "${marca}" aparece ${c} veces`)
}

franco.parameters.options.systemMessage = despues

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${despues.length} chars (+${REGLA.length})`)
console.log('  el color se dice "es blanco", no "está blanco"')
console.log('  intactas: v15, v16, v18, v19, v20 y v21')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
