// v117 -> v118 · EL CHICO QUE ENTRA NO SE SILENCIA
//
// BUG 1, turno 2 del caso `chico-no-es-utilitario`. EL DIAGNÓSTICO DE v117 ERA INCOMPLETO Y ESTE
// SCRIPT LO CORRIGE CON EL LOG EN LA MANO, no razonando sobre el código.
//
// LO QUE SE CREÍA: que faltaba un gate de tamaño en el SQL de `Listar stock`.
// LO QUE DICE LA EJECUCIÓN 14658 (la MISMA en la que `Franco (AI Agent)` escribió el texto del
// Kangoo, así que no es la trampa 7 — lo escribió el modelo, no `Armar respuesta`):
//   entrada de la tool: precio_objetivo=20000000, anio_min=2021 → devolvió 13 filas
//   y entre ellas    : Toyota Etios 2021 · $14.500.000 · tamano=chico · categoria='economica'
// O SEA: EL ETIOS SÍ LE LLEGÓ, con el tamaño correcto y entrando en el presupuesto. No faltaba
// el dato ni faltaba el filtro.
//
// LO QUE LO EXCLUYÓ FUE LA ETIQUETA DE PRECIO, NO LA DE TAMAÑO. Con capital 20M el CASE de
// `categoria` manda al Etios a 'economica' (precio < capital * 0.90 = 18M), y la línea 125 del
// prompt dice, textual: "Las economica NO se ofrecen". Silenciado el Etios, el único 'entra' que
// le quedaba era el Kangoo ($18,5M, mediano) y la línea 122 ("recomendás 2 a 5 de los entra") le
// ganó a la 155 ("un mediano NO es una respuesta a algo chico"). Franco obedeció el prompt.
// El "el Etios queda por encima de los 20 millones" es la verbalización de un auto que tenía
// prohibido ofrecer — y es falso, sale $14.500.000.
//
// MEDIDO EN LOS 3 REPEATS DE ESA VENTANA: 2 de 3 silencian el Etios (sesiones 7501adc4 y
// 8d8fed95); la única correcta (89f55764) lo nombra. El defecto es de ~2/3, no de 3/3.
//
// POR QUÉ EL GATE DE TAMAÑO SOLO NO ALCANZABA: sacar al Kangoo del SQL deja al Etios igual de
// silenciado, y la respuesta pasa a "los chicos se te pasan un poco" con un chico de $14,5M en el
// payload. El check viejo del turno 2 sólo prohibía "kangoo", así que ESO HABRÍA DADO VERDE con el
// bug vivo. Por eso el caso se afiló ANTES (exige el Etios por nombre) y la línea de base con los
// checks nuevos sobre v117 vivo es **1/3**, con `text_matches etios` en rojo.
//
// EL CAMBIO, EN UNA LÍNEA: cuando el cliente pide por un criterio que NO es el precio, el auto que
// CUMPLE el criterio y le entra al bolsillo deja de estar silenciado, y el que NO lo cumple deja de
// competir por el lugar de "recomendado".
//
// DOS DECISIONES DE DISEÑO QUE VALE LA PENA DEJAR ESCRITAS:
//
// 1. NO SE FILTRA NINGUNA FILA: se REETIQUETA. Las 13 filas siguen siendo 13. La trampa 4 (cero
//    filas = Franco no contesta) queda esquivada POR CONSTRUCCIÓN, no por cuidado. Hay un assert.
//
// 2. SE PROMUEVE UNO SOLO: el MÁS CARO que cumple el criterio y entra en el presupuesto. Promover
//    todos los 'economica' que cumplen despertaría también al Gol Trend ($9,2M) y al Fiesta ($8,2M)
//    para un cliente con 20M — que es LITERALMENTE el caso que la línea 125 fue escrita para evitar
//    ("el que va a poner 20 millones no quiere que le muestres uno de 9"). La protección de gama se
//    conserva entera; lo único que cambia es que deja de tapar la ÚNICA respuesta correcta.
//
// EL DETECTOR ES DETERMINÍSTICO Y VA EN `Config`, HERMANO DE `carroceria_pedida`, con su misma
// forma (regex sobre el mensaje). NO es un `$fromAI` nuevo: eso lo dejaría en manos del modelo
// —como `tiene_permuta`, que STATE marca justamente como señal NO determinística— y además cada
// `$fromAI` nuevo es superficie para la trampa 3.
//
// EL MECANISMO ES GENÉRICO POR CRITERIO AUNQUE HOY SÓLO SE CABLEE EL TAMAÑO. El mismo silencio
// existe en la dimensión CARROCERÍA (verificado: `Listar stock` no filtra por carrocería, y
// `carroceria_pedida` sólo alimenta 4 inyecciones del prompt), pero NO hay caso de eval que lo
// mida, y la regla dice que el bug falla primero. v119 lo cablea sin tocar el SQL.
//
// LO QUE NO HACE, A PROPÓSITO: no toca la línea 125, no toca el umbral 0.90, no toca `Armar
// respuesta`, y no recorta el prompt. Cada línea de ese prompt pagó un bug medido.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v117.json'
const DESTINO = 'workflows/franco-n8n-v118.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// ─────────────────────────────────────────────────────────────────────────────
// 1) Config · el detector determinístico, hermano de `carroceria_pedida`
// ─────────────────────────────────────────────────────────────────────────────
const cfg = wf.nodes.find((n) => n.name === 'Config')
const asigs = cfg.parameters.assignments.assignments
const iCarr = asigs.findIndex((a) => a.name === 'carroceria_pedida')
ok(iCarr !== -1, 'no encontré carroceria_pedida en Config (el hermano del que copio la forma)')
ok(!asigs.some((a) => a.name === 'tamano_pedido'), 'tamano_pedido ya existía en Config')

