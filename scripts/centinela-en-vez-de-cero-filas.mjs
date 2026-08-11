// v92 -> v93 · `Listar stock` devuelve UNA FILA CENTINELA en vez de cero
//
// EL BUG QUE ARREGLA — FRANCO INVENTA STOCK, y lo causé yo con el gate de v89.
// Medido con el check nuevo `no_inventa_autos`: **1 de 8 turnos** del camino del vacío.
//   - Toyota Hilux 2018 — 85.000 km — $9.800.000   (el real: $38.000.000)
//   - Ford Ranger 2019 — 90.000 km — $9.700.000    (el real: $57.000.000)
//   - Volkswagen Amarok 2019 — 75.000 km — $9.500.000 (el real: $32.000.000)
// Tres modelos que SÍ existen, con años y precios inventados, todos justo debajo del techo de
// $10.000.000 que Franco acababa de decir. Antes había listado una "Nissan Frontier", marca que
// no existe en el stock.
//
// CAUSA, EN EL LOG — ejecución `11923`: `Listar stock` devolvió **CERO FILAS ONCE VECES SEGUIDAS**
// (23 s, 12 llamadas al modelo) por el gate de v89, y el modelo llenó el vacío. Antes de v89 la
// tool devolvía las 17 filas: no había invención, había dump. Cambié un bug por otro peor.
//
// EL ARREGLO: cuando los gates dejan el resultado vacío, la query devuelve **una fila centinela**
// con `categoria`/`tramo` = 'no_mostrar' y un `titulo` que dice qué hacer. Es el principio de la
// **trampa 4** aplicado a una tool: *nunca devolver el conjunto vacío cuando el vacío se puede
// confundir con "no hay"*. Corta el loop de reintentos Y elimina el hueco que el modelo rellena.
//
// PRUEBA VINCULANTE CONTRA LA BASE REAL (Supabase, project qfmsdgjtlduravrtqrif) — esto es lo que
// no se podía hacer antes de conectar el MCP, y por eso este cambio no se pegó a ciegas:
//   · gate CERRADO (los parámetros exactos del log 11923): antes **0 filas**, ahora **1 fila**,
//     la centinela, con `id NULL` y `categoria='no_mostrar'`.
//   · gate ABIERTO (`pidio_ver = 1`): **los autos de siempre, 0 centinelas**, todos con id.
//
// POR QUÉ NO ROMPE AGUAS ABAJO: `Armar respuesta` ya filtra las filas sin `id`
// (`.filter(r => r && r.id != null)`), así que la centinela **no puede convertirse en card ni en
// foto**. El `precio_num` queda dentro del CTE para ordenar y NO se agrega a la salida: la tool
// sigue devolviendo las mismas 16 columnas.
//
// RIESGO CONOCIDO Y CUBIERTO: que Franco copie el texto de la centinela al cliente. Por eso
// `evals/run.mjs` gana el check global `no_filtra_centinela`, que corre en TODOS los turnos.
//
// 1 NODO: `Listar stock` (Query + Description).

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v92.json'
const DESTINO = 'workflows/franco-n8n-v93.json'
export const CENTINELA = 'ESTE TURNO NO ES PARA MOSTRAR AUTOS: no listes ninguno, seguí el embudo'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const listar = wf.nodes.find((n) => n.name === 'Listar stock')
const q = listar.parameters.query

const MARCA = '\nSELECT id, titulo, precio, foto_principal, carroceria, color, anio, km,'
const FIN = '\nORDER BY u.precio_num DESC;'
if (q.split(MARCA).length !== 2) throw new Error('no encontré (una sola vez) el SELECT final')
if (!q.endsWith(FIN)) throw new Error('la query no termina en el ORDER BY esperado')

const cabeza = q.slice(0, q.indexOf(MARCA))              // los CTE
const cuerpo = q.slice(q.indexOf(MARCA) + 1, q.length - FIN.length) // SELECT final + FROM + WHERE

// El SELECT final pasa a ser el CTE `filtrado`, sumándole `precio_num` para poder ordenar
// después sin exponerlo en la salida.
const COLS = `id, titulo, precio, foto_principal, carroceria, color, anio, km,
       combustible, consumo, categoria, tramo, tamano, eco_permuta, eco_financia, eco_presu`

