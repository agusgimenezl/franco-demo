#!/usr/bin/env node
// C-a1b: remover el nodo `Valuar usado`, huérfano desde a1a. Base: franco-n8n-v55.json. (2026-07-23, sesión C)
//
//   node scripts/remover-valuar-usado-huerfano.mjs [--check]
//
// POR QUÉ: a1a movió la valuación a un CTE dentro de Listar stock. El nodo `Valuar usado` quedó sin uso en
//   el prompt, PERO el log (7445/7438) muestra que Franco lo SIGUE llamando por costumbre (su toolDescription
//   dice "Usala en la permuta ANTES de armar el abanico") y su resultado se IGNORA. Es una llamada de tool
//   desperdiciada por turno de abanico = TPM de más (trampa 5, sospechoso del parser fallback). Removerlo lo
//   saca del schema de tools de Franco → no lo puede llamar → una llamada LLM menos por turno.
//
// SEGURO: `Valuar usado` sólo tiene una conexión (ai_tool -> Franco) y nadie apunta a él. La valuación NO se
//   pierde: vive COPIADA en el CTE de Listar stock (no es una referencia al nodo). 36 -> 35 nodos.
// ⚠️ PEGA A MANO Agustina + verificación byte a byte.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v55.json')
const OUT = join(ROOT, 'franco-n8n-v56.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const NAME = 'Valuar usado'

// pre-condiciones: el nodo existe, sólo sale hacia Franco, nadie lo apunta
assert(wf.nodes.some((n) => n.name === NAME), `no existe "${NAME}"`)
assert(wf.nodes.length === 36, `esperaba 36 nodos, hay ${wf.nodes.length}`)
{
  let targeted = false
  for (const [, obj] of Object.entries(wf.connections)) {
    for (const [, arr] of Object.entries(obj)) {
      for (const grp of arr) for (const conn of (grp || [])) if (conn && conn.node === NAME) targeted = true
    }
  }
  assert(!targeted, `algo apunta a "${NAME}" — no es huérfano`)
}

// remover nodo + su conexión de salida
wf.nodes = wf.nodes.filter((n) => n.name !== NAME)
delete wf.connections[NAME]

// post-condiciones
assert(wf.nodes.length === 35, `tras remover esperaba 35 nodos, hay ${wf.nodes.length}`)
assert(!wf.nodes.some((n) => n.name === NAME), 'el nodo sigue estando')
assert(!(NAME in wf.connections), 'quedó la conexión de salida')
{
  let ref = false
  for (const [, obj] of Object.entries(wf.connections)) {
    for (const [, arr] of Object.entries(obj)) {
      for (const grp of arr) for (const conn of (grp || [])) if (conn && conn.node === NAME) ref = true
    }
  }
  assert(!ref, 'quedó una referencia a Valuar usado en connections')
}
// Listar stock conserva la valuación interna (el CTE) — la lógica NO se pierde
const ls = wf.nodes.find((n) => n.name === 'Listar stock').parameters.query
assert(ls.includes('WITH usado_val AS (') && ls.includes('valores_usados_referencia') && ls.includes('power(0.88'),
  'se perdió el CTE de valuación en Listar stock')
// prompt no menciona más a Valuar usado
const m = wf.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(!m.includes('Valuar usado'), 'el prompt todavía menciona Valuar usado')

console.log('✓ todas las aserciones pasan')
console.log(`  removido "${NAME}" (nodo + conexión). Nodos: 36 -> 35. La valuación vive en el CTE de Listar stock.`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
