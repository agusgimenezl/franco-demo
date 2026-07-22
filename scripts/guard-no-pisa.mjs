#!/usr/bin/env node
// (A) El guard de cierre deja de pisar una pregunta que Franco ya hizo, y (B) Franco no
// arma la lista antes de saber qué usado entrega (2026-07-21).
//
//   node scripts/guard-no-pisa.mjs            # escribe franco-n8n-v27.json
//   node scripts/guard-no-pisa.mjs --check    # solo valida
//
// ─────────────────────────────────────────────────────────────────────────────
// (A) EL GUARD PISA PREGUNTAS — y era la causa real del "asesor" prematuro
//
// Medido en v26: de 3 corridas, la 3 dio EXACTAMENTE la respuesta que pidió Agustina
// ("Sí, claro, recibimos usados... Para avanzar, necesito que me digas qué auto entregás").
// Las corridas 1 y 2 fueron iguales pero terminaron con "Querés que un asesor te prepare una
// cotización...". **Esa frase no la escribe Franco: la inyecta este nodo.**
//
// El guard corre con `autos.length >= 1 && !texto.endsWith('?')`, donde `texto` es SÓLO la
// última burbuja. En las corridas 1 y 2 Franco ya había preguntado "contame qué auto
// entregás, marca, modelo y año" — pero esa pregunta quedó a mitad de la burbuja, no al
// final, así que el guard la ignoró y le pegó otra encima. Con 1-2 autos la variante que
// inyecta es justamente la que ofrece el asesor.
//
// Es la deuda que STATE ya describe como "el guard gana piso y pierde techo": garantiza que
// haya una pregunta, pero a veces reemplaza una mejor de Franco por la genérica. Acá el
// techo que perdía era el fix entero.
//
// FIX: el guard mira si hay una pregunta en CUALQUIER burbuja del turno, no sólo al final de
// la última. Sigue garantizando el piso (una lista nunca queda sin próximo paso) y deja de
// pisar cuando Franco ya cumplió.
//
// ─────────────────────────────────────────────────────────────────────────────
// (B) FRANCO ARMA LA LISTA SIN SABER QUÉ ENTREGA (2 de 3)
//
// La regla de v26 dice "no armes ninguna lista", y se cumple 1/3. El problema es que igual
// llama a la herramienta de stock: con los autos ya en contexto, listarlos es lo natural.
// FIX: prohibir la LLAMADA, no el listado. Sin autos en contexto no hay nada que listar, y
// de paso `auto_ids` queda vacío — con lo cual el guard tampoco se dispara (necesita
// `autos.length >= 1`). Los dos cambios se refuerzan.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v26.json')
const OUT = join(ROOT, 'franco-n8n-v27.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))

// ══════════════════ (A) el guard, en Armar respuesta

const armar = wf.nodes.find((n) => n.name === 'Armar respuesta')
assert(armar, 'no existe "Armar respuesta"')
let js = armar.parameters.jsCode
const jsAntes = js

const GUARD_VIEJO =
  `  let msgs = messages;\n` +
  `  const ultima = msgs[msgs.length - 1];\n` +
  `  const texto = (ultima && ultima.content) ? String(ultima.content).trim() : '';\n`
unaVez(js, GUARD_VIEJO, 'preámbulo del guard')

const GUARD_NUEVO =
  `  let msgs = messages;\n` +
  `  // Antes se miraba SOLO si la última burbuja terminaba en "?", así que una pregunta de\n` +
  `  // Franco a mitad de párrafo ("contame qué auto entregás, marca, modelo y año") no\n` +
  `  // contaba y el guard le pegaba otra encima — con 1-2 autos, la que ofrece un asesor.\n` +
  `  // Ahora alcanza con que haya una pregunta en CUALQUIER burbuja del turno: el piso sigue\n` +
  `  // garantizado (una lista nunca queda sin próximo paso) y deja de pisar el techo.\n` +
  `  const hayPregunta = msgs.some(m => String((m && m.content) || '').includes('?'));\n`
js = js.replace(GUARD_VIEJO, GUARD_NUEVO)

const COND_VIEJA = `if (autos.length >= 1 && !texto.endsWith('?')) {`
unaVez(js, COND_VIEJA, 'condición del guard')
js = js.replace(COND_VIEJA, `if (autos.length >= 1 && !hayPregunta) {`)

assert(!js.includes('texto.endsWith'), 'quedó la condición vieja del guard')
assert(!/const texto = /.test(js), 'quedó la variable `texto` sin uso')
assert(js.includes('const hayPregunta'), 'no quedó hayPregunta')
assert((js.match(/hayPregunta/g) || []).length === 2, 'hayPregunta debe declararse y usarse una vez cada una')
// Lo que el guard tiene que seguir haciendo.
assert(js.includes("product_cards.length >= 3"), 'se perdió la variante de cierre según cantidad de cards')
assert(js.includes("replace(/[¿¡]/g, '')"), 'se perdió el strip de signos de apertura')
assert(js.includes('yaMostrados'), 'se perdió el filtro de fotos ya mostradas')
assert(js.length > jsAntes.length - 50, 'se borró más código del esperado')

armar.parameters.jsCode = js

// ══════════════════ (B) no llamar a la tool sin saber el usado

const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe "Franco (AI Agent)"')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
const EXPR = (m.match(/\{\{/g) || []).length
assert(EXPR === 19, `esperaba 19 expresiones {{ }}, hay ${EXPR}`)

const P2_VIEJO =
  '2. SI TODAVÍA NO SABÉS QUÉ AUTO ENTREGA, FRENÁ ACÁ: no armes ninguna lista. Le das una ' +
  'expectativa honesta ("con eso más tu usado seguramente entren varias opciones, e incluso ' +
  'alguna de más valor si la tasación acompaña") y hacés UNA sola pregunta: qué auto ' +
  'entregaría, marca, modelo y año. Los pasos de abajo recién corren cuando ya sabés qué ' +
  'entrega — mostrarle precios sin saber qué tiene para dar es adivinar.\n'
unaVez(m, P2_VIEJO, 'punto 2 de Permuta (v26)')

const P2_NUEVO =
  '2. SI TODAVÍA NO SABÉS QUÉ AUTO ENTREGA, FRENÁ ACÁ. **No llames a ninguna herramienta de ' +
  'stock en ese turno** y no armes ninguna lista: sin saber qué entrega no podés calcular qué ' +
  'le alcanza, así que cualquier precio que muestres es adivinar. Ese turno va con ' +
  '`auto_ids` VACÍO. Lo único que hacés es: contestar, dar una expectativa honesta ("con eso ' +
  'más tu usado seguramente entren varias opciones, e incluso alguna de más valor si la ' +
  'tasación acompaña") y UNA sola pregunta: qué auto entregaría, marca, modelo y año. Los ' +
  'pasos de abajo recién corren cuando ya sabés qué entrega.\n'

m = m.replace(P2_VIEJO, P2_NUEVO)

// ══════════════════ post-condiciones del prompt

assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial')
assert((m.match(/\{\{/g) || []).length === EXPR, 'se perdió alguna expresión {{ }}')
assert((m.match(/No llames a ninguna herramienta de stock/g) || []).length === 1, 'la regla quedó duplicada')
assert(m.includes('`auto_ids` VACÍO'), 'no quedó la instrucción de auto_ids vacío')

for (const n of [1, 2, 3, 4, 5, 6]) {
  const c = (m.match(new RegExp(`^${n}\\. `, 'gm')) || []).length
  assert(c === 1, `el punto ${n} del guion aparece ${c} veces, esperaba 1`)
}
for (const [marca, versión] of [
  ['TRATO:', 'v15'],
  ['SIN PRESUPUESTO DECLARADO', 'v16'],
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
console.log(`  Armar respuesta: el guard mira todo el turno, no sólo la última burbuja`)
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars (+${m.length - mAntes.length})`)
console.log('  sin saber el usado: no llama la tool, auto_ids vacío -> el guard tampoco dispara')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