// Negación mirando ATRÁS del match ("no muy grande", "nada grande") para no invertir el criterio.
// El orden importa: grande antes que chico, para que "chico pero no muy grande" caiga en chico.
const DETECTOR = `={{ (() => {
  const t = String($('Webhook Render').item.json.body.content || '').toLowerCase();
  const G = /\\b(grandes?|amplio|espacios[oa]s?)\\b/;
  const M = /\\b(median[oa]s?)\\b/;
  const C = /\\b(chic[oa]s?|peque[nñ][oa]s?|compact[oa]s?)\\b/;
  const neg = /\\b(no|nada|ni|tampoco)\\b[^.,;!?]{0,20}$/;
  const pide = (re) => { const m = t.match(re); return !!m && !neg.test(t.slice(0, m.index)); };
  const r = pide(G) ? 'grande' : pide(M) ? 'mediano' : pide(C) ? 'chico' : '';
  return r.replace(/[^a-z]/g, '');
})() }}`

asigs.splice(iCarr + 1, 0, {
  id: 'a32-tamano-pedido',
  name: 'tamano_pedido',
  value: DETECTOR,
  type: 'string',
})

// ─────────────────────────────────────────────────────────────────────────────
// 2) Listar stock · promover el que cumple, reetiquetar el que no
// ─────────────────────────────────────────────────────────────────────────────
const ls = wf.nodes.find((n) => n.name === 'Listar stock')
const qAntes = ls.parameters.query

const A_CAT = 'END AS categoria,'
const A_ENP = '),\nen_presupuesto AS ('
const A_SEL = 'en_presupuesto AS (\n  SELECT * FROM base'
const A_UNI = 'SELECT * FROM base WHERE NOT EXISTS (SELECT 1 FROM en_presupuesto)'
for (const [nm, a] of [['categoria', A_CAT], ['en_presupuesto', A_ENP], ['select base', A_SEL], ['union base', A_UNI]]) {
  ok(qAntes.split(a).length === 2, `el ancla SQL "${nm}" no aparece exactamente 1 vez`)
}

// El orden de columnas de `base` se respeta EXACTO: el UNION ALL de abajo lo exige.
const CTE_NUEVAS = `),
-- v118 · EL CRITERIO NO-PRECIO NO PUEDE QUEDAR SILENCIADO POR LA ETIQUETA DE GAMA.
-- Medido en la ejecución 14658: el Etios (chico, $14.500.000) le llegó a Franco etiquetado
-- 'economica' —porque 14,5M < 20M*0,90— y la línea 125 del prompt prohíbe ofrecer las 'economica'.
-- Resultado: el único 'entra' que quedaba era un utilitario mediano. NO SE FILTRA NADA ACÁ: se
-- reetiqueta. Las filas que entran son las mismas que salen, así que la trampa 4 no aplica.
criterio AS (
  SELECT lower(trim('{{ $('Config').item.json.tamano_pedido }}')) AS tamano_pedido
),
marcado AS (
  SELECT b.*,
    ((SELECT tamano_pedido FROM criterio) <> '' AND lower(COALESCE(b.tamano, '')) = (SELECT tamano_pedido FROM criterio)) AS cumple_tam,
    -- El MÁS CARO que cumple el criterio Y entra en el presupuesto. Uno solo: promover todos los
    -- 'economica' que cumplen le pondría un auto de 9 millones adelante a un cliente de 20.
    row_number() OVER (
      PARTITION BY ((SELECT tamano_pedido FROM criterio) <> '' AND lower(COALESCE(b.tamano, '')) = (SELECT tamano_pedido FROM criterio) AND b.categoria_base = 'economica')
      ORDER BY b.precio_num DESC
    ) AS rk_tam
  FROM base b
),
con_categoria AS (
  SELECT id, titulo, precio, foto_principal, carroceria, tamano, color, anio, km, combustible, consumo,
    CASE
      -- 'fuera' NO se toca NUNCA: hay tres gates aguas abajo que dependen de esa etiqueta exacta.
      WHEN categoria_base = 'fuera' THEN 'fuera'
      WHEN (SELECT tamano_pedido FROM criterio) = '' THEN categoria_base
      WHEN NOT cumple_tam THEN 'otro_tamano'
      WHEN categoria_base = 'economica' AND rk_tam = 1 THEN 'entra'
      ELSE categoria_base
    END AS categoria,
    tramo, precio_num
  FROM marcado
),
en_presupuesto AS (`

