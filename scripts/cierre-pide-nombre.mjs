#!/usr/bin/env node
// Con el usado ya identificado (auto + km), la pregunta del turno es el NOMBRE (2026-07-21).
//
//   node scripts/cierre-pide-nombre.mjs            # escribe franco-n8n-v29.json
//   node scripts/cierre-pide-nombre.mjs --check    # solo valida
//
// ESTADO EN v28 (medido, 3 corridas): los turnos 1 y 2 quedaron perfectos.
//   t1: "Sí, claro, recibimos usados como parte de pago. (...) Para avanzar, contame qué
//        auto entregás, marca, modelo y año."   <- exactamente lo que pidió Agustina
//   t2: pregunta los kilómetros, sin pedir nombre.
// Falla sólo el t3: con el auto y los km ya sabidos, Franco muestra las opciones —que es
// cumplir lo que prometió en t1— pero NO cierra pidiendo el nombre. Se queda en "querés que
// te pase todo el stock?", que alarga la charla sin avanzar el lead.
//
// LA REGLA YA ESTABA y no alcanzó: el "Cierre de este caso" de v26 dice "si ya tenés el auto
// y los kilómetros, recién ahí pedís nombre y apellido". Es una regla abstracta compitiendo
// contra los pasos 3-6, que sí traen guiones concretos de qué decir. Trampa 6 otra vez.
//
// FIX: darle el guion. La regla nueva trae la frase textual del cierre, que es lo único que
// en este proyecto le ganó a un guion existente.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v28.json')
const OUT = join(ROOT, 'franco-n8n-v29.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe "Franco (AI Agent)"')

const antes = franco.parameters.options.systemMessage
assert(antes.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(antes.includes('No llames a ninguna herramienta de stock'), 'falta el fix de v27 — ¿partiste de v28?')
const EXPR = (antes.match(/\{\{/g) || []).length
assert(EXPR === 19, `esperaba 19 expresiones {{ }}, hay ${EXPR}`)

const VIEJO =
  'Cierre de este caso: seguís la progresión, de a UNA pregunta por turno. Si ya sabés qué ' +
  'auto entrega pero no los kilómetros, preguntás los kilómetros y nada más. Si ya tenés el ' +
  'auto y los kilómetros, recién ahí pedís nombre y apellido para que un asesor coordine la ' +
  'tasación. Nunca dos datos en el mismo mensaje. No le pidas el teléfono (la charla es por ' +
  'WhatsApp). Cuando ya tenés todo, confirmás que un asesor lo contacta y cerrás preguntando ' +
  'si necesita algo más mientras tanto.\n'
const n = antes.split(VIEJO).length - 1
assert(n === 1, `el ancla del cierre aparece ${n} veces, esperaba 1`)

const NUEVO =
  'Cierre de este caso: seguís la progresión, de a UNA pregunta por turno, y la pregunta del ' +
  'turno la define lo que TE FALTA:\n' +
  '   · No sabés qué auto entrega -> preguntás eso, y nada más.\n' +
  '   · Sabés el auto pero no los kilómetros -> preguntás los kilómetros, y nada más.\n' +
  '   · YA TENÉS EL AUTO Y LOS KILÓMETROS -> la pregunta de ese turno es el NOMBRE. Le ' +
  'mostrás las opciones que le entran y cerrás con: "con eso ya le puedo pasar todo a un ' +
  'asesor para que coordine la tasación. Me dejás tu nombre y apellido?". NO la reemplaces ' +
  'por "querés que te pase todo el stock?" ni por "querés ver más opciones?": esas alargan ' +
  'la charla sin avanzar, y el lead se enfría.\n' +
  'Nunca dos datos en el mismo mensaje. No le pidas el teléfono (la charla es por WhatsApp). ' +
  'Cuando ya tenés todo, confirmás que un asesor lo contacta y cerrás preguntando si ' +
  'necesita algo más mientras tanto.\n'

const despues = antes.replace(VIEJO, NUEVO)

// --- post-condiciones
assert(despues !== antes, 'no se aplicó ningún cambio')
assert(despues.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((despues.match(/\{\{/g) || []).length === EXPR, 'se perdió alguna expresión {{ }}')
assert((despues.match(/la pregunta de ese turno es el NOMBRE/g) || []).length === 1, 'la regla quedó duplicada')
assert(despues.includes('Me dejás tu nombre y apellido?"'), 'no quedó el guion concreto del cierre')
assert(!despues.includes(VIEJO), 'sobrevivió la redacción vieja')

for (const n of [1, 2, 3, 4, 5, 6]) {
  const c = (despues.match(new RegExp(`^${n}\\. `, 'gm')) || []).length
  assert(c === 1, `el punto ${n} del guion aparece ${c} veces, esperaba 1`)
}
for (const [marca, versión] of [
  ['TRATO:', 'v15'],
  ['SIN PRESUPUESTO DECLARADO', 'v16'],
  ['(se pasa del presupuesto', 'v19'],
  ['SUENE A CONSEJO ÚTIL', 'v20/v23'],
  ['nunca "está blanco"', 'v22'],
  ['LA DERIVACIÓN MANDA', 'v23'],
  ['OJO CON EL FORMATO AL REDIRIGIR', 'v24'],
  ['UNA PREGUNTA POR TURNO', 'v25'],
  ['CONTESTALA PRIMERO', 'v26'],
  ['No llames a ninguna herramienta de stock', 'v27'],
]) {
  const c = (despues.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  assert(c === 1, `problema con la regla de ${versión}: "${marca}" aparece ${c} veces`)
}

// El guard NO se toca: se revirtió en v28 tras el replay que mostró que lo rompía.
const armarRef = JSON.parse(readFileSync(SRC, 'utf8')).nodes.find((k) => k.name === 'Armar respuesta')
const armar = wf.nodes.find((k) => k.name === 'Armar respuesta')
assert(armar.parameters.jsCode === armarRef.parameters.jsCode, 'no se debe tocar Armar respuesta')

franco.parameters.options.systemMessage = despues

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${despues.length} chars (+${despues.length - antes.length})`)
console.log('  el cierre ahora trae el GUION textual de pedir el nombre, no sólo la regla')
console.log('  Armar respuesta sin tocar')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
