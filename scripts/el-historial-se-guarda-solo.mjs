// v141 -> v142 · EL HISTORIAL SE GUARDA SOLO (y los evals NO entran)
//
// PEDIDO DE AGUSTINA (2026-08-12): que todas las conversaciones queden en el Historial sin apretar
// el botón de guardado, PERO que no entren las que mando yo por terminal.
//
// CÓMO ESTÁ ARMADO HOY, QUE CAMBIA EL PLANTEO: los mensajes YA se guardan siempre — cada turno
// escribe en `mensajes_demo` (nodo `Guardar mensajes (historial)`). El botón no guarda nada nuevo:
// hace `UPDATE crm_leads SET is_saved = true`, y ese flag es el que filtran el Historial y la
// pestaña de Leads (`WHERE l.is_saved = true`). O sea que lo único que hay que cambiar es cuándo
// `is_saved` nace en true. Hoy el default de la columna es `false`.
//
// QUÉ GUARDA (decisión de Agustina): las conversaciones que TIENEN ALGO, no todas. Una sesión de un
// solo "hola" o un "asdf" no entra. El umbral es determinístico y sale de la base, no del modelo:
//   · 2 o más mensajes del cliente en `mensajes_demo`, o
//   · el cliente dio su nombre real, o
//   · el lead quedó en 'Requiere asesor'.
// El botón sigue existiendo para forzar el guardado de una que no llegue al mínimo.
//
// EL TIMING ESTÁ VERIFICADO EN EL LOG, NO SUPUESTO (ejecución 16915): `Guardar mensajes (historial)`
// corre en el índice 23 y `Guardar lead` en el 27, así que cuando se evalúa la condición el mensaje
// de ESTE turno ya está en `mensajes_demo`. Por eso "2 o más" se cumple desde el 2º mensaje del
// cliente y no desde el 3º.
//
// CÓMO SE EXCLUYEN LOS EVALS, SIN HEADERS NI COLUMNAS NUEVAS: `run.mjs` pasa a prefijar su
// session_id con `eval-`, y acá se exige `session_id NOT LIKE 'eval-%'`. `session_id` es `text` en
// las tres tablas, así que el prefijo entra sin tocar tipos. La alternativa era mirar el header
// `x-franco-auth` que manda el proxy del front, pero CLAUDE.md marca ese header como delicado y
// acoplarle el guardado es pedir problemas.
//
// NUNCA DEGRADA: en el ON CONFLICT va `crm_leads.is_saved OR EXCLUDED.is_saved`. Si alguien ya
// apretó el botón —o si la conversación ya calificó antes— no se desmarca nunca.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v141.json'
const DESTINO = 'workflows/franco-n8n-v142.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antesWf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const nodo = wf.nodes.find((n) => n.name === 'Guardar lead')
ok(!!nodo, 'no está el nodo "Guardar lead"')
let q = String(nodo.parameters.query)

ok(!q.includes('is_saved'), 'la query ya toca is_saved: este cambio ya estaba aplicado')

// Se REUSAN las expresiones $fromAI tal cual están en la query (trampa 3: misma key, misma
// descripción y mismo tipo, byte por byte).
const expr = (key) => {
  const m = q.match(new RegExp('\\{\\{ String\\(\\$fromAI\\(\'' + key + '\'[\\s\\S]*?\\}\\}'))
  ok(!!m, `no pude reusar la expresión de ${key}`)
  return m ? m[0] : ''
}
const SID = expr('session_id')
const NOMBRE = expr('nombre')
const ESTADO = expr('estado')

// La condición, en SQL y con los mismos literales que ya usa el resto de la query.
const COND = `(
    -- v142 · GUARDADO AUTOMÁTICO. Determinístico y calculado de la base, no del modelo.
    -- Los evals quedan afuera por el prefijo que pone run.mjs en su session_id.
    '${SID}' NOT LIKE 'eval-%'
    AND (
      (SELECT count(*) FROM mensajes_demo WHERE session_id = '${SID}' AND rol = 'user') >= 2
      OR '${NOMBRE}' <> ''
      OR '${ESTADO}' = 'Requiere asesor'
    )
  )`

