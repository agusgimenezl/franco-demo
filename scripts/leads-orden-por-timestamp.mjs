#!/usr/bin/env node
// LEADS ORDENADOS POR TEXTO EN VEZ DE POR FECHA — fix de SQL. Sesión 2026-08-01.
//
// PROBLEMA (reportado por Agustina como "no se generó la tarjeta del lead", MEDIDO contra el
// endpoint real el 2026-08-01): la tarjeta SÍ existía. `GET /webhook/leads` la devolvía en la
// posición 12 de 12, al fondo de la lista, así que en la pestaña de Leads quedaba invisible
// abajo de todo.
//
// ROOT CAUSE: en `Query leads` el SELECT hace
//     to_char(ultima_actualizacion, 'DD/MM/YYYY HH24:MI') AS ultima_actualizacion
// y después ordena con
//     ORDER BY ultima_actualizacion DESC
// En Postgres, un ORDER BY cuyo argumento es un nombre PELADO se resuelve primero contra las
// columnas de SALIDA (SQL estándar), no contra las de la tabla. Así que ordena el TEXTO
// "DD/MM/YYYY HH24:MI" alfabéticamente, no el timestamp. Orden observado, tal cual volvió del
// endpoint: 31/07 · 30/07 · 30/07 · 30/07 · 30/07 · 29/07 · 25/07 · 23/07 ... y **01/08 último**.
// Todo agosto se hunde debajo de julio, y el 1 de cada mes es siempre el peor caso.
//
// EVIDENCIA DE QUE ES ESTO Y NO OTRA COSA (control natural, misma base de datos, mismo momento):
// `Query sessions` (la pestaña Historial) tiene el MISMO to_char con el MISMO alias, pero ordena
// por `l.fecha_contacto` — nombre CALIFICADO con el alias de tabla, que Postgres sí resuelve
// contra la columna original. El mismo lead salía PRIMERO en Historial y ÚLTIMO en Leads. Eso es
// exactamente lo que reportó Agustina: "no aparece en Leads pero sí guardó el historial".
//
// FIX: calificar la columna en el ORDER BY (`crm_leads.ultima_actualizacion`), igual que ya hace
// `Query sessions`. No se toca el SELECT: el front sigue recibiendo la fecha ya formateada.
//
// TRAMPAS:
//   · Trampa 2 (queryReplacement array): NO se agregan parámetros; `$1` y el queryReplacement
//     quedan intactos, y se verifica que siga en forma array.
//   · Trampa 4 (>=1 fila): no aplica — `Query leads` cuelga del webhook GET /leads, no de la
//     cadena principal del chat, y ordenar no cambia la cantidad de filas.
//   · Trampa 5 (TPM): cero LLM. Es SQL puro.
//
// UN SOLO NODO, UNA SOLA LÍNEA. No toca el chat: ni Franco, ni el CRM, ni Config, ni las tools.
// Base: franco-n8n-v75.json (encadenado sobre el fix del name-ask, igual que v72->v73).
// (2026-08-01)
//
//   node scripts/leads-orden-por-timestamp.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v75.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v76.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const base = JSON.parse(readFileSync(SRC, 'utf8'))

// ---------------------------------------------------------------- Query leads
const nodo = wf.nodes.find((n) => n.name === 'Query leads')
assert(nodo, 'no encontré el nodo Query leads')
let q = nodo.parameters.query

const OLD_ORDER = 'ORDER BY ultima_actualizacion DESC;'
const NEW_ORDER = 'ORDER BY crm_leads.ultima_actualizacion DESC;'
assert(cuenta(q, OLD_ORDER) === 1, 'no encontré el ORDER BY sin calificar (¿base cambió o script ya corrido?)')
assert(cuenta(q, "to_char(ultima_actualizacion, 'DD/MM/YYYY HH24:MI') AS ultima_actualizacion") === 1,
  'no está el to_char con alias que causa el shadowing (¿base cambió?)')
assert(cuenta(q, 'FROM crm_leads') === 1, 'el FROM no es el esperado: la calificación por nombre de tabla no serviría')
// Si la tabla tuviera alias (`FROM crm_leads l`), calificar por nombre completo sería inválido
// en Postgres. Acá la línea del FROM tiene que ser exactamente `FROM crm_leads`.
assert(q.split('\n').some((l) => l.trim() === 'FROM crm_leads'),
  'crm_leads parece tener alias de tabla: calificar por nombre completo no sería válido')

q = q.replace(OLD_ORDER, NEW_ORDER)
nodo.parameters.query = q

// ---------------------------------------------------------------- post
assert(cuenta(nodo.parameters.query, NEW_ORDER) === 1, 'no quedó el ORDER BY calificado')
assert(cuenta(nodo.parameters.query, '$1') === 1, 'cambió la cantidad de parámetros (trampa 2)')
assert(nodo.parameters.options.queryReplacement.startsWith('={{ ['),
  'el queryReplacement dejó de estar en forma array (trampa 2)')
assert(nodo.parameters.query.trim().endsWith(NEW_ORDER), 'la query no termina en el ORDER BY')
// El SELECT no cambia: el front sigue recibiendo la fecha formateada.
assert(nodo.parameters.query.replace(NEW_ORDER, OLD_ORDER) === base.nodes.find((n) => n.name === 'Query leads').parameters.query,
  'cambió algo más de la query además del ORDER BY')

// El control (Query sessions) NO se toca: ya ordena bien y es la prueba de que el fix es correcto.
const sessions = wf.nodes.find((n) => n.name === 'Query sessions')
assert(cuenta(sessions.parameters.query, 'ORDER BY l.fecha_contacto DESC') === 1,
  'Query sessions ya no ordena por la columna calificada: se cae la analogía del fix')

// Ningún otro nodo puede cambiar.
for (const n of wf.nodes) {
  const b = base.nodes.find((x) => x.name === n.name)
  assert(b, `nodo nuevo inesperado: ${n.name}`)
  if (n.name === 'Query leads') continue
  assert(JSON.stringify(n) === JSON.stringify(b), `cambió el nodo ${n.name} y NO debía`)
}
assert(wf.nodes.length === base.nodes.length, 'cambió la cantidad de nodos')
assert(JSON.stringify(wf.connections) === JSON.stringify(base.connections), 'cambiaron las connections')

console.log('✓ todas las aserciones pasan')
console.log(`  Query leads: ORDER BY ultima_actualizacion -> ORDER BY crm_leads.ultima_actualizacion`)
console.log('  Query sessions (control, ya ordenaba bien): SIN CAMBIOS')
console.log('  chat (Franco / CRM / Config / tools): SIN CAMBIOS')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
