#!/usr/bin/env node
// v45: (A) hardening del abanico — Listar stock NO devuelve los 'fuera' cuando hay financiación,
// así Franco no puede mostrar autos fuera de la capacidad. (B) fix WhatsApp — no lo ofrece solo.
// Base: franco-n8n-v44.json. (2026-07-23)
//
//   node scripts/hardening-tramos-whatsapp.mjs [--check]
//
// (A) EL BUG (medido en v44): a un cliente con 7M + un Ka, Franco mostró S10 $39.5M, Hilux $38M,
//     Amarok $32M como "abanico". Causa: el SQL etiqueta esos como tramo='fuera' (>techo) pero se
//     los DEVUELVE igual, y el prompt "no te quedes corto" empujó a Franco a agarrarlos. Regla del
//     proyecto: lo determinístico va a código. Fix: la query FILTRA los 'fuera' cuando
//     con_financiacion=1. No dependemos de que el LLM obedezca. (No toca el flujo sin financiación.)
// (B) EL BUG (captura): tras derivar y dar la dirección, Franco ofreció "querés que te pase el
//     WhatsApp?" sin que se lo pidan. Debía cerrar. Fix: nunca ofrece el número; solo lo da si el
//     cliente lo pide explícito.
// ⚠️ PEGA A MANO Agustina + verificación byte a byte por MCP.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v44.json')
const OUT = join(ROOT, 'franco-n8n-v45.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => { const x = wf.nodes.find((k) => k.name === n); assert(x, `no existe "${n}"`); return x }

const FIN = "{{ $fromAI('con_financiacion', 'Poner 1 si el cliente va a financiar, dio un anticipo, o pregunto por cuotas/financiacion. 0 si paga al contado o no lo menciono.', 'number') }}"

// (A) Listar stock: filtrar los tramo='fuera' cuando hay financiación
{
  const n = nodo('Listar stock')
  let q = n.parameters.query
  assert(q.includes('END AS tramo'), 'no hay tramo — ¿base equivocada?')
  assert(!q.includes("u.tramo = 'fuera'"), 'ya está el filtro — ¿ya se aplicó?')
  const ANCLA = ') u\nORDER BY u.precio_num DESC;'
  unaVez(q, ANCLA, 'Listar stock (ORDER BY final)')
  q = q.replace(ANCLA, `) u\nWHERE NOT (${FIN} = 1 AND u.tramo = 'fuera')\nORDER BY u.precio_num DESC;`)
  n.parameters.query = q
}

// (B) prompt: el WhatsApp no se ofrece solo
const franco = nodo('Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
const EXPR_ANTES = (m.match(/\{\{/g) || []).length

const OLD_TEL = '- El teléfono de la empresa lo das solo si el cliente lo pide ("me pasás un número?", "tenés WhatsApp?") o pide hablar con un asesor. En un cierre normal ofrecés que "un asesor lo puede contactar" y pedís su nombre y apellido, no su teléfono.'
const NEW_TEL = '- El teléfono/WhatsApp de la empresa lo das SOLO si el cliente lo pide EXPLÍCITAMENTE ("me pasás un número?", "tenés WhatsApp?"). NUNCA lo ofrecés vos ni preguntás "querés que te pase el WhatsApp?": si el cliente ya está derivado, lo contacta el asesor, y ofrecerle un número de más te hace ver que no cerraste. En un cierre normal ofrecés que "un asesor lo puede contactar" y pedís su nombre y apellido, no su teléfono. Si te pregunta la dirección, se la das y cerrás — sin ofrecer el WhatsApp.'
unaVez(m, OLD_TEL, 'prompt (regla del teléfono)')
m = m.replace(OLD_TEL, NEW_TEL)

// (C) el abanico NO se dispara si el cliente ya eligió un auto puntual
const OLD_SCOPE = 'Este punto corre cuando el cliente PIDE ver opciones o recién arranca la permuta.'
const NEW_SCOPE = 'Este punto (el abanico) corre SOLO cuando el cliente pide ver opciones EN GENERAL, sin un auto puntual ya elegido. Si el cliente vino interesado en UN AUTO PUNTUAL (te preguntó por ese modelo) y te ofrece su usado como parte de pago, NO le tires el abanico de otros modelos —y JAMÁS autos más caros o de otra categoría que no pidió (una pickup a quien mira un hatchback)—: reconocé la permuta sobre ESE auto y ofrecé UNA de dos, que un asesor coordine la tasación, o mostrarle modelos PARECIDOS al que le gustó si quiere ver más.'
unaVez(m, OLD_SCOPE, 'prompt (scope del abanico)')
m = m.replace(OLD_SCOPE, NEW_SCOPE)

franco.parameters.options.systemMessage = m

// post
assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES, 'cambió el número de expresiones {{ }} del prompt (no debía)')
assert(m.includes('NUNCA lo ofrecés vos'), 'no quedó el refuerzo del WhatsApp')
assert(!m.includes('o pide hablar con un asesor. En un cierre'), 'quedó la regla vieja del teléfono')
assert(m.includes('interesado en UN AUTO PUNTUAL'), 'no quedó el scope del abanico')
assert(!m.includes('Este punto corre cuando el cliente PIDE ver opciones o recién arranca la permuta.'), 'quedó el scope viejo')
const ls = nodo('Listar stock').parameters.query
assert(ls.includes("WHERE NOT (") && ls.includes("u.tramo = 'fuera'"), 'no quedó el filtro de fuera')
assert(ls.includes('con_financiacion') && ls.includes('END AS tramo'), 'se rompió la query de tramo')
assert(ls.includes('NOT EXISTS (SELECT 1 FROM en_presupuesto)'), 'se perdió el fallback de v14')
// tools intactas
assert(nodo('Valuar usado').parameters.query.includes('valor_ref_2020'), 'se tocó Valuar usado')
// trampa 3
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
console.log('  (A) Listar stock: filtra tramo=fuera cuando con_financiacion=1 (Franco no puede mostrar $38M)')
console.log('  (B) prompt: el WhatsApp no se ofrece solo, solo si lo piden explícito')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
