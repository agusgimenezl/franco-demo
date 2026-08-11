#!/usr/bin/env node
// EL NÚMERO SE DA DE UNA — Franco recitaba la regla interna y se contradecía. v80 -> v81. 2026-08-05.
//
// EL BUG (captura de Agustina). El cliente abre con *"me pasarías el número de un asesor
// directamente?"* y Franco:
//   (1) le NARRA la condición del prompt: *"el teléfono y WhatsApp te los puedo pasar si me los
//       pedís explícitamente"*,
//   (2) no reconoce que ese primer mensaje YA es el pedido explícito — es **textualmente el
//       ejemplo que trae el prompt** (*"me pasás un número?"*) — y condiciona el número a que le
//       den nombre y apellido,
//   (3) cuando el cliente contesta *"pasamelo, te lo pido explícitamente"*, le da el número al
//       toque y **ya no pide el nombre** que había dicho que necesitaba. Se contradice solo.
//
// BASELINE MEDIDO SOBRE v80 (`--repeat 3 --delay 15000`): **0/3**, y peor que la captura —
// 2 de 3 **ni siquiera dan el número** y recitan la regla (*"los doy solo si me los pedís
// explícitamente"*, *"te los puedo dar si me los pedís expresamente"*), y **3 de 3** piden nombre
// y apellido en el turno 1.
//
// TRAMPA 7, DESCARTADA PRIMERO: el guard de cierre de `Armar respuesta` sólo corre con
// `autos.length >= 1` y este turno no tiene autos; además el guard no menciona teléfono ni
// WhatsApp. Todo lo que se ve lo escribió Franco → el fix va al prompt.
//
// ROOT CAUSE — DOS REGLAS QUE CHOCAN Y NINGUNA DEFINE PRECEDENCIA:
//   · `## Paso 4`: *"El teléfono/WhatsApp de la empresa lo das SOLO si el cliente lo pide
//     EXPLÍCITAMENTE"*.
//   · `# Derivación a un asesor`: *"Derivás cuando el cliente pide hablar con alguien (...) le
//     pedís el nombre y el apellido"*.
//   "El número de un asesor" dispara las dos, y como nada dice cuál manda, Franco hizo una en el
//   turno 1 y la otra en el turno 2. Por eso se contradice: no es que falle una regla, es que
//   cumple las dos en orden distinto.
//
// TRAMPA 6 EN SU FORMA MÁS PURA, Y ES LO QUE HAY QUE ENTENDER PARA NO REPETIRLO: la regla vieja
// está escrita **como una condición** ("lo das SOLO si te lo piden explícitamente"), o sea que le
// da al modelo una **oración sobre el requisito**. Cuando llega un pedido de número, lo que más se
// parece a lo que tiene que escribir es esa oración, y la recita. **No alcanza con prohibir que la
// diga: hay que que no exista una oración así para copiar.** Por eso la regla nueva está escrita
// como una ACCIÓN con guion textual ("Claro, el WhatsApp de X es Y") en vez de como una condición.
//
// EL FIX, EN LOS DOS LADOS (precedente de v23: la regla va en el punto de disparo Y en el de uso;
// arreglar uno solo no sirve porque el que queda gana):
//   (A) `## Paso 4` — se REEMPLAZA el guion: el pedido de número se contesta dando el número, con
//       guion textual, y el ofrecimiento del asesor va DESPUÉS. Anti-ejemplo explícito de las dos
//       frases exactas que salieron en las corridas.
//   (B) `# Derivación a un asesor` — se agrega la precedencia en el punto donde hoy se dispara el
//       pedido de nombre: pedir un NÚMERO no es aceptar el contacto.
//
// LO QUE SE PRESERVA (era el riesgo de aflojar de más): Franco sigue **sin ofrecer** el
// teléfono por su cuenta, y sigue sin ofrecerlo a quien ya está derivado. Eso es lo que cuidan
// los evals `cierre-conversacion` y `derivacion-completada-no-reofrece-visita`.
//
// TRAMPAS: trampa 1 (sigue arrancando con "="), trampa 5 (cero LLM nuevo), trampa 3 (no se toca
// ninguna tool), y no se toca ningún nodo Postgres.
//
// Base: franco-n8n-v80.json (el vivo).
//
//   node scripts/numero-se-da-de-una.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v80.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v81.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const base = JSON.parse(readFileSync(SRC, 'utf8'))

