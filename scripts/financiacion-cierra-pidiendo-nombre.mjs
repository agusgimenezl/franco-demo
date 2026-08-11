#!/usr/bin/env node
// DERIVACION ACEPTADA PERO SIN NOMBRE — SEGUNDO INTENTO, ahora en el lugar correcto. 2026-08-01.
//
// QUÉ PASÓ ANTES (leer para no repetirlo): el primer intento (v75) metió la instrucción en
// `Config.estado_cliente`, o sea en el ESTADO que inyecta el código. **Medido y descartado: 0/4 con
// el CRM sano.** La ejecución 10208 probó que la línea LE LLEGABA a Franco (`lead_estado:
// "Requiere asesor"`, `lead_nombre: ""`) y que Franco igual no pedía el nombre. Es **trampa 6**: una
// regla abstracta pierde contra el guion concreto que ya está en el prompt.
//
// DÓNDE ESTÁ EL GUION QUE GANA (esto es el root cause real, encontrado leyendo el systemMessage):
//   (A) `# Financiación`, último paso del pre-perfilado:
//       "Recién con el anticipo preguntás las cuotas (12, 24, 36 o 48) si no las dio, y confirmás
//        que se lo dejás anotado al asesor para la simulación."
//       El embudo TERMINA ahí. No dice "y pedís el nombre". Franco hace exactamente eso: cierra con
//       "le dejo anotado al asesor..." y nunca pide el nombre.
//   (B) `## Paso 3`, Excepción 2 (financiación ya en curso):
//       '...consolidá con una AFIRMACIÓN ("perfecto, le dejo anotado al asesor la simulación con tu
//        anticipo y las cuotas que me diste") y cerrá ofreciendo OTRO paso (verla en persona, o si
//        necesita algo más mientras tanto).'
//       Ese "ofreciendo OTRO paso" es literalmente el "Mientras tanto, querés que te muestre algunas
//       opciones de Corolla...?" que salió en las corridas fallidas.
//
// Son el MISMO guion para la MISMA situación, en dos lugares. Por trampa 6, arreglar uno y dejar el
// otro no sirve: el que queda gana. Por eso este cambio toca los dos y NADA MÁS.
//
// EL FIX: se REEMPLAZA el guion (no se le pone una prohibición arriba — eso ya falló tres veces
// según el CLAUDE.md). Ahora el pre-perfilado de financiación termina en el NOMBRE, con guion
// textual, y con el anti-ejemplo explícito de los dos cierres que producen el bug. Se preserva el
// caso "ya tengo el nombre": ahí NO se vuelve a pedir.
//
// TRAMPAS:
//   · Trampa 6: guion concreto entre comillas en ambos lugares + anti-ejemplo textual.
//   · Trampa 1: el systemMessage sigue arrancando con "=".
//   · Trampa 7: verificado en la sesión anterior que la frase la escribe Franco (sale del output
//     crudo del agente), NO el guard de `Armar respuesta` — por eso el fix va al prompt.
//   · Trampa 5: cero llamadas nuevas a LLM.
//
// NO toca: `Config` (el intento anterior quedó revertido en v77), ningún nodo Postgres, el prompt
// del CRM, ni el fix de orden de `Query leads` (ese está medido y funcionando).
// Base: franco-n8n-v77.json (= v76 con estado_cliente revertido a v74).
// (2026-08-01)
//
//   node scripts/financiacion-cierra-pidiendo-nombre.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v77.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v78.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const base = JSON.parse(readFileSync(SRC, 'utf8'))

