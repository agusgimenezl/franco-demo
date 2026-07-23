#!/usr/bin/env node
// v43: tool `Valuar usado` — valúa el usado desde la tabla de referencia, con fallback por
// categoría. Franco deja de adivinar el valor. Base: franco-n8n-v42.json. (2026-07-23)
//
//   node scripts/valuar-usado-tool.mjs [--check]
//
// REQUISITO: correr antes scripts/valores-usados.sql en Supabase (crea valores_usados_referencia).
//
// QUÉ HACE:
//   (A) Agrega el nodo `Valuar usado` (postgresTool, mismas credenciales que Buscar auto) + su
//       conexión ai_tool al agente. La query: match exacto por marca+modelo (ILIKE, string
//       sanitizado igual que Buscar auto) → si no hay, fallback al promedio de la categoría →
//       ajuste por año (~7%/año en pesos, exponente acotado). Devuelve valor_estimado y metodo.
//   (B) Prompt pto 5/6: en vez de "estimás vos", Franco llama a Valuar usado con marca/modelo/año/
//       categoría y usa ESE valor como usado_valor en Listar stock.
//
// NO toca Listar stock ni Buscar auto (aislado, bajo riesgo para el resto de los flujos).
// ⚠️ PEGA A MANO Agustina + verificación byte a byte por MCP.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v42.json')
const OUT = join(ROOT, 'franco-n8n-v43.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => { const x = wf.nodes.find((k) => k.name === n); assert(x, `no existe "${n}"`); return x }

assert(!wf.nodes.some((n) => n.name === 'Valuar usado'), 'Valuar usado ya existe — ¿ya se aplicó?')

// ── (A) el nodo Valuar usado
// String sanitizado igual que Buscar auto (evita inyección: alfanumérico + espacio/guion).
const SAN = ".replace(/[^A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ \\-]/g, '').trim()"
const MARCA = `{{ $fromAI('usado_marca', 'La marca del auto usado que entrega el cliente (ej: Ford).', 'string')${SAN} }}`
const MODELO = `{{ $fromAI('usado_modelo', 'El modelo del auto usado que entrega el cliente (ej: Ka).', 'string')${SAN} }}`
const CAT = `{{ $fromAI('usado_categoria', 'La categoria del usado para el fallback: chico (hatchback), mediano (sedan o SUV chica), grande (SUV grande o pickup).', 'string').replace(/[^A-Za-z]/g, '').toLowerCase() }}`
const ANIO = `{{ $fromAI('usado_anio', 'El anio del auto usado que entrega el cliente (ej: 2015).', 'number') }}`

const matchExacto = `marca ILIKE '%' || '${MARCA}' || '%' AND modelo ILIKE '%' || '${MODELO}' || '%'`

const query =
  `SELECT\n` +
  `  round(\n` +
  `    COALESCE(\n` +
  `      (SELECT valor_ref_2020 FROM valores_usados_referencia\n` +
  `        WHERE ${matchExacto}\n` +
  `        ORDER BY valor_ref_2020 DESC LIMIT 1),\n` +
  `      (SELECT avg(valor_ref_2020) FROM valores_usados_referencia WHERE categoria = '${CAT}'),\n` +
  `      0\n` +
  `    ) * power(0.93, GREATEST(LEAST(2020 - ${ANIO}, 20), -5))\n` +
  `  )::bigint AS valor_estimado,\n` +
  `  CASE WHEN EXISTS (SELECT 1 FROM valores_usados_referencia WHERE ${matchExacto})\n` +
  `       THEN 'exacto' ELSE 'por categoria' END AS metodo;`

const valuar = {
  parameters: {
    descriptionType: 'manual',
    toolDescription:
      'Devuelve una estimacion de referencia del valor de mercado del usado que entrega el cliente, en pesos. ' +
      'Pasale usado_marca, usado_modelo, usado_anio y usado_categoria (chico/mediano/grande). Si el modelo esta en ' +
      'la tabla usa su valor; si no, usa el promedio de la categoria (campo metodo dice cual fue). Usala en la permuta ' +
      'ANTES de armar el abanico: el valor que devuelve va como usado_valor en Listar stock. Es preliminar y de ' +
      'referencia: la tasacion final la hace un asesor.',
    operation: 'executeQuery',
    query,
    options: {},
  },
  type: 'n8n-nodes-base.postgresTool',
  typeVersion: 2.6,
  position: [99552, 13260],
  id: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  name: 'Valuar usado',
  credentials: { postgres: { id: 'OGgik8tnVeOMytiu', name: 'Postgres account demo' } },
}
wf.nodes.push(valuar)
wf.connections['Valuar usado'] = { ai_tool: [[{ node: 'Franco (AI Agent)', type: 'ai_tool', index: 0 }]] }

// ── (B) prompt
const franco = nodo('Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
const EXPR_ANTES = (m.match(/\{\{/g) || []).length

const OLD_B1 = 'Con los 4, estimás vos un valor de mercado preliminar del usado y lo pasás como usado_valor,'
const NEW_B1 = 'Con los 4, llamás a Valuar usado (marca, modelo, año y categoría chico/mediano/grande del usado) y el valor que te devuelve lo pasás como usado_valor a Listar stock — NO lo estimes de tu cabeza,'
unaVez(m, OLD_B1, 'prompt (pto 5, pasar usado_valor)')
m = m.replace(OLD_B1, NEW_B1)

const OLD_6 = '6. La estimación preliminar del usado la usás para armar el abanico (usado_valor), pero NO se la afirmás al cliente como un valor cerrado ni prometas que "con eso te alcanza seguro": aclarás que es preliminar y de referencia, y que la tasación real la hace el asesor al inspeccionar el auto.'
const NEW_6 = '6. El valor del usado sale de Valuar usado (referencia de mercado), NO lo inventás vos. Ese valor lo usás para armar el abanico, pero NO se lo afirmás al cliente como un valor cerrado ni prometas que "con eso te alcanza seguro": es preliminar y de referencia, y la tasación real la hace el asesor al inspeccionar el auto.'
unaVez(m, OLD_6, 'prompt (pto 6)')
m = m.replace(OLD_6, NEW_6)

franco.parameters.options.systemMessage = m

// ── post-condiciones
assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES, 'cambió el número de expresiones {{ }} del prompt (no debía)')
assert((m.match(/Valuar usado/g) || []).length === 2, 'Valuar usado no quedó referenciado 2 veces en el prompt')
assert(!m.includes('estimás vos un valor de mercado preliminar'), 'quedó la instrucción vieja de estimar')
assert(m.includes('DESLINDE obligatorio'), 'se perdió el deslinde de v42')

// nodo y conexión
assert(wf.nodes.filter((n) => n.name === 'Valuar usado').length === 1, 'el nodo no quedó (o duplicado)')
assert(wf.connections['Valuar usado']?.ai_tool?.[0]?.[0]?.node === 'Franco (AI Agent)', 'falta la conexión ai_tool al agente')
assert(nodo('Valuar usado').type === 'n8n-nodes-base.postgresTool', 'tipo de nodo incorrecto')
assert(nodo('Valuar usado').credentials.postgres.id === 'OGgik8tnVeOMytiu', 'credenciales incorrectas')

// Listar stock y Buscar auto intactos
const lsQ = nodo('Listar stock').parameters.query
assert(lsQ.includes('END AS tramo') && lsQ.includes('* 0.70'), 'se tocó Listar stock (no debía)')
assert(nodo('Buscar auto').parameters.query.includes("metadata->>'color' ILIKE"), 'se tocó Buscar auto (no debía)')

// Trampa 3 sobre todo el workflow
const porKey = new Map()
for (const n of wf.nodes) {
  for (const mm of String(n.parameters?.query ?? '').matchAll(/\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g)) {
    const [, key, desc, tipo] = mm
    const firma = `${desc}||${tipo}`
    if (porKey.has(key)) assert(porKey.get(key) === firma, `trampa 3: la key '${key}' tiene firmas distintas`)
    else porKey.set(key, firma)
  }
}
for (const k of ['usado_marca', 'usado_modelo', 'usado_categoria', 'usado_anio']) assert(porKey.has(k), `${k} no quedó registrada`)

console.log('✓ todas las aserciones pasan')
console.log(`  (A) nodo Valuar usado agregado (${wf.nodes.length} nodos) + conexión ai_tool`)
console.log('  (B) prompt: Franco consulta Valuar usado en vez de estimar (ptos 5 y 6)')
console.log(`  trampa 3: ${porKey.size} keys $fromAI, todas con firma única`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
