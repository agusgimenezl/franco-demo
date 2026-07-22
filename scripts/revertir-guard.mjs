#!/usr/bin/env node
// Revierte el cambio del guard de v27 y conserva el fix de prompt (2026-07-21).
//
//   node scripts/revertir-guard.mjs            # escribe franco-n8n-v28.json
//   node scripts/revertir-guard.mjs --check    # solo valida
//
// POR QUÉ SE REVIERTE, medido SIN gastar cuota (replay del predicado sobre baseline-v23,
// que ya estaba pagada):
//   Turnos donde el guard viejo disparó: 3
//     · con mi lógica nueva seguiría disparando:  1
//     · dejaría de disparar:                      2  <- y LOS DOS quedaban sin pregunta final
//         stock-general-completo t1 -> cerraba con la lista de autos pelada
//         rango-14-20 t1            -> cerraba en "...para recomendarte mejor."
//
// EL ERROR: puse `msgs.some(m => m.includes('?'))`, y el saludo es
// "Hola! Soy Franco, asistente de Automotores Tucumán. Cómo estás?" — tiene un "?". O sea
// que el predicado daba true en casi todo primer turno y DESACTIVABA el guard, rompiendo el
// piso que el guard existe para garantizar (que una lista de autos nunca quede sin próximo
// paso). Iba a cambiar un bug chico por uno peor.
//
// Y NO HACE FALTA. El "asesor" prematuro aparecía porque Franco mostraba autos sin saber qué
// usado entrega; el guard sólo corre con `autos.length >= 1`. El otro cambio de v27 —no
// llamar a la tool de stock hasta saber el usado, `auto_ids` vacío— hace que el guard nunca
// llegue a dispararse en ese escenario. Está verificado en la corrida 3 de v26, que sin
// autos dio exactamente la respuesta pedida.
//
// QUEDA COMO DEUDA, no como problema resuelto: si en el futuro Franco pregunta a mitad de
// burbuja EN UN TURNO CON AUTOS, el guard le va a seguir pegando una pregunta encima. Para
// arreglarlo bien habría que distinguir el saludo de una pregunta real, y eso no vale el
// riesgo ahora.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v27.json')
const REF = join(ROOT, 'franco-n8n-v26.json') // guard original, de referencia
const OUT = join(ROOT, 'franco-n8n-v28.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const ref = JSON.parse(readFileSync(REF, 'utf8'))

const armar = wf.nodes.find((n) => n.name === 'Armar respuesta')
const armarRef = ref.nodes.find((n) => n.name === 'Armar respuesta')
assert(armar && armarRef, 'falta "Armar respuesta" en alguno de los dos')
assert(armar.parameters.jsCode !== armarRef.parameters.jsCode, 'el guard ya está igual que v26')
assert(armar.parameters.jsCode.includes('hayPregunta'), 'v27 no tiene el cambio del guard — ¿ya se revirtió?')

// Se restaura el código EXACTO de v26: no se reescribe a mano, se copia del archivo que
// estuvo en producción y midió 31/32.
armar.parameters.jsCode = armarRef.parameters.jsCode

// --- post-condiciones
const js = armar.parameters.jsCode
assert(!js.includes('hayPregunta'), 'quedó rastro del predicado nuevo')
assert(js.includes("!texto.endsWith('?')"), 'no volvió la condición original del guard')
assert(js.includes('const texto ='), 'no volvió la variable texto')
assert(js === armarRef.parameters.jsCode, 'el código no quedó idéntico al de v26')

// El fix de prompt de v27 SE CONSERVA: es el que resuelve el problema de verdad.
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const m = franco.parameters.options.systemMessage
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(m.includes('No llames a ninguna herramienta de stock'), 'se perdió el fix de prompt de v27')
assert(m.includes('`auto_ids` VACÍO'), 'se perdió la instrucción de auto_ids vacío')
assert((m.match(/\{\{/g) || []).length === 19, 'cambió la cantidad de expresiones {{ }}')

// Todo lo demás igual que v27.
const v27 = JSON.parse(readFileSync(SRC, 'utf8'))
for (const n of wf.nodes) {
  if (n.name === 'Armar respuesta') continue
  const orig = v27.nodes.find((k) => k.name === n.name)
  assert(JSON.stringify(n.parameters) === JSON.stringify(orig.parameters), `se tocó ${n.name} sin querer`)
}

console.log('✓ todas las aserciones pasan')
console.log('  Armar respuesta: guard restaurado byte a byte al de v26 (el que midió 31/32)')
console.log('  el fix de prompt de v27 se conserva: sin saber el usado, no llama la tool')
console.log('  ningún otro nodo cambia')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
