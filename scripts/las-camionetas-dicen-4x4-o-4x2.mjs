// v121 -> v122 · LAS CAMIONETAS DICEN 4x4 O 4x2 EN EL LISTADO
//
// PEDIDO DE AGUSTINA (2026-08-10): "en el listado de stock, se le puede sumar a las camionetas la
// aclaración de 4x4 o 4x2?".
//
// NO ES UN BUG: es una función nueva. Pero el dato YA EXISTE y el cambio es determinístico, así que
// va a SQL + una línea de formato, no a "que el modelo se acuerde".
//
// EL DATO, VERIFICADO CONTRA LA BASE (los 17, 2026-08-10):
//   Pickup : Hilux 2021 4x4 · Ranger 2024 4x4 · Amarok 2018 4x4 · S10 2022 4x2
//   El resto (13 autos): todos 4x2 — cierto, pero sin valor comercial para mostrar.
// Por eso `traccion` se expone SÓLO para Pickup: si saliera para todos, Franco terminaría colgando
// "(4x2)" a un Gol Trend, que es ruido. La carrocería la decide el dato, no el modelo.
//
// DÓNDE SE TOCA Y POR QUÉ AHÍ:
//   1. `Listar stock` — el CASE nuevo en el SELECT del CTE `base` y el campo en el SELECT final.
//      Es una columna más sobre 17 filas: costo de tokens despreciable contra el TPM (trampa 5).
//   2. El prompt, línea 68 (declarar el campo que la herramienta devuelve) y línea 115 (el formato
//      del renglón). Si el campo no se declara, es la historia de la etiqueta `fuera`.
//
// EL EJEMPLO DEL FORMATO VA SIN NÚMEROS DE ESTE STOCK, A PROPÓSITO: v120 se hizo justamente porque
// un guion con "$32.000.000" adentro era recitable palabra por palabra. Acá el sufijo se muestra
// como forma ("(4x4)"), no dentro de un renglón completo listo para copiar.
//
// NO TOCA `Buscar auto`, que matchea tracción contra `content` con ILIKE '%4x4%'. Ese acoplamiento
// está anotado en STATE y sigue igual: acá no se reescribe ningún `content`.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v121.json'
const DESTINO = 'workflows/franco-n8n-v122.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// ── 1) Listar stock ─────────────────────────────────────────────────────────────────────────
const ls = wf.nodes.find((n) => n.name === 'Listar stock')
const qAntes = ls.parameters.query

const SEL_VIEJO = "    metadata->>'tamano' AS tamano,\n"
const SEL_NUEVO = "    metadata->>'tamano' AS tamano,\n"
  + "    -- v122 · SÓLO PARA PICKUP. El dato existe en los 17, pero los 13 no-camionetas son todos\n"
  + "    -- 4x2 y decirlo es ruido; en las pickups sí distingue (3 son 4x4 y una es 4x2).\n"
  + "    CASE WHEN metadata->>'carroceria' = 'Pickup' THEN metadata->>'traccion' END AS traccion,\n"
ok(qAntes.split(SEL_VIEJO).length === 2, 'no encontré (1 vez) `tamano` en el SELECT del CTE base')
let q = qAntes.replace(SEL_VIEJO, () => SEL_NUEVO)

const FIN_VIEJO = "       combustible, consumo, categoria, tramo, tamano,"
const FIN_NUEVO = "       combustible, consumo, categoria, tramo, tamano, traccion,"
ok(q.split(FIN_VIEJO).length === 2, 'no encontré (1 vez) la lista de columnas del SELECT final')
q = q.replace(FIN_VIEJO, () => FIN_NUEVO)
ls.parameters.query = q

// ── 2) El prompt: declarar el campo y el formato del renglón ────────────────────────────────
const ag = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = ag.parameters.options.systemMessage

const DECL_VIEJO = 'Devuelve el stock con campos listos para mostrar (id, titulo, precio formateado, carroceria, tamano, anio, km, combustible, consumo) y una etiqueta `categoria` por auto'
const DECL_NUEVO = 'Devuelve el stock con campos listos para mostrar (id, titulo, precio formateado, carroceria, tamano, anio, km, combustible, consumo, traccion) y una etiqueta `categoria` por auto. `traccion` viene SÓLO en las pickups (4x4 o 4x2) y viene vacío en todo lo demás: si está vacío, no lo menciones'
ok(smAntes.split(DECL_VIEJO).length === 2, 'no encontré (1 vez) la declaración de campos de Listar stock')
let sm = smAntes.replace(DECL_VIEJO, () => DECL_NUEVO)

