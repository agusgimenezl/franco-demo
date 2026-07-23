#!/usr/bin/env node
// v52: state-awareness. Franco recolecta anticipo + cuotas y, al pivotear el cliente a "más info del auto",
// RE-OFRECE la financiación como si no tuviera nada. Base: franco-n8n-v51.json. (2026-07-23)
//
//   node scripts/financiacion-no-reofrece.mjs [--check]
//
// EL BUG (captura + eval financiacion-no-re-ofrece 0/4 en v51): recolectó anticipo (10M) + cuotas (36) de la
//   Duster; el cliente pregunta "tenés más info de la duster?"; Franco da la ficha y cierra con "Te interesa
//   saber cómo sería financiarla o entregando tu usado?" — re-ofrece algo ya en curso. RAÍZ: el cierre comercial
//   de ## Paso 3 tiene el ejemplo "te interesa saber cómo sería financiarlo..." y su ÚNICA excepción es la
//   permuta (name-ask), no la financiación ya arrancada.
// EL FIX (trampa 6/7: el cierre comercial es un guion casi-obligatorio): se agrega la Excepción 2 — si el
//   cliente YA dio anticipo y/o cuotas, el cierre NO re-ofrece financiación: CONSOLIDA (afirmación, no pregunta)
//   y ofrece OTRO paso (verla en persona / algo más).
// NO toca SQL ni otros flujos. ⚠️ PEGA A MANO Agustina + verificación byte a byte.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v51.json')
const OUT = join(ROOT, 'franco-n8n-v52.json')
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

const OLD = 'Excepción: si venís en la progresión de permuta y ya tenés el auto y los kilómetros del usado, la pregunta obligatoria de ese turno es pedir el nombre y apellido para derivar (ver ## Permuta), no la de cotización.'
const NEW = 'Excepción: si venís en la progresión de permuta y ya tenés el auto y los kilómetros del usado, la pregunta obligatoria de ese turno es pedir el nombre y apellido para derivar (ver ## Permuta), no la de cotización. Excepción 2 (financiación ya en curso): si el cliente YA te dio el anticipo y/o las cuotas (mirá la conversación reciente y "Lo que ya sabés de este cliente"), NO le vuelvas a preguntar "te interesa financiarla?" ni "querés que un asesor te arme la simulación?" —eso ya lo arrancó, re-ofrecerlo le dice que no lo escuchaste—: consolidá con una AFIRMACIÓN ("perfecto, le dejo anotado al asesor la simulación con tu anticipo y las cuotas que me diste") y cerrá ofreciendo OTRO paso (verla en persona, o si necesita algo más mientras tanto).'
unaVez(m, OLD, 'prompt (## Paso 3, cierre comercial)')
m = m.replace(OLD, NEW)

franco.parameters.options.systemMessage = m

// ── post-condiciones
assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES, 'cambió el número de expresiones {{ }} del prompt (no debía)')
assert(m.includes('Excepción 2 (financiación ya en curso)'), 'no quedó la excepción 2')
assert(m.includes('consolidá con una AFIRMACIÓN'), 'no quedó la consolidación')
assert((m.match(/Excepción:/g) || []).length === 1 && m.includes('Excepción 2'), 'las excepciones no quedaron bien')
// fixes previos sobreviven
assert(m.includes('NO abras confirmándoselos'), 'se perdió el anti-eco global (v51)')
assert(m.includes('NO le recites los datos que ÉL te acaba de dar'), 'se perdió el anti-eco del pto 6 (v50)')
assert(m.includes('genial, y cuántos km tiene?'), 'se perdió el pto 3 seco (v48)')
assert(m.includes('LA SIMULACIÓN LA ARMA EL ASESOR, no vos'), 'se perdió la transparencia (v47)')
const ls = nodo('Listar stock').parameters.query
assert(ls.includes('GREATEST(') && ls.includes("u.tramo = 'fuera'"), 'se rompió Listar stock (v49/v45)')
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
console.log('  ## Paso 3 cierre: Excepción 2 — si ya dio anticipo/cuotas, consolidar (afirmación), NO re-ofrecer financiación')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
