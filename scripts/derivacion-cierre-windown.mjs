#!/usr/bin/env node
// Bug post-derivación (capturas Agustina, medido baseline 0/4): tras derivar (implícito vía
// financiación + nombre, estado='Requiere asesor'), el cliente pregunta la dirección y Franco
// (a) RE-OFRECE el asesor ("querés que un asesor te contacte?"), (b) INVENTA acciones que no puede
// hacer ("te reservo la S10", "te preparo un turno") y (c) ofrece el teléfono sin que lo pidan.
//
// Root cause MEDIDO: estado ya estaba en 'Requiere asesor' (no es lag). La regla de cierre comercial
// —## Paso 4 "cerrás con dirección y horario, y ofrecés que un asesor lo contacte" + el cierre
// comercial obligatorio— le gana a "LA DERIVACIÓN MANDA". Es lenguaje, no cálculo -> va al prompt.
//
// Fix (trampa 6: se REEMPLAZAN los guiones que enseñan el bug, con ejemplo concreto):
//   (A) ## Paso 4: el cierre tras derivación es SECO (dirección + "quedo a disposición"), sin re-ofrecer.
//   (B) # Derivación: dos reglas nuevas — wind-down tras derivar + no simular acciones (reservar/
//       preparar/agendar/pasar teléfono), con los mismos anti-ejemplos que Franco produjo.
//
// Solo toca el systemMessage de Franco. Base: franco-n8n-v67.json. (2026-07-29)
//
//   node scripts/derivacion-cierre-windown.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v67.json')
const OUT = join(ROOT, 'franco-n8n-v68.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no encontré el nodo Franco (AI Agent)')
let sm = franco.parameters.options.systemMessage
const lenAntes = sm.length
assert(sm[0] === '=', 'el systemMessage no arranca con "=" (trampa 1)')
assert(cuenta(sm, 'DESPUÉS DE DERIVAR, EL CIERRE CAMBIA') === 0, 'el fix ya está aplicado')

// ---------------------------------------------------------------- (A) ## Paso 4 — Cierre
const A_OLD = 'Si te pregunta la dirección, se la das y cerrás — sin ofrecer el WhatsApp.'
assert(cuenta(sm, A_OLD) === 1, `ancla A aparece ${cuenta(sm, A_OLD)} veces, esperaba 1`)
const A_NEW = A_OLD + ' Y si el cliente YA está derivado (ya aceptó el asesor o ya le confirmaste que lo van a contactar), ese cierre es SECO: das la dirección y el horario y cerrás con "quedo a disposición si te surge cualquier otra consulta" — NO re-ofrecés el asesor (ya está aceptado) y NO le prometés reservarle ni prepararle un auto ni agendarle la visita: eso lo coordina el asesor (ver # Derivación a un asesor).'
sm = sm.replace(A_OLD, A_NEW)

// ---------------------------------------------------------------- (B) # Derivación a un asesor
const B_OLD = 'ofrecés la dirección por si prefiere acercarse, y no prometés tiempos exactos.'
assert(cuenta(sm, B_OLD) === 1, `ancla B aparece ${cuenta(sm, B_OLD)} veces, esperaba 1`)
const B_NEW = B_OLD + '\n- DESPUÉS DE DERIVAR, EL CIERRE CAMBIA. Una vez que confirmaste que un asesor lo va a contactar, la regla de "SIEMPRE cerrá con una pregunta comercial" YA NO corre en los turnos que siguen: el próximo paso lo da el asesor, no vos. Si el cliente pregunta la dirección, el horario, o te agradece, contestás lo que pidió y cerrás con "quedo a disposición si te surge cualquier otra consulta" — NADA de una pregunta comercial ni de re-ofrecer el asesor. Ejemplo: "dónde están? para ir a verlos" -> "Estamos en [dirección], [horario]. Quedo a disposición si te surge cualquier otra consulta." y listo. NUNCA cierres eso con "querés que un asesor te contacte?" (ya lo aceptó), ni con "querés que te pase el teléfono?", ni con "querés que te prepare o te reserve algún auto?".\n- NO SIMULES ACCIONES QUE NO PODÉS HACER. No reservás autos, no los preparás para la visita, no agendás turno ni día ni hora: todo eso lo coordina el asesor cuando contacta al cliente. Nunca digas "te reservo la X", "te la preparo para cuando vengas", "te preparo un turno", "querés que te reserve alguno?" ni "querés que te prepare algún auto?". Si el cliente quiere coordinar la visita, lo enmarcás como algo del asesor ("el asesor coordina la visita con vos cuando te contacte"), sin prometer que lo hacés vos.'
sm = sm.replace(B_OLD, B_NEW)

franco.parameters.options.systemMessage = sm

// ---------------------------------------------------------------- post
assert(sm[0] === '=', 'el systemMessage dejó de arrancar con "=" (trampa 1)')
assert(cuenta(sm, 'DESPUÉS DE DERIVAR, EL CIERRE CAMBIA') === 1, 'la regla wind-down no quedó una vez')
assert(cuenta(sm, 'NO SIMULES ACCIONES QUE NO PODÉS HACER') === 1, 'la regla anti-simulación no quedó una vez')
assert(cuenta(sm, 'quedo a disposición si te surge cualquier otra consulta') === 2, 'esperaba el guion de cierre en las 2 ediciones')
assert(cuenta(sm, '# Alcance') === 1, 'se tocó # Alcance sin querer')
assert(cuenta(sm, '# Consignación (vender tu auto)') === 1, 'se perdió/duplicó la sección de consignación (v67)')

console.log('✓ todas las aserciones pasan')
console.log(`  systemMessage: ${lenAntes} -> ${sm.length} chars (+${sm.length - lenAntes})`)
console.log('  (A) Paso 4: cierre seco tras derivación. (B) Derivación: wind-down + anti-simulación de acciones.')

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
