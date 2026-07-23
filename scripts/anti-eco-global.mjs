#!/usr/bin/env node
// v51: anti-eco GLOBAL. v50 mató el eco del encabezado del abanico (pto 6), pero Franco sigue abriendo el
// PRIMER turno devolviéndole al cliente su mensaje: "Perfecto, recibo que tenés 10 millones de presupuesto y
// un auto usado para entregar como parte de pago...". Base: franco-n8n-v50.json. (2026-07-23)
//
//   node scripts/anti-eco-global.mjs [--check]
//
// EL BUG (captura + eval permuta-sin-eco-primer-turno 2/4 en v50): el eco no está solo en el abanico; aparece
//   en cualquier turno como preámbulo de confirmación ("recibo que tenés X", "entonces tenés X"). Un fix por
//   guion local (v50, pto 6) no alcanza: hay que reforzar la regla GLOBAL de # Tono, que cubre todos los turnos.
// EL FIX (trampa 6: ejemplo concreto): la regla "No repitas los datos que el cliente acaba de darte" pasa a
//   prohibir explícitamente el preámbulo de confirmación ("recibo que tenés 10 millones y un usado"), preservando
//   el "perfecto Nombre" de la derivación. NO toca SQL ni otros guiones.
// ⚠️ PEGA A MANO Agustina + verificación byte a byte.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v50.json')
const OUT = join(ROOT, 'franco-n8n-v51.json')
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

const OLD = '- No repitas los datos que el cliente acaba de darte: si te dijo "un Yaris 2021 con 85mil km", confirmá con naturalidad ("perfecto") y seguí, no le recites "tu Yaris 2021 con 85.000 km".'
const NEW = '- No repitas los datos que el cliente acaba de darte, y NO abras confirmándoselos: si te dijo "un Yaris 2021 con 85mil km" o "tengo 10 millones y un usado", NO arranques con "recibo que tenés 10 millones y un usado", ni "perfecto, entonces tenés un Yaris 2021 con 85.000 km", ni "teniendo en cuenta tu Yaris 2021 con 85.000 km" —devolverle su propio mensaje resumido es puro eco y suena a formulario—. Un "perfecto", "genial" o "dale" solo, y vas DERECHO a lo que sigue (la pregunta o las opciones). Esto NO aplica a nombrarlo por su nombre de pila ("perfecto Martín"), que sí va.'
unaVez(m, OLD, 'prompt (# Tono, regla no repitas)')
m = m.replace(OLD, NEW)

franco.parameters.options.systemMessage = m

// ── post-condiciones
assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES, 'cambió el número de expresiones {{ }} del prompt (no debía)')
assert(m.includes('NO abras confirmándoselos'), 'no quedó el refuerzo anti-eco')
assert(m.includes('recibo que tenés 10 millones y un usado'), 'no quedó el ejemplo concreto del eco')
assert(m.includes('perfecto Martín'), 'no quedó la excepción del nombre')
// v50 (pto 6) y demás sobreviven
assert(m.includes('NO le recites los datos que ÉL te acaba de dar'), 'se perdió el anti-eco del pto 6 (v50)')
assert(m.includes('genial, y cuántos km tiene?'), 'se perdió el pto 3 seco (v48)')
assert(m.includes('refleja el valor REAL del usado'), 'se perdió el contado proporcional (v49)')
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
console.log('  # Tono: la regla "no repitas" prohíbe el preámbulo de confirmación ("recibo que tenés 10M y un usado")')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
