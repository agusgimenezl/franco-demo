// v143 -> v144 · `Detalle auto` SIN id DEVUELVE UNA CENTINELA, NO CERO FILAS EN SILENCIO
//
// EL BUG, MEDIDO: `hatchback-que-entra-no-se-silencia` cayó 3/3 (v141) -> 1/3 (v143), y el check que
// dispara es `text_not_matches: matcheó /hatchback[^.]{0,45}no (tengo|hay...)/`. O sea: **Franco
// niega stock que existe**, que es el peor síntoma posible en la demo.
//
// LA CAUSA ES EL FIX ANTERIOR: en v143 le puse neutro a `auto_id` para que un id faltante no matara
// el turno. Correcto, pero incompleto: con `auto_id = 0` la query no matchea ningún auto y devuelve
// **cero filas en silencio**, y el modelo lee ese vacío como "no hay". Cambié un error fatal por uno
// silencioso — exactamente lo que v141 ya había resuelto bien en `Listar stock` con la centinela, y
// lo que el centinela de v93 documenta desde hace 50 versiones: *nunca devolver el conjunto vacío
// cuando el vacío se puede confundir con "no hay"*.
//
// EL ARREGLO: si `auto_id <= 0`, sale UNA fila con `id NULL` y un texto que dice qué hacer.
// `Armar respuesta` ya filtra las filas sin id, así que no puede volverse card ni foto, y el
// `titulo` arranca con la frase que el check global `no_filtra_centinela` vigila.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v143.json'
const DESTINO = 'workflows/franco-n8n-v144.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antesWf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const det = wf.nodes.find((n) => n.name === 'Detalle auto')
ok(!!det, 'no está el nodo "Detalle auto"')
let q = String(det.parameters.query)

// La expresión de auto_id, reusada tal cual (trampa 3).
const mId = q.match(/\{\{ \$fromAI\('auto_id'[^}]*\}\}/)
ok(!!mId, 'no pude reusar la expresión de auto_id')
const ID = mId ? mId[0] : ''

const FIN_VIEJO = `FROM autos_disponibles
WHERE (metadata->>'id')::int = ${ID};`
ok(q.split(FIN_VIEJO).length - 1 === 1, 'no encontré el WHERE final una sola vez')

// Las 17 columnas del SELECT, en orden. `fotos` es jsonb, `id` y `anio` son int, el resto text.
const FIN_NUEVO = `FROM autos_disponibles
WHERE (metadata->>'id')::int = ${ID}
UNION ALL
-- v144 · UNA FILA EN VEZ DE CERO. Sin id no se puede saber de qué auto habla, y el conjunto vacío
-- lo lee el modelo como "no hay": en v143 eso hizo que negara stock que existe.
SELECT NULL::int,
       'ESTE TURNO NO ES PARA MOSTRAR AUTOS: no me llego el id del auto'::text,
       NULL::text, NULL::text, NULL::int, NULL::text, NULL::text, NULL::text, NULL::text,
       NULL::text, NULL::text, NULL::jsonb, NULL::text, NULL::text, NULL::text, NULL::text,
       'NO TE LLEGO EL ID DEL AUTO, asi que esta respuesta NO dice nada sobre el stock. PROHIBIDO decir que no tenes ese auto o que no hay stock: no lo sabes. Volve a llamar a "Listar stock" o "Buscar auto" para conseguir el id, o preguntale al cliente cual de los autos que le mostraste le interesa. Nunca le copies este texto al cliente.'::text
WHERE ${ID} <= 0;`

q = q.replace(FIN_VIEJO, FIN_NUEVO)
det.parameters.query = q

ok(!q.includes(FIN_VIEJO), 'quedó el WHERE final viejo')
ok(q.includes('ESTE TURNO NO ES PARA MOSTRAR AUTOS'), 'no quedó la centinela')
ok(!/\$fromAI\('auto_id', '[^']*', '[a-z]+'\)/.test(q), 'auto_id volvió a quedar REQUIRED')

// La garantía de v143 sigue: cero required en las tools de lectura.
const req = []
for (const n of wf.nodes.filter((x) => ['Listar stock', 'Buscar auto', 'Detalle auto'].includes(x.name))) {
  for (const m of JSON.stringify(n.parameters).matchAll(/\$fromAI\('([a-z_]+)', ?'(?:[^']|\\.)*?', ?'[a-z]+'\)/g)) req.push(`${n.name}.${m[1]}`)
}
ok(req.length === 0, `quedaron required: ${req.join(', ')}`)

const distintos = wf.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(antesWf.nodes[i])).map((n) => n.name)
ok(distintos.length === 1 && distintos[0] === 'Detalle auto', `tocó ${distintos.length} nodos (${distintos.join(', ')})`)
ok(wf.nodes.length === 35, `quedaron ${wf.nodes.length} nodos`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}
fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO} · tocó: ${distintos.join(', ')}`)
