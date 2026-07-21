#!/usr/bin/env node
// M2 — el historial guarda lo que vio el cliente, no la versión cruda.
//
//   node scripts/m2-historial-fiel.mjs            # escribe franco-n8n-v9.json
//   node scripts/m2-historial-fiel.mjs --check    # solo valida, no escribe
//
// POR QUÉ: "Armar respuesta" devuelve dos objetos. `respuesta` lleva `finalMsgs`/`finalImgs`
// (con saludo, con la pregunta de cierre del guard y sin ¿/¡). `historial` llevaba las
// variables CRUDAS, previas a todo ese post-proceso. Como "Guardar mensajes (historial)"
// persiste `historial` en `mensajes_demo`, y ese es el origen de la pestaña "Historial"
// —la pantalla que se le muestra al dueño en la demo—, el dueño veía una conversación peor
// que la que tuvo el cliente: sin saludo, sin cierre y con los ¿ que el cliente nunca vio.
//
// Verificado por tres vías: el código, la captura del saludo faltante, la captura del ¿.
// Reproducido por el eval `saludo-solo` con `history_checks` (falla 2/2 antes del cambio).
//
// SEGURIDAD DEL CAMBIO: esto sólo afecta lo que se escribe en `mensajes_demo`. La decisión
// de saludar la toma "Contar mensajes previos", que cuenta `n8n_chat_histories` — otra
// tabla. Por eso NO aplica la advertencia de M2 sobre "si agregás una fila se rompe el
// saludo". El CRM tampoco se ve afectado: "Leer conversación (CRM)" lee n8n_chat_histories.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SRC = join(ROOT, 'franco-n8n-v8.json')
const OUT = join(ROOT, 'franco-n8n-v9.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`✗ ASERCIÓN FALLIDA: ${msg}`)
    process.exit(1)
  }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = wf.nodes.find((n) => n.name === 'Armar respuesta')
assert(nodo, 'no existe el nodo "Armar respuesta"')
assert(nodo.type === 'n8n-nodes-base.code', `"Armar respuesta" no es un nodo Code (es ${nodo.type})`)

const codigo = nodo.jsCode || nodo.parameters?.jsCode
assert(typeof codigo === 'string', 'no encuentro el jsCode de "Armar respuesta"')

// Las variables que el cambio va a usar tienen que existir y ser las que creemos.
for (const v of ['finalMsgs', 'finalImgs', 'product_cards']) {
  assert(codigo.includes(v), `el código no define "${v}" — el nodo cambió, revisar a mano`)
}
assert(
  codigo.includes('const finalMsgs = esPrimero ? [saludo, ...msgs] : msgs;'),
  'la línea que arma finalMsgs no es la esperada',
)

const VIEJO = `    // historial = mismo contrato que guardaba v6 (crudo, sin saludo ni guard).
    // Que el historial refleje lo que vio el cliente es M2, fase 5.
    historial: { messages, images, product_cards },`

const NUEVO = `    // M2: el historial guarda EXACTAMENTE lo que vio el cliente — saludo, pregunta de
    // cierre del guard y strip de ¿/¡ incluidos. Antes guardaba \`messages\`/\`images\` crudos,
    // así que la pestaña "Historial" (la pantalla que se le muestra al dueño en la demo)
    // mostraba una conversación sin saludo, sin cierre y con los ¿ que el cliente no vio.
    // No afecta al saludo: eso lo decide "Contar mensajes previos" sobre n8n_chat_histories,
    // que es otra tabla. Tampoco al CRM, que lee n8n_chat_histories.
    historial: { messages: finalMsgs, images: finalImgs, product_cards },`

assert(
  codigo.includes(VIEJO),
  'el bloque `historial:` no coincide byte a byte con lo esperado — ¿ya se aplicó el cambio?',
)
// Hay una segunda asignación de `historial:` dentro de fallback(), y esa es correcta como
// está: el cliente ve exactamente esa burbuja, así que ya es fiel. El bloque que se
// reemplaza es el del camino normal, y tiene que aparecer una sola vez.
assert(
  codigo.split(VIEJO).length === 2,
  'el bloque `historial:` del camino normal no aparece exactamente una vez',
)
assert(
  codigo.includes('historial: { messages: msgs, images: [], product_cards: [] }'),
  'no encuentro el `historial` de fallback() donde se esperaba — revisar que no se toque',
)

const nuevoCodigo = codigo.replace(VIEJO, NUEVO)
assert(nuevoCodigo !== codigo, 'el reemplazo no cambió nada')
assert(
  nuevoCodigo.includes('historial: { messages: finalMsgs, images: finalImgs, product_cards },'),
  'el código resultante no tiene el historial fiel',
)
// `respuesta` no se toca.
assert(
  nuevoCodigo.includes('respuesta: { session_id: cfg.session_id, messages: finalMsgs, images: finalImgs, product_cards, error: null }'),
  'se alteró `respuesta`, y este cambio no debe tocarla',
)

if (nodo.jsCode) nodo.jsCode = nuevoCodigo
else nodo.parameters.jsCode = nuevoCodigo

console.log('✓ todas las aserciones pasan')
console.log('  Armar respuesta: historial { messages, images } -> { finalMsgs, finalImgs }')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
  console.log('\n--- PEGAR EN EL NODO "Armar respuesta" ---')
  console.log('\nBUSCAR:\n')
  console.log(VIEJO)
  console.log('\nREEMPLAZAR POR:\n')
  console.log(NUEVO)
}
