#!/usr/bin/env node
// v49 (Tarea B): CONTADO PROPORCIONAL. La rama contado+permuta subtasaba (techo estirar = efectivo×1.40,
// no factorizaba el usado): a un cliente con 10M + Yaris 2020 le ofrecía autos más viejos que su propio
// usado. Base: franco-n8n-v48.json. (2026-07-23)
//
//   node scripts/contado-proporcional.mjs [--check]
//
// EL BUG (captura + logs): 10M efectivo + Yaris 2020 → Franco ofrecía Gol 2018 / Fiesta 2017 / Etios 2019
//   (techo 14M = 10M×1.40). El usado NO entraba en la capacidad. Decisión de Agustina: factor ×0.70
//   (consistente con financiación). Sim: scratchpad/sim-contado.mjs — con el usado, la capacidad al contado
//   sube a efectivo + usado×0.70 (~18.7M para el Yaris fallback) y el "estirar" llega a Cronos/Kangoo.
//
// EL FIX (regla del proyecto, determinístico → SQL):
//   (A) Listar stock: el techo de la categoría "estirar" pasa de `efectivo×1.40` a
//       GREATEST(efectivo×1.40, efectivo + usado_valor×0.70) cuando hay permuta. Toma el mayor: nunca
//       rinde menos que antes, y factoriza el usado cuando Franco pasa usado_valor. Con usado_valor=0
//       (cadena falla) degrada EXACTO al ×1.40 viejo.
//   (B) prompt rama contado: pasar usado_valor también al contado (con_financiacion=0), así el camino
//       "entregando tu usado" refleja el valor real y no un estirón fijo.
// NO toca la rama financiación (tramos) ni el name-ask. Verificación vinculante: sim + log de Listar stock
// (categoria estirar llega a Cronos/Kangoo con usado_valor). ⚠️ PEGA A MANO Agustina + verificación byte a byte.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v48.json')
const OUT = join(ROOT, 'franco-n8n-v49.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => { const x = wf.nodes.find((k) => k.name === n); assert(x, `no existe "${n}"`); return x }

// firmas byte-idénticas (trampa 3)
const PO = "{{ $fromAI('precio_objetivo', 'El techo de presupuesto real del cliente en pesos, sin estirar. Poner 0 si no dio presupuesto.', 'number') }}"
const TP = "{{ $fromAI('tiene_permuta', 'Poner 1 si el cliente dijo que entrega un auto usado en parte de pago, 0 si no.', 'number') }}"
const UV = "{{ $fromAI('usado_valor', 'Tu estimacion del valor de mercado actual del usado que entrega el cliente, en pesos (ej: 7500000). Poner 0 si no hay usado o todavia no sabes marca, modelo, anio y km.', 'number') }}"

// ── (A) Listar stock: techo de 'estirar' factoriza el usado
{
  const n = nodo('Listar stock')
  let q = n.parameters.query
  const OLD_CEIL = `(${PO} * (CASE WHEN ${TP} = 1 THEN 1.40 ELSE 1.25 END))`
  unaVez(q, OLD_CEIL, 'Listar stock (techo estirar)')
  assert(!q.includes('GREATEST(' + PO), 'ya está el GREATEST — ¿ya se aplicó?')
  const NEW_CEIL = `GREATEST(${PO} * (CASE WHEN ${TP} = 1 THEN 1.40 ELSE 1.25 END), CASE WHEN ${TP} = 1 AND ${UV} > 0 THEN ${PO} + ${UV} * 0.70 ELSE 0 END)`
  q = q.replace(OLD_CEIL, NEW_CEIL)
  n.parameters.query = q
}

// ── (B) prompt: la rama contado pasa usado_valor también
const franco = nodo('Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
const EXPR_ANTES = (m.match(/\{\{/g) || []).length

const OLD_CONT = 'SI PAGA AL CONTADO (no menciona financiar ni cuotas): con_financiacion=0 y presentás DOS caminos'
const NEW_CONT = 'SI PAGA AL CONTADO (no menciona financiar ni cuotas): con_financiacion=0. Si ya tenés los 4 datos del usado (marca, modelo, año, km), llamás a Valuar usado y pasás ese usado_valor con con_financiacion=0: así el camino "entregando tu usado" refleja el valor REAL del usado, no un estirón fijo. Presentás DOS caminos'
unaVez(m, OLD_CONT, 'prompt (rama contado)')
m = m.replace(OLD_CONT, NEW_CONT)

franco.parameters.options.systemMessage = m

// ── post-condiciones
assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES, 'cambió el número de expresiones {{ }} del prompt (no debía)')
assert(m.includes('refleja el valor REAL del usado'), 'no quedó el pasaje de usado_valor al contado')
const ls = nodo('Listar stock').parameters.query
assert(ls.includes('GREATEST(') && ls.includes('* 0.70 ELSE 0 END)'), 'no quedó el GREATEST del techo estirar')
assert(ls.includes("THEN 'estirar'"), 'se rompió la categoría estirar')
// financiación intacta (tramos)
assert(ls.includes("END AS tramo") && ls.includes(') * 2   THEN'), 'se tocó la rama financiación (tramos) — no debía')
assert(ls.includes("u.tramo = 'fuera'") && ls.includes('WHERE NOT ('), 'se perdió el filtro de fuera (v45)')
assert(ls.includes('NOT EXISTS (SELECT 1 FROM en_presupuesto)'), 'se perdió el fallback de v14')
// fixes previos del prompt sobreviven
assert(m.includes('genial, y cuántos km tiene?'), 'se perdió el pto 3 seco (v48)')
assert(m.includes('ofrecele ver el stock completo por si quiere'), 'se perdió el ofrecimiento de stock (v48)')
assert(m.includes('arrancás por el ANTICIPO'), 'se perdió el fix de financiación (v47)')
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
console.log('  (A) Listar stock: techo estirar = GREATEST(efectivo×1.40, efectivo + usado×0.70) — factoriza el usado')
console.log('  (B) prompt: la rama contado pasa usado_valor (con_financiacion=0)')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
