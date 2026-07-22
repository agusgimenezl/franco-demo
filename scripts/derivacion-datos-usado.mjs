#!/usr/bin/env node
// Al derivar a un asesor, si el cliente entrega un usado, Franco pide también los datos de
// ese usado (2026-07-21).
//
//   node scripts/derivacion-datos-usado.mjs            # escribe franco-n8n-v21.json
//   node scripts/derivacion-datos-usado.mjs --check    # solo valida
//
// EL HUECO. La sección `## Permuta` YA lo pedía ("pedile el NOMBRE Y APELLIDO y los datos
// del usado (año, versión, km)"), pero sólo aplica cuando se disparó esa narrativa completa,
// que necesita presupuesto declarado + usado. Un cliente que dice "tengo un auto para
// entregar y quiero que me contacte un asesor" entra por la derivación general, y ahí el
// prompt sólo pedía nombre y apellido. El asesor recibía el lead sin saber qué entrega y
// tenía que volver a preguntar todo — que es exactamente el trabajo que Franco debería
// ahorrarle.
//
// Medido antes del fix: `derivacion-pide-datos-del-usado` 1/3.
//
// FRANCO YA TIENE CON QUÉ SABERLO, no hace falta ningún dato nuevo. `Leer lead (estado)` le
// pasa `lead_entrega` y `lead_usado`, que aparecen en el bloque "Lo que ya sabés de este
// cliente". Por eso la regla se apoya en lo que ya está ahí en vez de pedirle que recuerde:
//   · entrega = "Sí" y el usado sin detalles -> los pide junto con el nombre
//   · el usado ya cargado -> NO lo vuelve a preguntar (repreguntar un dato ya dado es el
//     bug que se cerró en "pendiente #1", y no quiero reabrirlo por este lado)
//
// EN UN SOLO PEDIDO, no en dos turnos: encadenar preguntas es lo que hace que el cliente
// abandone. Y sin listar los campos como formulario.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v20.json')
const OUT = join(ROOT, 'franco-n8n-v21.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe "Franco (AI Agent)"')

const antes = franco.parameters.options.systemMessage
assert(antes.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(antes.includes('NO se cuenta solo'), 'falta la regla de condicionantes de v20 — ¿partiste de v20?')
const EXPR = (antes.match(/\{\{/g) || []).length
assert(EXPR === 19, `esperaba 19 expresiones {{ }}, hay ${EXPR}`)

// Ancla: el primer bullet de "# Derivación a un asesor", el que pide nombre y apellido.
const ANCLA =
  '- Cuando derivás o el cliente acepta el contacto, le pedís el nombre y el apellido si no ' +
  'los tenés ("le paso la info a un asesor. Me dejás tu nombre y apellido?"). Siempre nombre ' +
  'Y apellido: el asesor necesita identificar al cliente. No le pedís el teléfono: esta ' +
  'conversación ES por WhatsApp, así que el asesor ya tiene el número del cliente por acá ' +
  'mismo. Pedir el teléfono no tiene sentido y queda mal.'

const n = antes.split(ANCLA).length - 1
assert(n === 1, `el ancla de derivación aparece ${n} veces, esperaba 1`)

const REGLA =
  '\n- SI EL CLIENTE ENTREGA UN USADO, en ese MISMO pedido le pedís también los datos de ese ' +
  'auto: marca, modelo, año y kilómetros. Fijate en "Lo que ya sabés de este cliente": si la ' +
  'entrega figura en "Sí" pero del usado no hay detalles, te faltan y los pedís ("dale, te ' +
  'paso con un asesor. Me dejás tu nombre y apellido, y qué auto entregarías: marca, modelo, ' +
  'año y kilómetros más o menos?"). Sin eso el asesor lo tiene que llamar para preguntarle lo ' +
  'mismo de nuevo, y ese es justo el trabajo que le estás ahorrando.\n' +
  '- Si los datos del usado YA figuran ahí, no se los vuelvas a preguntar: los tenés. ' +
  'Repreguntar algo que el cliente ya dijo es de las cosas que peor quedan.\n' +
  '- Todo junto en UNA sola pregunta, en tono de charla. No encadenes un pedido atrás de ' +
  'otro ni lo listes como formulario: ahí es donde el cliente se cansa y abandona.'

const despues = antes.replace(ANCLA, ANCLA + REGLA)

// --- post-condiciones
assert(despues !== antes, 'no se aplicó ningún cambio')
assert(despues.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert(despues.length === antes.length + REGLA.length, 'cambió más texto del esperado')
assert((despues.match(/\{\{/g) || []).length === EXPR, 'se perdió alguna expresión {{ }}')
assert((despues.match(/SI EL CLIENTE ENTREGA UN USADO/g) || []).length === 1, 'la regla quedó duplicada')
assert(despues.includes(ANCLA), 'se rompió el bullet de nombre y apellido')

// La sección Permuta ya pedía lo mismo para su propio camino: se deja intacta, no se duplica
// la lógica en dos lados con redacciones distintas.
assert(
  despues.includes('pedile el NOMBRE Y APELLIDO y los datos del usado'),
  'se tocó el pedido de datos del usado de la sección Permuta',
)

// Lo de las versiones anteriores, intacto.
for (const [marca, versión] of [
  ['TRATO:', 'v15'],
  ['SIN PRESUPUESTO DECLARADO', 'v16'],
  ['ARRANCA por el porqué', 'v18'],
  ['viñeta "- "', 'v18'],
  ['(se pasa del presupuesto', 'v19'],
  ['NO se cuenta solo', 'v20'],
]) {
  const c = (despues.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  assert(c === 1, `se tocó la regla de ${versión}: "${marca}" aparece ${c} veces`)
}

franco.parameters.options.systemMessage = despues

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${despues.length} chars (+${REGLA.length})`)
console.log('  al derivar con permuta, pide también marca/modelo/año/km del usado')
console.log('  se apoya en lead_entrega y lead_usado, que Franco ya recibe')
console.log('  intactas: TRATO (v15), permuta (v16), detalle y viñeta (v18), fuera (v19), condicionantes (v20)')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
