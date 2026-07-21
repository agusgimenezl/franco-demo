#!/usr/bin/env node
// No reenviar las fotos de un auto si ya se mandaron en los últimos 8 mensajes (2026-07-21).
//
//   node scripts/fotos-no-repetidas.mjs            # escribe franco-n8n-v11.json
//   node scripts/fotos-no-repetidas.mjs --check    # solo valida, no escribe
//
// POR QUÉ: "Armar respuesta" arma las imágenes desde `auto_ids` en CADA turno. Si el cliente
// sigue preguntando por el mismo auto ("cuál es el consumo?"), Franco vuelve a incluir ese id
// y las mismas 3 fotos se mandan de nuevo. Queda robótico: un vendedor real no te reenvía las
// fotos cada vez que le preguntás algo. Medido en el eval `fotos-no-repetidas`: 0/5, siempre
// 3 imágenes repetidas en el turno 2.
//
// DOS DECISIONES DE ALCANCE, las dos para no romper flujos que hoy funcionan:
//
// 1. Sólo se miran las IMÁGENES previas, no las `product_cards`. Una miniatura en una lista
//    no es lo mismo que la ficha con fotos: el flujo "mostrame el stock" -> "contame del
//    primero" TIENE que seguir mostrando las fotos del auto elegido aunque haya aparecido
//    como card. Por eso la query lee `contenido->'images'` y nada más.
//
// 2. El filtro se aplica SÓLO en la rama de imágenes (1-2 autos), nunca en la de cards
//    (3+ autos). Si no, pedir el stock después de haber visto un auto devolvería la lista
//    incompleta, con ese auto faltando.
//
// El guard de cierre sigue usando la lista COMPLETA de autos: si Franco nombró autos en el
// texto, la pregunta de cierre tiene que ir igual, se manden fotos o no.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v10.json')
const OUT = join(ROOT, 'franco-n8n-v11.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`✗ ASERCIÓN FALLIDA: ${msg}`)
    process.exit(1)
  }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => wf.nodes.find((x) => x.name === n)

const hidratar = nodo('Hidratar autos')
const armar = nodo('Armar respuesta')
assert(hidratar, 'no existe "Hidratar autos"')
assert(armar, 'no existe "Armar respuesta"')
assert(!nodo('Autos ya mostrados'), 'ya existe "Autos ya mostrados" — ¿el cambio ya se aplicó?')
assert(hidratar.credentials?.postgres?.id, '"Hidratar autos" no tiene credencial postgres para copiar')

// La cadena tiene que ser exactamente Hidratar autos -> Armar respuesta.
const salida = wf.connections['Hidratar autos']?.main
assert(
  JSON.stringify(salida) === JSON.stringify([[{ node: 'Armar respuesta', type: 'main', index: 0 }]]),
  `la salida de "Hidratar autos" no es la esperada: ${JSON.stringify(salida)}`,
)

// ---------------------------------------------------------------- 1) nodo nuevo
// Trampa 4: un nodo Postgres de la cadena principal que devuelva 0 filas corta el flujo.
// El agregado sin GROUP BY siempre devuelve exactamente 1 fila (NULL si no hay nada), y el
// COALESCE la convierte en ''. Igual va alwaysOutputData por si acaso.
// Trampa 2: queryReplacement SIEMPRE en forma array.
const QUERY = `SELECT COALESCE(string_agg(DISTINCT m[1], ','), '') AS ids_recientes
FROM (
  SELECT contenido
  FROM mensajes_demo
  WHERE session_id = $1
  ORDER BY id DESC
  LIMIT 8
) r
LEFT JOIN LATERAL regexp_matches(
  COALESCE(r.contenido->'images', '[]'::jsonb)::text, 'foto-(\\d+)-', 'g'
) AS m ON TRUE;`

const nuevo = {
  parameters: {
    operation: 'executeQuery',
    query: QUERY,
    options: {
      queryReplacement: "={{ [ $('Config').item.json.session_id ] }}",
    },
  },
  type: 'n8n-nodes-base.postgres',
  typeVersion: hidratar.typeVersion,
  position: [
    Math.round((hidratar.position[0] + armar.position[0]) / 2),
    hidratar.position[1] + 160,
  ],
  id: 'a7c1f2e8-4b3d-4c9a-8e11-fotosnorepetidas',
  name: 'Autos ya mostrados',
  alwaysOutputData: true,
  onError: 'continueRegularOutput',
  credentials: hidratar.credentials,
}
wf.nodes.push(nuevo)

// ---------------------------------------------------------------- 2) reconectar
wf.connections['Hidratar autos'].main = [[{ node: 'Autos ya mostrados', type: 'main', index: 0 }]]
wf.connections['Autos ya mostrados'] = {
  main: [[{ node: 'Armar respuesta', type: 'main', index: 0 }]],
}

