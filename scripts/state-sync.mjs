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
// Los workflows viven en workflows/, pero --file acepta tanto 'franco-n8n-v74.json'
// como una ruta relativa a la raíz: se resuelve primero tal cual, después en workflows/.
const resolveWf = (p) => {
  const asGiven = join(ROOT, p)
  return existsSync(asGiven) ? asGiven : join(ROOT, 'workflows', p)
}
// EL PUNTERO DE PRODUCCIÓN. Se edita acá, en una línea sola y con nombre propio: antes vivía
// dentro del ternario de abajo y se editaba a ciegas.
const PRODUCCION = 'franco-n8n-v131.json'
const WORKFLOW = argFile !== -1 ? resolveWf(process.argv[argFile + 1]) : join(ROOT, 'workflows', PRODUCCION)
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

// ─── Invariante 6: las inyecciones determinísticas que ya se midieron siguen ahí
// Los 5 de arriba son trampas de n8n. Éste es de otra clase y nace de un hallazgo del 2026-08-11:
// el fix determinístico del name-ask —medido de 1/7 a 7/8 en v75— DESAPARECIÓ del workflow en v77
// y estuvo perdido 53 versiones sin que nada lo notara. El caso de eval no lo cazó porque pasó a
// fallar de a poco y se lo trató como flaky.
// Un fix que se puede perder en silencio va a perderse. Acá se listan las inyecciones que ya
// costaron una medición: si alguna se cae, la próxima corrida de `--check` lo dice.
const INYECCIONES = [
  ['Config', 'estado_cliente', 'l.lead_nombre ?',
    'el name-ask determinístico (v75): sin esta rama, un cliente que acepta la derivación sin dar el nombre queda anónimo en el CRM'],
  ['Config', 'estado_cliente', 'me dejas tu nombre y apellido?',
    'el GUION concreto del name-ask (trampa 6): sin el ejemplo, la regla sola pierde'],
]
for (const [nodo, campo, aguja, porque] of INYECCIONES) {
  const asigns = nodes[nodo]?.parameters?.assignments?.assignments ?? []
  const valor = String(asigns.find((a) => a.name === campo)?.value ?? '')
  if (!valor) { fail('INYECT', `${nodo}.${campo}: no existe`); continue }
  if (!valor.includes(aguja)) {
    fail('INYECT', `${nodo}.${campo}: se perdió ${JSON.stringify(aguja)} — ${porque}`)
  }
}

// ─── Compuerta de pre-deploy: sin línea de base CON CONTROLES, un candidato no se aprueba
// POR QUÉ ES UNA COMPUERTA Y NO UNA NOTA: el 2026-08-11 esto se anotó como preferencia, se
// escribió en la memoria del proyecto, y DOS HORAS DESPUÉS se repitió igual. v128 se desplegó sin
// medir los controles, rompió `financiacion-pide-anticipo` y la regresión se descubrió con la
// versión ya en producción. Después volvió a pasar con v131. Una regla que depende de acordarse
// no es una regla.
//
// CUÁNDO CORRE: sólo con `--file`, y sólo si el archivo auditado es una versión MAYOR que la de
// producción — o sea, exactamente cuando se está por aprobar un candidato para pegar.
//
// QUÉ EXIGE: que exista `evals/baseline-<produccion>.json` y que cubra AL MENOS DOS casos
// distintos. Dos es el punto: con uno solo se mide el caso que se está arreglando y se vuelve a
// cometer el error. Los controles son la parte que se saltea.
const verNum = (s) => parseInt(String(s).match(/v(\d+)\.json$/)?.[1] ?? '0', 10)
const vCand = verNum(WORKFLOW)
const vProd = verNum(PRODUCCION)
if (argFile !== -1 && vCand > vProd && vProd > 0) {
  const baseName = PRODUCCION.replace(/\.json$/, '').replace('franco-n8n-', 'baseline-')
  const basePath = join(ROOT, 'evals', `${baseName}.json`)
  const comando = `FRANCO_URL=... node evals/run.mjs --case <caso>,<control1>,<control2> --repeat 3 --delay 45000 --json evals/${baseName}.json`
  if (!existsSync(basePath)) {
    fail('BASE', `falta la línea de base de producción (${PRODUCCION}) para aprobar v${vCand}.\n`
      + `        No hay "antes": si algo se rompe, no se va a poder atribuir. Corré:\n`
      + `        ${comando}`)
  } else {
    let ids = []
    try {
      ids = [...new Set(JSON.parse(readFileSync(basePath, 'utf8')).map((r) => r.id))]
    } catch { /* archivo ilegible: cae en el chequeo de abajo */ }
    if (ids.length < 2) {
      fail('BASE', `la línea de base ${baseName}.json cubre ${ids.length} caso(s) (${ids.join(', ') || 'ninguno'}).\n`
        + `        Hacen falta AL MENOS 2: el caso y sus controles. Medir sólo el caso objetivo es\n`
        + `        el error exacto que rompió v128. Corré:\n`
        + `        ${comando}`)
    } else {
      console.log(`${C.dim}línea de base de ${PRODUCCION}: ${ids.length} casos (${ids.join(', ')})${C.off}`)
    }
  }
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

**Invariantes:** ${problems.length === 0 ? '✅ los 6 pasan' : `❌ ${problems.length} rotos — ver \`node scripts/state-sync.mjs --check\``}

<!-- FIN AUTOGENERADO -->`

// ─── Salida
if (problems.length) {
  console.log(`${C.red}Invariantes rotos:${C.off}`)
  for (const p of problems) console.log(`  ${C.red}✗${C.off} ${p}`)
} else {
  console.log(`${C.grn}✓ los 6 invariantes pasan${C.off}`)
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





