// v102 -> v103 · LA FICHA QUE YA DISTE NO TE LLEGA DE VUELTA
//
// EL BUG (captura de Agustina 2026-08-06, sesión REAL 00eb34ec, y antes la Amarok de la sesión
// b6b3ed0c). Turno 3 "me interesa el cronos y el corolla": Franco da las dos fichas completas —eso
// está BIEN—. Turno 11 "me interesa el corolla que te había dicho y el cronos": REPITE los mismos
// datos casi palabra por palabra (motor 1.3L de 99 HP, consumo 6.5 L/100km, motor 1.8L de 140 HP,
// 7.2 L/100km), con todo eso todavía en pantalla.
//
// REPRODUCIDO: `charla-real-reapertura-con-usado` (caso 85) mide 0/3 sobre v99 y el turno 11 falla
// `text_not_contains` en **3 de 3 corridas** — es el más estable de los tres bugs de esa charla.
//
// CAUSA, YA IDENTIFICADA CON EL LOG EN LA SESIÓN ANTERIOR (ejecución 12186 contra 12202): la
// variable es si el turno de seguimiento vuelve a llamar `Detalle auto`. Si la llama, recibe
// `ficha_completa` ENTERA otra vez y la recita; si no la llama, contesta en una línea.
//
// EL FIX ES LA REGLA DEL PROYECTO APLICADA AL DATO, NO AL PROMPT: **lo que no le llega, no lo
// puede recitar.** Si la ficha de ese auto ya se dio en esta conversación, `Detalle auto` devuelve
// en su lugar un aviso corto. No hay que pedirle al modelo que se acuerde de no repetir: no tiene
// qué repetir.
//
// CÓMO SE SABE QUE LA FICHA YA SE DIO, DETERMINÍSTICAMENTE: si alguna burbuja reciente de Franco
// en esta sesión contiene el CONSUMO de ese auto ("6.5 L/100km"). El consumo es el dato que sólo
// aparece cuando se dio la ficha completa — no sale en las listas de stock, que llevan km y precio.
// El `session_id` sale de `$('Config').item.json.session_id`, el mismo patrón que ya usa
// `Listar stock` con `pidio_ver` y `entrega_plata`.
//
// UN SOLO NODO: `Detalle auto` -> Query. No toca el prompt.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v102.json'
const DESTINO = 'workflows/franco-n8n-v103.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const da = wf.nodes.find((n) => n.name === 'Detalle auto')
const q = da.parameters.query

// La condición "esta ficha ya se dio", como subconsulta correlacionada con el auto de la fila.
const YA_DADA = `EXISTS (
    SELECT 1
    FROM (
      SELECT contenido FROM mensajes_demo
      WHERE session_id = '{{ $('Config').item.json.session_id }}' AND rol = 'franco'
      ORDER BY id DESC LIMIT 12
    ) r
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.contenido->'messages') = 'array'
           THEN r.contenido->'messages' ELSE '[]'::jsonb END
    ) AS b
    WHERE NULLIF(metadata->>'consumo', '') IS NOT NULL
      AND (b->>'content') LIKE '%' || (metadata->>'consumo') || '%'
  )`

const VIEJO_FICHA = "  regexp_replace(content, 'Condición: [^.]*[.] ', '', 'g') AS ficha_completa"
if (q.split(VIEJO_FICHA).length !== 2) throw new Error('no encontré (una sola vez) la columna ficha_completa')

const NUEVO_FICHA = `  -- LA FICHA QUE YA DISTE NO VUELVE (v103). Si en esta conversación ya se dio la ficha completa
  -- de este auto, en vez de mandarla otra vez va un aviso: lo que no le llega, no lo puede
  -- recitar. La señal es el CONSUMO ("6.5 L/100km"), que sólo aparece cuando se dio la ficha —las
  -- listas de stock llevan km y precio, no consumo.
  CASE WHEN ${YA_DADA}
    THEN 'YA LE DISTE LA FICHA COMPLETA DE ESTE AUTO EN ESTA MISMA CONVERSACIÓN Y SIGUE EN PANTALLA. PROHIBIDO volver a escribir su motor, HP, transmisión, consumo, kilómetros o equipamiento: repetirle lo que ya leyó le dice que no lo estás escuchando. Confirmá en UNA sola línea de qué auto se trata y su precio, y pasá al próximo paso.'
    ELSE regexp_replace(content, 'Condición: [^.]*[.] ', '', 'g')
  END AS ficha_completa,
  CASE WHEN ${YA_DADA} THEN '' ELSE metadata->>'descripcion' END AS descripcion_2`

// `descripcion` ya existe como columna aparte: se anula ahí mismo en vez de duplicarla.
const VIEJO_DESC = "  metadata->>'descripcion' AS descripcion,"
if (q.split(VIEJO_DESC).length !== 2) throw new Error('no encontré (una sola vez) la columna descripcion')

da.parameters.query = q
  .replace(VIEJO_DESC, () => `  CASE WHEN ${YA_DADA} THEN '' ELSE metadata->>'descripcion' END AS descripcion,`)
  .replace(VIEJO_FICHA, () => NUEVO_FICHA.replace(/,\n  CASE WHEN [\s\S]*AS descripcion_2$/, ''))

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Detalle auto']),
  `esperaba SOLO Detalle auto; hay: ${JSON.stringify(distintos)}`)

const qn = da.parameters.query
ok(!qn.includes('descripcion_2'), 'quedó la columna auxiliar descripcion_2')
ok(qn.split('AS ficha_completa').length === 2, 'ficha_completa falta o está duplicada')
ok(qn.split('AS descripcion,').length === 2, 'descripcion falta o está duplicada')
ok(qn.split('YA LE DISTE LA FICHA COMPLETA').length === 2, 'el aviso falta o está duplicado')
ok(qn.split(YA_DADA).length === 3, 'la condición "ya dada" tiene que aparecer 2 veces (ficha y descripción)')
// TRAMPA 3: el $fromAI de auto_id no se toca.
const fromAI = (o) => (JSON.stringify(o).match(/fromAI\(/g) || []).length
ok(fromAI(wf) === fromAI(antes), `cambió la cantidad de $fromAI: ${fromAI(antes)} -> ${fromAI(wf)}`)
ok(qn.split("$fromAI('auto_id'").length === 2, 'el $fromAI de auto_id falta o se duplicó')
// Las columnas que el front necesita siguen todas.
for (const col of ['AS id', 'AS titulo', 'AS precio', 'AS anio', 'AS km', 'AS combustible',
                   'AS consumo', 'AS carroceria', 'AS color', 'AS foto_principal', 'AS fotos',
                   'AS tamano', 'AS condicionantes']) {
  ok(qn.includes(col), `se perdió una columna de Detalle auto: ${col}`)
}
// El resto del workflow, intacto.
for (const nm of ['Listar stock', 'Buscar auto', 'Armar respuesta', 'Config', 'Leer lead (estado)', 'Franco (AI Agent)']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log('  nodos con diferencias: Detalle auto')
console.log(`  Detalle auto query: ${q.length} -> ${qn.length} chars`)
