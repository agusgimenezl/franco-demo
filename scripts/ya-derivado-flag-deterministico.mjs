#!/usr/bin/env node
// DESFASE DEL ESTADO DEL LEAD — fix determinístico (regla del proyecto: lo que se puede calcular
// determinísticamente va a SQL, no al prompt). Sesión 2026-07-31, aprobado por Agustina.
//
// PROBLEMA (medido, log 9327): `Leer lead (estado)` corre en el paso 3 de la cadena y el CRM
// escribe el lead reción DESPUÉS de `Responder a Render`. Cadena real (leída de connections):
//   Webhook -> Contar mensajes previos -> Leer lead (estado) -> Config -> Franco -> ... ->
//   Armar respuesta -> Responder a Render -> [Leer conversación (CRM) -> CRM (AI Agent) -> Guardar lead]
// => lo que Franco ve en el turno N lo escribió el CRM en el turno N-1 (o más tarde todavía si el
// CRM se comió un rate limit de gpt-4.1, que es lo que pasó en 9324-9327).
// Consecuencia: `Config.estado_cliente` NO empujaba la línea "- YA ACEPTO que lo contacte un
// asesor..." aunque la derivación ya hubiera ocurrido, y toda regla del prompt anclada en ese
// estado se quedaba sin nada sobre qué disparar.
//
// FIX: el hecho "ya derivé" NO hay que esperarlo del CRM: ya está escrito en la conversación, en
// las propias burbujas de Franco. Se calcula por SQL, igual que ya hace `Autos ya mostrados` con
// las fotos/cards de los últimos mensajes.
//   (A) `Leer lead (estado)`: se agrega la columna `ya_derivado` (bool) con una SUBCONSULTA ESCALAR
//       sobre las últimas 12 burbujas de Franco de `mensajes_demo`.
//   (B) `Config.estado_cliente`: la línea de derivación se empuja con
//       `lead_estado === 'Requiere asesor' OR ya_derivado`.
//
// VALIDACIÓN OFFLINE DEL PATRÓN (hecha ANTES de escribir esto, sobre datos reales):
// 37 burbujas de Franco que mencionan "asesor", de 11 sesiones reales de `mensajes_demo`,
// etiquetadas a mano: 11 confirmaciones de derivación / 26 ofrecimientos o menciones.
// Resultado: 11/11 verdaderos positivos, 26/26 verdaderos negativos, **0 falsos positivos y 0
// falsos negativos**. El caso trampa discrimina bien: "ya le PUEDO pasar todo a un asesor"
// (ofrecimiento) NO activa, "ya le paso todo a un asesor" (hecho) SÍ.
//
// TRAMPAS:
//   · Trampa 4 (>=1 fila): `ya_derivado` es una subconsulta ESCALAR en el SELECT list — no puede
//     cambiar la cantidad de filas. Se mantiene `FROM (SELECT 1) d LEFT JOIN crm_leads`, y el
//     COALESCE(..., false) cubre el caso "sesión sin mensajes todavía".
//   · Trampa 2 (queryReplacement array): NO se agregan parámetros, se reusa `$1`; el
//     queryReplacement sigue siendo la misma forma array `={{ [ ... ] }}`.
//   · Trampa 1 (`=` inicial): `estado_cliente` sigue arrancando con `={{`.
//   · Trampa 5 (TPM): cero llamadas nuevas a LLM. El flag es SQL puro.
//
// NO toca el systemMessage de Franco, ni el prompt del CRM, ni ninguna tool, ni columnas nuevas.
// Base: franco-n8n-v73.json (producción vigente). (2026-07-31)
//
//   node scripts/ya-derivado-flag-deterministico.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v73.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v74.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))

// ---------------------------------------------------------------- (A) Leer lead (estado)
const leer = wf.nodes.find((n) => n.name === 'Leer lead (estado)')
assert(leer, 'no encontré el nodo Leer lead (estado)')
let q = leer.parameters.query
assert(cuenta(q, 'ya_derivado') === 0, 'la query ya tiene ya_derivado (¿script ya corrido?)')
assert(cuenta(q, 'FROM (SELECT 1) d') === 1, 'no está el patrón de trampa 4 `FROM (SELECT 1) d` (¿base cambió?)')

const OLD_COL = "  COALESCE(l.estado,            'Nuevo')                   AS lead_estado\n"
assert(cuenta(q, OLD_COL) === 1, 'no encontré la última columna (lead_estado) como esperaba')

// Patrón validado offline: 37/37, 0 falsos positivos. Matchea CONFIRMACIÓN de derivación
// ("ya le paso/pasé...", "un asesor te va a contactar", "el asesor se contacta", "ya está al
// tanto"), NO ofrecimientos ("ya le PUEDO pasar", "querés que te conecte...?", "para que un
// asesor te contacte, me dejás tu nombre?").
const PATRON = '(ya le pas[oóeé]|le pas[oó] todo a un asesor|un asesor te va a contactar|un asesor se va a contactar|asesor te va a contactar|un asesor te contacta|el asesor se contacta|asesor ya est[aá] al tanto)'

