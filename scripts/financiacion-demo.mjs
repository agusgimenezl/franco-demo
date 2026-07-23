#!/usr/bin/env node
// Capacidad de financiación para la demo (2026-07-22). Feature, no bug-fix.
//
//   node scripts/financiacion-demo.mjs            # escribe franco-n8n-v38.json
//   node scripts/financiacion-demo.mjs --check    # solo valida
//
// OBJETIVO (pedido de Agustina): mostrarle a los dueños que Franco maneja financiación con
// solvencia. Automotores Tucumán es ficticia; no hay accuracy provincial que cuidar. Dos partes,
// separadas según la regla del proyecto (dato -> FAQ/Config, lenguaje -> prompt):
//
//   (A) DATOS al empresa_faq (Config): documentación del comprador para prenda + gastos de la
//       operación. Es "info para recitar", va donde ya vive el resto del FAQ. Cero montos en pesos.
//   (B) CONDUCTA al prompt (Franco): bloque ## Financiación con pre-perfilado (preguntar anticipo
//       + cuántas cuotas para adelantarle el trabajo al asesor) y el reframe "asesor en marcha"
//       (si ya lo pidió/aceptó, no re-ofrecer conectarlo: ya se va a contactar).
//
// FALLA-PRIMERO MEDIDO en v37 (evals/repro-financiacion.json, checks ajustados):
//   financiacion-documentacion 0/2 (no da DNI/CUIT/Formulario 08), financiacion-gastos 0/2 (no da
//   sellos/aranceles/gestoría), financiacion-preperfilado 0/2 (no pregunta anticipo+cuotas, ofrece
//   asesor). El bug de la captura (re-ofrecer asesor ya en marcha) NO reproduce en v37 (3/3 ok):
//   ya mitigado por v34/v37; el reframe va igual como refuerzo, medido por asesor-en-marcha-no-reofrece.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v37.json')
const OUT = join(ROOT, 'franco-n8n-v38.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))

// ══════════════ (A) FAQ en el Config: documentación + gastos

const cfg = wf.nodes.find((n) => n.name === 'Config')
assert(cfg, 'no existe el nodo "Config"')
const faqAsg = cfg.parameters.assignments.assignments.find((a) => a.name === 'empresa_faq')
assert(faqAsg, 'no existe empresa_faq en el Config')
const faqAntes = faqAsg.value
assert(faqAntes.includes('FINANCIACIÓN:'), 'el FAQ no tiene la entrada FINANCIACIÓN de base')
assert(!faqAntes.includes('Formulario 08'), 'el FAQ ya tiene las entradas nuevas — ¿doble corrida?')

const FAQ_NUEVO =
  '\n\nDOCUMENTACIÓN PARA FINANCIAR (PRENDA): Para financiar con prenda, el titular presenta DNI ' +
  'vigente y CUIT o CUIL, más una demostración de ingresos (recibo de sueldo, monotributo o ' +
  'equivalente) según el perfil. Para la transferencia se firma el Formulario 08 y se hace la ' +
  'verificación policial de la unidad. El asesor te confirma exactamente qué papeles pedir según tu caso.' +
  '\n\nGASTOS DE LA OPERACIÓN: Además del precio del auto, una compra financiada suele tener gastos ' +
  'de transferencia e inscripción (aranceles del Registro Automotor), impuesto de sellos, ' +
  'inscripción de la prenda, gestoría, y el seguro del vehículo mientras dure la prenda. No te ' +
  'puedo dar los montos exactos porque dependen de la valuación y la jurisdicción; el asesor te ' +
  'arma el detalle en la simulación.'

faqAsg.value = faqAntes + FAQ_NUEVO

// ══════════════ (B) prompt de Franco: bloque ## Financiación

const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe "Franco (AI Agent)"')
let m = franco.parameters.options.systemMessage
const smAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
const EXPR = (m.match(/\{\{/g) || []).length
assert(EXPR === 21, `esperaba 21 expresiones {{ }}, hay ${EXPR}`)
// Sobre v37.
assert(cuenta(m, 'con el Gol 2015 ya le paso todo a un asesor') === 1, 'no encuentro v37 — ¿partiste de v37?')

const ANCLA = '# Cotización de usados'
assert(cuenta(m, ANCLA) === 1, `anchor "${ANCLA}" aparece ${cuenta(m, ANCLA)} veces`)

const BLOQUE =
  '# Financiación\n' +
  'Cuando pregunten por financiación, cuotas, prenda, gastos o documentación, respondés con la ' +
  'info del FAQ (el 50%, los papeles, los gastos) en tono charlado, no la copies textual. NUNCA ' +
  'des un monto exacto en pesos de una cuota ni de los gastos: depende de la valuación y lo arma ' +
  'el asesor en la simulación. Decir "el asesor te arma el cálculo exacto" se lee bien, no evasivo.\n' +
  'Después de contestar, adelantale trabajo al asesor pre-perfilando: preguntá cuánto pensás ' +
  'poner de anticipo (un monto, o un usado a entregar) y en cuántas cuotas te gustaría financiar ' +
  '(por ejemplo 12, 24, 36 o 48). Cuando te lo diga, confirmás que se lo dejás anotado al asesor ' +
  'para la simulación.\n' +
  'ASESOR EN MARCHA: si el cliente YA pidió o aceptó un asesor, la derivación está en curso — no ' +
  'ofrezcas "conectarte con un asesor" como si fuera algo nuevo. Enmarcá que ya se va a contactar: ' +
  '"como el asesor ya se va a contactar, querés que le deje anotado que te prepare la simulación ' +
  'de esta Hilux?" en vez de "querés que te conecte con un asesor?".\n\n'

m = m.replace(ANCLA, BLOQUE + ANCLA)
franco.parameters.options.systemMessage = m

// ══════════════ post-condiciones

// (A)
assert(faqAsg.value.length > faqAntes.length, 'el FAQ no creció')
assert(faqAsg.value.includes('DOCUMENTACIÓN PARA FINANCIAR (PRENDA):'), 'falta la entrada de documentación')
assert(faqAsg.value.includes('GASTOS DE LA OPERACIÓN:'), 'falta la entrada de gastos')
assert(cuenta(faqAsg.value, 'Formulario 08') === 1, 'Formulario 08 no quedó una sola vez')
// sin montos en pesos en lo nuevo
assert(!/\$\s?\d/.test(FAQ_NUEVO), 'el FAQ nuevo tiene un monto en pesos y no debería')

// (B)
assert(m !== smAntes, 'no se aplicó el bloque al prompt')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR, 'el bloque agregó/quitó una expresión {{ }} (debía ser texto plano)')
assert(cuenta(m, '# Financiación\n') === 1, 'el bloque no quedó una sola vez')
assert(cuenta(m, 'ASESOR EN MARCHA:') === 1, 'falta el reframe asesor-en-marcha')
assert(cuenta(m, ANCLA) === 1, 'se duplicó o perdió el anchor')
// fixes previos intactos
assert(cuenta(m, 'con el Gol 2015 ya le paso todo a un asesor') === 1, 'se perdió v37')
assert(cuenta(m, 'El molde de la recomendación') === 1, 'se perdió #4')
assert(cuenta(m, 'un asesor necesita ver el estado del auto en persona') === 1, 'se perdió #2')
assert(cuenta(m, 'lo único que lo destraba es ese dato') === 1, 'se perdió v34')
assert(cuenta(m, 'LA DERIVACIÓN MANDA') === 1, 'se tocó v23')
assert(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)

console.log('✓ todas las aserciones pasan')
console.log(`  FAQ:    ${faqAntes.length} -> ${faqAsg.value.length} chars (+${faqAsg.value.length - faqAntes.length})`)
console.log(`  prompt: ${smAntes.length} -> ${m.length} chars (+${m.length - smAntes.length})`)
console.log('  (A) FAQ: documentación del comprador + gastos de la operación (sin montos)')
console.log('  (B) prompt: # Financiación — pre-perfilado (anticipo + cuotas) + reframe asesor-en-marcha')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
