#!/usr/bin/env node
// Dos correcciones medidas sobre v22 (2026-07-21).
//
//   node scripts/derivacion-manda.mjs            # escribe franco-n8n-v23.json
//   node scripts/derivacion-manda.mjs --check    # solo valida
//
// ─────────────────────────────────────────────────────────────────────────────
// (A) LOS CONDICIONANTES SE SIGUEN FILTRANDO CUANDO SUENAN A CONSEJO
//
// v20 los limitó a "si preguntan o si se compara" y con el Duster daba 3/3. Al sumar un
// segundo auto al eval, el Vento los filtró 3 de 3 y el Duster 1 de 3. La muestra de un solo
// auto había dado confianza falsa — el mismo error que con el "efectivo".
//
// LA CAUSA es un efecto lateral del fix anterior. Al reescribir los condicionantes "hacia
// adelante" (pedido de Agustina, para que no fueran negativos puros), el del Vento quedó:
//     "Es turbo: pide nafta de buena calidad y service al día para rendir como corresponde."
// Eso ya no suena a advertencia: suena a consejo práctico, del tipo que cualquier vendedor
// menciona al pasar. Franco no lo reconoce como "un contra" y por eso la regla no lo frena.
// El del Duster ("la potencia es justa para el tamaño") sigue sonando a limitación y se
// filtra menos. Los dos fixes tironean en direcciones opuestas.
//
// FIX: la regla deja de depender de que el texto PAREZCA un contra. Lo que se prohíbe es
// usar el CONTENIDO DEL CAMPO, suene como suene.
//
// ─────────────────────────────────────────────────────────────────────────────
// (B) LA DERIVACIÓN NO GANA CUANDO EL CLIENTE YA PIDIÓ UN ASESOR
//
// Medido 3/3: con "quiero que me contacte un asesor" ya dicho, al recibir los datos del
// usado Franco relanza la narrativa completa de `## Permuta` — 7 a 17 cards, los dos
// caminos, y vuelve a preguntar si quiere que lo derive. El cliente ya lo había pedido dos
// turnos antes.
//
// LA CAUSA es de precedencia, no de una regla suelta: `## Permuta` se dispara con
// entrega = "Sí" y nada más, sin mirar si la derivación ya está en curso. v21 sólo tocó el
// turno en que se PIDEN los datos, no el siguiente. Ninguno de los casos de derivación
// anteriores combinaba permuta con pedido explícito de asesor, así que el conflicto nunca
// se había ejercitado.
//
// FIX (decisión de Agustina): la derivación manda. Si ya pidió asesor, se pide lo que falte
// y se cierra, sin stock ni cards. La narrativa de permuta queda para quien todavía está
// mirando. Se pone en los DOS lados: el gate de Permuta (punto de disparo) y la sección de
// Derivación (punto de uso).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v22.json')
const OUT = join(ROOT, 'franco-n8n-v23.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe "Franco (AI Agent)"')

