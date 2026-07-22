#!/usr/bin/env node
// Los `condicionantes` dejan de cantarse solos: sólo salen si el cliente pregunta o si
// hacen falta para una comparación (2026-07-21).
//
//   node scripts/condicionantes-a-pedido.mjs            # escribe franco-n8n-v20.json
//   node scripts/condicionantes-a-pedido.mjs --check    # solo valida
//
// EL BUG LO INTRODUJE YO EN v18. La regla que escribí decía:
//     "Si el campo `condicionantes` trae algo que le importa a ESTE cliente, lo decís en UNA
//      frase y como criterio honesto de vendedor ("tené en cuenta que la potencia es justa
//      para el tamaño")."
// Dos fallas en una línea:
//   1. "algo que le importa a ESTE cliente" es un criterio elástico, y Franco lo resuelve
//      siempre a favor de contarlo.
//   2. EL EJEMPLO LITERAL LE ENSEÑA A DECIRLO. Es la misma trampa que el "efectivo" de v16:
//      el modelo recita el ejemplo que tiene más cerca del punto de uso. Medido: Franco
//      arrancó tres de tres respuestas con "Tené en cuenta que la potencia es justa para el
//      tamaño" — la frase del ejemplo, casi palabra por palabra.
//
// POR QUÉ IMPORTA COMERCIALMENTE. Franco es un vendedor, no una ficha técnica. Volcarle al
// cliente los contras de un auto que todavía no comparó con nada, y que ni preguntó, sólo
// resta. Capturas del 2026-07-21: al preguntar por un Cronos recibió "la potencia queda
// justa si lo cargás mucho en subida y no tiene cámara ni sensores"; al pedir info de la
// Ranger, "tené en cuenta que es la opción más cara y con mayor consumo del stock".
//
// LOS DOS CASOS DONDE SÍ VAN, y no son negociables:
//   · el cliente PREGUNTA (contras, punto flojo, qué tener en cuenta) -> se responde derecho,
//     sin esquivar. Ocultarlo ahí es peor que decirlo: mata la confianza.
//   · COMPARACIÓN entre modelos, donde el condicionante es lo que explica por qué uno le
//     encaja mejor que otro. Ahí suma, no resta.
//
// El guardarraíl contra pasarse de freno es el eval `condicionante-si-preguntan` (hoy 3/3):
// si el fix lo rompe, Franco pasó de sincero a evasivo y hay que rehacerlo.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v19.json')
const OUT = join(ROOT, 'franco-n8n-v20.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe "Franco (AI Agent)"')

const antes = franco.parameters.options.systemMessage
assert(antes.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(antes.includes('(se pasa del presupuesto'), 'falta la etiqueta fuera de v19 — ¿partiste de v19?')
const EXPR = (antes.match(/\{\{/g) || []).length
assert(EXPR === 19, `esperaba 19 expresiones {{ }}, hay ${EXPR}`)

const VIEJO =
  '- Si el campo `condicionantes` trae algo que le importa a ESTE cliente, lo decís en UNA ' +
  'frase y como criterio honesto de vendedor ("tené en cuenta que la potencia es justa ' +
  'para el tamaño"). Nunca los enumeres todos ni los presentes como lista de defectos: eso ' +
  'espanta la venta. Si no viene al caso, no lo menciones.'
const n = antes.split(VIEJO).length - 1
assert(n === 1, `el ancla de condicionantes aparece ${n} veces, esperaba 1`)

// Sin ejemplo de la frase prohibida: el ejemplo es lo que se recita. El único ejemplo que
// queda es el del caso donde SÍ corresponde decirlo.
const NUEVO =
  '- El campo `condicionantes` NO se cuenta solo. Sos un vendedor: volcarle los contras de ' +
  'un auto a alguien que no los pidió y que todavía no lo comparó con nada sólo resta, y es ' +
  'plata que se pierde. En una consulta simple ("contame del Duster", "qué onda la Ranger") ' +
  'presentás el auto por lo que tiene a favor y CERRÁS. Nada de "tené en cuenta que...", ' +
  'nada de "aunque...", nada de aclarar lo que le falta.\n' +
  '- `condicionantes` sale en DOS situaciones, y en las dos suma:\n' +
  '   · Si el cliente PREGUNTA (los contras, el punto flojo, qué tiene que tener en cuenta, ' +
  'si le va a servir para algo puntual): respondés derecho y con el dato real, sin esquivar ' +
  'ni endulzarlo. Ahí ocultarlo es peor que decirlo, porque te hace perder la confianza y la ' +
  'venta igual.\n' +
  '   · Si estás COMPARANDO modelos y el condicionante es lo que explica por qué uno le ' +
  'encaja mejor que otro ("la Duster va a andar más justa que la EcoSport si la cargás ' +
  'seguido"). Ahí el dato ayuda a elegir, no espanta.\n' +
  '- Fuera de esos dos casos, el condicionante no existe para el cliente.'

const despues = antes.replace(VIEJO, NUEVO)

// --- post-condiciones
assert(despues !== antes, 'no se aplicó ningún cambio')
assert(despues.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((despues.match(/\{\{/g) || []).length === EXPR, 'se perdió alguna expresión {{ }}')
assert(despues.includes('NO se cuenta solo'), 'no quedó la regla nueva')
assert((despues.match(/condicionantes` NO se cuenta solo/g) || []).length === 1, 'la regla quedó duplicada')

// La frase que Franco venía recitando NO puede seguir en el prompt como ejemplo: el ejemplo
// es exactamente el mecanismo del bug (mismo patrón que el "efectivo" de v16).
assert(
  !despues.includes('tené en cuenta que la potencia es justa para el tamaño'),
  'quedó el ejemplo de la frase prohibida, que es lo que el modelo recita',
)

// Lo de las versiones anteriores, intacto.
for (const [marca, versión] of [
  ['TRATO:', 'v15'],
  ['SIN PRESUPUESTO DECLARADO', 'v16'],
  ['ARRANCA por el porqué', 'v18'],
  ['viñeta "- "', 'v18'],
  ['(se pasa del presupuesto', 'v19'],
]) {
  const c = (despues.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  assert(c === 1, `se tocó la regla de ${versión}: "${marca}" aparece ${c} veces`)
}

franco.parameters.options.systemMessage = despues

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${despues.length} chars (${despues.length - antes.length >= 0 ? '+' : ''}${despues.length - antes.length})`)
console.log('  condicionantes: sólo si preguntan o si se está comparando')
console.log('  fuera el ejemplo "tené en cuenta que la potencia es justa" — era lo que recitaba')
console.log('  intactas: TRATO (v15), gate de permuta (v16), detalle y viñeta (v18), fuera (v19)')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
