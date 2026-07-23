#!/usr/bin/env node
// Con el asesor YA pedido, cuando el cliente da los datos del usado, Franco confirma y CIERRA
// (no relanza la permuta ni re-pide el nombre) (2026-07-22, regresión "derivación manda").
//
//   node scripts/derivacion-manda-confirma-cierra.mjs            # escribe franco-n8n-v37.json
//   node scripts/derivacion-manda-confirma-cierra.mjs --check    # solo valida
//
// MEDIDO. `derivacion-pide-datos-del-usado`: v33 0/4 -> v36 1/3. El cliente pide asesor (T2) y
// da "Julieta Miguez, tengo un gol 2015 con 90.000 km" (T3). Franco debería confirmar y cerrar
// (v23 "LA DERIVACIÓN MANDA"). En cambio, en 2/3 relanza la permuta con 7-8 cards, y en 1 de
// esas re-pide "Me dejás tu nombre y apellido?" con el nombre YA dado en el mismo mensaje.
//
// POR QUÉ PIERDE (trampa 6). La línea "LA DERIVACIÓN MANDA" dice en ABSTRACTO "confirmás y
// CERRÁS", pero el único ejemplo concreto de cierre (el de abajo, "listo Julio...") es sobre
// recibir el NOMBRE, no los datos del usado. Cuando llega el usado, Franco no tiene un guion
// concreto de "confirmar+cerrar con el usado" y cae en la narrativa de permuta, que SÍ tiene
// un ejemplo rico. Es el mismo patrón del name-ask (v34): el ejemplo concreto le gana a la
// regla abstracta.
//
// EL FIX. Se le da a "LA DERIVACIÓN MANDA" el ejemplo concreto que le falta, para el caso
// exacto que falla: recibir los datos del usado con el asesor ya pedido -> UNA burbuja que
// confirma nombrando el usado y cierra, con auto_ids VACÍO y sin re-pedir el nombre si ya lo
// dio. Al no mandar cards, el guard de `Armar respuesta` tampoco dispara (sólo corre con
// autos.length >= 1): el fix del prompt desactiva la re-oferta del guard de arriba (trampa 7).
//
// Sección aislada (# Derivación a un asesor). No toca ## Permuta ni ## Recomendación.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v36.json')
const OUT = join(ROOT, 'franco-n8n-v37.json')
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
// Partimos de v36 (que ya tiene v34 name-ask, #2 y #4).
assert(cuenta(m, 'El molde de la recomendación') === 1, 'no encuentro #4 — ¿partiste de v36?')
assert(cuenta(m, 'un asesor necesita ver el estado del auto en persona') === 1, 'no encuentro #2')
assert(cuenta(m, 'lo único que lo destraba es ese dato') === 1, 'no encuentro el name-ask de v34')

const OLD =
  'Cuando te da los datos que faltaban, confirmás que un asesor lo contacta y CERRÁS ' +
  'preguntando si necesita algo más mientras tanto.'
assert(cuenta(m, OLD) === 1, `esperaba la frase de cierre de "derivación manda" una vez, hay ${cuenta(m, OLD)}`)

const NEW =
  'Cuando te da los datos que faltaban (el nombre, o el auto que entrega), tu respuesta es UNA ' +
  'burbuja corta: confirmás nombrando lo que te dio y CERRÁS, con auto_ids VACÍO. Concreto: si ' +
  'te dice "Julieta Miguez, tengo un Gol 2015 con 90.000 km", respondés algo como "listo ' +
  'Julieta, con el Gol 2015 ya le paso todo a un asesor para que coordine la tasación. ' +
  'Necesitás que te ayude con algo más mientras tanto?" — sin cards, sin lista de opciones, y ' +
  'sin volver a pedirle el nombre si ya te lo dio.'

m = m.replace(OLD, NEW)

// post-condiciones
assert(m !== antes, 'no se aplicó ningún cambio')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR, 'cambió la cantidad de expresiones {{ }}')
assert(!m.includes(OLD), 'sobrevivió la frase abstracta vieja')
assert(cuenta(m, 'con el Gol 2015 ya le paso todo a un asesor') === 1, 'el ejemplo concreto nuevo no quedó una sola vez')
// La regla marco de v23 sigue, y el ejemplo de cierre del nombre (línea 188) también.
assert(cuenta(m, 'LA DERIVACIÓN MANDA') === 1, 'se tocó el encabezado de v23')
assert(m.includes('listo Julio, un asesor te contacta por acá'), 'se perdió el ejemplo de cierre del nombre (línea 188)')
// Los fixes de abajo intactos.
assert(cuenta(m, 'El molde de la recomendación') === 1, 'se perdió #4')
assert(cuenta(m, 'un asesor necesita ver el estado del auto en persona') === 1, 'se perdió #2')
assert(cuenta(m, 'lo único que lo destraba es ese dato') === 1, 'se perdió el name-ask de v34')
assert(cuenta(m, 'TRATO:') === 1, 'se tocó v15')
assert(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)

franco.parameters.options.systemMessage = m

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${m.length} chars (+${m.length - antes.length})`)
console.log('  "LA DERIVACIÓN MANDA" ahora trae el ejemplo concreto: recibir datos del usado -> confirmar+cerrar, auto_ids vacío, sin re-pedir el nombre')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
