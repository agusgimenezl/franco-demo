#!/usr/bin/env node
// v50: anti-eco. Franco recita los datos que el cliente acaba de dar ("tu Yaris 2020 con 65.000 km") en
// los encabezados de la permuta. Base: franco-n8n-v49.json. (2026-07-23)
//
//   node scripts/permuta-sin-eco-datos.mjs [--check]
//
// EL BUG (énfasis de Agustina + eval permuta-sin-eco-datos 0/4 en v49): en el encabezado del abanico Franco
//   repite "teniendo en cuenta tu Yaris 2020 con 65.000 km..." / "tu usado, un Toyota Yaris 2020 con 65.000 km".
//   La regla global de # Tono ("No repitas los datos que el cliente acaba de darte") YA tiene el ejemplo exacto
//   y no aguanta: el guion del encabezado de permuta invita el eco (trampa 6: el guion local le gana a la regla
//   global). FIX: anti-eco CONCRETO en el pto 6 de ## Permuta (que ya es el "qué NO decirle al cliente").
// NO toca SQL ni otros flujos. ⚠️ PEGA A MANO Agustina + verificación byte a byte.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v49.json')
const OUT = join(ROOT, 'franco-n8n-v50.json')
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

const OLD = 'Tampoco prometas que "con eso te alcanza seguro".'
const NEW = 'Tampoco prometas que "con eso te alcanza seguro". Y NO le recites los datos que ÉL te acaba de dar: si te dio "Yaris 2020, 65.000 km", en el encabezado del abanico NO repitas "tu Yaris 2020 con 65.000 km" ni "tu usado, un Yaris 2020 con 65.000 km" —es relleno y suena a formulario—; decí "tu usado" (y "tu efectivo" o "tu anticipo") a secas. Ya te los dio; devolvérselos no aporta.'
unaVez(m, OLD, 'prompt (pto 6, anti-eco)')
m = m.replace(OLD, NEW)

franco.parameters.options.systemMessage = m

// ── post-condiciones
assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES, 'cambió el número de expresiones {{ }} del prompt (no debía)')
assert(m.includes('NO le recites los datos que ÉL te acaba de dar'), 'no quedó el anti-eco')
assert(m.includes('decí "tu usado" (y "tu efectivo" o "tu anticipo") a secas'), 'no quedó el ejemplo del anti-eco')
// la regla global sigue (no se tocó)
assert(m.includes('No repitas los datos que el cliente acaba de darte'), 'se perdió la regla global de # Tono')
// fixes previos sobreviven
assert(m.includes('genial, y cuántos km tiene?'), 'se perdió el pto 3 seco (v48)')
assert(m.includes('refleja el valor REAL del usado'), 'se perdió el contado proporcional (v49)')
const ls = nodo('Listar stock').parameters.query
assert(ls.includes('GREATEST(') && ls.includes('* 0.70 ELSE 0 END)'), 'se perdió el GREATEST del estirar (v49)')
assert(ls.includes("u.tramo = 'fuera'") && ls.includes('WHERE NOT ('), 'se perdió el filtro de fuera (v45)')
assert(nodo('Valuar usado').parameters.query.includes('EXTRACT(YEAR FROM CURRENT_DATE)'), 'se perdió el km_factor (v46)')

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
console.log('  pto 6: anti-eco — no recitar los datos que el cliente acaba de dar ("tu Yaris 2020 con 65.000 km" → "tu usado")')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
