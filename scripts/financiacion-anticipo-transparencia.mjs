#!/usr/bin/env node
// v47: flujo de financiación (2 capturas). Dos bugs: (1) Franco avanzaba sin el MONTO del anticipo
// (preguntaba compuesto y el cliente skipeaba el monto); (2) contradicción de la simulación ("querés que
// te prepare una simulación" suena a que la hace Franco). Base: franco-n8n-v46.json. (2026-07-23)
//
//   node scripts/financiacion-anticipo-transparencia.mjs [--check]
//
// EL BUG (medido, eval financiacion-pide-anticipo 0/2 en v45): cliente interesado en el Etios pregunta
//   cómo financiarlo. Franco pregunta compuesto ("cuánto de anticipo O un usado" + "cuántas cuotas"); el
//   cliente contesta solo las cuotas, después "con anticipo" SIN el monto, y Franco avanza a pedir el
//   nombre "con el anticipo que tenés" (que nunca dio). Además ofrecía "prepararte una simulación" como
//   si la hiciera él.
//
// EL FIX (trampa 6: se REEMPLAZA el guion, no se agrega prohibición) — sección # Financiación:
//   (R1) transparencia: la simulación SIEMPRE la arma el asesor; Franco nunca ofrece prepararla él.
//   (R2) pre-perfil de a UNA pregunta, ANTICIPO primero (dato clave); sin el monto NO avanza (ni confirma,
//        ni pide nombre, ni deriva), salvo que el cliente pida EXPLÍCITAMENTE un asesor. + regla de DATO
//        INCOMPLETO: si contesta solo una parte, re-pedir el faltante antes de seguir; si en la segunda no
//        lo sabe/quiere, no insistir.
//   (R3) ejemplo de ASESOR EN MARCHA: sacar el ambiguo "que te prepare la simulación" → "le dejo anotado
//        que te arme la simulación... de cuánto el anticipo?".
// NO toca Listar stock, Valuar usado ni los otros flujos. ⚠️ PEGA A MANO Agustina + verificación byte a byte.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v46.json')
const OUT = join(ROOT, 'franco-n8n-v47.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => { const x = wf.nodes.find((k) => k.name === n); assert(x, `no existe "${n}"`); return x }

const franco = nodo('Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
const EXPR_ANTES = (m.match(/\{\{/g) || []).length

// (R1) transparencia de la simulación
const OLD_R1 = 'NUNCA des un monto exacto en pesos de una cuota ni de los gastos: depende de la valuación y lo arma el asesor en la simulación. Decir "el asesor te arma el cálculo exacto" se lee bien, no evasivo.'
const NEW_R1 = 'NUNCA des un monto exacto en pesos de una cuota ni de los gastos: depende de la valuación y LA SIMULACIÓN LA ARMA EL ASESOR, no vos. Nunca ofrezcas "prepararte una simulación" ni "armarte una cotización" como si la hicieras vos: vos pre-perfilás (tomás el anticipo y las cuotas) y el asesor arma los números. La frase es siempre "para que un asesor te arme la simulación exacta con los montos finales, ..."; decir "el asesor te arma el cálculo exacto" se lee bien, no evasivo.'
unaVez(m, OLD_R1, 'prompt (R1 transparencia)')
m = m.replace(OLD_R1, NEW_R1)

// (R2) pre-perfil de a una pregunta, anticipo primero, + dato incompleto
const OLD_R2 = 'Después de contestar, adelantale trabajo al asesor pre-perfilando: preguntá cuánto pensás poner de anticipo (un monto, o un usado a entregar) y en cuántas cuotas te gustaría financiar (por ejemplo 12, 24, 36 o 48). Cuando te lo diga, confirmás que se lo dejás anotado al asesor para la simulación.'
const NEW_R2 = 'Después de contestar, pre-perfilás para el asesor de a UNA pregunta por mensaje, y arrancás por el ANTICIPO, que es el dato clave: "para que un asesor te arme la simulación exacta, de cuánto pensás poner de anticipo, más o menos?" (un monto en pesos, o un usado que entregás). SIN el monto del anticipo no se puede estimar nada: NO avances —ni confirmes que el auto te entra, ni pidas el nombre, ni derives— mientras no lo tengas, aunque el cliente te pida la simulación o el valor de la cuota (esos los arma el asesor con el anticipo). La única excepción es que el cliente pida EXPLÍCITAMENTE un asesor: ahí manda la derivación (ver # Derivación). Recién con el anticipo preguntás las cuotas (12, 24, 36 o 48) si no las dio, y confirmás que se lo dejás anotado al asesor para la simulación.\nDATO INCOMPLETO: si el cliente contesta solo una parte (te da las cuotas pero no el anticipo, o dice "con anticipo" sin el monto), volvé a pedir el que falta ANTES de seguir, sin avanzar: "dale, y de cuánto sería el anticipo, más o menos?". Si en la segunda no lo sabe o no lo quiere decir, no insistas: seguís y le dejás anotado al asesor que el monto queda pendiente.'
unaVez(m, OLD_R2, 'prompt (R2 anticipo primero)')
m = m.replace(OLD_R2, NEW_R2)

// (R3) ejemplo ASESOR EN MARCHA sin el ambiguo "te prepare la simulación"
const OLD_R3 = 'Enmarcá que ya se va a contactar: "como el asesor ya se va a contactar, querés que le deje anotado que te prepare la simulación de esta Hilux?" en vez de "querés que te conecte con un asesor?".'
const NEW_R3 = 'Enmarcá que ya se va a contactar: "como el asesor ya se va a contactar, le dejo anotado que te arme la simulación de este auto; de cuánto pensás poner de anticipo?" en vez de "querés que te conecte con un asesor?".'
unaVez(m, OLD_R3, 'prompt (R3 asesor en marcha)')
m = m.replace(OLD_R3, NEW_R3)

franco.parameters.options.systemMessage = m

// ── post-condiciones
assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES, 'cambió el número de expresiones {{ }} del prompt (no debía)')
assert(m.includes('arrancás por el ANTICIPO'), 'no quedó el anticipo-primero')
assert(m.includes('DATO INCOMPLETO:'), 'no quedó la regla de dato incompleto')
assert(m.includes('LA SIMULACIÓN LA ARMA EL ASESOR, no vos'), 'no quedó la transparencia')
assert(!m.includes('preguntá cuánto pensás poner de anticipo (un monto, o un usado a entregar) y en cuántas cuotas'), 'quedó la pregunta compuesta vieja')
assert(!m.includes('que te prepare la simulación de esta Hilux'), 'quedó el ejemplo ambiguo viejo')
// una pregunta por mensaje: la regla base sigue
assert(m.includes('Una sola pregunta por mensaje.'), 'se perdió la regla de una pregunta por mensaje')
// fixes previos sobreviven
assert(nodo('Valuar usado').parameters.query.includes('EXTRACT(YEAR FROM CURRENT_DATE)'), 'se perdió el km_factor de v46')
assert(nodo('Valuar usado').parameters.query.includes('usado_km'), 'se perdió usado_km de v46')
const ls = nodo('Listar stock').parameters.query
assert(ls.includes("u.tramo = 'fuera'") && ls.includes('WHERE NOT ('), 'se perdió el filtro de fuera (v45)')
assert(m.includes('NUNCA lo ofrecés vos'), 'se perdió el fix del WhatsApp (v45)')
assert(m.includes('interesado en UN AUTO PUNTUAL'), 'se perdió el scope del abanico (v45)')
assert(m.includes('ahora SÍ cambia la valuación del usado'), 'se perdió la razón del gate (v46)')

// trampa 3 (no se agregaron $fromAI)
const porKey = new Map()
for (const nn of wf.nodes) {
  for (const mm of String(nn.parameters?.query ?? '').matchAll(/\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g)) {
    const [, key, desc, tipo] = mm
    const firma = `${desc}||${tipo}`
    if (porKey.has(key)) assert(porKey.get(key) === firma, `trampa 3: la key '${key}' tiene firmas distintas`)
    else porKey.set(key, firma)
  }
}

console.log('✓ todas las aserciones pasan')
console.log('  (R1) transparencia: la simulación la arma el asesor, Franco no la ofrece él')
console.log('  (R2) anticipo PRIMERO, una pregunta por mensaje, sin avanzar sin el monto + dato incompleto')
console.log('  (R3) ejemplo asesor-en-marcha sin el "te prepare" ambiguo')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars · trampa 3: ${porKey.size} keys $fromAI`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
