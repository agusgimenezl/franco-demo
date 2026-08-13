// v142 -> v143 · NINGÚN PARÁMETRO DE UNA TOOL PUEDE MATAR EL TURNO. CERO `required`.
//
// EL BUG (captura de Agustina, 23:00 UTC): "Hola! Me dirías que tenes 2021 en adelante?" -> fallback,
// dos veces seguidas. Log (ejecución 16963): `Received tool input did not match expected schema
// ✖ Required → at tiene_permuta`.
//
// ES MI ERROR, Y ESTÁ DOCUMENTADO COMO DECISIÓN: en v141 dejé `tiene_permuta` obligatorio a
// propósito, razonando que un default de 0 podría tragarse una permuta EN SILENCIO y que eso era
// peor que un error ruidoso. **La jerarquía estaba al revés.** El error ruidoso NO es ruidoso para
// el cliente: mata el turno entero y le contesta "se me trabó el sistema". El 0 silencioso sólo
// degrada una rama (no se valúa el usado) y el cliente igual recibe una respuesta.
//
// LA REGLA QUE QUEDA, Y AHORA ES UN INVARIANTE, NO UN CRITERIO: en las tools que Franco llama para
// LEER, **ningún parámetro puede ser required**. No hay excepción que valga, porque el costo de
// equivocarse no es simétrico: un parámetro faltante rechaza la llamada ENTERA y se lleva puesto el
// turno. La validación de que un dato esté completo va en la SQL (como la centinela de v141), donde
// falla de forma recuperable.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v142.json'
const DESTINO = 'workflows/franco-n8n-v143.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antesWf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const nodo = wf.nodes.find((n) => n.name === 'Listar stock')
ok(!!nodo, 'no está el nodo "Listar stock"')
let q = String(nodo.parameters.query)

const re = /\$fromAI\('tiene_permuta', '([^']*)', '([a-z]+)'\)/g
const antes = [...q.matchAll(re)]
ok(antes.length === 10, `tiene_permuta: esperaba 10 ocurrencias sin default, encontré ${antes.length}`)
ok(new Set(antes.map((m) => m[1] + '|' + m[2])).size === 1, 'tiene_permuta ya tenía firmas distintas (trampa 3)')
q = q.replace(re, (m0, desc, tipo) => `$fromAI('tiene_permuta', '${desc}', '${tipo}', 0)`)
ok(!/\$fromAI\('tiene_permuta', '[^']*', '[a-z]+'\)/.test(q), 'quedó alguna ocurrencia SIN default')
nodo.parameters.query = q

// `Detalle auto`: `auto_id` es el otro que puede matar el turno de Franco si el modelo lo omite.
// Neutro 0 = "no me dijo cuál": la query no devuelve filas, que es un estado que la cadena ya
// maneja, en vez de rechazar la llamada entera.
const det = wf.nodes.find((n) => n.name === 'Detalle auto')
ok(!!det, 'no está el nodo "Detalle auto"')
let qd = String(det.parameters.query)
const reId = /\$fromAI\('auto_id', '([^']*)', '([a-z]+)'\)/g
const antesId = [...qd.matchAll(reId)]
ok(antesId.length >= 1, `auto_id: no encontré ocurrencias sin default`)
ok(new Set(antesId.map((m) => m[1] + '|' + m[2])).size === 1, 'auto_id ya tenía firmas distintas (trampa 3)')
qd = qd.replace(reId, (m0, desc, tipo) => `$fromAI('auto_id', '${desc}', '${tipo}', 0)`)
det.parameters.query = qd

// ── LA GARANTÍA: CERO `required` EN TODO EL WORKFLOW ──────────────────────────────────────────
// Un $fromAI con 3 argumentos es required. Después de esto no puede quedar ninguno.
// Alcance: las tools que llama FRANCO. `Guardar lead` es del agente CRM y corre en otra rama — si
// se rechaza se pierde ese lead, pero la respuesta al cliente sale igual. Es otro riesgo y otro fix.
const LECTURA = ['Listar stock', 'Buscar auto', 'Detalle auto']
const requeridos = []
for (const n of wf.nodes.filter((x) => LECTURA.includes(x.name))) {
  for (const m of JSON.stringify(n.parameters).matchAll(/\$fromAI\('([a-z_]+)', ?'(?:[^']|\\.)*?', ?'[a-z]+'\)/g)) requeridos.push(`${n.name}.${m[1]}`)
}
ok(requeridos.length === 0, `quedaron required en las tools de lectura: ${[...new Set(requeridos)].join(', ')}`)

// Trampa 3 sobre el workflow entero.
const porKey = new Map()
for (const m of JSON.stringify(wf).matchAll(/\$fromAI\('([a-z_]+)', ?'((?:[^']|\\.)*?)', ?'([a-z]+)'/g)) {
  if (!porKey.has(m[1])) porKey.set(m[1], new Set())
  porKey.get(m[1]).add(m[2] + '|' + m[3])
}
for (const [k, v] of porKey) ok(v.size === 1, `TRAMPA 3: "${k}" tiene ${v.size} firmas distintas`)

const distintos = wf.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(antesWf.nodes[i])).map((n) => n.name)
ok(distintos.length === 2 && distintos.includes('Listar stock') && distintos.includes('Detalle auto'), `tocó ${distintos.length} nodos (${distintos.join(', ')})`)
ok(wf.nodes.length === 35, `quedaron ${wf.nodes.length} nodos`)
ok(q.includes('falta_usado'), 'se perdió la centinela de v141')
ok(String(wf.nodes.find((n) => n.name === 'Guardar lead').parameters.query).includes("NOT LIKE 'eval-%'"), 'se perdió el guardado automático de v142')
ok(String(wf.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage).includes('La Amarok 2023 no la tengo'), 'se perdió el guion de v140')

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO} · nodos ${wf.nodes.length} · tocó: ${distintos.join(', ')}`)
console.log('  parámetros required en TODO el workflow: 0')