const FMT_VIEJO = '- Cada auto: "Modelo Año — km — Precio" (ej: "Toyota Corolla 2019 — 45.000 km — $22.000.000").'
const FMT_NUEVO = '- Cada auto: "Modelo Año — km — Precio" (ej: "Toyota Corolla 2019 — 45.000 km — $22.000.000").\n'
  + '- SI EL AUTO TRAE `traccion` (son las pickups y nada más), el renglón cierra con la tracción entre paréntesis: "Modelo Año — km — Precio (4x4)". Sale TAL CUAL del campo `traccion`, nunca de tu memoria ni de lo que suene razonable para esa camioneta: en el mismo stock puede haber pickups 4x4 y 4x2, y decirle 4x4 a una 4x2 es inventar. Si el campo viene vacío, el renglón va sin paréntesis: a un hatchback o a un sedán NO les pongas la tracción.'
ok(sm.split(FMT_VIEJO).length === 2, 'no encontré (1 vez) el formato del renglón de la lista')
sm = sm.replace(FMT_VIEJO, () => FMT_NUEVO)
ag.parameters.options.systemMessage = sm

// ── Aserciones ──────────────────────────────────────────────────────────────────────────────
ok(smAntes.startsWith('='), 'TRAMPA 1: el origen ya no arrancaba con "="')
ok(sm.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok((smAntes.match(/\{\{/g) || []).length === (sm.match(/\{\{/g) || []).length,
  'cambió la cantidad de expresiones {{ }} del prompt')
ok((qAntes.match(/\$fromAI\(/g) || []).length === (q.match(/\$fromAI\(/g) || []).length,
  'TRAMPA 3: cambió la cantidad de $fromAI')

ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Franco (AI Agent)', 'Listar stock']),
  `esperaba Franco + Listar stock; hay: ${JSON.stringify(distintos)}`)
for (const nm of ['Buscar auto', 'Detalle auto', 'Config', 'Armar respuesta']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

// El texto viejo ya no está y el nuevo quedó una sola vez.
ok(q.split('AS traccion,').length === 2, '`traccion` no quedó exactamente 1 vez en el CTE')
ok(q.split('tamano, traccion,').length === 2, '`traccion` no quedó en el SELECT final')
ok(!sm.includes(FMT_VIEJO + '\n- SIEMPRE'), 'el formato viejo quedó duplicado')

// El CASE no puede tocar el resto de la query.
ok(q.length - qAntes.length === (SEL_NUEVO.length - SEL_VIEJO.length) + (FIN_NUEVO.length - FIN_VIEJO.length),
  'cambió algo más que los dos reemplazos en el SQL')

// ── Revisión del texto ──────────────────────────────────────────────────────────────────────
const casos = []
const chk = (n, c) => { casos.push(n); if (!c) fallas.push(`texto · ${n}`) }
chk('declara el campo nuevo en la tool', /`traccion` viene SÓLO en las pickups/.test(DECL_NUEVO))
chk('dice qué hacer cuando viene vacío', /si está vacío, no lo menciones/.test(DECL_NUEVO))
chk('el formato muestra la forma del sufijo', /Precio \(4x4\)/.test(FMT_NUEVO))
chk('prohíbe deducir la tracción de memoria', /nunca de tu memoria/.test(FMT_NUEVO))
chk('avisa que en el mismo stock conviven 4x4 y 4x2', /pickups 4x4 y 4x2/.test(FMT_NUEVO))
chk('prohíbe ponerle tracción a lo que no es camioneta', /NO les pongas la tracción/.test(FMT_NUEVO))
chk('el ejemplo nuevo NO trae números de este stock (lección de v120)',
  !/32\.000\.000|57\.000\.000|39\.500\.000|38\.000\.000/.test(FMT_NUEVO))
chk('no hardcodea modelos de este stock en la regla nueva',
  !/(Hilux|Ranger|Amarok|S10)/.test(FMT_NUEVO + DECL_NUEVO))

const malas = fallas.filter((f) => f.startsWith('texto ·')).length
console.log(`  las camionetas dicen 4x4 o 4x2: ${casos.length - malas}/${casos.length}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Franco (AI Agent), Listar stock')
console.log(`  Listar stock query: ${qAntes.length} -> ${q.length} chars`)
console.log(`  systemMessage:      ${smAntes.length} -> ${sm.length} chars`)
