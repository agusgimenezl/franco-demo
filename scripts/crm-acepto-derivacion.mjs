#!/usr/bin/env node
// El CRM marca "Requiere asesor" cuando el cliente ACEPTA una derivación ofrecida por Franco
// (2026-07-22). Toca sólo el prompt del agente CRM.
//
//   node scripts/crm-acepto-derivacion.mjs            # escribe franco-n8n-v32.json
//   node scripts/crm-acepto-derivacion.mjs --check    # solo valida
//
// LA CORRELACIÓN QUE LO DELATA (medido en v31, `no-repreguntar-asesor` x3):
//     corrida 2 -> lead.estado = "Requiere asesor" -> Franco: "Perfecto, para que te
//                  contacte un asesor, me dejás tu nombre y apellido?"   ✅
//     corrida 1 -> lead.estado = "En conversacion"  -> no pide el nombre
//     corrida 3 -> lead.estado = "En conversación"  -> vuelve a ofrecer el asesor
//
// O sea: los dos mecanismos que se construyeron para esto YA FUNCIONAN cuando el estado está
// bien — el bloque `estado_cliente` de v30 que se lo dice a Franco, y el gate del guard de
// v31 que evita re-ofrecerlo. Lo que falla es aguas arriba: el estado no se setea.
//
// LA CAUSA: el prompt del CRM define "Requiere asesor" como "quiere coordinar visita,
// reservar, que lo contacten, avanzar con una operación". No cubre el caso MÁS COMÚN de esta
// demo: que Franco ofrezca la derivación y el cliente conteste "sí", "dale", "si porfa". El
// cliente nunca dice la palabra "asesor", así que el CRM lo lee como charla y lo deja en
// "En conversación".
//
// Es el mismo patrón que la etiqueta `fuera` de v19: un estado que el sistema necesita, que
// nadie le enseñó a producir.
//
// BONUS, del mismo diagnóstico: el CRM escribe el estado con y sin tilde ("En conversación" y
// "En conversacion") en corridas distintas. Para una columna que después se filtra o agrupa
// en el CRM que ve el dueño, eso son dos valores distintos. Se fija la ortografía exacta.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v31.json')
const OUT = join(ROOT, 'franco-n8n-v32.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const crm = wf.nodes.find((n) => n.name === 'CRM (AI Agent)')
assert(crm, 'no existe "CRM (AI Agent)"')

const antes = crm.parameters.options.systemMessage
assert(typeof antes === 'string' && antes.length > 0, 'el systemMessage del CRM está vacío')
assert(!antes.includes('ACEPTADO una derivación'), '¿ya se aplicó este cambio?')

const VIEJO =
  '- estado: "Nuevo" (recién arranca, solo saludó), "En conversación" (ya hizo consultas, ' +
  'mencionó datos), "Requiere asesor" (quiere coordinar visita, reservar, que lo contacten, ' +
  'avanzar con una operación).'
const n = antes.split(VIEJO).length - 1
assert(n === 1, `el ancla de estado aparece ${n} veces, esperaba 1`)

const NUEVO =
  '- estado: "Nuevo" (recién arranca, solo saludó), "En conversación" (ya hizo consultas, ' +
  'mencionó datos), "Requiere asesor" (quiere coordinar visita, reservar, que lo contacten, ' +
  'avanzar con una operación).\n' +
  '  CUENTA COMO "Requiere asesor" QUE EL CLIENTE HAYA ACEPTADO una derivación que le ofreció Franco. Si ' +
  'en la conversación Franco preguntó algo como "querés que un asesor te contacte / te prepare ' +
  'una cotización / te arme una simulación?" y el cliente contestó que sí — "sí", "dale", ' +
  '"si porfa", "sí por favor", "sí pero antes contame X" —, el estado es "Requiere asesor", ' +
  'AUNQUE el cliente nunca haya escrito la palabra "asesor". Es la forma más común de aceptar ' +
  'y es la que hay que detectar: si lo dejás en "En conversación", Franco no se entera de que ' +
  'ya aceptó y se lo vuelve a preguntar.\n' +
  '  Escribí el valor EXACTO, con tilde: "En conversación", no "En conversacion". Es una ' +
  'columna que el dueño filtra en el CRM, y dos ortografías son dos estados distintos.'

const despues = antes.replace(VIEJO, NUEVO)

// --- post-condiciones
assert(despues !== antes, 'no se aplicó ningún cambio')
assert(despues.includes('ACEPTADO una derivación'), 'no quedó la regla de aceptación')
assert((despues.match(/ACEPTADO una derivación/g) || []).length === 1, 'la regla quedó duplicada')
assert(despues.includes('Escribí el valor EXACTO, con tilde'), 'no quedó la regla de ortografía')
assert(despues.includes('"Requiere asesor" (quiere coordinar visita'), 'se perdió la definición original')

// Lo que el CRM tiene que seguir haciendo, intacto.
for (const campo of ['session_id', 'nombre', 'vehiculo_interes', 'entrega', 'descripcion_usado',
  'presupuesto', 'financia', 'temperatura', 'estado', 'resumen', 'info_nueva']) {
  assert(despues.includes(`- ${campo}:`), `se perdió el campo ${campo} del CRM`)
}
assert(despues.includes('llamá a "Guardar lead" UNA sola vez'), 'se perdió la instrucción de llamar la tool')
assert(despues.includes('REGLA CLAVE: no inventes datos'), 'se perdió la regla de no inventar')

crm.parameters.options.systemMessage = despues

// Nada más cambia: ni Franco, ni las queries, ni Armar respuesta.
const orig = JSON.parse(readFileSync(SRC, 'utf8'))
for (const nn of wf.nodes) {
  if (nn.name === 'CRM (AI Agent)') continue
  const o = orig.nodes.find((k) => k.name === nn.name)
  assert(JSON.stringify(nn.parameters) === JSON.stringify(o.parameters), `se tocó ${nn.name} sin querer`)
}

console.log('✓ todas las aserciones pasan')
console.log(`  prompt del CRM: ${antes.length} -> ${despues.length} chars (+${despues.length - antes.length})`)
console.log('  aceptar una derivación ofrecida por Franco ahora cuenta como "Requiere asesor"')
console.log('  + ortografía fija de "En conversación" (venía con y sin tilde)')
console.log('  ningún otro nodo cambia')

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
