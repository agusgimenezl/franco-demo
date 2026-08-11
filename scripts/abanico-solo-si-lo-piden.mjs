#!/usr/bin/env node
// EL ABANICO SE OFRECE, NO SE DISPARA SOLO. v82 -> v83. 2026-08-05.
//
// EL BUG (captura de Agustina): en la progresión de permuta, apenas el cliente contesta los km del
// usado ("110000 km"), Franco le dumpea el abanico completo de capacidad de compra (tramos
// entrada/Intermedio/Alto con Amarok, Vento, S10, Hilux, T-Cross) + 4 cards, **sin que el cliente
// haya pedido ver opciones**. Agustina: el agente NO manda recomendaciones ni alternativas porque
// sí; puede PREGUNTAR si le gustaría verlas.
//
// LO PRIMERO QUE HAY QUE ENTENDER, PORQUE CAMBIA EL FIX: **la regla ya existía CUATRO veces** y las
// cuatro se violaron en la misma respuesta:
//   (A) "si ya venís en la progresión de permuta y tenés el auto y los kilómetros del usado, NO
//       corras este punto ni muestres opciones (ni tramos ni 'dos caminos')"
//   (B) el guion de ofrecer una de dos: "querés que te conecte con un asesor para la tasación de tu
//       vehículo, o preferís ver más opciones en stock?"
//   (C) "Nunca saltees directo al abanico"
//   (D) "ni le muestres autos que no pidió"
// Agregar una QUINTA prohibición no iba a servir: es exactamente el patrón que el CLAUDE.md
// documenta tres veces (trampa 6).
//
// Y EL HALLAZGO QUE LO EXPLICA: no es que faltara una regla — **hay una frase que autoriza
// justamente lo que Agustina no quiere**, y por eso les ganaba a las otras cuatro:
//   "OJO: dar un anticipo/efectivo y querer ver qué le entra YA es pedir opciones —no le exijas que
//    diga 'mostrame el catálogo' para armar el abanico; con anticipo declarado y sin modelo
//    puntual, el abanico VA."
// Esa frase se escribió a propósito en su momento (el abanico de tramos costó ~12 versiones,
// v40-v52). La decisión de Agustina del 2026-08-05 la revierte: **el abanico pasa a estar detrás de
// un sí explícito, siempre.**
//
// BASELINE MEDIDO SOBRE v82 (`--repeat 3 --delay 25000`): **0/3**, pero HONESTAMENTE falla por tres
// motivos distintos y sólo uno es este bug — está anotado para que nadie lea el 0/3 como si fuera
// todo lo mismo:
//   · corrida 1: dumpea el abanico. ES el bug. **Reproduce 1 de 3, no siempre.**
//   · corrida 2: va al name-ask — que es lo que HOY dice el punto 5, o sea comportamiento correcto
//     según el prompt viejo. Esta decisión lo reemplaza por el ofrecimiento.
//   · corrida 0: repregunta "me dejás el modelo y año de tu Toyota Etios?" justo después de que se
//     lo dijeron. **Es OTRO bug** (abierto #3 de STATE.md, "al pedir datos del usado, repregunta
//     los ya dados"), NO se toca acá: un cambio por vez.
//
// EL FIX — SE REEMPLAZAN LOS DOS GUIONES, no se agrega una prohibición:
//   (A) El turno posterior a tener usado + km deja de ser el name-ask y pasa a ser el
//       OFRECIMIENTO, con guion textual y `auto_ids` vacío. Es la decisión de Agustina.
//   (B) La frase que autoriza el abanico se reemplaza por su opuesta: el abanico va SOLO después
//       del sí, y si con el sí no hay presupuesto conocido, primero se pregunta eso.
//   Se PRESERVA la rama INTERÉS PUNTUAL, que ya decía lo que Agustina quiere (si el cliente vino
//   por un auto concreto, no se le ofrecen alternativas de otros modelos).
//
// TRAMPAS: trampa 1 (sigue arrancando con "="), trampa 5 (cero LLM nuevo), trampa 7 (verificado:
// el guard de `Armar respuesta` sólo corre con autos.length>=1 y no arma listas; el abanico lo
// escribe Franco).
//
// Base: franco-n8n-v82.json (el vivo).
//
//   node scripts/abanico-solo-si-lo-piden.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v82.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v83.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const base = JSON.parse(readFileSync(SRC, 'utf8'))

