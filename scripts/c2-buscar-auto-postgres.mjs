#!/usr/bin/env node
// C2 — "Buscar auto" deja de ser un toolVectorStore y pasa a ser un postgresTool.
//
//   node scripts/c2-buscar-auto-postgres.mjs            # escribe franco-n8n-v8.json
//   node scripts/c2-buscar-auto-postgres.mjs --check    # solo valida, no escribe
//
// POR QUÉ: el toolVectorStore no devuelve filas, se las pasa a su propio LLM que las
// resume. El `content` vectorizado NO tiene el id (armar_content() en
// revectorizar_con_consumo_v2.py no lo escribe), así que el id sólo le llegaba a Franco
// por un canal accidental: las URLs de las fotos ("foto-5-1.webp" -> 5). Medido en la
// ejecución 3626. Cuando el sumarizador omite las URLs, auto_ids sale vacío y el cliente
// ve una respuesta sin cards ni fotos (el "tipo B" de STATE.md).
//
// Todo cambio es asertado: si el JSON de entrada no es exactamente el esperado, el script
// aborta en vez de escribir algo a medias.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SRC = join(ROOT, 'franco-n8n-v7.json')
const OUT = join(ROOT, 'franco-n8n-v8.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`✗ ASERCIÓN FALLIDA: ${msg}`)
    process.exit(1)
  }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))

// ---------------------------------------------------------------- estado esperado
const byName = (n) => wf.nodes.find((x) => x.name === n)

const buscar = byName('Buscar auto')
const listar = byName('Listar stock')
assert(buscar, 'no existe el nodo "Buscar auto"')
assert(listar, 'no existe el nodo "Listar stock"')
assert(
  buscar.type === '@n8n/n8n-nodes-langchain.toolVectorStore',
  `"Buscar auto" ya no es un toolVectorStore (es ${buscar.type}) — ¿el cambio ya se aplicó?`,
)
assert(
  listar.type === 'n8n-nodes-base.postgresTool',
  '"Listar stock" no es un postgresTool: no puedo copiarle typeVersion ni credenciales',
)

// Trampa 6: la typeVersion y las credenciales NO se inventan, se copian de un nodo del
// mismo tipo que ya funciona en este workflow.
const TYPE_VERSION = listar.typeVersion
const CREDENTIALS = listar.credentials
assert(TYPE_VERSION === 2.6, `typeVersion inesperada en "Listar stock": ${TYPE_VERSION}`)
assert(
  CREDENTIALS?.postgres?.id && !/placeholder|xxx|TODO/i.test(CREDENTIALS.postgres.id),
  'la credencial postgres de "Listar stock" parece un placeholder (trampa 7: deja el workflow sin poder activarse)',
)

// Los 3 sub-nodos que sólo existían para alimentar al toolVectorStore.
const HUERFANOS = ['Supabase Vector Store', 'Embeddings OpenAI', 'OpenAI Chat Model (Tool)']
for (const n of HUERFANOS) assert(byName(n), `no existe el nodo "${n}" que se esperaba eliminar`)

// Los 3 sub-nodos forman una cadena cerrada que muere en "Buscar auto"
// (Embeddings -> Vector Store -> Buscar auto, y Chat Model (Tool) -> Buscar auto).
// Si alguno alimenta además algo FUERA de ese grupo, borrarlo rompería ese otro nodo.
const PERMITIDO = new Set([...HUERFANOS, 'Buscar auto'])
for (const [src, salidas] of Object.entries(wf.connections)) {
  if (!HUERFANOS.includes(src)) continue
  for (const [tipo, ramas] of Object.entries(salidas)) {
    for (const rama of ramas || []) {
      for (const con of rama || []) {
        assert(
          PERMITIDO.has(con.node),
          `"${src}" --${tipo}--> "${con.node}": el sub-nodo alimenta algo fuera del grupo a eliminar, no puedo borrarlo`,
        )
      }
    }
  }
}

// ---------------------------------------------------------------- la query nueva
// Mismas columnas que "Listar stock" (incluido el id, que es todo el punto) para que
// Franco reciba filas con la misma forma venga de donde venga.
//
// Trampa 3: $fromAI con la misma key necesita descripción y tipo BYTE-IDÉNTICOS en todas
// sus ocurrencias. 'precio_min' y 'precio_max' se copian textualmente de "Listar stock".
const D_MIN = 'Precio minimo en pesos. Poner 0 si no hay piso.'
const D_MAX = 'Precio maximo en pesos. Poner 0 si no hay techo.'
assert(
  listar.parameters.query.includes(`$fromAI('precio_min', '${D_MIN}', 'number')`),
  'la descripción de precio_min no coincide con la de "Listar stock" (trampa 3)',
)
assert(
  listar.parameters.query.includes(`$fromAI('precio_max', '${D_MAX}', 'number')`),
  'la descripción de precio_max no coincide con la de "Listar stock" (trampa 3)',
)

const MIN = `{{ $fromAI('precio_min', '${D_MIN}', 'number') }}`
const MAX = `{{ $fromAI('precio_max', '${D_MAX}', 'number') }}`