const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no encontré el nodo Franco (AI Agent)')
let sm = franco.parameters.options.systemMessage
assert(sm.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(!sm.includes('SE LO DAS EN EL ACTO'), 'el fix ya está aplicado (¿script ya corrido?)')

// ---------------------------------------------------------------- (A) ## Paso 4
const OLD_A = '- El teléfono/WhatsApp de la empresa lo das SOLO si el cliente lo pide EXPLÍCITAMENTE ("me pasás un número?", "tenés WhatsApp?"). NUNCA lo ofrecés vos ni preguntás "querés que te pase el WhatsApp?": si el cliente ya está derivado, lo contacta el asesor, y ofrecerle un número de más te hace ver que no cerraste.'
assert(cuenta(sm, OLD_A) === 1, 'no encontré la regla del teléfono de ## Paso 4 como esperaba')

const NEW_A = '- SI EL CLIENTE TE PIDE UN NÚMERO, SE LO DAS EN EL ACTO Y SIN CONDICIONES. ' +
  '"Me pasás el número de un asesor?", "tenés WhatsApp?", "me das un teléfono?" — todas esas YA ' +
  'son el pedido, no hay ninguna otra que esperar. El guion es: "Claro, el WhatsApp de ' +
  '{{ $node["Config"].json.empresa_nombre }} es {{ $node["Config"].json.empresa_telefono }}. Y si ' +
  'preferís que un asesor te contacte directamente, decime y lo arreglo." Primero el número, ' +
  'después el ofrecimiento; el nombre y apellido se los pedís SÓLO si acepta que lo contacten. ' +
  'NUNCA le contestes "te lo puedo pasar si me lo pedís explícitamente" ni "los doy solo si me los ' +
  'pedís": cómo decido yo qué datos doy es asunto mío, no algo que se le cuenta al cliente, y ' +
  'encima ya te lo pidió. Y NUNCA le condiciones el número al nombre ("necesito tu nombre y ' +
  'apellido para darte el contacto"): el número es público y el nombre es para derivar, son dos ' +
  'cosas distintas y mezclarlas se lee como cobrarle peaje.\n' +
  '- Lo que NO hacés es ofrecerlo vos: si no te lo pidió, no preguntes "querés que te pase el ' +
  'WhatsApp?". Si el cliente ya está derivado, lo contacta el asesor, y ofrecerle un número de más ' +
  'te hace ver que no cerraste.'
sm = sm.replace(OLD_A, NEW_A)

// ---------------------------------------------------------------- (B) # Derivación a un asesor
const OLD_B = '- Cuando derivás o el cliente acepta el contacto, le pedís el nombre y el apellido si no los tenés ("le paso la info a un asesor. Me dejás tu nombre y apellido?").'
assert(cuenta(sm, OLD_B) === 1, 'no encontré el pedido de nombre de # Derivación como esperaba')

const NEW_B = OLD_B + ' PERO OJO: pedir un NÚMERO no es aceptar el contacto. Si te dice "me pasás ' +
  'el número de un asesor?", eso se contesta DÁNDOLE EL NÚMERO (ver ## Paso 4) y recién después le ' +
  'ofrecés que lo contacten; el nombre se lo pedís sólo si acepta ESO. Pedirle el nombre para darle ' +
  'un número es el error que lo hace sentir que le ponés un peaje.'
sm = sm.replace(OLD_B, NEW_B)

franco.parameters.options.systemMessage = sm

// ---------------------------------------------------------------- post
// OLD_A se reemplaza entero; OLD_B se CONSERVA a propósito (el guion del pedido de nombre está
// bien, lo que faltaba era la precedencia) y se le agrega la excepción detrás.
assert(cuenta(sm, OLD_A) === 0, 'quedó la regla vieja del teléfono')
assert(cuenta(sm, OLD_B) === 1, 'se perdió el guion del pedido de nombre de # Derivación')
assert(cuenta(sm, 'SE LO DAS EN EL ACTO Y SIN CONDICIONES') === 1, 'no quedó el reemplazo (A)')
assert(cuenta(sm, 'pedir un NÚMERO no es aceptar el contacto') === 1, 'no quedó el reemplazo (B)')
// Trampa 6: guion textual + los DOS anti-ejemplos que salieron medidos.
assert(cuenta(sm, 'Claro, el WhatsApp de') === 1, 'falta el guion textual (trampa 6)')
assert(cuenta(sm, 'te lo puedo pasar si me lo pedís explícitamente') === 1, 'falta el anti-ejemplo de la regla recitada')
assert(cuenta(sm, 'necesito tu nombre y apellido para darte el contacto') === 1, 'falta el anti-ejemplo del peaje')
// Ya no queda NINGUNA oración que describa el teléfono como condicionado: es lo que se recitaba.
assert(!sm.includes('lo das SOLO si el cliente lo pide EXPLÍCITAMENTE'), 'quedó la regla escrita como condición')
// Lo que NO se puede perder (los controles viven de esto).
assert(cuenta(sm, 'querés que te pase el WhatsApp?') === 1, 'se perdió la prohibición de ofrecerlo por tu cuenta')
assert(cuenta(sm, 'ofrecerle un número de más te hace ver que no cerraste') === 1, 'se perdió el caso del ya-derivado')
assert(cuenta(sm, 'Me dejás tu nombre y apellido?') >= 1, 'se perdió el guion del pedido de nombre')
assert(cuenta(sm, 'e dejás tu nombre y apellido así te contacta?') === 2, 'se perdió el fix de v78 (financiación cierra pidiendo nombre)')
assert(sm.startsWith('='), 'el systemMessage dejó de arrancar con "=" (trampa 1)')
// Las 2 expresiones nuevas del guion tienen que resolverse (trampa 1 / C0).
const exprsBase = (base.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage.match(/\{\{/g) || []).length
const exprs = (sm.match(/\{\{/g) || []).length
assert(exprs === exprsBase + 2, `esperaba ${exprsBase + 2} expresiones {{ }} y hay ${exprs}`)
assert(cuenta(sm, '{{ $node["Config"].json.empresa_telefono }}') === 2, 'el guion no usa la variable del teléfono (quedaría hardcodeado: es multi-tenant)')

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
// Los fixes de v79 y v80 siguen puestos.
assert(wf.nodes.find((n) => n.name === 'Listar stock').parameters.query.includes("* 0.90) THEN 'economica'"), 'se perdió el piso de v79')
assert(cuenta(wf.nodes.find((n) => n.name === 'Buscar auto').parameters.query, 'translate(') === 8, 'se perdió el plegado de tildes de v80')

console.log('✓ todas las aserciones pasan')
console.log(`  systemMessage de Franco: ${fb.parameters.options.systemMessage.length} -> ${sm.length} chars (+${sm.length - fb.parameters.options.systemMessage.length})`)
console.log(`  expresiones {{ }}: ${exprsBase} -> ${exprs} (+2, el guion usa empresa_nombre y empresa_telefono)`)
console.log('  2 guiones reemplazados: ## Paso 4 (punto de uso) y # Derivación (punto de disparo)')
console.log('  Piso de v79 y plegado de tildes de v80: INTACTOS')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
