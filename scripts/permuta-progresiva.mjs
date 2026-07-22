#!/usr/bin/env node
// Reescribe el GUION de permuta y el pedido de datos, en vez de agregarles reglas encima
// (2026-07-21). Segundo intento: v25 falló 0/3.
//
//   node scripts/permuta-progresiva.mjs            # escribe franco-n8n-v26.json
//   node scripts/permuta-progresiva.mjs --check    # solo valida
//
// POR QUÉ FALLÓ v25 (medido 0/3, con el control `derivacion-pide-datos-del-usado` cayendo de
// 3/3 a 1/2). Le agregué las reglas nuevas ARRIBA de un guion numerado de 4 pasos que dice
// lo contrario, y **el guion concreto le gana a la prosa abstracta**. La respuesta que falló
// se puede rastrear línea por línea al prompt:
//     "Un usado y 8 millones te dan un buen margen"      <- punto 1, casi textual
//     "No puedo decirte el valor exacto..."               <- punto 2
//     "o preferís que un asesor tase tu usado"            <- "Cierre de este caso", LITERAL
//     "los kilómetros y también tu nombre y apellido"     <- "pedile el NOMBRE Y APELLIDO
//                                                            y los datos del usado"
// Y en la sección de Derivación sobrevivía el formulario COMO EJEMPLO:
//     ("dale, te paso con un asesor. Me dejás tu nombre y apellido, y qué auto entregarías:
//       marca, modelo, año y kilómetros más o menos?")
// con mi "UNA PREGUNTA POR TURNO" tres líneas más abajo.
//
// ES LA TERCERA VEZ QUE EL MISMO MECANISMO MUERDE EN ESTA SESIÓN: el "efectivo" de v16, los
// condicionantes de v18/v20, y esto. En los tres casos el modelo recitó el EJEMPLO más
// cercano al punto de uso e ignoró la regla. Lo único que funcionó siempre fue REEMPLAZAR el
// guion, no prohibirlo desde arriba. Acá se hace eso.
//
// QUÉ CAMBIA EN EL GUION:
//   · Paso 1 pasa a ser "contestá la pregunta". Antes era "reconocé lo positivo", que es
//     literalmente el "un usado siempre es una ventaja" que Agustina marcó.
//   · Paso 2 nuevo: si no sabés qué auto entrega, NO armes la lista. Expectativa honesta y
//     UNA pregunta por el auto. Los pasos de abajo corren recién con ese dato.
//   · "Cierre de este caso" deja de hardcodear la pregunta con "asesor" y pasa a ser la
//     progresión: auto -> km -> nombre.
//   · Se elimina "pedile el NOMBRE Y APELLIDO y los datos del usado (año, versión, km)".
//   · En Derivación, se saca "en ese MISMO pedido" y el ejemplo del formulario de 6 campos.
//
// NO TOCA: la rama "estirar", la condición de v19 sobre "entra", el punto de no estimar el
// valor del usado, ni el refuerzo del parser de v24 (que midió 10/10 y se queda).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v25.json')
const OUT = join(ROOT, 'franco-n8n-v26.json')
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