const nuevaQuery =
  `${cabeza},\n-- El resultado filtrado pasa por un CTE para poder detectar que quedó VACÍO y\n` +
  `-- devolver una centinela en su lugar (ver el comentario del script v92->v93).\n` +
  `filtrado AS (\n${cuerpo.replace(/\nFROM \(/, ',\n       u.precio_num\nFROM (')}\n)\n` +
  `SELECT ${COLS}\nFROM (\n  SELECT * FROM filtrado\n  UNION ALL\n` +
  `  -- CERO FILAS ES AMBIGUO: el modelo lo lee como "no hay stock" y llega a INVENTAR autos\n` +
  `  -- (medido: 1 de 8 turnos). Con una fila que dice qué hacer, no hay hueco que rellenar.\n` +
  `  SELECT NULL::int, '${CENTINELA}'::text, NULL::text, NULL::text, NULL::text, NULL::text,\n` +
  `         NULL::int, NULL::text, NULL::text, NULL::text, 'no_mostrar'::text, 'no_mostrar'::text,\n` +
  `         NULL::text, 0, 0, 0, -1\n` +
  `  WHERE NOT EXISTS (SELECT 1 FROM filtrado)\n) z\nORDER BY precio_num DESC;`

listar.parameters.query = nuevaQuery

// El toolDescription: la centinela es una instrucción, nunca contenido para el cliente.
const NOTA =
  ' Si la herramienta devuelve UNA sola fila con categoria="no_mostrar", eso NO es un auto: es una' +
  ' señal de que este turno no es para mostrar autos. En ese caso no listes nada, no menciones esa' +
  ' fila, NUNCA copies su texto al cliente y NO vuelvas a llamar a la herramienta: seguí el embudo' +
  ' con la pregunta que te falte.'
if (listar.parameters.toolDescription.includes('no_mostrar')) throw new Error('la nota ya está')
listar.parameters.toolDescription += NOTA

// ── Aserciones ──────────────────────────────────────────────────────────────
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name)
ok(JSON.stringify(distintos) === JSON.stringify(['Listar stock']),
  `esperaba UN solo nodo con diferencias; hay: ${JSON.stringify(distintos)}`)
ok(wf.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage ===
   antes.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage,
   'se tocó el systemMessage y no corresponde')

// Los 5 gates siguen enteros, y no se agregó ningún $fromAI (nada nuevo se le pregunta al modelo).
for (const gate of [
  "u.tramo = 'fuera'", "u.categoria = 'fuera'",
  "$('Config').item.json.pidio_ver }} = 0)",
  "$('Config').item.json.monto_financiar }} > 0 OR",
]) ok(nuevaQuery.includes(gate), `se perdió un gate: ${JSON.stringify(gate)}`)
const nA = (JSON.stringify(antes.nodes).match(/\$fromAI\(/g) || []).length
const nB = (JSON.stringify(wf.nodes).match(/\$fromAI\(/g) || []).length
ok(nA === nB, `cambió la cantidad de $fromAI: ${nA} -> ${nB}`)
ok(nuevaQuery.endsWith('ORDER BY precio_num DESC;'), 'la query no termina en el ORDER BY nuevo')
// La salida sigue teniendo 16 columnas: `precio_num` vive dentro de `filtrado` (para ordenar)
// y NO aparece en la lista de la salida.
ok(!COLS.includes('precio_num'), 'precio_num se filtró a la lista de salida')
const cteFiltrado = nuevaQuery.slice(nuevaQuery.indexOf('filtrado AS ('), nuevaQuery.indexOf('\nSELECT ' + COLS))
ok(cteFiltrado.includes('u.precio_num'), 'el CTE filtrado no lleva precio_num y el ORDER BY quedaría roto')
ok(COLS.split(',').length === 16, `esperaba 16 columnas de salida, hay ${COLS.split(',').length}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  único nodo con diferencias: Listar stock (Query + Description)`)
console.log(`  query: ${q.length} -> ${nuevaQuery.length} chars · $fromAI sin cambios (${nB})`)
console.log(`\n  FALTA LA PRUEBA CONTRA LA BASE: correr la query renderizada en Supabase,`)
console.log(`  gate cerrado (1 fila centinela) y gate abierto (autos, 0 centinelas).`)