let m = franco.parameters.options.systemMessage
const antes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(m.includes('nunca "está blanco"'), 'falta la regla de color de v22 — ¿partiste de v22?')
const EXPR = (m.match(/\{\{/g) || []).length
assert(EXPR === 19, `esperaba 19 expresiones {{ }}, hay ${EXPR}`)

// ══════════════════════════ (A) condicionantes, sin importar el tono

const COND_VIEJO =
  '- El campo `condicionantes` NO se cuenta solo. Sos un vendedor: volcarle los contras de ' +
  'un auto a alguien que no los pidió y que todavía no lo comparó con nada sólo resta, y es ' +
  'plata que se pierde. En una consulta simple ("contame del Duster", "qué onda la Ranger") ' +
  'presentás el auto por lo que tiene a favor y CERRÁS. Nada de "tené en cuenta que...", ' +
  'nada de "aunque...", nada de aclarar lo que le falta.'
unaVez(m, COND_VIEJO, 'condicionantes (v20)')

const COND_NUEVO =
  '- El contenido del campo `condicionantes` NO se cuenta solo, y esto vale AUNQUE EL TEXTO ' +
  'SUENE A CONSEJO ÚTIL Y NO A DEFECTO. Da igual si dice "pide nafta de buena calidad", ' +
  '"conviene revisar el service" o "la potencia es justa": si salió de ese campo, no va. No ' +
  'lo juzgues por cómo suena, juzgalo por de dónde viene. Sos un vendedor: sumarle eso a ' +
  'alguien que no preguntó y que todavía no comparó nada sólo resta, y es plata que se ' +
  'pierde. En una consulta simple ("contame del Duster", "qué onda la Ranger") presentás el ' +
  'auto por lo que tiene a favor y CERRÁS. Nada de "tené en cuenta que...", nada de ' +
  '"aunque...", nada de "eso sí...", nada de aclarar lo que le falta ni qué mantenimiento pide.'

m = m.replace(COND_VIEJO, COND_NUEVO)

// ══════════════════════════ (B) precedencia de la derivación

// (B1) en el gate de Permuta, que es donde se dispara la narrativa
const GATE_ANCLA = '· CON PRESUPUESTO DECLARADO: seguí con los 4 puntos.\n'
unaVez(m, GATE_ANCLA, 'gate de Permuta (v16)')

const GATE_NUEVO =
  GATE_ANCLA +
  '· SI EL CLIENTE YA PIDIÓ UN ASESOR: no uses esta narrativa, ni ahora ni en los turnos que ' +
  'siguen. La derivación manda sobre todo lo demás — ver "# Derivación a un asesor".\n'

m = m.replace(GATE_ANCLA, GATE_NUEVO)

// (B2) en la sección de Derivación, que es donde se usa
const DERIV_ANCLA =
  '- Todo junto en UNA sola pregunta, en tono de charla. No encadenes un pedido atrás de ' +
  'otro ni lo listes como formulario: ahí es donde el cliente se cansa y abandona.'
unaVez(m, DERIV_ANCLA, 'regla de datos del usado (v21)')

const DERIV_NUEVO =
  DERIV_ANCLA +
  '\n- LA DERIVACIÓN MANDA. Desde el momento en que el cliente pide que lo contacte un ' +
  'asesor, eso es lo que estás haciendo, y no volvés atrás. NO relances la narrativa de ' +
  '## Permuta, NO vuelvas a listar stock ni a mandar cards, y NO le vuelvas a preguntar si ' +
  'quiere un asesor: ya te lo pidió. Cuando te da los datos que faltaban, confirmás que un ' +
  'asesor lo contacta y CERRÁS preguntando si necesita algo más mientras tanto. Ponerte a ' +
  'mostrarle opciones en ese punto le dice que no lo escuchaste, y es donde se cae la venta ' +
  'que ya tenías hecha.'

m = m.replace(DERIV_ANCLA, DERIV_NUEVO)

// ══════════════════════════ post-condiciones

assert(m !== antes, 'no se aplicó ningún cambio')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR, 'se perdió alguna expresión {{ }}')
assert((m.match(/SUENE A CONSEJO ÚTIL/g) || []).length === 1, 'la regla de condicionantes quedó duplicada')
assert((m.match(/LA DERIVACIÓN MANDA/g) || []).length === 1, 'la regla de precedencia quedó duplicada')
assert((m.match(/SI EL CLIENTE YA PIDIÓ UN ASESOR/g) || []).length === 1, 'el gate de permuta quedó duplicado')
// La regla vieja no puede sobrevivir en paralelo: dos redacciones del mismo tema es
// exactamente cómo nacen las contradicciones que después cuesta semanas encontrar.
assert(!m.includes(COND_VIEJO), 'quedó la redacción vieja de condicionantes conviviendo con la nueva')

// Las dos situaciones donde SÍ van los condicionantes siguen intactas: sin esto el fix se
// pasa de freno y Franco esquiva preguntas directas (eval `condicionante-si-preguntan`).
assert(m.includes('Si el cliente PREGUNTA'), 'se perdió el caso "si preguntan"')
assert(m.includes('Si estás COMPARANDO modelos'), 'se perdió el caso "comparación"')

for (const [marca, versión] of [
  ['TRATO:', 'v15'],
  ['SIN PRESUPUESTO DECLARADO', 'v16'],
  ['ARRANCA por el porqué', 'v18'],
  ['viñeta "- "', 'v18'],
  ['(se pasa del presupuesto', 'v19'],
  ['SI EL CLIENTE ENTREGA UN USADO', 'v21'],
  ['nunca "está blanco"', 'v22'],
]) {
  const c = (m.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  assert(c === 1, `se tocó la regla de ${versión}: "${marca}" aparece ${c} veces`)
}

franco.parameters.options.systemMessage = m

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${m.length} chars (+${m.length - antes.length})`)
console.log('  (A) condicionantes: se juzga por de dónde viene el texto, no por cómo suena')
console.log('  (B) la derivación manda: si ya pidió asesor, no se relanza la permuta')
console.log('  intactas: v15, v16, v18, v19, v21, v22 y los dos casos donde SÍ van los condicionantes')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
