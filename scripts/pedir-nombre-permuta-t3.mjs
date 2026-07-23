#!/usr/bin/env node
// En la progresión de permuta, cuando Franco YA tiene el auto y los kilómetros del usado,
// tiene que cerrar el turno PIDIENDO EL NOMBRE Y APELLIDO — y no lo hace (2026-07-22).
//
//   node scripts/pedir-nombre-permuta-t3.mjs            # escribe franco-n8n-v34.json
//   node scripts/pedir-nombre-permuta-t3.mjs --check    # solo valida
//
// MEDIDO EN v33: `permuta-una-pregunta-por-vez` 0/4 (baseline-v33 + recheck --repeat 3).
// T1 y T2 salen PERFECTOS las 4 veces (contesta, una pregunta por vez, auto -> km). El fallo
// es SIEMPRE T3: con el auto (Gol Trend 2017) y los km (90.000) ya dados, la línea de la
// progresión ordena pedir el NOMBRE. En las 4 corridas Franco NO lo pide: muestra opciones y
// cierra con la pregunta comercial genérica ("querés que un asesor te prepare una cotización,
// o preferís que te muestre algo parecido?") o con "te paso todo el stock / más opciones".
//
// POR QUÉ PIERDE (trampa 6). La regla del nombre YA existía y YA traía el ejemplo correcto,
// pero pierde contra dos cosas:
//   1. El ejemplo de la línea 163 (Paso 3): 'SIEMPRE cerrás con una pregunta comercial...
//      "querés que un asesor te prepare una cotización?"'. Ese es el ejemplo que Franco recita
//      al cerrar T3. Es exactamente el "ejemplo viejo que queda abajo" de la trampa 6.
//   2. La propia línea del nombre PROHIBÍA "querés que te pase todo el stock?" y "querés ver
//      más opciones?" — y Franco recitaba variantes IGUAL ("te paso todo el stock o te
//      contacto con un asesor. Qué preferís?"). La prohibición estaba BACKFIREANDO, tal como
//      la trampa 6 predice: citar la frase mala la mantiene viva.
//
// EL FIX, en dos puntos, cada uno en su sección (como v18/v23):
//   A) ## Permuta, paso "ya tenés auto y km": se SACA la enumeración de frases prohibidas (que
//      backfirea) y se pone un mandato POSITIVO y dominante: la última burbuja de ese turno ES
//      la pregunta por el nombre, con el ejemplo exacto. Reescribir el guion, no prohibir.
//   B) Paso 3, línea 163: carve-out para que "SIEMPRE pregunta comercial" CEDA al pedido de
//      nombre en la progresión de permuta con auto+km. Se ataca el ejemplo competidor en su
//      fuente, sin borrarlo (sigue vigente para los turnos normales de detalle de auto).
//
// El guard de `Armar respuesta` NO se toca: si Franco cierra con "...Me dejás tu nombre y
// apellido?" la última burbuja contiene "?" y el guard no dispara (por eso hoy inyecta la
// frase del asesor — porque Franco NO cierra con "?"). El fix del prompt lo desactiva solo.
//
// NO TOCA v23 ("LA DERIVACIÓN MANDA", cuando el cliente YA pidió asesor): esto es la
// progresión de permuta que Franco conduce, no la derivación ya aceptada.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v33.json')
const OUT = join(ROOT, 'franco-n8n-v34.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}
const cuenta = (txt, aguja) => txt.split(aguja).length - 1
const unaVez = (txt, aguja, dónde) => {
  const n = cuenta(txt, aguja)
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe "Franco (AI Agent)"')

let m = franco.parameters.options.systemMessage
const antes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
const EXPR = (m.match(/\{\{/g) || []).length
assert(EXPR === 21, `esperaba 21 expresiones {{ }}, hay ${EXPR}`)
assert(cuenta(m, 'LA DERIVACIÓN MANDA') === 1, 'no encuentro v23 — ¿partiste de v33?')

// ══════════════ (A) ## Permuta: el turno auto+km cierra pidiendo el nombre

const OLD_150 =
  '   · YA TENÉS EL AUTO Y LOS KILÓMETROS -> la pregunta de ese turno es el NOMBRE. ' +
  'Le mostrás las opciones que le entran y cerrás con: "con eso ya le puedo pasar todo a un ' +
  'asesor para que coordine la tasación. Me dejás tu nombre y apellido?". NO la reemplaces ' +
  'por "querés que te pase todo el stock?" ni por "querés ver más opciones?": esas alargan ' +
  'la charla sin avanzar, y el lead se enfría.'
unaVez(m, OLD_150, 'paso "ya tenés auto y km" (línea 150)')

const NEW_150 =
  '   · YA TENÉS EL AUTO Y LOS KILÓMETROS -> ya tenés todo del usado. Lo único que falta ' +
  'para derivar es el NOMBRE Y APELLIDO, así que la pregunta con la que cerrás este turno ES ' +
  'esa: la última burbuja es un "?" pidiendo el nombre. Mostrás en una línea las opciones que ' +
  'le entran y cerrás EXACTO así: "con eso ya le puedo pasar todo a un asesor para que ' +
  'coordine la tasación. Me dejás tu nombre y apellido?". Ya lo orientaste y el asesor ya ' +
  'está en camino: lo único que lo destraba es ese dato, así que no cierres con ninguna otra ' +
  'pregunta.'

m = m.replace(OLD_150, NEW_150)

// ══════════════ (B) Paso 3: la pregunta comercial CEDE al nombre en permuta con auto+km

const OLD_163 =
  '- SIEMPRE cerrás con una pregunta comercial en una burbuja SEPARADA (no pegada al bloque ' +
  'de specs), que empuje la conversación hacia la venta. No termines en el precio. Ejemplos: ' +
  '"te interesa saber cómo sería financiarlo o entregando tu usado?" / "querés que un asesor ' +
  'te prepare una cotización?" / "lo querés ver en persona o te muestro algo parecido?". La ' +
  'pregunta comercial es obligatoria: cada detalle de auto tiene que invitar al siguiente paso.'
unaVez(m, OLD_163, 'regla de pregunta comercial (línea 163)')

const CARVEOUT =
  ' Excepción: si venís en la progresión de permuta y ya tenés el auto y los kilómetros del ' +
  'usado, la pregunta obligatoria de ese turno es pedir el nombre y apellido para derivar ' +
  '(ver ## Permuta), no la de cotización.'

m = m.replace(OLD_163, OLD_163 + CARVEOUT)

// ══════════════ post-condiciones

assert(m !== antes, 'no se aplicó ningún cambio')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR, 'se perdió o se agregó una expresión {{ }}')

// (A) aplicada y sin duplicar
assert(!m.includes(OLD_150), 'sobrevivió el guion viejo de la línea 150')
assert(cuenta(m, 'lo único que lo destraba es ese dato') === 1, 'el guion nuevo (A) no quedó una sola vez')
// La prohibición que backfireaba se fue (era la que Franco recitaba igual).
assert(!m.includes('querés que te pase todo el stock?'), 'quedó la prohibición que backfireaba ("todo el stock")')
assert(!m.includes('querés ver más opciones?'), 'quedó la prohibición que backfireaba ("ver más opciones")')

// (B) aplicada y sin duplicar; el ejemplo comercial de siempre SIGUE (para turnos normales)
assert(cuenta(m, 'SIEMPRE cerrás con una pregunta comercial') === 1, 'se tocó la línea 163 base')
assert(cuenta(m, CARVEOUT) === 1, 'el carve-out (B) no quedó una sola vez')
assert(m.includes('querés que un asesor te prepare una cotización?'), 'se perdió el ejemplo comercial de la 163 (debe seguir para turnos normales)')

// El ejemplo del nombre sobrevive en los dos puntos donde ya estaba (permuta + derivación).
assert(cuenta(m, 'Me dejás tu nombre y apellido?') === 2, 'cambió la cantidad de "Me dejás tu nombre y apellido?"')

// Todo lo vigente de cada versión sigue intacto (una sola vez).
for (const [marca, versión] of [
  ['TRATO:', 'v15'],
  ['SIN PRESUPUESTO DECLARADO', 'v16'],
  ['ARRANCA por el porqué', 'v18'],
  ['(se pasa del presupuesto', 'v19'],
  ['SUENE A CONSEJO ', 'v20/v23'],
  ['SI EL CLIENTE ENTREGA UN USADO', 'v21'],
  ['está blanco', 'v22'],
  ['LA DERIVACIÓN MANDA', 'v23'],
  ['OJO CON EL FORMATO AL REDIRIGIR', 'v24'],
]) {
  const c = cuenta(m, marca)
  assert(c === 1, `se tocó la regla de ${versión}: "${marca}" aparece ${c} veces`)
}
assert(cuenta(m, 'now.year') === 2, 'cambió la cantidad de {{ $now.year }} (v30)')
// La narrativa de permuta y la rama estirar siguen enteras.
assert(m.includes('NUNCA estimes vos el valor del usado'), 'se perdió el punto "NUNCA estimes" de Permuta')
assert(m.includes('(categoria "estirar")'), 'se perdió la rama estirar')

// Nada fuera del systemMessage: mismo número de nodos.
assert(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)

franco.parameters.options.systemMessage = m

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${m.length} chars (+${m.length - antes.length})`)
console.log('  (A) el turno auto+km cierra pidiendo el nombre (mandato positivo, sin la prohibición que backfireaba)')
console.log('  (B) la pregunta comercial de la 163 cede al nombre en permuta con auto+km')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
