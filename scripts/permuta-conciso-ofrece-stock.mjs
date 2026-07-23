#!/usr/bin/env node
// v48 (Tarea A de la tanda de permuta): dos fixes de prompt. Base: franco-n8n-v47.json. (2026-07-23)
//
//   node scripts/permuta-conciso-ofrece-stock.mjs [--check]
//
// (#3) VERBOSIDAD (captura + eval permuta-km-conciso 1/6 en v47): al pedir el km, Franco mete relleno
//   ("un Yaris 2020 es muy buscado para permuta", "para que pueda estimar mejor el valor"). RAÍZ: pto 3
//   de ## Permuta enseña 'valorá lo que entrega ("un Gol Trend 2017 es de los más buscados")' — el ejemplo
//   enseña el piropo (trampa 6). FIX: pto 3 seco, con el ejemplo terso "genial, y cuántos km tiene?".
// (#2) NO OFRECE EL STOCK COMPLETO (captura + eval permuta-ofrece-stock-completo 4/6): en la rama contado,
//   tras mostrar las opciones Franco salta a "dame tu nombre para el asesor" sin ofrecer ver el stock
//   completo. FIX: en la rama contado, ofrecer el stock completo ANTES de proponer la tasación.
// NO toca SQL ni el name-ask progression (se mide permuta-una-pregunta-por-vez de control).
// ⚠️ PEGA A MANO Agustina + verificación byte a byte por MCP.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v47.json')
const OUT = join(ROOT, 'franco-n8n-v48.json')
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

// (#3) pto 3 seco
const OLD_P3 = `3. Con el usado ya identificado, valorá lo que entrega ("un Gol Trend 2017 es de los más buscados") y enmarcá la permuta como una VENTAJA para él, no como una traba.`
const NEW_P3 = `3. Con el usado ya identificado, NO lo elogies ("es muy buscado", "muy valorado", "de los más buscados") ni expliques por qué pedís el dato ("para estimar mejor el valor", "para darte opciones"): es relleno y alarga el mensaje. Si te falta el kilometraje, la pregunta va corta y sola, en una burbuja: "genial, y cuántos km tiene?". La permuta es una ventaja que se demuestra con los autos que le entran, no con un piropo al usado.`
unaVez(m, OLD_P3, 'prompt (#3 pto 3)')
m = m.replace(OLD_P3, NEW_P3)

// (#2) rama contado: ofrecer el stock completo antes de derivar
const OLD_CONT = `SOLO mostrás las que la herramienta trae; no inventes opciones más caras para "que vaya viendo".`
const NEW_CONT = `SOLO mostrás las que la herramienta trae; no inventes opciones más caras para "que vaya viendo". Y ANTES de proponerle la tasación con un asesor, ofrecele ver el stock completo por si quiere ("y si querés te paso todo el stock que tenemos, avisame"): no lo empujes a derivar sin haberle dado la opción de ver todo.`
unaVez(m, OLD_CONT, 'prompt (#2 rama contado)')
m = m.replace(OLD_CONT, NEW_CONT)

franco.parameters.options.systemMessage = m

// ── post-condiciones
assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES, 'cambió el número de expresiones {{ }} del prompt (no debía)')
assert(m.includes('genial, y cuántos km tiene?'), 'no quedó el ejemplo terso del km')
assert(!m.includes('un Gol Trend 2017 es de los más buscados'), 'quedó el ejemplo verboso viejo (pto 3)')
assert(m.includes('ofrecele ver el stock completo por si quiere'), 'no quedó el ofrecimiento del stock completo')
// no se rompió nada de las versiones previas
assert(nodo('Valuar usado').parameters.query.includes('EXTRACT(YEAR FROM CURRENT_DATE)'), 'se perdió el km_factor (v46)')
assert(m.includes('arrancás por el ANTICIPO'), 'se perdió el fix de financiación (v47)')
assert(m.includes('LA SIMULACIÓN LA ARMA EL ASESOR, no vos'), 'se perdió la transparencia (v47)')
const ls = nodo('Listar stock').parameters.query
assert(ls.includes("u.tramo = 'fuera'") && ls.includes('WHERE NOT ('), 'se perdió el filtro de fuera (v45)')
assert(m.includes('NUNCA lo ofrecés vos'), 'se perdió el fix del WhatsApp (v45)')
// name-ask progression intacta (se mide de control, pero el texto tiene que seguir estando)
assert(m.includes('YA TENÉS EL AUTO Y LOS KILÓMETROS'), 'se tocó la progresión del name-ask (no debía)')

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
console.log('  (#3) pto 3 seco: sin piropo al usado ni explicar por qué pide el dato ("genial, y cuántos km tiene?")')
console.log('  (#2) rama contado: ofrece el stock completo antes de proponer la tasación con un asesor')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
