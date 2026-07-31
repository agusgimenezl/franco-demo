#!/usr/bin/env node
// Filtro de transmisión (captura Agustina, baseline stock-automaticos-todos 0/3): ante "qué autos
// automáticos tenés?" Franco lista de MEMORIA e incluye MANUALES (S10, Hilux) como automáticos —
// no hay filtro determinístico de transmisión. La transmisión NO está en metadata (stock-update-
// metadata.sql solo carga año/km/precio/condicion) pero SÍ está en el texto `content` de forma
// consistente: "transmisión manual" / "transmisión automática" / "transmisión cvt".
//
// Fix (regla del proyecto: lo mecánico va a código):
//   (A) Buscar auto: param `transmision` + filtro sobre `content` (automatica incluye CVT).
//   (B) Prompt ## Buscar auto: routing — para consultas por transmisión, usar esta tool con
//       transmision=..., y mostrar TODOS los que matchean, sin curar (la data sale de la ficha).
//
// Toca 2 nodos: Buscar auto (query) y Franco (systemMessage). Base: franco-n8n-v68.json. (2026-07-29)
//
//   node scripts/buscar-auto-filtro-transmision.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v68.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v69.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))

// ---------------------------------------------------------------- (A) Buscar auto: filtro transmisión
const buscar = wf.nodes.find((n) => n.name === 'Buscar auto')
assert(buscar, 'no encontré el nodo Buscar auto')
let q = buscar.parameters.query
assert(cuenta(q, "$fromAI('transmision'") === 0, 'Buscar auto ya tiene el param transmision')

// La expresión $fromAI se usa idéntica en las 2 ramas del CASE (trampa 3: misma key = misma firma).
const TP = "{{ $fromAI('transmision', 'La transmisión que busca el cliente: automatica (incluye CVT) o manual. Vacío si no mencionó ninguna.', 'string').replace(/[^A-Za-z]/g, '').toLowerCase() }}"
const FILTRO = [
  '  AND (CASE',
  `    WHEN '${TP}' ILIKE 'autom%' THEN (content ILIKE '%transmisión autom%' OR content ILIKE '%transmisión cvt%')`,
  `    WHEN '${TP}' ILIKE 'manual%' THEN content ILIKE '%transmisión manual%'`,
  '    ELSE TRUE',
  '  END)',
].join('\n')

// Anclamos en la línea del filtro precio_min (única en Buscar auto) y le anteponemos el filtro.
const ANCLA_Q = "  AND ({{ $fromAI('precio_min', 'Precio minimo en pesos. Poner 0 si no hay piso.', 'number') }} = 0 OR (metadata->>'precio')::int >= {{ $fromAI('precio_min', 'Precio minimo en pesos. Poner 0 si no hay piso.', 'number') }})"
assert(cuenta(q, ANCLA_Q) === 1, `ancla precio_min aparece ${cuenta(q, ANCLA_Q)} veces en Buscar auto, esperaba 1`)
q = q.replace(ANCLA_Q, FILTRO + '\n' + ANCLA_Q)
buscar.parameters.query = q

// ---------------------------------------------------------------- (B) Prompt ## Buscar auto: routing
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no encontré el nodo Franco (AI Agent)')
let sm = franco.parameters.options.systemMessage
assert(sm[0] === '=', 'el systemMessage no arranca con "=" (trampa 1)')
assert(cuenta(sm, 'o una transmisión (automática o manual)') === 0, 'el prompt ya tiene el routing de transmisión')

const ANCLA_SM = ', un color. Te devuelve el modelo/tipo pedido'
assert(cuenta(sm, ANCLA_SM) === 1, `ancla ## Buscar auto aparece ${cuenta(sm, ANCLA_SM)} veces, esperaba 1`)
const NEW_SM = ', un color, o una transmisión (automática o manual). Si el cliente pide por TRANSMISIÓN ("automáticos", "con caja automática", "manuales"), llamás esta herramienta con transmision=automatica o manual (y marca/modelo vacío si no nombró otro criterio): te trae TODOS los que matchean por transmisión —la transmisión sale de la ficha real, NUNCA la adivines ni la saques de memoria—, y los mostrás TODOS, sin curar ni dar "ejemplos", cerrando con el detalle de alguno o el stock completo. Te devuelve el modelo/tipo pedido'
sm = sm.replace(ANCLA_SM, NEW_SM)
franco.parameters.options.systemMessage = sm

// ---------------------------------------------------------------- post
assert(cuenta(buscar.parameters.query, "$fromAI('transmision'") === 2, 'el param transmision no quedó 2 veces (byte-idénticas)')
assert(cuenta(buscar.parameters.query, "content ILIKE '%transmisión cvt%'") === 1, 'no quedó el match de CVT')
assert(cuenta(sm, 'o una transmisión (automática o manual)') === 1, 'el routing no quedó una vez')
assert(sm[0] === '=', 'el systemMessage dejó de arrancar con "=" (trampa 1)')
assert(cuenta(sm, '# Consignación (vender tu auto)') === 1, 'se perdió/duplicó consignación (v67)')
assert(cuenta(sm, 'DESPUÉS DE DERIVAR, EL CIERRE CAMBIA') === 1, 'se perdió el fix de derivación (v68)')

console.log('✓ todas las aserciones pasan')
console.log(`  Buscar auto: +filtro transmisión (content, automatica incluye CVT). query ${q.length} chars`)
console.log(`  systemMessage: routing de transmisión en ## Buscar auto. ${sm.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