const q = qAntes
  .replace(A_CAT, () => 'END AS categoria_base,')
  .replace(A_ENP, () => CTE_NUEVAS)
  .replace(A_SEL, () => 'en_presupuesto AS (\n  SELECT * FROM con_categoria')
  .replace(A_UNI, () => 'SELECT * FROM con_categoria WHERE NOT EXISTS (SELECT 1 FROM en_presupuesto)')

ls.parameters.query = q

// ─────────────────────────────────────────────────────────────────────────────
// 3) Franco (AI Agent) · declarar la etiqueta nueva (si no, es la historia de `fuera`)
// ─────────────────────────────────────────────────────────────────────────────
const ag = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = ag.parameters.options.systemMessage

const VOC_VIEJO = '"economica" (más de un 10% por debajo del presupuesto: es OTRA GAMA, no lo que este cliente vino a comprar), "fuera" (se pasa del presupuesto, PERO cumple el criterio que pidió el cliente). Confiá en esa etiqueta, no compares precios vos.'
const VOC_NUEVO = '"economica" (más de un 10% por debajo del presupuesto: es OTRA GAMA, no lo que este cliente vino a comprar), "otro_tamano" (NO es del tamaño que pidió el cliente), "fuera" (se pasa del presupuesto, PERO cumple el criterio que pidió el cliente). Confiá en esa etiqueta, no compares precios vos. Las etiquetas son INTERNAS: nunca le escribas una al cliente. Si un auto viene "otro_tamano", no lo cuentes entre los que cumplen y no digas que es de otra categoría: o va en el grupo aparte diciendo con todas las letras que es más grande, o no va.'

const CRIT_VIEJO = '- Si la ficha dice `tamano: mediano` o `tamano: grande`, ese auto NO es una respuesta a "algo chico".'
const CRIT_NUEVO = '- Cuando el cliente pide un tamaño, la herramienta ya hace la cuenta por vos: el que NO cumple viene con categoria "otro_tamano", y el mejor que SÍ cumple y le entra al bolsillo viene como "entra" aunque sea bastante más barato que su techo. Ese es el que va PRIMERO, y no lo trates como "otra gama": es exactamente lo que el cliente pidió. Ya pasó y es el bug: a "qué opción chica tenés" con techo de $20.000.000 saliste diciendo que los chicos se pasaban de los 20, cuando tenías uno de $14.500.000 en la lista, y ofreciste un utilitario mediano en su lugar.\n'
  + '- Si la ficha dice `tamano: mediano` o `tamano: grande`, ese auto NO es una respuesta a "algo chico".'

ok(smAntes.split(VOC_VIEJO).length === 2, 'no encontré (1 vez) el vocabulario de categorias en el prompt')
ok(smAntes.split(CRIT_VIEJO).length === 2, 'no encontré (1 vez) la línea 155 del prompt')
ag.parameters.options.systemMessage = smAntes.replace(VOC_VIEJO, () => VOC_NUEVO).replace(CRIT_VIEJO, () => CRIT_NUEVO)
const smDespues = ag.parameters.options.systemMessage

