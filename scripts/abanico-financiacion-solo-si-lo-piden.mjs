// v88 -> v89 · el abanico tampoco se dumpea por la rama de FINANCIACIÓN
//
// PRUEBA VINCULANTE — ejecución `11621`, el turno que trae las filas:
//   `Listar stock` <- tiene_permuta: 0, con_financiacion: 1, precio_objetivo: 30000000
//                  -> 17 filas (el catálogo entero)
// El gate de v85 es `NOT (tiene_permuta = 1 AND pidio_ver = 0)`: con tiene_permuta = 0 **ni se
// activa**. Es el MISMO bug que v85 cerró para permuta, por la rama que el gate no cubre.
// Con 17 filas en la mano, 3 de 4 corridas de v88 las listaron sin que se las pidan.
//
// POR QUÉ NO SE EXTIENDE A `con_financiacion = 1`, QUE ERA LO OBVIO — BARRIDO SOBRE LOS 177
// TURNOS DE LOS 78 CASOS: dejaría sin autos a **8 turnos que sí tienen que mostrarlos**
// ("tenés algo entre 14 y 20 millones?", "Quiero un auto de 20 millones o menos", "hola, tengo
// 18 millones para un auto"...). La causa es que `pidio_ver` tiene falsos negativos en los
// mensajes de PRESUPUESTO: en v85 eso era inocuo (el default deseado era preguntar), acá sería
// catálogo vacío para alguien que claramente pidió. Y además `con_financiacion` lo declara el
// MODELO, que es la familia que v83/v84 dejaron descartada por medición.
//
// EL GATE QUE SÍ PASA EL BARRIDO: se condiciona a los campos CALCULADOS de v86 y v87.
//   bloquear si  (monto_financiar > 0 OR entrega_plata > 0)  AND  pidio_ver = 0
// Sobre los 177 turnos: bloquea **3**, y **NINGUNO** de los 18 que exigen material gráfico.
// Los 3 son exactamente los turnos del bug. Verificado con las expresiones reales desplegadas.
//
// DEBILIDAD CONOCIDA, MEDIDA Y NO TAPADA: "entrego 5 millones, cuáles me entran?" da
// `pidio_ver = 0` (falso negativo del patrón de v85) y quedaría bloqueado aunque el cliente
// pidió. El síntoma sería que Franco PREGUNTA en vez de mostrar — no que diga "no hay stock",
// porque el `toolDescription` ya explica la señal de 0 filas desde v84. **No se toca
// `pidio_ver`**: su corpus de validación son 152 mensajes que no quedaron en el repo, así que
// no se puede re-validar y modificarlo a ciegas arriesgaría sus 0 falsos positivos.
//
// 1 NODO: `Listar stock` (query + toolDescription). El `systemMessage` NO se toca —
// el enforcement es duro (sin filas no hay nada que listar), que es lo que funcionó en v85 y lo
// que NO funcionó en v83.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v88.json'
const DESTINO = 'workflows/franco-n8n-v89.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const listar = wf.nodes.find((n) => n.name === 'Listar stock')
if (!listar) throw new Error('no encontré Listar stock')

// ── (1) La query: una condición más en el WHERE, gemela de la de v85 ─────────
const q = listar.parameters.query
const GATE_V85 = `  AND NOT ({{ $fromAI('tiene_permuta', 'Poner 1 si el cliente dijo que entrega un auto usado en parte de pago, 0 si no.', 'number') }} = 1 AND {{ $('Config').item.json.pidio_ver }} = 0)`
if (q.split(GATE_V85).length !== 2) throw new Error('no encontré (una sola vez) el gate de v85 en la query')

const GATE_NUEVO =
  `\n  -- Gemelo del gate de v85, para la rama de FINANCIACIÓN. Si el cliente está DANDO un dato\n` +
  `  -- de plata (declaró cuánto quiere financiar, o cuánto entrega de anticipo) y no pidió ver\n` +
  `  -- opciones, no hay nada que listar: la respuesta de ese turno es seguir el embudo.\n` +
  `  -- Se condiciona a los campos CALCULADOS, no a con_financiacion (que lo declara el modelo):\n` +
  `  -- el barrido sobre los 177 turnos de los evals muestra que con con_financiacion se quedaban\n` +
  `  -- sin autos 8 turnos que sí tienen que mostrarlos, y con estos, ninguno.\n` +
  `  AND NOT (({{ $('Config').item.json.monto_financiar }} > 0 OR {{ $('Config').item.json.entrega_plata }} > 0) AND {{ $('Config').item.json.pidio_ver }} = 0)`

listar.parameters.query = q.replace(GATE_V85, () => GATE_V85 + GATE_NUEVO)

// ── (2) El toolDescription: que Franco sepa leer las 0 filas ────────────────
// Precedente vivo: ya explica la señal de 0 filas para `precio_objetivo = 0` y para el gate de
// v85. Sin esto, Franco puede leer el vacío como "no hay stock" y decírselo al cliente.
const opts = listar.parameters.toolDescription !== undefined ? listar.parameters : listar.parameters.options
const KEY = listar.parameters.toolDescription !== undefined ? 'toolDescription' : null
if (!KEY) throw new Error('no encontré el toolDescription de Listar stock')
const desc = opts[KEY]
const NOTA =
  ' OJO: si el cliente acaba de decir cuánto quiere FINANCIAR o cuánto ENTREGA de anticipo y no' +
  ' pidió ver opciones, esta herramienta devuelve CERO filas A PROPÓSITO. Eso NO significa que no' +
  ' haya stock y no se lo digas: significa que ese turno es del embudo de financiación (te falta' +
  ' el anticipo o las cuotas), no de mostrar autos.'