// ── 1) columna en el INSERT ───────────────────────────────────────────────────────────────────
const COLS_VIEJO = '  fecha_contacto, ultima_actualizacion, last_activity_at\n)'
const COLS_NUEVO = '  fecha_contacto, ultima_actualizacion, last_activity_at, is_saved\n)'
ok(q.split(COLS_VIEJO).length - 1 === 1, 'no encontré la lista de columnas del INSERT una sola vez')
q = q.replace(COLS_VIEJO, COLS_NUEVO)

// ── 2) valor en el VALUES ─────────────────────────────────────────────────────────────────────
// El VALUES termina con los tres now() de fecha_contacto / ultima_actualizacion / last_activity_at.
const VALS_VIEJO = /now\(\), now\(\), now\(\)\s*\)\s*ON CONFLICT/
ok(VALS_VIEJO.test(q), 'no encontré el cierre del VALUES con los tres now()')
q = q.replace(VALS_VIEJO, `now(), now(), now(), ${COND}\n)\nON CONFLICT`)

// ── 3) ON CONFLICT: nunca degrada ─────────────────────────────────────────────────────────────
const UPD_VIEJO = '  last_activity_at = now();'
const UPD_NUEVO =
  '  last_activity_at = now(),\n' +
  '  -- v142 · NUNCA DEGRADA: si ya estaba guardada (por el botón o porque ya calificó), sigue.\n' +
  '  is_saved = crm_leads.is_saved OR EXCLUDED.is_saved;'
ok(q.split(UPD_VIEJO).length - 1 === 1, 'no encontré el cierre del ON CONFLICT una sola vez')
q = q.replace(UPD_VIEJO, UPD_NUEVO)

nodo.parameters.query = q

// ── Aserciones ────────────────────────────────────────────────────────────────────────────────
ok(!q.includes(COLS_VIEJO), 'quedó la lista de columnas vieja')
ok(!/now\(\), now\(\), now\(\)\s*\)\s*ON CONFLICT/.test(q), 'quedó el VALUES viejo')
ok(!q.includes(UPD_VIEJO), 'quedó el SET viejo')
// 4 = 1 en la lista de columnas + 3 en `is_saved = crm_leads.is_saved OR EXCLUDED.is_saved`.
ok((q.match(/is_saved/g) || []).length === 4, `is_saved tiene que aparecer 4 veces, aparece ${(q.match(/is_saved/g) || []).length}`)
ok(q.includes("NOT LIKE 'eval-%'"), 'no quedó la exclusión de los evals')
ok(q.includes('crm_leads.is_saved OR EXCLUDED.is_saved'), 'no quedó la garantía de no-degradación')
ok((q.match(/mensajes_demo/g) || []).length === 1, 'la subconsulta de mensajes_demo no quedó una sola vez')

// Trampa 3 sobre el workflow entero.
const porKey = new Map()
for (const m of JSON.stringify(wf).matchAll(/\$fromAI\('([a-z_]+)', ?'((?:[^']|\\.)*?)', ?'([a-z]+)'/g)) {
  const k = m[1]
  if (!porKey.has(k)) porKey.set(k, new Set())
  porKey.get(k).add(m[2] + '|' + m[3])
}
for (const [k, v] of porKey) ok(v.size === 1, `TRAMPA 3: "${k}" tiene ${v.size} firmas distintas`)

const distintos = wf.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(antesWf.nodes[i])).map((n) => n.name)
ok(distintos.length === 1 && distintos[0] === 'Guardar lead', `tocó ${distintos.length} nodos (${distintos.join(', ')})`)
ok(wf.nodes.length === 35, `quedaron ${wf.nodes.length} nodos, tenían que ser 35`)

// Lo de v141 y v140 sigue entero.
const ls = String(wf.nodes.find((n) => n.name === 'Listar stock').parameters.query)
ok(ls.includes('falta_usado'), 'se perdió la centinela de v141')
ok(String(wf.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage).includes('La Amarok 2023 no la tengo'), 'se perdió el guion de v140')

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  nodos: ${wf.nodes.length} · con diferencias: ${distintos.join(', ')}`)
console.log('  FALTA EJECUTAR EL INSERT RENDERIZADO CONTRA LA BASE ANTES DE DESPLEGAR')
