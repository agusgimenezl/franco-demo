#!/usr/bin/env node
// Refuerza el nombre de la clave `messages` en la sección `# Alcance`, que es donde el
// parser falla (2026-07-21).
//
//   node scripts/alcance-clave-messages.mjs            # escribe franco-n8n-v24.json
//   node scripts/alcance-clave-messages.mjs --check    # solo valida
//
// EL BUG, con causa raíz ya confirmada por log de n8n (documentado en STATE desde
// 2026-07-20): en pedidos fuera de rubro el modelo a veces nombra la clave del array
// `"output"` en vez de `"messages"`. El RESTO de la respuesta está bien —el chiste de
// redirección es correcto— pero el `Structured Output Parser` rechaza el objeto entero,
// `Franco (AI Agent)` devuelve `{error: "..."}` y `Armar respuesta` cae al fallback
// ("Uy, se me trabó el sistema un segundo"). Reproducido en cuatro corridas con
// `--repeat 8/10`: ~40-44%.
//
// POR QUÉ NO SE PUEDE ARREGLAR CON CÓDIGO AGUAS ABAJO. El texto bueno se pierde EN el
// parser: para cuando `Armar respuesta` recibe algo, el nodo del agente ya devolvió
// `{error}` y la respuesta correcta no existe en ninguna parte. No hay nada que recuperar.
// Tiene que resolverse antes: o el modelo escribe bien la clave, o el parser la acepta.
//
// POR QUÉ EN "ALCANCE" Y NO EN "FORMATO DE SALIDA". El nombre de la clave ya está declarado
// en `# Formato de salida`, y aun así falla — pero SÓLO en este escenario. La hipótesis es
// que el `jsonSchemaExample` del parser muestra una respuesta CON autos
// (`auto_ids: [1,5,9]`), así que al redirigir un pedido fuera de rubro —sin autos, sin
// lista, una sola burbuja— el ejemplo ancla poco y el modelo improvisa la forma. Por eso el
// refuerzo va en el punto de uso, pegado a la instrucción de redirigir, y no repetido en la
// sección general.
//
// LO QUE YA SE PROBÓ Y EMPEORÓ (no repetir): activar "Auto-Fix Format" en el parser llevó
// la falla de ~40% a 100% (10/10). Está en la lista de trampas.
//
// EXPECTATIVA HONESTA: es un refuerzo de prompt contra un fallo intermitente del modelo. Con
// una tasa base de ~40% hacen falta `--repeat 10` antes y después para distinguir una mejora
// real de la suerte, y aun así 10 muestras dan un intervalo ancho. Si el después no baja
// claramente, se revierte y se deja como deuda: no vale meter más prompt a ciegas.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v23.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v24.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe "Franco (AI Agent)"')

const antes = franco.parameters.options.systemMessage
assert(antes.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(antes.includes('LA DERIVACIÓN MANDA'), 'falta la regla de v23 — ¿partiste de v23?')
const EXPR = (antes.match(/\{\{/g) || []).length
assert(EXPR === 19, `esperaba 19 expresiones {{ }}, hay ${EXPR}`)

// El parser tiene que seguir esperando exactamente estas dos claves: si alguien cambia el
// schema, este refuerzo pasa a mentir.
const parser = wf.nodes.find((n) => n.name === 'Structured Output Parser')
assert(parser, 'no existe el "Structured Output Parser"')
const ejemplo = parser.parameters?.jsonSchemaExample ?? ''
assert(ejemplo.includes('"messages"'), 'el schema del parser ya no declara `messages`')
assert(ejemplo.includes('"auto_ids"'), 'el schema del parser ya no declara `auto_ids`')

const ANCLA =
  'Si insisten, cortás más seco pero sin perder la compostura ni insultar, aunque el cliente insulte.'
const n = antes.split(ANCLA).length - 1
assert(n === 1, `el ancla de Alcance aparece ${n} veces, esperaba 1`)

const REGLA =
  '\nOJO CON EL FORMATO AL REDIRIGIR: que no estés mostrando autos no cambia NADA de la ' +
  'estructura. La redirección va en el mismo objeto de siempre — el texto adentro de ' +
  '`messages` (una sola burbuja alcanza) y `auto_ids: []` vacío. La clave del array se llama ' +
  '`messages`, SIEMPRE: nunca `output`, nunca `respuesta`, nunca `text`. Es el error más ' +
  'común justo en este caso, porque no hay lista de autos que te guíe.'

const despues = antes.replace(ANCLA, ANCLA + REGLA)

// --- post-condiciones
assert(despues !== antes, 'no se aplicó ningún cambio')
assert(despues.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert(despues.length === antes.length + REGLA.length, 'cambió más texto del esperado')
assert((despues.match(/\{\{/g) || []).length === EXPR, 'se perdió alguna expresión {{ }}')
assert((despues.match(/OJO CON EL FORMATO AL REDIRIGIR/g) || []).length === 1, 'la regla quedó duplicada')
// El parser NO se toca: "Auto-Fix Format" ya se probó y llevó la falla de 40% a 100%.
assert(
  JSON.stringify(parser.parameters) === JSON.stringify(JSON.parse(readFileSync(SRC, 'utf8')).nodes.find((k) => k.name === 'Structured Output Parser').parameters),
  'no se debe tocar el Structured Output Parser (Auto-Fix Format ya empeoró a 100%)',
)

for (const [marca, versión] of [
  ['TRATO:', 'v15'],
  ['SIN PRESUPUESTO DECLARADO', 'v16'],
  ['ARRANCA por el porqué', 'v18'],
  ['(se pasa del presupuesto', 'v19'],
  ['SUENE A CONSEJO ÚTIL', 'v20/v23'],
  ['SI EL CLIENTE ENTREGA UN USADO', 'v21'],
  ['nunca "está blanco"', 'v22'],
  ['LA DERIVACIÓN MANDA', 'v23'],
]) {
  const c = (despues.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  assert(c === 1, `se tocó la regla de ${versión}: "${marca}" aparece ${c} veces`)
}

franco.parameters.options.systemMessage = despues

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${despues.length} chars (+${REGLA.length})`)
console.log('  refuerzo de la clave `messages` en el punto de uso (# Alcance)')
console.log('  el Structured Output Parser NO se toca')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