if (desc.includes('CERO filas A PROPÓSITO')) throw new Error('la nota ya está')
opts[KEY] = desc + NOTA

// ── Aserciones ──────────────────────────────────────────────────────────────
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name)
ok(JSON.stringify(distintos) === JSON.stringify(['Listar stock']),
  `esperaba UN solo nodo con diferencias; hay: ${JSON.stringify(distintos)}`)

// El systemMessage NO se toca: el enforcement acá es duro, no de lenguaje.
const smA = antes.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage
const smB = wf.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage
ok(smA === smB, 'se tocó el systemMessage y no corresponde')

// El gate de v85 sigue entero y el nuevo quedó pegado después.
const qNueva = listar.parameters.query
ok(qNueva.includes(GATE_V85), 'se rompió el gate de v85')
// 2 usos: el gate de v85 y el nuevo. (Antes había 1.)
const usosAntes = antes.nodes.find((n) => n.name === 'Listar stock').parameters.query.split('pidio_ver').length - 1
const usosAhora = qNueva.split('pidio_ver').length - 1
ok(usosAntes === 1 && usosAhora === 2, `usos de pidio_ver en la query: ${usosAntes} -> ${usosAhora}, esperaba 1 -> 2`)
ok(qNueva.split('monto_financiar').length - 1 === 1, 'esperaba UN uso de monto_financiar en la query')
ok(qNueva.split('entrega_plata').length - 1 === 1, 'esperaba UN uso de entrega_plata en la query')
ok(qNueva.endsWith('ORDER BY u.precio_num DESC;'), 'la query no termina en el ORDER BY: el gate quedó mal ubicado')

// TRAMPA 2 y TRAMPA 3 sobre todo el workflow.
for (const n of wf.nodes) {
  const a = antes.nodes.find((x) => x.name === n.name)
  ok(JSON.stringify(a?.parameters?.options?.queryReplacement ?? null) ===
     JSON.stringify(n?.parameters?.options?.queryReplacement ?? null),
     `TRAMPA 2: cambió el queryReplacement de ${n.name}`)
}
const firmas = new Map()
for (const m of JSON.stringify(wf).matchAll(/\$fromAI\(\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*'([^']+)'\s*\)/g)) {
  const [todo, key] = m
  if (firmas.has(key)) ok(firmas.get(key) === todo, `TRAMPA 3: la key ${key} tiene dos firmas distintas`)
  else firmas.set(key, todo)
}
// No se agregó ningún $fromAI nuevo: el gate usa Config, no el juicio del modelo.
const nAntes = (JSON.stringify(antes).match(/\$fromAI\(/g) || []).length
const nAhora = (JSON.stringify(wf).match(/\$fromAI\(/g) || []).length
ok(nAntes === nAhora, `cambió la cantidad de \$fromAI: ${nAntes} -> ${nAhora} (el gate no debe pedirle nada al modelo)`)

// PRUEBA VINCULANTE: simular el WHERE nuevo sobre los turnos de los evals.
const campo = (n) => {
  const v = wf.nodes.find((x) => x.name === 'Config').parameters.assignments.assignments
    .find((a) => a.name === n).value
  return v.slice(v.indexOf('{{') + 2, v.lastIndexOf('}}'))
}
const mk = (n) => new Function('$', `return ${campo(n)}`)
const fP = mk('pidio_ver'), fM = mk('monto_financiar'), fE = mk('entrega_plata')
const bind = (msg, ofrecio) => (n) => n === 'Leer lead (estado)'
  ? { item: { json: { franco_ofrecio_mostrar: ofrecio, lead_entrega: 'No mencionado' } } }
  : { item: { json: { body: { content: msg } } } }
const bloquea = (msg) => {
  const pv = Math.max(fP(bind(msg, false)), fP(bind(msg, true)))
  return (fM(bind(msg, false)) > 0 || fE(bind(msg, false)) > 0) && pv === 0
}

const cases = JSON.parse(fs.readFileSync('evals/cases.json', 'utf8')).cases
const exigeMedia = (t) => (t.checks || []).some(([k, v]) =>
  (k === 'cards_min' || k === 'media_min' || k === 'images_min') && Number(v) >= 1)
let rotos = 0, bloqueados = 0, turnos = 0
for (const c of cases) for (const t of c.turns) {
  turnos++
  if (!bloquea(t.say)) continue
  bloqueados++
  if (exigeMedia(t)) { rotos++; fallas.push(`el gate deja sin autos a ${c.id}: ${JSON.stringify(t.say)}`) }
}
ok(rotos === 0, `${rotos} turnos que exigen material gráfico quedarían bloqueados`)
for (const [msg, esperado] of [
  ['Puedo entregar 5.000.000?', true],
  ['Quiero financiar 30.000.000', true],
  ['dale, mostrame qué autos me entran', false],
  ['quiero financiar 30 millones, mostrame qué opciones tengo', false],
  ['tenés algo entre 14 y 20 millones?', false],
  ['Quiero un auto de 20 millones o menos', false],
  ['tengo 12 millones en efectivo y entrego un yaris 2021 con 85mil km', false],
]) ok(bloquea(msg) === esperado, `bloquea(${JSON.stringify(msg)}) = ${bloquea(msg)}, esperaba ${esperado}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  único nodo con diferencias: Listar stock (Query + Description)`)
console.log(`  query: ${q.length} -> ${qNueva.length} chars · $fromAI sin cambios (${nAhora})`)
console.log(`  barrido: ${turnos} turnos, bloquea ${bloqueados}, y 0 de los que exigen material gráfico`)
