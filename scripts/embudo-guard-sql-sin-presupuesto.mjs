#!/usr/bin/env node
// BUG-embudo (parte determinística): Listar stock NO devuelve autos cuando el cliente va por la capacidad
// (permuta o financiación) pero NO declaró presupuesto (precio_objetivo=0). Le saca la munición al dump.
// Base: franco-n8n-v58.json. (2026-07-24)
//
//   node scripts/embudo-guard-sql-sin-presupuesto.mjs [--check]
//
// POR QUÉ: v58 (prompt) NO aguantó — medido, el gate por prompt leakea (1/3 dumpea entero, 1/3 mezcla). Franco
//   sigue llamando Listar stock con precio_objetivo=0 + tiene_permuta=1 → la query etiqueta TODO 'entra' →
//   dump de pickups $50M. Regla del proyecto: lo determinístico va a código. El abanico de capacidad NO tiene
//   sentido sin presupuesto → la query devuelve 0 filas en ese caso, y Franco (con el guion del embudo de v58)
//   no tiene autos que dumpear: sigue el embudo (asesor o pedir presupuesto). Los flujos CON presupuesto no se
//   tocan (v58 no los regresó; el guard tampoco).
//
// QUÉ HACE:
//   (A) Listar stock query: WHERE final + `AND NOT (precio_objetivo=0 AND (tiene_permuta=1 OR con_financiacion=1))`
//       → 0 filas para la capacidad sin presupuesto. Búsqueda normal (sin permuta/financiación) NO se toca.
//   (B) toolDescription: aclara que 0 filas en ese caso NO es "no hay stock", es la señal del embudo.
//   (C) prompt línea 135 (SIN PRESUPUESTO): deja de decir "mostrás stock" (la herramienta no trae nada) →
//       ofrecé el embudo / pedí el presupuesto.
// NO toca: el guion del embudo (v58), el techo estirar, los tramos, los strips, el colapso a1a, el dedup.
// Verificación: sim offline (0 filas sin presupuesto, >0 con presupuesto) + log post-paste. ⚠️ PEGA A MANO.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v58.json')
const OUT = join(ROOT, 'franco-n8n-v59.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => { const x = wf.nodes.find((k) => k.name === n); assert(x, `no existe "${n}"`); return x }

const PO = "{{ $fromAI('precio_objetivo', 'El techo de presupuesto real del cliente en pesos, sin estirar. Poner 0 si no dio presupuesto.', 'number') }}"
const TP = "{{ $fromAI('tiene_permuta', 'Poner 1 si el cliente dijo que entrega un auto usado en parte de pago, 0 si no.', 'number') }}"
const CF = "{{ $fromAI('con_financiacion', 'Poner 1 si el cliente va a financiar, dio un anticipo, o pregunto por cuotas/financiacion. 0 si paga al contado o no lo menciono.', 'number') }}"

// ── (A) SQL guard
{
  const ls = nodo('Listar stock')
  let q = ls.parameters.query
  const OLD = `  AND NOT (${TP} = 1 AND u.categoria = 'fuera')\nORDER BY u.precio_num DESC;`
  const NEW = `  AND NOT (${TP} = 1 AND u.categoria = 'fuera')\n  AND NOT (${PO} = 0 AND (${TP} = 1 OR ${CF} = 1))\nORDER BY u.precio_num DESC;`
  unaVez(q, OLD, 'Listar stock (WHERE final)')
  assert(!q.includes(`AND NOT (${PO} = 0 AND`), 'ya está el guard — ¿ya se aplicó?')
  q = q.replace(OLD, NEW)
  ls.parameters.query = q

  // (B) toolDescription
  let td = ls.parameters.toolDescription
  const TD_OLD = 'Mostrá 2 por tramo (entrada/intermedio/alto); los tramo=fuera no se muestran.'
  const TD_NEW = TD_OLD + ' Si es permuta o financiacion pero el cliente NO declaro presupuesto/anticipo (precio_objetivo=0), la query NO devuelve autos a proposito: eso NO significa "no hay stock", es la senal de pedir el presupuesto o derivar al asesor (el embudo).'
  unaVez(td, TD_OLD, 'Listar stock (toolDescription)')
  td = td.replace(TD_OLD, TD_NEW)
  ls.parameters.toolDescription = td
}

// ── (C) prompt línea 135
const franco = nodo('Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
const EXPR = (m.match(/\{\{/g) || []).length
const L135_OLD = 'mostrás stock SIN afirmar que lo cubre, y le preguntás el presupuesto:'
const L135_NEW = 'NO listás un abanico de autos (sin presupuesto la herramienta no te trae nada a propósito), y ofrecés el embudo —un asesor para la tasación, o pedirle el presupuesto para acercarle opciones—:'
unaVez(m, L135_OLD, 'prompt (línea 135 sin presupuesto)')
m = m.replace(L135_OLD, L135_NEW)
franco.parameters.options.systemMessage = m

// ── post-condiciones
const lsq = nodo('Listar stock').parameters.query
assert(lsq.includes(`AND NOT (${PO} = 0 AND (${TP} = 1 OR ${CF} = 1))`), 'no quedó el guard sin-presupuesto')
assert(lsq.includes("AND NOT (" + TP + " = 1 AND u.categoria = 'fuera')"), 'se perdió el strip de fuera (a2.1)')
assert(lsq.includes(`= 0 OR ${TP} = 1 OR `), 'se perdió el guard de precio_max (a2)')
assert(lsq.includes('WITH usado_val AS (') && lsq.includes('power(0.88'), 'se perdió el colapso a1a')
assert(nodo('Listar stock').parameters.toolDescription.includes('es la senal de pedir el presupuesto o derivar al asesor'), 'no quedó la nota de toolDescription')
assert(m !== mAntes && m.startsWith('='), 'el prompt no cambió o perdió el =')
assert((m.match(/\{\{/g) || []).length === EXPR, 'cambió el número de expresiones {{ }}')
assert(m.includes('NO listás un abanico de autos (sin presupuesto'), 'no quedó el ajuste de la línea 135')
assert(m.includes('querés que te conecte con un asesor para la tasación de tu vehículo, o preferís ver más opciones en stock?'), 'se perdió el guion del embudo (v58)')
assert(m.includes('SOLO si el cliente pidió opciones EN GENERAL Y declaró un anticipo/presupuesto'), 'se perdió el gate de capacidad (v58)')
assert(m.includes('andá directo a pedir el nombre'), 'se perdió el name-ask gate')

// trampa 3
{
  const porKey = new Map()
  for (const nn of wf.nodes) {
    for (const mm of String(nn.parameters?.query ?? '').matchAll(/\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g)) {
      const [, key, desc, tipo] = mm
      const firma = `${desc}||${tipo}`
      if (porKey.has(key)) assert(porKey.get(key) === firma, `trampa 3: la key '${key}' tiene firmas distintas`)
      else porKey.set(key, firma)
    }
  }
}

// ── SIM OFFLINE: el guard filtra sin presupuesto, deja pasar con presupuesto
{
  const guard = (precio_objetivo, tiene_permuta, con_financiacion) =>
    !(precio_objetivo === 0 && (tiene_permuta === 1 || con_financiacion === 1)) // true = pasa (hay filas)
  assert(guard(0, 1, 0) === false, 'sim: permuta sin presupuesto → 0 filas')
  assert(guard(0, 0, 1) === false, 'sim: financiación sin anticipo → 0 filas')
  assert(guard(10000000, 1, 0) === true, 'sim: permuta CON presupuesto → hay filas')
  assert(guard(7000000, 0, 1) === true, 'sim: financiación CON anticipo → hay filas')
  assert(guard(0, 0, 0) === true, 'sim: catálogo general sin permuta/financiación → hay filas (no se toca)')
  assert(guard(15000000, 0, 0) === true, 'sim: búsqueda por presupuesto → hay filas')
  console.log('  SIM guard: sin presupuesto (permuta/financiación)→0 filas · con presupuesto→filas · catálogo general→intacto  ✓')
}

console.log('✓ todas las aserciones pasan')
console.log('  (A) Listar stock: 0 filas si precio_objetivo=0 AND (tiene_permuta=1 OR con_financiacion=1)')
console.log('  (B) toolDescription: 0 filas = señal del embudo, no "no hay stock"')
console.log('  (C) prompt línea 135: sin presupuesto → embudo, no "mostrás stock"')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
