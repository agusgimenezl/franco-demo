#!/usr/bin/env node
// Verifica los invariantes del workflow de Franco y regenera el bloque
// autogenerado de docs/franco/STATE.md.
//
//   node scripts/state-sync.mjs              # verifica y actualiza STATE.md
//   node scripts/state-sync.mjs --check      # solo verifica (sale 1 si algo falla)
//
// Los invariantes son las trampas de n8n que ya costaron semanas de diagnóstico
// equivocado. Documentarlas no alcanza: hay que poder chequearlas en un comando.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const argFile = process.argv.indexOf('--file')
// --file permite auditar un workflow ANTES de importarlo a n8n (ej. el v7 en progreso).
const WORKFLOW = argFile !== -1 ? join(ROOT, process.argv[argFile + 1]) : join(ROOT, 'franco-n8n-v62.json')
const STATE = join(ROOT, 'docs/franco/STATE.md')
const checkOnly = process.argv.includes('--check') || argFile !== -1

const C = { red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', dim: '\x1b[2m', off: '\x1b[0m' }
const problems = []
const fail = (id, msg) => problems.push(`[${id}] ${msg}`)

const wf = JSON.parse(readFileSync(WORKFLOW, 'utf8'))
const nodes = Object.fromEntries(wf.nodes.map((n) => [n.name, n]))

// ─── Invariante 1: los campos con expresiones tienen que arrancar con "="
// El systemMessage no lo tenía y sus 18 expresiones {{ }} eran texto literal.
// Franco nunca recibió los datos de empresa ni la FAQ; se atribuyó a alucinación.
for (const n of wf.nodes) {
  const sm = n.parameters?.options?.systemMessage
  if (typeof sm === 'string' && sm.includes('{{') && !sm.startsWith('=')) {
    fail('EXPR', `${n.name}: el systemMessage tiene expresiones {{ }} pero no arranca con "=" — no se van a resolver`)
  }
}

// ─── Invariante 2: queryReplacement siempre en forma array
// La forma string se parte por comas: un mensaje con coma corría $1,$2,$3 y rompía el INSERT.
for (const n of wf.nodes) {
  const qr = n.parameters?.options?.queryReplacement
  if (typeof qr === 'string' && qr && !qr.trim().startsWith('={{ [')) {
    fail('QR', `${n.name}: queryReplacement en forma string — se parte por comas. Usar ={{ [ ... ] }}`)
  }
}

// ─── Invariante 3: $fromAI con la misma key, misma descripción y tipo
// n8n falla con "Duplicate key found with different description or type".
for (const n of wf.nodes) {
  const blob = JSON.stringify(n.parameters ?? {})
  const calls = [...blob.matchAll(/fromAI\(\\?'([a-z_]+)\\?',\s*\\?'((?:[^'\\]|\\.)*)\\?',\s*\\?'(\w+)\\?'\)/g)]
  const byKey = {}
  for (const [, key, desc, type] of calls) (byKey[key] ??= new Set()).add(`${desc}|${type}`)
  for (const [key, firmas] of Object.entries(byKey)) {
    if (firmas.size > 1) fail('FROMAI', `${n.name}: $fromAI '${key}' tiene ${firmas.size} firmas distintas`)
  }
}

// ─── Invariante 4: nodos Postgres de la cadena principal devuelven siempre ≥1 fila
// Si devuelven 0, cortan el flujo y el usuario no recibe respuesta.
const CADENA = ['Contar mensajes previos', 'Leer lead (estado)']
for (const name of CADENA) {
  const n = nodes[name]
  if (!n) { fail('CHAIN', `falta el nodo "${name}" de la cadena principal`); continue }
  const q = n.parameters?.query ?? ''
  const seguro = /LEFT JOIN/i.test(q) || /COUNT\(/i.test(q) || n.alwaysOutputData === true
  if (!seguro) fail('CHAIN', `${name}: puede devolver 0 filas y cortar la cadena (usar LEFT JOIN o alwaysOutputData)`)
}

// ─── Invariante 5: resiliencia ante rate limit y parser fallido
for (const name of ['Franco (AI Agent)', 'CRM (AI Agent)']) {
  if (!nodes[name]?.retryOnFail) fail('RETRY', `${name}: sin retryOnFail — un 429 de OpenAI se traduce en dato perdido`)
}
if (nodes['Guardar mensajes (historial)']?.onError !== 'continueRegularOutput') {
  fail('ONERR', 'Guardar mensajes (historial): sin onError — un fallo acá aborta la ejecución y se lleva puesto al CRM')
}
if (nodes['Franco (AI Agent)']?.onError !== 'continueRegularOutput') {
  fail('ONERR', 'Franco (AI Agent): sin onError — si el parser falla, el chat queda colgado')
}

// ─── Datos para el bloque de estado
const tipo = (t) => wf.nodes.filter((n) => n.type === t).length
const tools = Object.entries(wf.connections).filter(([, v]) => v.ai_tool).map(([k]) => k)
const cfg = Object.fromEntries(
  (nodes.Config?.parameters?.assignments?.assignments ?? []).map((a) => [a.name, a.value]),
)
const modelos = wf.nodes
  .filter((n) => n.type === '@n8n/n8n-nodes-langchain.lmChatOpenAi')
  .map((n) => `${n.name}: ${n.parameters?.model?.value}`)

const casos = existsSync(join(ROOT, 'evals/cases.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'evals/cases.json'), 'utf8')).cases.length
  : 0
// Ordenado por NÚMERO de versión, no alfabéticamente: con .sort() a secas,
// "baseline-v11" queda antes que "baseline-v7" (compara "1" contra "7") y el bloque de
// arriba termina citando una baseline vieja como si fuera la última.
const baselines = existsSync(join(ROOT, 'evals'))
  ? readdirSync(join(ROOT, 'evals'))
      .filter((f) => f.startsWith('baseline'))
      .sort((a, b) => {
        const n = (s) => parseInt(s.match(/v(\d+)/)?.[1] ?? '0', 10)
        return n(a) - n(b)
      })
  : []
let baselineTxt = 'sin baseline guardada'
if (baselines.length) {
  const b = JSON.parse(readFileSync(join(ROOT, 'evals', baselines.at(-1)), 'utf8'))
  const ok = b.filter((r) => !r.failures.length && !r.error).length
  baselineTxt = `${baselines.at(-1)} → ${ok}/${b.length}`
}

const bloque = `<!-- AUTOGENERADO: no editar a mano. Regenerar con: node scripts/state-sync.mjs -->

**Workflow en producción:** \`${WORKFLOW.split(/[\\/]/).pop()}\` · ${wf.nodes.length} nodos

| | |
|---|---|
| Webhooks | ${tipo('n8n-nodes-base.webhook')} (auth: ${wf.nodes.find((n) => n.type === 'n8n-nodes-base.webhook')?.parameters?.authentication ?? 'ninguna'}) |
| Nodos Postgres | ${tipo('n8n-nodes-base.postgres') + tipo('n8n-nodes-base.postgresTool')} |
| Tools de Franco | ${tools.join(', ')} |
| Modelos | ${modelos.join(' · ')} |
| Ventana de memoria de Franco | ${nodes['Postgres Chat Memory']?.parameters?.contextWindowLength} |
| Empresa configurada | ${cfg.empresa_nombre} |
| Evals | ${casos} casos · ${baselineTxt} |

**Invariantes:** ${problems.length === 0 ? '✅ los 5 pasan' : `❌ ${problems.length} rotos — ver \`node scripts/state-sync.mjs --check\``}

<!-- FIN AUTOGENERADO -->`

// ─── Salida
if (problems.length) {
  console.log(`${C.red}Invariantes rotos:${C.off}`)
  for (const p of problems) console.log(`  ${C.red}✗${C.off} ${p}`)
} else {
  console.log(`${C.grn}✓ los 5 invariantes pasan${C.off}`)
}

if (!checkOnly) {
  if (!existsSync(STATE)) {
    console.log(`${C.yel}!${C.off} no existe ${STATE}, no actualizo`)
  } else {
    const txt = readFileSync(STATE, 'utf8')
    const re = /<!-- AUTOGENERADO[\s\S]*?<!-- FIN AUTOGENERADO -->/
    if (!re.test(txt)) {
      console.log(`${C.yel}!${C.off} STATE.md no tiene los marcadores AUTOGENERADO`)
    } else {
      writeFileSync(STATE, txt.replace(re, bloque))
      console.log(`${C.dim}STATE.md actualizado${C.off}`)
    }
  }
}

process.exit(problems.length ? 1 : 0)





