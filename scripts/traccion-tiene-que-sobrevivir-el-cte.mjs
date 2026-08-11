// v122 -> v123 · LA COLUMNA TIENE QUE SOBREVIVIR AL CTE
//
// DEFECTO MÍO EN v122, ENCONTRADO EN PRODUCCIÓN POR AGUSTINA. El listado de stock salió con CINCO
// autos en vez de diecisiete y con TODOS LOS KILÓMETROS INVENTADOS (Duster 98.000 cuando son
// 31.000; Ranger 70.000 cuando son 18.000; Gol Trend 30.000 cuando son 110.000). Los precios y las
// cards estaban BIEN — y esa combinación es la firma: las cards las arma `Hidratar autos`, que lee
// la base por otro lado, así que si las cards están bien y el TEXTO está mal, el texto no salió de
// la herramienta. Franco lo inventó porque no recibió datos.
//
// LA CAUSA: v122 agregó `traccion` al SELECT del CTE `base` y al SELECT final, pero el CTE
// intermedio `con_categoria` —que v118 creó con LISTA EXPLÍCITA de columnas— no la incluía.
//   base        -> produce traccion
//   marcado     -> SELECT b.*  (la conserva)
//   con_categoria -> SELECT id, titulo, ..., consumo, CASE... , tramo, precio_num   <-- LA TIRA
//   SELECT final -> ... tamano, traccion, ...                                        <-- la pide
// Postgres: ERROR 42703: column "traccion" does not exist. Reproducido en la base con una query
// mínima de la misma forma antes de escribir este fix.
// El error NO aparece como ejecución fallida en n8n: el agente se come el error de la tool y sigue,
// así que `search_executions` con status error devuelve vacío. Por eso el síntoma es "inventa" y no
// "se rompió".
//
// POR QUÉ NO LO CACÉ: en v118 rendericé la query completa y la corrí contra la base. En v122 probé
// SÓLO la expresión CASE por separado y me apoyé en asserts de reemplazo de strings. El assert
// `q.split('tamano, traccion,').length === 2` pasó —el string estaba— pero nadie verificó que la
// columna RESOLVIERA. Un assert que mira el texto y no el significado no es un assert.
//
// EL FIX ES UNA PALABRA. LO QUE IMPORTA ES EL ASSERT NUEVO: se verifica que TODA columna que el
// SELECT final le pide a `u` exista en la lista explícita de `con_categoria`. Eso habría cazado
// esto en v122 y va a cazar el próximo.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v122.json'
const DESTINO = 'workflows/franco-n8n-v123.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ls = wf.nodes.find((n) => n.name === 'Listar stock')
const qAntes = ls.parameters.query

const VIEJO = '  SELECT id, titulo, precio, foto_principal, carroceria, tamano, color, anio, km, combustible, consumo,\n'
const NUEVO = '  SELECT id, titulo, precio, foto_principal, carroceria, tamano, color, anio, km, combustible, consumo, traccion,\n'
ok(qAntes.split(VIEJO).length === 2, `esperaba la lista de con_categoria 1 vez, hay ${qAntes.split(VIEJO).length - 1}`)
const q = qAntes.replace(VIEJO, () => NUEVO)
ls.parameters.query = q

// ── EL ASSERT QUE FALTABA ───────────────────────────────────────────────────────────────────
// Toda columna que el SELECT final le pide a `u` tiene que existir en la lista explícita de
// `con_categoria`, que es la que define la forma de `u`. Esto es lo que rompió v122.
const listaCon = q.slice(q.indexOf('con_categoria AS ('), q.indexOf('en_presupuesto AS ('))
const colsCon = new Set()
for (const linea of listaCon.split('\n')) {
  const m = linea.match(/^\s*SELECT (.+),\s*$/)
  if (m) for (const c of m[1].split(',')) colsCon.add(c.trim())
  const alias = linea.match(/\bAS (\w+),?\s*$/)
  if (alias) colsCon.add(alias[1])
  const sueltas = linea.match(/^\s*(tramo, precio_num)\s*$/)
  if (sueltas) for (const c of sueltas[1].split(',')) colsCon.add(c.trim())
}
const finalSel = q.slice(q.lastIndexOf('SELECT id, titulo, precio, foto_principal'))
const pedidas = (finalSel.slice(0, finalSel.indexOf('FROM (')).match(/\b(id|titulo|precio|foto_principal|carroceria|color|anio|km|combustible|consumo|categoria|tramo|tamano|traccion|precio_num)\b/g) || [])
const faltantes = [...new Set(pedidas)].filter((c) => !colsCon.has(c))
ok(faltantes.length === 0,
  `EL SELECT FINAL PIDE COLUMNAS QUE con_categoria NO PRODUCE: ${JSON.stringify(faltantes)} — es el defecto de v122`)
// y el ORDER BY final también lee de u
ok(colsCon.has('precio_num'), '`precio_num` no sobrevive a con_categoria y el ORDER BY lo usa')

// ── Aserciones de siempre ───────────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Listar stock']),
  `esperaba SÓLO Listar stock; hay: ${JSON.stringify(distintos)}`)
const sm = wf.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage
ok(sm.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok((qAntes.match(/\$fromAI\(/g) || []).length === (q.match(/\$fromAI\(/g) || []).length,
  'TRAMPA 3: cambió la cantidad de $fromAI')
ok(q.length - qAntes.length === NUEVO.length - VIEJO.length, 'cambió algo más que el reemplazo')
ok(q.split('AS traccion,').length === 2, '`traccion` no quedó 1 vez en el CTE base')
ok(q.split('consumo, traccion,').length === 2, '`traccion` no quedó 1 vez en con_categoria')
ok(q.split('tamano, traccion,').length === 2, '`traccion` no quedó 1 vez en el SELECT final')

console.log(`  columnas de con_categoria detectadas: ${colsCon.size}`)
console.log(`  columnas que pide el SELECT final y faltan: ${faltantes.length}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Listar stock')
console.log(`  query: ${qAntes.length} -> ${q.length} chars`)
console.log('\n  FALTA LO QUE ME SALTEÉ EN v122: correr la query RENDEREADA contra la base antes de desplegar.')