const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no encontré el nodo Franco (AI Agent)')
let sm = franco.parameters.options.systemMessage
assert(sm.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(!sm.includes('termina en el NOMBRE'), 'el fix ya está aplicado (¿script ya corrido?)')

// ---------------------------------------------------------------- (A) # Financiación
const OLD_A = 'Recién con el anticipo preguntás las cuotas (12, 24, 36 o 48) si no las dio, y confirmás que se lo dejás anotado al asesor para la simulación.'
assert(cuenta(sm, OLD_A) === 1, 'no encontré el cierre del pre-perfilado de # Financiación como esperaba')

const NEW_A = 'Recién con el anticipo preguntás las cuotas (12, 24, 36 o 48) si no las dio. ' +
  'OJO CON CÓMO CERRÁS EL PRE-PERFILADO: cuando ya tenés el anticipo Y las cuotas, el embudo NO ' +
  'termina en "se lo dejo anotado al asesor" — termina en el NOMBRE. Sin nombre el asesor no tiene ' +
  'a quién contactar y el lead queda anónimo, así que ESE turno es el name-ask: confirmás lo que le ' +
  'anotás Y pedís el nombre en el MISMO mensaje, y no ofrecés ningún otro paso hasta tenerlo. ' +
  'Guion: "perfecto, le dejo anotado al asesor la simulación con $15.000.000 de anticipo en 36 ' +
  'cuotas. Me dejás tu nombre y apellido así te contacta?". ' +
  'NO cierres con "un asesor te va a contactar para darte los montos exactos" ni con "mientras ' +
  'tanto, querés ver otras opciones?" mientras no tengas el nombre: esos dos cierres dan la ' +
  'derivación por hecha justo cuando le falta el dato que la completa. ' +
  'Si en "Lo que ya sabés de este cliente" YA figura su nombre, no se lo vuelvas a pedir: confirmás ' +
  'lo anotado y cerrás.'

sm = sm.replace(OLD_A, NEW_A)

// ---------------------------------------------------------------- (B) ## Paso 3, Excepción 2
const OLD_B = 'consolidá con una AFIRMACIÓN ("perfecto, le dejo anotado al asesor la simulación con tu anticipo y las cuotas que me diste") y cerrá ofreciendo OTRO paso (verla en persona, o si necesita algo más mientras tanto).'
assert(cuenta(sm, OLD_B) === 1, 'no encontré la Excepción 2 de ## Paso 3 como esperaba')

const NEW_B = 'consolidá con una AFIRMACIÓN ("perfecto, le dejo anotado al asesor la simulación con tu ' +
  'anticipo y las cuotas que me diste"). Y OJO CON EL PASO QUE OFRECÉS DESPUÉS: si todavía NO tenés ' +
  'su nombre, el próximo paso ES el nombre y ningún otro — "me dejás tu nombre y apellido así te ' +
  'contacta?" —, porque sin nombre la derivación queda incompleta. Recién cuando ya tenés el nombre ' +
  'cerrás ofreciendo OTRO paso (verla en persona, o si necesita algo más mientras tanto).'

sm = sm.replace(OLD_B, NEW_B)

franco.parameters.options.systemMessage = sm

// ---------------------------------------------------------------- post
assert(cuenta(sm, 'termina en el NOMBRE') === 1, 'no quedó el reemplazo (A)')
assert(cuenta(sm, 'el próximo paso ES el nombre') === 1, 'no quedó el reemplazo (B)')
// El guion arranca con mayúscula en (A) y con minúscula en (B); se cuenta el tramo común.
assert(cuenta(sm, 'e dejás tu nombre y apellido así te contacta?') === 2, 'esperaba el guion concreto en los DOS lugares (trampa 6)')
assert(cuenta(sm, OLD_A) === 0 && cuenta(sm, OLD_B) === 0, 'quedó alguno de los guiones viejos')
assert(sm.startsWith('='), 'el systemMessage dejó de arrancar con "=" (trampa 1)')

// El caso "ya tengo el nombre" tiene que seguir cubierto, o rompemos los controles que están 5/5.
assert(cuenta(sm, 'no se lo vuelvas a pedir') === 1, 'falta la salvaguarda de "ya tengo el nombre"')

// Lo que NO se toca.
const cfg = (w) => w.nodes.find((n) => n.name === 'Config').parameters.assignments.assignments.find((a) => a.name === 'estado_cliente').value
assert(cfg(wf) === cfg(base), 'cambió Config.estado_cliente y NO debía (el intento por estado ya fue descartado)')
assert(!cfg(wf).includes('TODAVIA NO TE DIO SU NOMBRE'), 'Config trae el fix descartado de v75: base equivocada')
const ql = (w) => w.nodes.find((n) => n.name === 'Query leads').parameters.query
assert(ql(wf).includes('ORDER BY crm_leads.ultima_actualizacion DESC;'), 'se perdió el fix de orden de Leads')

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

console.log('✓ todas las aserciones pasan')
console.log(`  systemMessage de Franco: ${fb.parameters.options.systemMessage.length} -> ${sm.length} chars (+${sm.length - fb.parameters.options.systemMessage.length})`)
console.log('  2 guiones reemplazados (# Financiación y ## Paso 3 Excepción 2), mismo guion en ambos')
console.log('  Config.estado_cliente: SIN CAMBIOS (revertido, el intento por estado ya se descartó)')
console.log('  Query leads (fix de orden, MEDIDO): INTACTO')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
