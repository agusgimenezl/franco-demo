#!/usr/bin/env node
// Reescribe las dos reglas de derivación de v30 dándoles GUION CONCRETO en vez de
// prohibición abstracta (2026-07-22). Trampa 6, cuarta vez en el día.
//
//   node scripts/derivacion-guion-concreto.mjs            # escribe franco-n8n-v33.json
//   node scripts/derivacion-guion-concreto.mjs --check    # solo valida
//
// LO QUE FALLÓ EN v32 (medido, no-repreguntar-asesor x4): el CRM ya marca "Requiere asesor"
// las 4 corridas (bug de raíz RESUELTO), pero Franco todavía dice, en cada turno:
//     "Querés que te pase los datos para que un asesor te contacte..."
// Dos problemas en esa frase, los dos por trampa 6:
//
//   (A) "te pase los datos" — la ÚNICA aparición de esa frase en todo el prompt está DENTRO
//       de la prohibición que puse en v30 ("Nunca digas 'querés que te pase los datos'"). Le
//       di la frase prohibida como ejemplo y el modelo la recita. Fix: sacar la frase, y dar
//       el guion correcto de qué SÍ decir.
//
//   (B) re-preguntar el asesor — la regla "UNA VEZ QUE ACEPTÓ, NO SE PREGUNTA MÁS" es prosa
//       abstracta. Su único ejemplo concreto es de cuándo YA vas a pedir el nombre, no de qué
//       hacer en el turno intermedio (cuando el cliente acepta pero antes pregunta otra cosa).
//       En ese turno Franco no tiene guion, así que improvisa la oferta de nuevo. Fix: darle
//       el guion textual del turno intermedio ("dale, apenas terminamos con esto lo paso a un
//       asesor").
//
// LÍMITE ESTRUCTURAL QUE NO SE RESUELVE ACÁ (documentado en STATE como "estado_cliente está
// un turno atrasado"): en el turno EXACTO en que el cliente acepta, el CRM todavía no
// escribió "Requiere asesor", así que `estado_cliente` no lo tiene. El único canal disponible
// en ese turno es la memoria de la conversación. Por eso el fix se apoya en la conversación
// ("SI VOS OFRECISTE Y TE DIJERON QUE SÍ"), no en el estado del lead. Aun así, contra un
// límite estructural, la expectativa honesta es reducir la frecuencia, no llevarla a 0.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v32.json')
const OUT = join(ROOT, 'franco-n8n-v33.json')
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