// El texto va SANITIZADO, no escapado: marcas y modelos son alfanuméricos ("T-Cross",
// "Gol Trend", "208"), así que sacar todo lo demás vuelve imposible la inyección y no
// pierde nada real. Escapar comillas habría dejado el mismo agujero que costó el bug de
// la coma en queryReplacement.
const TXT =
  `{{ $fromAI('marca_o_modelo', 'La marca y/o el modelo del auto que busca el cliente, ya corregido de typos (ej: Toyota Corolla, Volkswagen Amarok). Tambien vale una carroceria (pickup, SUV, sedan). Poner vacio si el cliente no nombro ninguno.', 'string')` +
  `.replace(/[^A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ \\-]/g, '').trim() }}`

const QUERY = `SELECT
  (metadata->>'id')::int AS id,
  metadata->>'marca' || ' ' || (metadata->>'modelo') || ' ' || (metadata->>'año') AS titulo,
  '$' || replace(to_char((metadata->>'precio')::bigint, 'FM999G999G999'), ',', '.') AS precio,
  metadata->>'foto_principal' AS foto_principal,
  metadata->>'carroceria' AS carroceria,
  metadata->>'condicion' AS condicion,
  (metadata->>'año')::int AS anio,
  (metadata->>'km')::text AS km,
  metadata->>'combustible' AS combustible,
  metadata->>'consumo' AS consumo
FROM autos_disponibles
WHERE
  ('${TXT}' = '' OR
   (metadata->>'marca' || ' ' || (metadata->>'modelo') || ' ' || COALESCE(metadata->>'carroceria', ''))
     ILIKE '%' || '${TXT}' || '%')
  AND (${MIN} = 0 OR (metadata->>'precio')::int >= ${MIN})
  AND (${MAX} = 0 OR (metadata->>'precio')::int <= ${MAX})
ORDER BY (metadata->>'precio')::int DESC;`

const DESC = `Busca autos del stock por marca, modelo o carroceria, y opcionalmente por rango de precio. Devuelve las filas reales de la base: id, titulo, precio ya formateado, foto_principal, carroceria, condicion, anio, km, combustible y consumo. Usala cuando el cliente pregunta por un auto o una marca puntual. El id que devuelve es el que va en auto_ids. Los datos vienen listos: usalos tal cual, no los reformatees ni inventes. Si no devuelve ninguna fila, ese auto no esta en el stock.`

// ---------------------------------------------------------------- transformación
const nuevo = {
  parameters: {
    descriptionType: 'manual',
    toolDescription: DESC,
    operation: 'executeQuery',
    query: QUERY,
    options: {},
  },
  type: 'n8n-nodes-base.postgresTool',
  typeVersion: TYPE_VERSION,
  position: buscar.position,
  id: buscar.id,
  name: buscar.name,
  credentials: CREDENTIALS,
}

wf.nodes = wf.nodes.filter((n) => !HUERFANOS.includes(n.name))
wf.nodes[wf.nodes.findIndex((n) => n.name === 'Buscar auto')] = nuevo

for (const h of HUERFANOS) delete wf.connections[h]

// ---------------------------------------------------------------- post-condiciones
const post = JSON.parse(JSON.stringify(wf))
const s = JSON.stringify(post)
for (const h of HUERFANOS) assert(!s.includes(`"${h}"`), `quedó una referencia a "${h}"`)

const b2 = post.nodes.find((n) => n.name === 'Buscar auto')
assert(b2.type === 'n8n-nodes-base.postgresTool', 'el nodo nuevo no quedó como postgresTool')
assert(b2.credentials?.postgres?.id === CREDENTIALS.postgres.id, 'el nodo nuevo perdió la credencial')
assert(/AS id/.test(b2.parameters.query), 'la query nueva no devuelve la columna id')

// La conexión que le da la tool a Franco tiene que seguir viva.
const sigueConectado = Object.values(post.connections).some((sal) =>
  Object.entries(sal).some(([tipo, ramas]) =>
    tipo === 'ai_tool' && (ramas || []).some((r) => (r || []).some((c) => c.node === 'Franco (AI Agent)')),
  ),
)
assert(post.connections['Buscar auto']?.ai_tool, '"Buscar auto" perdió su conexión ai_tool')
assert(sigueConectado, 'ningún nodo quedó conectado como ai_tool de Franco')

// Trampa 5 / volumen: el catálogo son 17 autos; la query no debe traer más columnas que
// las que ya traía "Listar stock".
assert(
  (b2.parameters.query.match(/AS /g) || []).length === 10,
  'la query nueva no tiene las 10 columnas esperadas',
)

console.log('✓ todas las aserciones pasan')
console.log(`  Buscar auto: toolVectorStore -> postgresTool (typeVersion ${TYPE_VERSION})`)
console.log(`  eliminados: ${HUERFANOS.join(', ')}`)
console.log(`  nodos: ${JSON.parse(readFileSync(SRC, 'utf8')).nodes.length} -> ${post.nodes.length}`)

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