let m = franco.parameters.options.systemMessage
const antes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(m.includes('OJO CON EL FORMATO AL REDIRIGIR'), 'falta el refuerzo del parser de v24 — ¿partiste de v25?')
assert(m.includes('UNA PREGUNTA POR TURNO'), 'falta la regla de v25 — ¿partiste de v25?')
const EXPR = (m.match(/\{\{/g) || []).length
assert(EXPR === 19, `esperaba 19 expresiones {{ }}, hay ${EXPR}`)

// ══════════════════ (1) el guion de permuta, reescrito

const P1_VIEJO =
  '1. Arrancá reconociendo lo positivo: valorá el usado que entrega ("un Yaris 2021 es un ' +
  'modelo muy buscado") y que su capital le da buen margen. Enmarcá la permuta como una ' +
  'VENTAJA para él, no como una traba.\n'
unaVez(m, P1_VIEJO, 'punto 1 de Permuta')

const P1_NUEVO =
  '1. SI TE HICIERON UNA PREGUNTA, CONTESTALA PRIMERO. "Reciben usados?", "toman permuta?", ' +
  '"me lo reciben como parte de pago?" se contestan corto y derecho: "sí, claro, recibimos ' +
  'usados como parte de pago". Nunca abras con una frase de vendedor genérica ("un usado ' +
  'siempre es una ventaja") antes de haber contestado: te preguntaron algo concreto y quieren ' +
  'esa respuesta, no un folleto.\n' +
  '2. SI TODAVÍA NO SABÉS QUÉ AUTO ENTREGA, FRENÁ ACÁ: no armes ninguna lista. Le das una ' +
  'expectativa honesta ("con eso más tu usado seguramente entren varias opciones, e incluso ' +
  'alguna de más valor si la tasación acompaña") y hacés UNA sola pregunta: qué auto ' +
  'entregaría, marca, modelo y año. Los pasos de abajo recién corren cuando ya sabés qué ' +
  'entrega — mostrarle precios sin saber qué tiene para dar es adivinar.\n' +
  '3. Con el usado ya identificado, valorá lo que entrega ("un Gol Trend 2017 es de los más ' +
  'buscados") y enmarcá la permuta como una VENTAJA para él, no como una traba.\n'

m = m.replace(P1_VIEJO, P1_NUEVO)

// Renumerar los que quedaron: 2->4, 3->5, 4->6.
for (const [viejo, nuevo] of [
  ['2. Explicá por qué no cotizás el usado en vivo', '4. Explicá por qué no cotizás el usado en vivo'],
  ['3. Presentá DOS caminos claros', '5. Presentá DOS caminos claros'],
  ['4. NUNCA estimes vos el valor del usado', '6. NUNCA estimes vos el valor del usado'],
]) {
  unaVez(m, viejo, `renumeración: ${viejo.slice(0, 30)}`)
  m = m.replace(viejo, nuevo)
}

// El cierre hardcodeaba la pregunta con "asesor" — es la frase que Franco recitaba.
const CIERRE_VIEJO =
  'Cierre de este caso: ofrecé dos caminos concretos: "querés que te muestre algo de gama ' +
  'superior para ir viendo, o preferís que un asesor tase tu usado sin compromiso así sabemos ' +
  'tu presupuesto total exacto?".\n' +
  '- Si el cliente acepta cualquiera de los dos (o pide avanzar), pedile el NOMBRE Y APELLIDO ' +
  'y los datos del usado (año, versión, km) para pasarle todo al asesor. No le pidas el ' +
  'teléfono (la charla es por WhatsApp). Una vez que tenés eso, confirmá que un asesor lo ' +
  'contacta y cerrá preguntando si necesita algo más mientras tanto.\n'
unaVez(m, CIERRE_VIEJO, 'cierre de Permuta')

const CIERRE_NUEVO =
  'Cierre de este caso: seguís la progresión, de a UNA pregunta por turno. Si ya sabés qué ' +
  'auto entrega pero no los kilómetros, preguntás los kilómetros y nada más. Si ya tenés el ' +
  'auto y los kilómetros, recién ahí pedís nombre y apellido para que un asesor coordine la ' +
  'tasación. Nunca dos datos en el mismo mensaje. No le pidas el teléfono (la charla es por ' +
  'WhatsApp). Cuando ya tenés todo, confirmás que un asesor lo contacta y cerrás preguntando ' +
  'si necesita algo más mientras tanto.\n'

m = m.replace(CIERRE_VIEJO, CIERRE_NUEVO)

// ══════════════════ (2) el formulario que sobrevivía como ejemplo en Derivación

const DERIV_VIEJO =
  '- SI EL CLIENTE ENTREGA UN USADO, en ese MISMO pedido le pedís también los datos de ese ' +
  'auto: marca, modelo, año y kilómetros. Fijate en "Lo que ya sabés de este cliente": si la ' +
  'entrega figura en "Sí" pero del usado no hay detalles, te faltan y los pedís ("dale, te ' +
  'paso con un asesor. Me dejás tu nombre y apellido, y qué auto entregarías: marca, modelo, ' +
  'año y kilómetros más o menos?"). Sin eso el asesor lo tiene que llamar para preguntarle lo ' +
  'mismo de nuevo, y ese es justo el trabajo que le estás ahorrando.'
unaVez(m, DERIV_VIEJO, 'regla de v21 en Derivación')

const DERIV_NUEVO =
  '- SI EL CLIENTE ENTREGA UN USADO, el asesor necesita saber qué auto es: marca, modelo, año ' +
  'y kilómetros. Fijate en "Lo que ya sabés de este cliente": si la entrega figura en "Sí" ' +
  'pero del usado no hay detalles, te faltan y los vas pidiendo — pero DE A UNO, en el orden ' +
  'de abajo, nunca todos juntos. Sin esos datos el asesor lo tiene que llamar para ' +
  'preguntarle lo mismo de nuevo, y ese es justo el trabajo que le estás ahorrando.'

m = m.replace(DERIV_VIEJO, DERIV_NUEVO)

// ══════════════════ post-condiciones

assert(m !== antes, 'no se aplicó ningún cambio')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR, 'se perdió alguna expresión {{ }}')

// Las frases que Franco recitaba NO pueden seguir en el prompt: son el mecanismo del bug.
for (const [frase, qué] of [
  ['Arrancá reconociendo lo positivo', 'el "un usado siempre es una ventaja" del punto 1'],
  ['o preferís que un asesor tase tu usado sin compromiso', 'la pregunta con "asesor" hardcodeada'],
  ['pedile el NOMBRE Y APELLIDO y los datos del usado', 'el pedido de todo junto'],
  ['en ese MISMO pedido', 'el "todo en el mismo mensaje" de v21'],
  ['Me dejás tu nombre y apellido, y qué auto entregarías', 'el formulario de 6 campos como EJEMPLO'],
]) {
  assert(!m.includes(frase), `sobrevivió ${qué}: "${frase}"`)
}

// La secuencia numerada quedó coherente 1..6, sin saltos ni repetidos.
for (const n of [1, 2, 3, 4, 5, 6]) {
  const c = (m.match(new RegExp(`^${n}\\. `, 'gm')) || []).length
  assert(c === 1, `el punto ${n} del guion aparece ${c} veces, esperaba 1`)
}

// Lo que NO se toca.
assert(m.includes('(categoria "estirar")'), 'se perdió la rama estirar')
assert(m.includes('Esta frase vale SOLO si declaró presupuesto'), 'se perdió la condición de v19 sobre "entra"')
assert(m.includes('6. NUNCA estimes vos el valor del usado'), 'se perdió el punto de no estimar el valor')
assert(m.includes('Si todavía no dio los datos del usado y no aceptó derivar'), 'se perdió el "no lo fuerces"')

for (const [marca, versión] of [
  ['TRATO:', 'v15'],
  ['SIN PRESUPUESTO DECLARADO', 'v16'],
  ['ARRANCA por el porqué', 'v18'],
  ['(se pasa del presupuesto', 'v19'],
  ['SUENE A CONSEJO ÚTIL', 'v20/v23'],
  ['nunca "está blanco"', 'v22'],
  ['LA DERIVACIÓN MANDA', 'v23'],
  ['OJO CON EL FORMATO AL REDIRIGIR', 'v24'],
  ['UNA PREGUNTA POR TURNO', 'v25'],
  ['CONTESTALA PRIMERO', 'v26'],
]) {
  const c = (m.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  assert(c === 1, `problema con la regla de ${versión}: "${marca}" aparece ${c} veces`)
}

franco.parameters.options.systemMessage = m

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${m.length} chars (${m.length - antes.length >= 0 ? '+' : ''}${m.length - antes.length})`)
console.log('  el GUION de permuta reescrito: contestar -> preguntar el auto -> recién ahí la lista')
console.log('  eliminadas las 5 frases que Franco recitaba, incluido el formulario de 6 campos')
console.log('  intactos: estirar, la condición de "entra" (v19), y el parser (v24, midió 10/10)')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