const antes = franco.parameters.options.systemMessage
assert(antes.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
const EXPR = (antes.match(/\{\{/g) || []).length
assert(EXPR === 21, `esperaba 21 expresiones {{ }}, hay ${EXPR}`)

const VIEJO =
  '- UNA VEZ QUE ACEPTÓ, NO SE PREGUNTA MÁS. Si en esta conversación ya ofreciste un asesor ' +
  'y el cliente dijo que sí — "sí", "dale", "si porfa", "sí pero antes contame X" —, la ' +
  'derivación está ACEPTADA y no se vuelve a preguntar NUNCA. Da igual cuántos turnos ' +
  'pasen o cuántas preguntas intercale en el medio: seguís contestando lo que te pregunte ' +
  'y, cuando termine, avanzás pidiendo lo que falte ("perfecto, para que te contacte, me ' +
  'dejás tu nombre y apellido?"). Volver a preguntarle si quiere un asesor a alguien que ' +
  'ya dijo que sí es lo que más rápido hace que abandone. Fijate también en "Lo que ya ' +
  'sabés de este cliente": si dice que ya aceptó, está aceptado.\n' +
  '- VOS NO MANDÁS DATOS, LOS PEDÍS. Nunca digas "querés que te pase los datos": el que ' +
  'pasa el nombre y apellido es el cliente, y vos se los pedís a él.\n'
unaVez(antes, VIEJO, 'reglas de derivación de v30')

const NUEVO =
  '- SI VOS OFRECISTE UN ASESOR Y TE DIJERON QUE SÍ, la derivación YA ESTÁ ACEPTADA. Contás ' +
  'como "sí" cualquier forma: "sí", "dale", "si porfa", "sí por favor", y también "sí pero ' +
  'antes contame X". A partir de ahí NO volvés a ofrecer el asesor ni a preguntar si lo ' +
  'quiere: ya lo quiere. Lo que hacés cambia según el turno:\n' +
  '   · Si en el mismo mensaje te pidió otra cosa ("sí, pero antes decime el consumo"), le ' +
  'contestás eso y cerrás confirmando, sin volver a preguntar: "listo, apenas terminamos con ' +
  'esto lo paso a un asesor".\n' +
  '   · Cuando ya no tiene más preguntas, pedís lo único que falta para derivar: "perfecto, ' +
  'para que un asesor te contacte, me dejás tu nombre y apellido?". Y si ya tenés el nombre, ' +
  'confirmás que lo contactan y cerrás.\n' +
  '   Volver a preguntarle "querés un asesor?" a alguien que ya dijo que sí es lo que más ' +
  'rápido lo hace abandonar. Fijate también en "Lo que ya sabés de este cliente": si figura ' +
  'que ya aceptó, está aceptado.\n' +
  '- EL NOMBRE Y APELLIDO LO PONE EL CLIENTE, NO VOS. Para derivar necesitás que él te escriba ' +
  'su nombre, así que se lo PEDÍS: "me dejás tu nombre y apellido?". Vos no le mandás ningún ' +
  'dato, ni datos del asesor ni nada: lo único que pasa de mano es que él te da su nombre.\n'
const despues = antes.replace(VIEJO, NUEVO)

// --- post-condiciones
assert(despues !== antes, 'no se aplicó ningún cambio')
assert(despues.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((despues.match(/\{\{/g) || []).length === EXPR, 'se perdió alguna expresión {{ }}')

// La frase que Franco recitaba NO puede seguir en el prompt, ni como prohibición.
assert(!despues.includes('te pase los datos'), 'sobrevivió la frase "te pase los datos" — es lo que recita')
// Los guiones nuevos, presentes y únicos.
assert((despues.match(/lo paso a un asesor/g) || []).length === 1, 'falta el guion del turno intermedio')
assert(despues.includes('me dejás tu nombre y apellido?'), 'falta el guion de pedir el nombre')
assert(!despues.includes('NO SE PREGUNTA MÁS'), 'quedó la redacción vieja')

for (const [marca, versión] of [
  ['TRATO:', 'v15'], ['SIN PRESUPUESTO DECLARADO', 'v16'], ['(se pasa del presupuesto', 'v19'],
  ['SUENE A CONSEJO ÚTIL', 'v20/v23'], ['nunca "está blanco"', 'v22'], ['LA DERIVACIÓN MANDA', 'v23'],
  ['OJO CON EL FORMATO AL REDIRIGIR', 'v24'], ['CONTESTALA PRIMERO', 'v26'],
  ['No llames a ninguna herramienta de stock', 'v27'], ['la pregunta de ese turno es el NOMBRE', 'v29'],
  ['anio_min', null], ['# No repitas lo que ya hiciste', 'v30'],
]) {
  const c = (despues.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  if (versión) assert(c === 1, `problema con la regla de ${versión}: "${marca}" aparece ${c} veces`)
}

franco.parameters.options.systemMessage = despues

// Nada más cambia.
const orig = JSON.parse(readFileSync(SRC, 'utf8'))
for (const n of wf.nodes) {
  if (n.name === 'Franco (AI Agent)') continue
  const o = orig.nodes.find((k) => k.name === n.name)
  assert(JSON.stringify(n.parameters) === JSON.stringify(o.parameters), `se tocó ${n.name} sin querer`)
}

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${despues.length} chars (${despues.length - antes.length >= 0 ? '+' : ''}${despues.length - antes.length})`)
console.log('  "te pase los datos" ELIMINADA del prompt (era el ejemplo que recitaba)')
console.log('  guion concreto para el turno intermedio y para pedir el nombre')

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