// ---------------------------------------------------------------- 3) Armar respuesta
const codigo = armar.jsCode ?? armar.parameters?.jsCode
assert(typeof codigo === 'string', 'no encuentro el jsCode de "Armar respuesta"')

const ANCLA_LEER = `  const porId = new Map(filas.map(r => [Number(r.id), r]));`
assert(codigo.includes(ANCLA_LEER), 'no encuentro el armado de porId en "Armar respuesta"')

const BLOQUE_LEER = `${ANCLA_LEER}

  // Autos cuyas FOTOS ya se mandaron en los últimos 8 mensajes de esta sesión. Viene como
  // "2,5,14" desde "Autos ya mostrados"; si no hay nada, viene ''. Sólo mira \`images\`
  // previas: haber aparecido como card NO cuenta, porque ver la ficha con fotos después de
  // la miniatura es un flujo válido.
  let yaMostrados = new Set();
  try {
    const crudoIds = String($('Autos ya mostrados').first().json.ids_recientes || '');
    yaMostrados = new Set(crudoIds.split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n)));
  } catch (e) {
    // Si el nodo no devolvió nada, no filtramos: preferimos repetir una foto antes que
    // dejar al cliente sin ver el auto.
  }`

const VIEJO_MEDIA = `  let images = [];
  let product_cards = [];
  if (autos.length >= 3) {
    product_cards = autos.map(a => ({
      id: a.id, titulo: a.titulo, precio: a.precio, foto_principal: a.foto_principal,
    }));
  } else if (autos.length >= 1) {
    images = autos.flatMap(fotosDe).map(url => ({ url, after_message_index: anchor }));
  }`

const NUEVO_MEDIA = `  let images = [];
  let product_cards = [];
  if (autos.length >= 3) {
    // Las listas van completas: filtrar acá dejaría huecos en el catálogo.
    product_cards = autos.map(a => ({
      id: a.id, titulo: a.titulo, precio: a.precio, foto_principal: a.foto_principal,
    }));
  } else if (autos.length >= 1) {
    // Acá sí: si las fotos de este auto ya se mandaron hace poco, no se reenvían.
    const sinRepetir = autos.filter(a => !yaMostrados.has(Number(a.id)));
    images = sinRepetir.flatMap(fotosDe).map(url => ({ url, after_message_index: anchor }));
  }`

assert(codigo.includes(VIEJO_MEDIA), 'el bloque de images/product_cards no coincide con lo esperado')
assert(codigo.split(VIEJO_MEDIA).length === 2, 'el bloque de images/product_cards aparece más de una vez')
assert(codigo.split(ANCLA_LEER).length === 2, 'el ancla de porId aparece más de una vez')

let nuevoCodigo = codigo.replace(ANCLA_LEER, BLOQUE_LEER).replace(VIEJO_MEDIA, NUEVO_MEDIA)
assert(nuevoCodigo !== codigo, 'el reemplazo no cambió nada')

// El guard tiene que seguir mirando la lista COMPLETA, no la filtrada.
assert(
  nuevoCodigo.includes('if (autos.length >= 1 && !texto.endsWith(\'?\'))'),
  'el guard de cierre dejó de usar la lista completa de autos',
)
assert(nuevoCodigo.includes('const sinRepetir = autos.filter'), 'no quedó el filtro de fotos')
assert(
  nuevoCodigo.includes('historial: { messages: finalMsgs, images: finalImgs, product_cards },'),
  'se perdió el historial fiel (M2)',
)

if (armar.jsCode) armar.jsCode = nuevoCodigo
else armar.parameters.jsCode = nuevoCodigo

// ---------------------------------------------------------------- post-condiciones
assert(nodo('Autos ya mostrados'), 'el nodo nuevo no quedó en el workflow')
assert(
  wf.connections['Hidratar autos'].main[0][0].node === 'Autos ya mostrados',
  'Hidratar autos no quedó apuntando al nodo nuevo',
)
assert(
  wf.connections['Autos ya mostrados'].main[0][0].node === 'Armar respuesta',
  'el nodo nuevo no quedó apuntando a Armar respuesta',
)
assert(
  nuevo.parameters.options.queryReplacement.startsWith('={{ ['),
  'trampa 2: queryReplacement tiene que ir en forma array',
)

console.log('✓ todas las aserciones pasan')
console.log(`  nodo nuevo: "Autos ya mostrados" (postgres tv ${nuevo.typeVersion}, alwaysOutputData)`)
console.log('  cadena: Hidratar autos -> Autos ya mostrados -> Armar respuesta')
console.log(`  nodos: ${wf.nodes.length - 1} -> ${wf.nodes.length}`)

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