const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no encontré el nodo Franco (AI Agent)')
let sm = franco.parameters.options.systemMessage
assert(sm.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(!sm.includes('ese turno es el OFRECIMIENTO'), 'el fix ya está aplicado (¿script ya corrido?)')

// ---------------------------------------------------------------- (A) el turno del ofrecimiento
const OLD_A = '— ese turno es el name-ask, andá directo a pedir el nombre (ver el cierre de esta sección).'
assert(cuenta(sm, OLD_A) === 1, 'no encontré el cierre del punto 5 como esperaba')

const NEW_A = '— ese turno es el OFRECIMIENTO, y nada más. Guion: "la tasación final de tu usado la ' +
  'hace un asesor viéndolo en persona. Querés que te muestre alternativas que te entren con eso, o ' +
  'preferís que un asesor te contacte directo?". UNA burbuja, `auto_ids` VACÍO, sin lista, sin ' +
  'tramos, sin cards y sin fotos, y ahí FRENÁS hasta que conteste. Mostrarle autos en ese turno es ' +
  'el error: el cliente te estaba dando datos de su usado, no pidiéndote opciones.'
sm = sm.replace(OLD_A, NEW_A)

// ---------------------------------------------------------------- (B) la frase que lo autorizaba
const OLD_B = 'OJO: dar un anticipo/efectivo y querer ver qué le entra YA es pedir opciones —no le exijas que diga "mostrame el catálogo" para armar el abanico; con anticipo declarado y sin modelo puntual, el abanico VA.'
assert(cuenta(sm, OLD_B) === 1, 'no encontré la frase que autoriza el abanico (¿cambió el prompt?)')

const NEW_B = 'OJO, ESTO CAMBIÓ: declarar un anticipo NO es pedir opciones. El abanico va SOLO ' +
  'después de que el cliente diga que SÍ a verlo ("dale, mostrame", "sí, qué me entra?", "bueno, a ' +
  'ver"). Antes de ese sí no armás abanico ni llamás a Listar stock para listar opciones, por más ' +
  'que tengas el anticipo. Si te dice que sí y NO sabés con cuánta plata cuenta, primero le ' +
  'preguntás eso —una sola pregunta— y recién con la respuesta armás el abanico; si el presupuesto ' +
  'YA te lo dio, no se lo vuelvas a preguntar y mostrá directo. Nunca lo armes por tu cuenta: ' +
  'mostrarle autos que no pidió se lee como que le querés colocar lo que te sobra, no como ayuda.'
sm = sm.replace(OLD_B, NEW_B)

franco.parameters.options.systemMessage = sm

// ---------------------------------------------------------------- post
assert(cuenta(sm, OLD_A) === 0 && cuenta(sm, OLD_B) === 0, 'quedó algún guion viejo')
assert(cuenta(sm, 'ese turno es el OFRECIMIENTO') === 1, 'no quedó el reemplazo (A)')
assert(cuenta(sm, 'El abanico va SOLO') === 1, 'no quedó el reemplazo (B)')
// Trampa 6: los dos reemplazos traen guion concreto, no sólo la regla.
assert(cuenta(sm, 'Querés que te muestre alternativas que te entren con eso') === 1, 'falta el guion textual del ofrecimiento')
assert(cuenta(sm, '"dale, mostrame"') === 1, 'falta el ejemplo concreto de qué cuenta como sí')
// Ya no puede quedar NINGUNA frase que diga que el abanico va sin pedirlo.
assert(!sm.includes('el abanico VA'), 'quedó la frase que autoriza el abanico sin pedirlo')
assert(!sm.includes('YA es pedir opciones'), 'quedó la premisa vieja de que dar anticipo es pedir opciones')
// Lo que NO se puede perder.
assert(cuenta(sm, 'INTERÉS PUNTUAL') === 1, 'se perdió la rama de interés puntual, que ya era correcta')
assert(cuenta(sm, 'preferís ver más opciones en stock?') === 1, 'se perdió el guion de una-de-dos del interés puntual')
assert(cuenta(sm, 'Nunca saltees directo al abanico') === 1, 'se perdió la regla C')
assert(cuenta(sm, 'CAPACIDAD DE COMPRA REAL') === 1, 'se perdió el abanico en sí (sólo se gatea, no se borra)')
assert(cuenta(sm, 'un dump de pickups de $50M') === 1, 'se perdió el gate de precio_objetivo=0')
assert(sm.startsWith('='), 'el systemMessage dejó de arrancar con "=" (trampa 1)')
const exprsBase = (base.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage.match(/\{\{/g) || []).length
assert((sm.match(/\{\{/g) || []).length === exprsBase, 'cambió la cantidad de expresiones {{ }}')
// Los fixes de las versiones anteriores siguen puestos.
assert(sm.includes('SE LO DAS EN EL ACTO'), 'se perdió el fix de v81')
assert(sm.includes('NUNCA metida adentro'), 'se perdió la línea de tracción de v82')
assert(sm.includes('Las "economica" NO se ofrecen'), 'se perdió el guion de v79')
assert(cuenta(sm, 'e dejás tu nombre y apellido así te contacta?') === 2, 'se perdió el fix de v78')

// Ningún otro nodo tocado.
for (const n of wf.nodes) {
  const b = base.nodes.find((x) => x.name === n.name)
  assert(b, `nodo nuevo inesperado: ${n.name}`)
  if (n.name === 'Franco (AI Agent)') continue
  assert(JSON.stringify(n) === JSON.stringify(b), `cambió el nodo ${n.name} y NO debía`)
}
const fb = base.nodes.find((n) => n.name === 'Franco (AI Agent)')
for (const k of Object.keys(franco.parameters)) {
  if (k === 'options') continue
  assert(JSON.stringify(franco.parameters[k]) === JSON.stringify(fb.parameters[k]), `cambió Franco.parameters.${k}`)
}
for (const k of Object.keys(franco.parameters.options)) {
  if (k === 'systemMessage') continue
  assert(JSON.stringify(franco.parameters.options[k]) === JSON.stringify(fb.parameters.options[k]), `cambió Franco.options.${k}`)
}
assert(JSON.stringify(wf.connections) === JSON.stringify(base.connections), 'cambiaron las connections')
assert(wf.nodes.length === base.nodes.length, 'cambió la cantidad de nodos')
// v79 y v82 tocaron SQL: tienen que seguir intactos.
assert(wf.nodes.find((n) => n.name === 'Listar stock').parameters.query.includes("* 0.90) THEN 'economica'"), 'se perdió el piso de v79')
assert(wf.nodes.find((n) => n.name === 'Buscar auto').parameters.query.includes("THEN content ILIKE '%4x2%'"), 'se perdió el filtro de tracción de v82')

console.log('✓ todas las aserciones pasan')
console.log(`  systemMessage de Franco: ${fb.parameters.options.systemMessage.length} -> ${sm.length} chars (+${sm.length - fb.parameters.options.systemMessage.length})`)
console.log('  2 guiones reemplazados: el turno post-usado (name-ask -> OFRECIMIENTO) y la frase que')
console.log('  autorizaba el abanico sin pedirlo ("el abanico VA" -> "SOLO después del sí")')
console.log('  INTERÉS PUNTUAL, el abanico en sí y el gate de precio_objetivo=0: PRESERVADOS')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