// ─────────────────────────────────────────────────────────────────────────────
// Aserciones
// ─────────────────────────────────────────────────────────────────────────────
// TRAMPA 1, la que costó meses.
ok(smAntes.startsWith('='), 'TRAMPA 1: el origen ya no arrancaba con "="')
ok(smDespues.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok((smAntes.match(/\{\{/g) || []).length === (smDespues.match(/\{\{/g) || []).length,
  'cambió la cantidad de expresiones {{ }} del prompt')

// TRAMPA 3: no agrego ningún $fromAI, y los que había quedan intactos.
const fromAiAntes = (qAntes.match(/\$fromAI\(/g) || []).length
const fromAiDespues = (q.match(/\$fromAI\(/g) || []).length
ok(fromAiAntes === fromAiDespues, `TRAMPA 3: cambió la cantidad de $fromAI (${fromAiAntes} -> ${fromAiDespues})`)

// El texto viejo YA NO ESTÁ (la regla del proyecto lo pide explícito).
ok(!q.includes(A_UNI), 'el UNION sigue leyendo de `base` en vez de `con_categoria`')
ok(q.split('END AS categoria_base,').length === 2, 'no quedó exactamente un categoria_base')
ok(q.split('SELECT * FROM base\n').length === 1, 'quedó algún SELECT * FROM base suelto')
ok(!smDespues.includes(VOC_VIEJO), 'el vocabulario viejo sigue en el prompt')

// Estructura.
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Config', 'Franco (AI Agent)', 'Listar stock']),
  `esperaba Config + Franco + Listar stock; hay: ${JSON.stringify(distintos)}`)
for (const nm of ['Armar respuesta', 'Leer lead (estado)', 'Detalle auto', 'Buscar auto', 'Guardar lead']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}
ok(cfg.parameters.assignments.assignments.length === 32, 'Config no quedó con 32 asignaciones')

// El detector, contra los dos turnos medidos y los adversarios.
const detect = (msg) => {
  const t = String(msg || '').toLowerCase()
  const G = /\b(grandes?|amplio|espacios[oa]s?)\b/
  const M = /\b(median[oa]s?)\b/
  const C = /\b(chic[oa]s?|peque[nñ][oa]s?|compact[oa]s?)\b/
  const neg = /\b(no|nada|ni|tampoco)\b[^.,;!?]{0,20}$/
  const pide = (re) => { const m = t.match(re); return !!m && !neg.test(t.slice(0, m.index)) }
  return pide(G) ? 'grande' : pide(M) ? 'mediano' : pide(C) ? 'chico' : ''
}
const casos = [
  ['hola, estoy buscando un auto chico, modelo mayor a 2020. qué tenés?', 'chico'],
  ['excelente. y si mi presupuesto se acota a 20 millones? qué opción chica tenés', 'chico'],
  ['quiero algo grande para la familia', 'grande'],
  ['busco algo mediano', 'mediano'],
  ['quiero algo chico pero no muy grande', 'chico'],
  ['no quiero algo chico', ''],
  ['tenés algo compacto?', 'chico'],
  ['un auto pequeño para ciudad', 'chico'],
  ['quiero cambiar mi fiat mobi, manteniendo el tamaño y bajo consumo', ''],
  ['mi presupuesto se achica un poco', ''],
  ['qué tenés en stock?', ''],
  ['algo mas grande que mi gol', 'grande'],
  ['nada grande, algo chico', 'chico'],
]
let malos = 0
for (const [msg, esp] of casos) if (detect(msg) !== esp) { malos++; fallas.push(`detector · "${msg}" dio "${detect(msg)}", esperaba "${esp}"`) }
console.log(`  detector de tamaño: ${casos.length - malos}/${casos.length}`)

// El detector NO se despierta en el resto de la suite: eso acota el radio del cambio.
const raw = JSON.parse(fs.readFileSync('evals/cases.json', 'utf8'))
const cases = Array.isArray(raw) ? raw : (raw.cases || Object.values(raw)[0])
const disparan = []
for (const c of cases) for (const t of (c.turns || [])) if (detect(t.say)) disparan.push(c.id)
const unicos = [...new Set(disparan)]
ok(JSON.stringify(unicos) === JSON.stringify(['chico-no-es-utilitario']),
  `el detector dispara en casos inesperados: ${JSON.stringify(unicos)}`)
console.log(`  turnos de la suite que despiertan el criterio: ${disparan.length} (todos de chico-no-es-utilitario)`)

// El caso tiene que exigir el Etios ANTES de este fix, o el fix se mide contra un check ciego.
const turno2 = cases.find((c) => c.id === 'chico-no-es-utilitario').turns[1].checks
ok(turno2.some((c) => c[0] === 'text_matches' && /etios/i.test(String(c[1]))),
  'el turno 2 no exige el Etios: sin eso, este fix puede dar verde sin arreglar nada')

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Config, Franco (AI Agent), Listar stock')
console.log(`  Listar stock query: ${qAntes.length} -> ${q.length} chars`)
console.log(`  systemMessage:      ${smAntes.length} -> ${smDespues.length} chars`)
console.log(`  Config:             31 -> ${cfg.parameters.assignments.assignments.length} asignaciones`)
