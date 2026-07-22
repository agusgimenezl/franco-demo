#!/usr/bin/env node
// Franco responde primero, avanza de a una pregunta y no deriva antes de tiempo
// (2026-07-21). Se apila sobre v24 (refuerzo del parser) para pegar una sola vez.
//
//   node scripts/una-pregunta-por-vez.mjs            # escribe franco-n8n-v25.json
//   node scripts/una-pregunta-por-vez.mjs --check    # solo valida
//
// LA CAPTURA. A "Mira tengo 8 millones y un usado, reciben?" Franco contestó:
//     "Un usado para entregar siempre es una ventaja, y 8 millones te da un buen margen..."
//     "...me dejás tu nombre y apellido, y qué auto entregás: marca, modelo, año y
//      kilómetros aproximados? Así un asesor te contacta..."
// Tres problemas, marcados por Agustina:
//   1. NO CONTESTA LO QUE LE PREGUNTARON. Abre con una frase genérica de vendedor. Un humano
//      arranca por "sí, claro, recibimos usados como parte de pago" y recién después amplía.
//   2. SEIS CAMPOS DE UNA. Nombre + apellido + marca + modelo + año + km en un solo mensaje
//      se lee como formulario, y en WhatsApp ahí es donde el cliente abandona.
//   3. DERIVA ANTES DE TIEMPO. El cliente todavía está hablando con Franco y espera que lo
//      ayude ÉL; mandarlo al asesor en el primer turno le dice "no puedo aportarte nada más".
//
// ESTO CORRIGE UNA DECISIÓN MÍA, NO LA COMPLEMENTA. En v21 escribí "Todo junto en UNA sola
// pregunta, en tono de charla. No encadenes un pedido atrás de otro", justificándolo como
// que reducía fricción. Era al revés: juntar los seis campos ES la fricción. Esa regla se
// REEMPLAZA — dejar las dos conviviendo es exactamente cómo nacen las contradicciones que
// después cuestan semanas de encontrar.
//
// LA PROGRESIÓN QUEDA: auto (marca/modelo/año) -> km -> nombre y apellido. Una por turno.
// El nombre va ÚLTIMO porque es el pedido que más cuesta: primero se construye valor.
//
// NO TOCA v23 ("LA DERIVACIÓN MANDA"): esa regla aplica cuando el cliente YA pidió un asesor.
// Acá el problema es el opuesto — Franco lo ofrece cuando nadie se lo pidió.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v24.json')
const OUT = join(ROOT, 'franco-n8n-v25.json')
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
assert(m.includes('OJO CON EL FORMATO AL REDIRIGIR'), 'falta el refuerzo del parser de v24 — ¿partiste de v24?')
const EXPR = (m.match(/\{\{/g) || []).length
assert(EXPR === 19, `esperaba 19 expresiones {{ }}, hay ${EXPR}`)

// ══════════════ (1) reemplazar la regla equivocada de v21

const V21 =
  '- Todo junto en UNA sola pregunta, en tono de charla. No encadenes un pedido atrás de ' +
  'otro ni lo listes como formulario: ahí es donde el cliente se cansa y abandona.'
unaVez(m, V21, 'regla de v21 (todo junto)')

const NUEVO =
  '- UNA PREGUNTA POR TURNO, siempre. Nunca le pidas dos datos juntos, y muchísimo menos ' +
  'seis: "nombre, apellido, marca, modelo, año y kilómetros" es un formulario, y en WhatsApp ' +
  'el cliente abandona ahí. El orden es: primero QUÉ AUTO entrega (marca, modelo y año), ' +
  'después los KILÓMETROS, y recién al final NOMBRE Y APELLIDO. El nombre va último a ' +
  'propósito: es el dato que más cuesta dar, así que primero le construís valor.'

m = m.replace(V21, NUEVO)

// ══════════════ (2) responder primero, derivar después

const PERMUTA_ANCLA = '## Permuta (cliente con efectivo + un usado para entregar)\n'
unaVez(m, PERMUTA_ANCLA, 'encabezado de Permuta')

const RESPONDER =
  PERMUTA_ANCLA +
  'ANTES QUE NADA, SI TE HICIERON UNA PREGUNTA, CONTESTALA. Si te preguntan "reciben ' +
  'usados?", "toman permuta?", "me lo reciben como parte de pago?", lo primero que sale es ' +
  'la respuesta, corta y directa: "sí, claro, recibimos usados como parte de pago". Recién ' +
  'después ampliás. Abrir con una frase de vendedor genérica ("un usado siempre es una ' +
  'ventaja") sin haber contestado suena a folleto y deja al cliente sin lo que pidió.\n' +
  'NO DERIVES TODAVÍA. Mientras el cliente te está preguntando cosas, el que ayuda sos VOS. ' +
  'Ofrecer el asesor en el primer turno le dice que ya no le podés aportar nada, y es ' +
  'mentira: podés orientarlo sobre qué opciones le entrarían. El asesor aparece cuando el ' +
  'cliente lo pide, o cuando ya hiciste tu parte y lo único que falta es tasar el usado.\n'

m = m.replace(PERMUTA_ANCLA, RESPONDER)

// ══════════════ post-condiciones

assert(m !== antes, 'no se aplicó ningún cambio')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR, 'se perdió alguna expresión {{ }}')
assert((m.match(/UNA PREGUNTA POR TURNO/g) || []).length === 1, 'la regla de progresión quedó duplicada')
assert((m.match(/CONTESTALA/g) || []).length === 1, 'la regla de responder primero quedó duplicada')
assert((m.match(/NO DERIVES TODAVÍA/g) || []).length === 1, 'la regla de no derivar quedó duplicada')

// La regla vieja NO puede sobrevivir: es la que decía lo contrario.
assert(!m.includes(V21), 'quedó la regla de v21 ("todo junto") conviviendo con la nueva, que la contradice')
assert(!m.includes('Todo junto en UNA sola pregunta'), 'sobrevivió el texto de v21')

// Lo que sigue vigente de cada versión.
for (const [marca, versión] of [
  ['TRATO:', 'v15'],
  ['SIN PRESUPUESTO DECLARADO', 'v16'],
  ['ARRANCA por el porqué', 'v18'],
  ['(se pasa del presupuesto', 'v19'],
  ['SUENE A CONSEJO ÚTIL', 'v20/v23'],
  ['SI EL CLIENTE ENTREGA UN USADO', 'v21'],
  ['nunca "está blanco"', 'v22'],
  ['LA DERIVACIÓN MANDA', 'v23'],
  ['OJO CON EL FORMATO AL REDIRIGIR', 'v24'],
]) {
  const c = (m.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  assert(c === 1, `se tocó la regla de ${versión}: "${marca}" aparece ${c} veces`)
}
// Los 4 puntos de la narrativa de permuta y la rama estirar siguen enteros.
assert(m.includes('4. NUNCA estimes vos el valor del usado'), 'se perdió el punto 4 de Permuta')
assert(m.includes('(categoria "estirar")'), 'se perdió la rama estirar')

franco.parameters.options.systemMessage = m

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${m.length} chars (+${m.length - antes.length})`)
console.log('  (1) la regla de v21 "todo junto" quedó REEMPLAZADA por la progresión auto -> km -> nombre')
console.log('  (2) contestar primero la pregunta, y no ofrecer el asesor antes de tiempo')
console.log('  incluye el refuerzo del parser de v24')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
