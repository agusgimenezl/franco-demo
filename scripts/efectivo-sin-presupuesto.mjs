#!/usr/bin/env node
// Franco deja de afirmar que el cliente "tiene efectivo" cuando nunca lo dijo
// (pendiente #1, rama abierta — 2026-07-21).
//
//   node scripts/efectivo-sin-presupuesto.mjs            # escribe franco-n8n-v16.json
//   node scripts/efectivo-sin-presupuesto.mjs --check    # solo valida
//
// BUG MEDIDO: 2 de 17 corridas (~12%) de `no-inventar-datos-del-cliente`. Cliente que
// entrega un usado y NUNCA menciona plata (lead: presupuesto="No mencionado",
// financia="No mencionado") recibe "opciones que con tu efectivo podrías cubrir".
//
// NO ES ALUCINACIÓN LIBRE: EL PROMPT LE DICTA LA FRASE. La sección "## Permuta" está
// escrita entera asumiendo que el efectivo existe y trae el guion literal
//     "con tu presupuesto, tu efectivo cubre el total de estas, y el valor de tu usado
//      te queda a favor"
// y se dispara con la permuta sola. Evidencia decisiva (sesión fd1a03aa): Franco contestó
//     "Con tu presupuesto solo te doy la lista completa PORQUE NO ME DISTE UN TECHO, pero
//      acá te paso opciones que podrías cubrir EN EFECTIVO, y TU USADO QUEDA A FAVOR"
// — reconoce que no hay presupuesto y aun así recita la plantilla. Está copiando, no
// infiriendo. Por eso las DOS prohibiciones explícitas que ya existen ("si no dice que paga
// en efectivo, no asumas que tiene efectivo") no alcanzan: no se puede prohibir contra un
// ejemplo literal que está más cerca del punto de uso.
//
// POR ESO EL FIX NO AGREGA UNA TERCERA PROHIBICIÓN. Le da una narrativa correcta PARA
// RECITAR en el caso sin presupuesto, adosada al mismo lugar donde hoy recita la incorrecta.
// Es el patrón que ya funcionó con el guard de cierre: un gate en el punto de uso le ganó
// al whack-a-mole de reglas.
//
// TAMBIÉN SE LE AVISA QUE LA ETIQUETA MIENTE. Raíz determinística, verificada en el SQL de
// "Listar stock": el CASE arranca con `WHEN precio_objetivo = 0 THEN 'entra'`, así que sin
// presupuesto declarado los 17 autos salen 'entra' — y el prompt traduce 'entra' a "tu
// efectivo cubre el total". La tool le afirma "entran en su presupuesto" a un cliente que no
// tiene presupuesto. Arreglar el CASE es el fix de fondo, pero está calibrado y se conservó
// byte a byte en v14: tocarlo obliga a re-medir presupuesto-*, permuta y km-con-presupuesto.
// Decisión de Agustina (2026-07-21): por ahora sólo prompt, y la raíz queda documentada.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v15.json')
const OUT = join(ROOT, 'franco-n8n-v16.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`✗ ASERCIÓN FALLIDA: ${msg}`)
    process.exit(1)
  }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe "Franco (AI Agent)"')