const NEW_COL = OLD_COL.replace('\n', ',\n') +
  '  -- ya_derivado: el hecho "ya derivé" sale de las propias burbujas de Franco, no del CRM\n' +
  '  -- (el CRM escribe DESPUÉS de responder, así que su estado llega >=1 turno tarde).\n' +
  '  -- Subconsulta ESCALAR: no puede cambiar la cantidad de filas (trampa 4).\n' +
  '  COALESCE((\n' +
  "    SELECT bool_or(b->>'content' ~* '" + PATRON + "')\n" +
  '    FROM (\n' +
  '      SELECT contenido\n' +
  '      FROM mensajes_demo\n' +
  "      WHERE session_id = $1 AND rol = 'franco'\n" +
  '      ORDER BY id DESC\n' +
  '      LIMIT 12\n' +
  '    ) r\n' +
  '    CROSS JOIN LATERAL jsonb_array_elements(\n' +
  "      CASE WHEN jsonb_typeof(r.contenido->'messages') = 'array'\n" +
  "           THEN r.contenido->'messages' ELSE '[]'::jsonb END\n" +
  '    ) AS b\n' +
  '  ), false)                                                AS ya_derivado\n'

q = q.replace(OLD_COL, NEW_COL)
leer.parameters.query = q

// ---------------------------------------------------------------- (B) Config.estado_cliente
const cfg = wf.nodes.find((n) => n.name === 'Config')
assert(cfg, 'no encontré el nodo Config')
const ec = cfg.parameters.assignments.assignments.find((a) => a.name === 'estado_cliente')
assert(ec, 'no encontré estado_cliente en Config')
let v = ec.value
assert(v.startsWith('={{'), 'estado_cliente no arranca con "={{" (trampa 1)')

const OLD_IF = "if (l.lead_estado === 'Requiere asesor') p.push('- YA ACEPTO que lo contacte un asesor: la derivacion esta en curso, no se la vuelvas a ofrecer.');"
assert(cuenta(v, OLD_IF) === 1, 'no encontré la condición de derivación en estado_cliente como esperaba')

// n8n puede entregar el bool de Postgres como boolean o como string; se cubren ambos.
const NEW_IF = "if (l.lead_estado === 'Requiere asesor' || l.ya_derivado === true || l.ya_derivado === 't' || l.ya_derivado === 'true') p.push('- YA ACEPTO que lo contacte un asesor: la derivacion esta en curso, no se la vuelvas a ofrecer.');"

v = v.replace(OLD_IF, NEW_IF)
ec.value = v

// ---------------------------------------------------------------- post
assert(cuenta(leer.parameters.query, 'AS ya_derivado') === 1, 'no quedó la columna ya_derivado')
assert(cuenta(leer.parameters.query, 'FROM (SELECT 1) d') === 1, 'se perdió el patrón de trampa 4')
assert(leer.parameters.query.trim().endsWith('LEFT JOIN crm_leads l ON l.session_id = $1;'), 'la query no termina como debe')
assert(cuenta(leer.parameters.query, '$1') === 2, `esperaba $1 dos veces (lead + mensajes), hay ${cuenta(leer.parameters.query, '$1')}`)
assert(leer.parameters.options.queryReplacement === "={{ [ $('Webhook Render').item.json.body.session_id ] }}", 'el queryReplacement cambió (trampa 2: tiene que seguir en forma array)')
assert(cuenta(ec.value, 'l.ya_derivado') === 3, 'no quedó la condición nueva en estado_cliente')
assert(ec.value.startsWith('={{'), 'estado_cliente dejó de arrancar con "={{" (trampa 1)')
// el systemMessage de Franco NO se toca
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const base = JSON.parse(readFileSync(SRC, 'utf8'))
const francoBase = base.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco.parameters.options.systemMessage === francoBase.parameters.options.systemMessage, 'el systemMessage de Franco cambió y NO debía')

console.log('✓ todas las aserciones pasan')
console.log(`  Leer lead (estado): query ${base.nodes.find(n => n.name === 'Leer lead (estado)').parameters.query.length} -> ${leer.parameters.query.length} chars (+ columna ya_derivado)`)
console.log(`  Config.estado_cliente: +${ec.value.length - base.nodes.find(n => n.name === 'Config').parameters.assignments.assignments.find(a => a.name === 'estado_cliente').value.length} chars (la línea de derivación ahora también mira ya_derivado)`)
console.log('  systemMessage de Franco: SIN CAMBIOS')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