const antes = franco.parameters.options.systemMessage
assert(antes.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(antes.includes('TRATO:'), 'falta la regla de TRATO — hay que partir de v15')
assert(!antes.includes('SIN PRESUPUESTO DECLARADO'), '¿ya se aplicó este cambio?')

const EXPRESIONES = (antes.match(/\{\{/g) || []).length
assert(EXPRESIONES === 19, `esperaba 19 expresiones {{ }}, hay ${EXPRESIONES}`)

// --- 1. El gate, arriba de todo en la sección, antes de los 4 puntos.
const INTRO =
  '## Permuta (cliente con efectivo + un usado para entregar)\n' +
  'Cuando el cliente tiene un presupuesto en efectivo Y entrega un usado, tenés que ' +
  'responder como un vendedor experto, con esta narrativa (no como una lista seca de precios):\n'

assert(antes.split(INTRO).length - 1 === 1, 'el encabezado de "## Permuta" no aparece exactamente 1 vez')

const GATE =
  'ANTES de usar esta narrativa fijate si el cliente declaró CON CUÁNTA PLATA CUENTA (mirá ' +
  '"Lo que ya sabés de este cliente"). Entregar un usado NO es declarar un presupuesto.\n' +
  '· SIN PRESUPUESTO DECLARADO: no uses los 4 puntos de abajo y no digas "efectivo" ni ' +
  '"tu efectivo cubre" ni "podrías cubrir" — no sabés si tiene un peso. Lo que hacés es: ' +
  'valorás el usado, aclarás que la tasación la hace un asesor, mostrás stock SIN afirmar ' +
  'que lo cubre, y le preguntás el presupuesto: "con tu usado como parte de pago, contame ' +
  'con cuánto más contás y te acerco las que mejor te cierren". Recién cuando te lo diga ' +
  'pasás a la narrativa de dos caminos.\n' +
  '· OJO CON LA ETIQUETA: cuando el cliente no declaró presupuesto, la herramienta devuelve ' +
  'TODO el stock etiquetado "entra". Ahí "entra" NO significa que lo cubra: significa que no ' +
  'hay techo con qué compararlo. No lo leas como que le alcanza.\n' +
  '· CON PRESUPUESTO DECLARADO: seguí con los 4 puntos.\n'

let despues = antes.replace(INTRO, INTRO + GATE)

// --- 2. La línea que hoy recita, marcada en su propio punto de uso.
const LINEA_VIEJA =
  '   · Opciones que cubre su efectivo (categoria "entra"): "con tu presupuesto, tu efectivo ' +
  'cubre el total de estas, y el valor de tu usado te queda a favor" — enmarcá que el usado ' +
  'es un extra a su favor, no algo que necesita para llegar.'

assert(despues.split(LINEA_VIEJA).length - 1 === 1, 'la línea del guion de "entra" no aparece exactamente 1 vez')

const LINEA_NUEVA =
  LINEA_VIEJA.slice(0, -1) +
  '. Esta frase vale SOLO si declaró presupuesto: si no lo declaró, no existe "su efectivo" ' +
  'y la frase queda prohibida.'

despues = despues.replace(LINEA_VIEJA, LINEA_NUEVA)

// --- post-condiciones
assert(despues !== antes, 'no se aplicó ningún cambio')
assert(despues.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((despues.match(/\{\{/g) || []).length === EXPRESIONES, 'se perdió alguna expresión {{ }}')
assert((despues.match(/SIN PRESUPUESTO DECLARADO/g) || []).length === 1, 'el gate quedó duplicado')
assert((despues.match(/TRATO:/g) || []).length === 1, 'se tocó la regla de TRATO de v15')

// Los 4 puntos de la narrativa siguen intactos: el gate decide CUÁNDO se usan, no los reescribe.
for (const p of [
  '1. Arrancá reconociendo lo positivo',
  '2. Explicá por qué no cotizás el usado en vivo',
  '3. Presentá DOS caminos claros',
  '4. NUNCA estimes vos el valor del usado',
]) {
  assert(despues.includes(p), `se perdió el punto: ${p}`)
}
// La rama "estirar" no se toca: es la que hace funcionar `permuta-mas-efectivo`.
assert(
  despues.includes('· Opciones de gama superior alcanzables con la permuta (categoria "estirar")'),
  'se tocó la rama "estirar"',
)

franco.parameters.options.systemMessage = despues

console.log('✓ todas las aserciones pasan')
console.log(`  systemMessage: ${antes.length} -> ${despues.length} chars (+${despues.length - antes.length})`)
console.log('  gate de presupuesto arriba de "## Permuta" + la línea de "entra" acotada')
console.log('  los 4 puntos y la rama "estirar" quedan intactos')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
  console.log('\n--- PEGAR EN n8n: Franco (AI Agent) -> System Message ---')
  console.log('\n[1] En "## Permuta", JUSTO DEBAJO de la línea que termina en')
  console.log('    "...(no como una lista seca de precios):"')
  console.log('    y ANTES del punto "1. Arrancá reconociendo lo positivo", insertar:\n')
  console.log(GATE)
  console.log('[2] En el punto 3, REEMPLAZAR la línea que arranca con')
  console.log('    "   · Opciones que cubre su efectivo" por:\n')
  console.log(LINEA_NUEVA)
}
