// v99 -> v100 · EL TECHO DE COMPRA SALE DEL ANTICIPO Y LO CALCULA EL CÓDIGO, NO EL MODELO
//
// EL BUG (captura de Agustina, ya sobre v99, sesión REAL c1afbc8b-54d3-411c-8792-cf2d081a8bd5).
// Turnos: "Quiero financiar 30.000.000" / "7 millones" / "no tengo usado". Los dos primeros salen
// BIEN (la frase de v99 dice que faltan $23.000.000). El tercero: Franco dice "puedo mostrarte
// autos hasta unos $60.000.000 financiando la mitad" y lista la Ford Ranger 2024 de $57.000.000 a
// alguien que tiene $7.000.000. El techo correcto es anticipo x 2 = $14.000.000.
//
// REPRODUCIDO ANTES DE TOCAR NADA: `financiacion-techo-por-anticipo` (caso 84) mide **0/3 sobre
// v99**, ventana 12:08:51-12:13:39, 0 ejecuciones en error. Y las TRES rojas del turno 3 importan:
// no dice $14.000.000, nombra la T-Cross, y **manda cards de Hilux, S10 y T-Cross**. O sea: la
// frase renderizada sola NO alcanza — el bug también está en lo que devuelve la herramienta.
//
// CAUSA, DEL `inputOverride` DE `Listar stock` (ejecución 12423) — o sea de los `$fromAI`, o sea
// del MODELO: precio_objetivo=60000000, con_financiacion=1, tiene_permuta=0. Los $60.000.000 son
// el VALOR DEL AUTO del guion de v92 ("para financiar $30.000.000 el auto tiene que valer al menos
// $60.000.000") metido como si fuera la capacidad del cliente. La tool hizo lo suyo bien con un
// dato equivocado: devolvió las 17 filas con la Ranger en categoria='entra'.
// DAÑO EXTRA: ese mismo turno ya traía lead_presupuesto="$60.000.000" — el error queda PERSISTIDO
// en crm_leads y vuelve por Config.estado_cliente en todos los turnos siguientes.
//
// ES LA REGLA DEL PROYECTO: el techo de compra es aritmética pura y hoy lo elige el modelo.
//
// EL CAMBIO — 4 nodos, todos al servicio de UN objetivo ("el techo sale del anticipo"):
//   (A) `Leer lead (estado)`: `msg_anticipo_hist` — el último mensaje del cliente que da plata,
//       sea con verbo ("entrego 5 millones") o PELADO contestando a un pedido de anticipo de la
//       burbuja de Franco inmediatamente anterior (reusa el RE_PIDE de v99). Hacía falta porque en
//       el turno del bug el mensaje es "no tengo usado": el anticipo quedó dos turnos atrás.
//       PROBADO CONTRA LA BASE sobre las DOS conversaciones reales: -> "7 millones" y "6 millones";
//       sesión inexistente -> '' (escalar, trampa 4).
//   (B) `Config`: `entrega_plata_hist` — el parser de `entrega_plata` (con verbo) sobre ese texto
//       y, si da 0, el de `entrega_plata_resp` (pelado) sin su guarda, porque el contexto ya lo
//       validó el SQL. Los dos DERIVADOS por reemplazo, no reescritos: una sola implementación de
//       cada parser, como en v98/v99.
//   (C) `Listar stock`: un CTE `cap` al principio acota el CAPITAL una vez, y los **11 bloques**
//       de `$fromAI('precio_objetivo')` —byte-idénticos entre sí— pasan a `(SELECT capital FROM
//       cap)`. Así el `$fromAI` queda en UNA sola ocurrencia y la trampa 3 se satisface
//       trivialmente en vez de multiplicarse por 11. El acceso a Config desde este tool node NO es
//       nuevo: la query ya usa `$('Config').item.json.pidio_ver`, `.monto_financiar` y
//       `.entrega_plata`.
//       OJO CON LA SEMÁNTICA — ACÁ ME EQUIVOQUÉ Y LO CAZÓ LA PRUEBA CONTRA LA BASE: primero puse
//       el TECHO DEL AUTO (anticipo x 2) y todavía salían 7 autos por encima, hasta la Corolla de
//       $24.800.000. `precio_objetivo` NO es el techo del auto: es el CAPITAL, y el cálculo de
//       `tramo` YA lo multiplica x 2 (la financiación al 50%). Poner el techo ahí lo duplicaba de
//       nuevo: 7M -> 14M -> 28M. El tope correcto es el ANTICIPO A SECAS, y es `tramo` el que lo
//       convierte en los $14.000.000. VERIFICADO CONTRA LA BASE con la query materializada: con
//       capital $7.000.000 devuelve SÓLO Etios $12.500.000, Gol Trend $9.200.000 y Fiesta
//       $8.200.000 — exactamente lo que pidió Agustina.
//       ACOTA SÓLO CON tiene_permuta=0 Y con_financiacion=1: con permuta el capital incluye el
//       usado tasado y esto rompería `capacidad-de-compra-financiada`; al contado el techo no es
//       anticipo x 2. Todo el cálculo va en try/catch: ante cualquier duda devuelve el
//       precio_objetivo de siempre, o sea la conducta de hoy.
//   (D) `Franco (AI Agent)`: la frase de Agustina, renderizada, para el turno en que el cliente
//       dice que NO entrega usado.
//
// LO QUE NO SE TOCA, A PROPÓSITO: la inyección de v98/v99 sigue mirando el anticipo DE ESTE TURNO.
// Si le diera el histórico, repetiría "todavía faltan $X" en cada turno posterior.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v99.json'
const DESTINO = 'workflows/franco-n8n-v100.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// ─────────────────────────────────────────────────────────── (A) SQL
const lead = wf.nodes.find((n) => n.name === 'Leer lead (estado)')
const qAntes = lead.parameters.query
const ANCLA_SQL = 'FROM (SELECT 1) d\nLEFT JOIN crm_leads l ON l.session_id = $1;'
if (qAntes.split(ANCLA_SQL).length !== 2) throw new Error('no encontré (una sola vez) el cierre del SELECT')

// El RE_PIDE / RE_YA_DADO de v99, tomados de la query VIVA para que no se desincronicen.
const mPide = qAntes.match(/\(b->>'content'\) ~\* '(\(de cu\[aá\]nto\|[^']+)'/)
ok(!!mPide, 'no pude extraer el RE_PIDE de v99 de la query: revisá si cambió')
const mYaDado = qAntes.match(/NOT \(b->>'content'\) ~\* '(\(\\\$[^']+)'/)
ok(!!mYaDado, 'no pude extraer el RE_YA_DADO de v99 de la query: revisá si cambió')
const RE_PIDE = mPide ? mPide[1] : ''
const RE_YA_DADO = mYaDado ? mYaDado[1] : ''

const COLUMNA = `,
  -- msg_anticipo_hist: el último mensaje del CLIENTE que dio PLATA, para que el anticipo no se
  -- pierda al turno siguiente. Hace falta porque en el turno del bug (ejecución 12423) el mensaje
  -- es "no tengo usado": entrega_plata=0 y entrega_plata_resp=0, y el anticipo quedó 2 turnos
  -- atrás. Sin esto el techo no se puede calcular.
  -- Dos formas, las mismas que sabe leer Config:
  --   (a) con VERBO ("entrego 5 millones"), que es lo que ya parsea entrega_plata (v87);
  --   (b) PELADO ("7 millones"), válido SÓLO si la burbuja de Franco INMEDIATAMENTE anterior
  --       pedía el anticipo — el mismo criterio de v99, que es lo que lo vuelve determinístico.
  -- Se trae el TEXTO CRUDO, no el número: el parseo lo hace Config con los parsers que ya existen.
  -- Subconsulta ESCALAR: no cambia la cantidad de filas (trampa 4).
  COALESCE((
    SELECT u.contenido->>'text'
    FROM mensajes_demo u
    WHERE u.session_id = $1 AND u.rol = 'user'
      AND u.contenido->>'text' ~ '[0-9]'
      AND (
        u.contenido->>'text' ~* '(entrego|entregar|entregarte|doy|dar|darte|pongo|poner|adelanto|adelantar|aporto|aportar)[^0-9]{0,20}[0-9]'
        OR EXISTS (
          SELECT 1
          FROM mensajes_demo f
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(f.contenido->'messages') = 'array'
                 THEN f.contenido->'messages' ELSE '[]'::jsonb END) AS b
          WHERE f.session_id = $1 AND f.rol = 'franco'
            AND f.id = (SELECT max(f2.id) FROM mensajes_demo f2
                        WHERE f2.session_id = $1 AND f2.rol = 'franco' AND f2.id < u.id)
            AND (b->>'content') ~* '${RE_PIDE}'
            AND NOT (b->>'content') ~* '${RE_YA_DADO}'
        )
      )
    ORDER BY u.id DESC
    LIMIT 1
  ), '')                                                   AS msg_anticipo_hist
`
lead.parameters.query = qAntes.replace(ANCLA_SQL, () => COLUMNA + ANCLA_SQL)

// ─────────────────────────────────────────────────────────── (B) Config
const cfg = wf.nodes.find((n) => n.name === 'Config')
const asg = cfg.parameters.assignments.assignments
ok(!asg.some((a) => a.name === 'entrega_plata_hist'), 'ya existía el campo entrega_plata_hist')

const cuerpo = (v) => String(v).replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '')
const FUENTE_VIEJA = "String($('Webhook Render').item.json.body.content || '')"
const FUENTE_HIST = "String($('Leer lead (estado)').item.json.msg_anticipo_hist || '')"

const ep = asg.find((a) => a.name === 'entrega_plata')
const er = asg.find((a) => a.name === 'entrega_plata_resp')
ok(!!ep && !!er, 'faltan entrega_plata (v87) o entrega_plata_resp (v99)')
ok(String(ep.value).split(FUENTE_VIEJA).length === 2, 'entrega_plata no lee el mensaje del turno como esperaba')
ok(String(er.value).split(FUENTE_VIEJA).length === 2, 'entrega_plata_resp no lee el mensaje del turno como esperaba')

// El parser con VERBO, apuntando al historial.
const A = cuerpo(ep.value).replace(FUENTE_VIEJA, () => FUENTE_HIST)
// El parser PELADO, apuntando al historial y SIN su guarda: el contexto (que Franco lo había
// pedido) ya lo validó el SQL al elegir ese mensaje.
const GUARDA_RESP = "if (!$('Leer lead (estado)').item.json.franco_pidio_anticipo) return 0;\n  "
ok(String(er.value).split(GUARDA_RESP).length === 2, 'no encontré (una sola vez) la guarda de entrega_plata_resp')
const B = cuerpo(er.value).replace(GUARDA_RESP, () => '').replace(FUENTE_VIEJA, () => FUENTE_HIST)

asg.push({
  id: 'a31-entrega-plata-hist',
  name: 'entrega_plata_hist',
  value: `={{ (() => { const a = (${A})(); return a || (${B})(); })() }}`,
  type: 'number',
})

// ─────────────────────────────────────────────────────────── (C) Listar stock
const ls = wf.nodes.find((n) => n.name === 'Listar stock')
const qls = ls.parameters.query

const bloques = (clave) => {
  const re = new RegExp(`\\{\\{ \\$fromAI\\('${clave}'[^}]*\\}\\}`, 'g')
  return qls.match(re) || []
}
const bPrecio = bloques('precio_objetivo')
const bPermuta = bloques('tiene_permuta')
const bFinancia = bloques('con_financiacion')
ok(bPrecio.length === 11 && new Set(bPrecio).size === 1, `esperaba 11 bloques idénticos de precio_objetivo, hay ${bPrecio.length}/${new Set(bPrecio).size}`)
ok(new Set(bPermuta).size === 1, 'los bloques de tiene_permuta no son idénticos entre sí (trampa 3)')
ok(new Set(bFinancia).size === 1, 'los bloques de con_financiacion no son idénticos entre sí (trampa 3)')

// Las llamadas $fromAI van TEXTUALES, tal cual están hoy: la trampa 3 exige descripción y tipo
// byte-idénticos en todas las ocurrencias de una misma key.
const LLAMADA = (bloque) => bloque.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '')
const EXPR_TECHO = `{{ (() => {
  const p = Number(${LLAMADA(bPrecio[0])}) || 0;
  try {
    const c = $('Config').item.json;
    const ant = Number(c.entrega_plata || 0) || Number(c.entrega_plata_resp || 0) || Number(c.entrega_plata_hist || 0);
    if (!ant) return p;
    if (Number(${LLAMADA(bPermuta[0])}) === 1) return p;
    if (Number(${LLAMADA(bFinancia[0])}) !== 1) return p;
    return (!p || p > ant) ? ant : p;
  } catch (e) { return p; }
})() }}`

const ANCLA_LS = 'WITH usado_val AS ('
ok(qls.split(ANCLA_LS).length === 2, 'no encontré (una sola vez) el arranque WITH usado_val AS (')
let qlsNueva = qls.replace(ANCLA_LS, () => `WITH cap AS (
  -- EL CAPITAL DEL CLIENTE, ACOTADO POR CÓDIGO Y UNA SOLA VEZ.
  -- OJO CON LA SEMÁNTICA, QUE ES DONDE ME EQUIVOQUÉ Y LO CAZÓ LA PRUEBA CONTRA LA BASE:
  -- precio_objetivo NO es el techo del auto, es el CAPITAL del cliente. El cálculo de \`tramo\`
  -- de más abajo ya lo multiplica x 2 ((capital + usado x 0,70) x 2), que es la financiación
  -- al 50%. Si acá se pusiera el techo del auto (anticipo x 2), la tool volvería a duplicarlo
  -- y el cliente vería autos de hasta 4 x anticipo. Por eso el tope es el ANTICIPO a secas: es
  -- \`tramo\` el que lo convierte en el techo de $14.000.000 para un anticipo de $7.000.000.
  -- QUÉ ARREGLA: en la ejecución 12423 el MODELO puso precio_objetivo=60.000.000 —el valor que
  -- el auto TENÍA QUE TENER para financiar 30.000.000— a un cliente con 7.000.000, y la tool
  -- devolvió las 17 filas con la Ford Ranger de $57.000.000 en categoria='entra'.
  -- Sólo acota con tiene_permuta=0 y con_financiacion=1: con permuta el capital incluye el
  -- usado tasado, y al contado el techo no es anticipo x 2. Ante cualquier error devuelve el
  -- precio_objetivo de siempre, o sea la conducta previa.
  SELECT (${EXPR_TECHO})::bigint AS capital
),
usado_val AS (`)
qlsNueva = qlsNueva.split(bPrecio[0]).join('(SELECT capital FROM cap)')
ls.parameters.query = qlsNueva

// ─────────────────────────────────────────────────────────── (D) prompt
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage no arranca con "="')

const ANCLA_SM = '\nCuando pregunten por financiación, cuotas, prenda, gastos o documentación,'
if (sm.split(ANCLA_SM).length !== 2) throw new Error('no encontré (una sola vez) el ancla de # Financiación')

const INYECCION = `{{ (() => {
  const cfg = $node["Config"].json;
  const ant = Number(cfg.entrega_plata || 0) || Number(cfg.entrega_plata_resp || 0) || Number(cfg.entrega_plata_hist || 0);
  if (!ant) return '';
  const msg = String(cfg.mensaje_usuario || '');
  if (!/no tengo (un |una |ning[uú]n |ninguna )?(usado|auto|coche|veh[ií]culo|camioneta)|sin usado|no entrego (nada|ning[uú]n|ninguna|auto|usado)|no tengo nada para entregar|no voy a entregar|no tengo para entregar/i.test(msg)) return '';
  const antTurno = Number(cfg.entrega_plata || 0) || Number(cfg.entrega_plata_resp || 0);
  const fin = Number(cfg.monto_financiar || 0) || Number(cfg.monto_financiar_hist || 0);
  if (antTurno && fin && fin - antTurno > 0) return '';
  // Si dispara la de v97 (pidió una carrocería que no existe a ese precio), esa manda: es más
  // específica y está medida. El bloque tiene scope propio para que la guarda quede TEXTUALMENTE
  // igual a la de v97 y a la de v98 — si alguien toca una y no las otras, el assert lo caza.
  {
    const carr = String(cfg.carroceria_pedida || '');
    const mapa = $('Leer lead (estado)').item.json.pisos_map || {};
    const piso = Number(mapa[carr] || 0);
    const techo = Number(cfg.entrega_plata || 0) * 2;
    if (!(!carr || !piso || !techo || piso <= techo)) return '';
  }
  const techo = ant * 2;
  const m = (n) => cfg.empresa_moneda_simbolo + String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
  return 'DATO YA CALCULADO DE ESTA CONVERSACIÓN, ES VERDAD Y NO SE DISCUTE: el cliente tiene ' + m(ant) + ' de anticipo y acaba de decir que NO entrega ningún usado, así que su techo es ' + m(techo) + ' —financiamos hasta el 50%, o sea anticipo por dos—. PROHIBIDO EN ESTE TURNO, y es la regla que manda sobre cualquier otra: nombrar, listar u ofrecer un auto que valga más de ' + m(techo) + ', y decir cualquier otro techo (en especial el valor que el auto TENÍA QUE TENER para financiar lo que pidió: ese no es su presupuesto). Decí TEXTUAL esta frase, que YA ESTÁ CALCULADA —no la recalcules, no la resumas y no le cambies los números—: "Perfecto. Con un anticipo de ' + m(ant) + ' y sin un usado para entregar, podríamos buscar vehículos de hasta aproximadamente ' + m(techo) + ', ya que financiamos hasta el 50% del valor de la unidad. Si te parece, puedo mostrarte las opciones disponibles dentro de ese rango o, si preferís, puedo ponerte en contacto con un asesor para revisar alternativas de financiación." Los autos van en el turno SIGUIENTE, si dice que sí.\\n';
})() }}`

franco.parameters.options.systemMessage = sm.replace(ANCLA_SM, () => '\n' + INYECCION + ANCLA_SM)
const smNuevo = franco.parameters.options.systemMessage

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Config', 'Franco (AI Agent)', 'Leer lead (estado)', 'Listar stock']),
  `esperaba exactamente esos 4 nodos; hay: ${JSON.stringify(distintos)}`)

ok(smNuevo.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok(String(lead.parameters.options.queryReplacement).trim().startsWith('={{ ['),
  'TRAMPA 2: el queryReplacement de Leer lead (estado) dejó de estar en forma array')
ok(lead.parameters.query.includes('FROM (SELECT 1) d\nLEFT JOIN crm_leads l ON l.session_id = $1;'),
  'TRAMPA 4: se rompió el patrón FROM (SELECT 1) d LEFT JOIN')
for (const col of ['AS pisos_carroceria', 'AS pisos_map', 'AS carroceria_pedida_hist',
                   'AS msg_financiar_hist', 'AS franco_pidio_anticipo', 'AS ya_derivado']) {
  ok(lead.parameters.query.includes(col), `se perdió una columna previa: ${col}`)
}
ok(lead.parameters.query.split('AS msg_anticipo_hist').length === 2, 'la columna nueva falta o está duplicada')

// TRAMPA 3: cada key de $fromAI, con descripción y tipo byte-idénticos en TODAS sus ocurrencias.
{
  const porClave = {}
  for (const b of ls.parameters.query.match(/\{\{[^{}]*\$fromAI\('([a-z_]+)'[^}]*\}\}/g) || []) {
    const k = b.match(/\$fromAI\('([a-z_]+)'/)[1]
      ;(porClave[k] = porClave[k] || []).push(b.match(/\$fromAI\('[a-z_]+',[^)]*\)/)[0])
  }
  for (const [k, v] of Object.entries(porClave)) {
    ok(new Set(v).size === 1, `TRAMPA 3: la key ${k} tiene ${new Set(v).size} formas distintas de $fromAI`)
  }
  const antesClaves = new Set((antes.nodes.find((n) => n.name === 'Listar stock').parameters.query
    .match(/\$fromAI\('([a-z_]+)'/g) || []).map((s) => s))
  const ahoraClaves = new Set((ls.parameters.query.match(/\$fromAI\('([a-z_]+)'/g) || []).map((s) => s))
  ok(JSON.stringify([...antesClaves].sort()) === JSON.stringify([...ahoraClaves].sort()),
    'cambió el CONJUNTO de keys de $fromAI de Listar stock: la tool cambiaría de firma')
  ok((ls.parameters.query.match(/\$fromAI\('precio_objetivo'/g) || []).length === 1,
    'precio_objetivo debería quedar en UNA sola ocurrencia')
  ok(ls.parameters.query.split('(SELECT capital FROM cap)').length === 12,
    'esperaba los 11 usos reemplazados por (SELECT capital FROM cap)')
}
// Los gates que viven en Listar stock siguen ahí.
for (const frag of [
  "$('Config').item.json.pidio_ver",
  "$('Config').item.json.monto_financiar",
  "$('Config').item.json.entrega_plata",
]) ok(ls.parameters.query.includes(frag), `se perdió un gate de Listar stock: ${frag}`)

// Los campos de los que esto depende NO se tocan.
const antesCfg = antes.nodes.find((n) => n.name === 'Config').parameters.assignments.assignments
for (const nm of ['entrega_plata', 'entrega_plata_resp', 'monto_financiar', 'monto_financiar_hist', 'carroceria_pedida', 'pidio_ver']) {
  ok(JSON.stringify(asg.find((a) => a.name === nm)) === JSON.stringify(antesCfg.find((a) => a.name === nm)),
    `se tocó el campo ${nm} y no debe`)
}
for (const nm of ['Buscar auto', 'Detalle auto', 'Armar respuesta', 'Guardar mensajes (historial)']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}
for (const frag of [
  'LOS MONTOS DE "PISOS DE STOCK" NO SON EL PRECIO DE NINGÚN AUTO',   // v96
  'OFRECER ALGO QUE NO EXISTE TAMBIÉN ES INVENTAR',                    // v97
  'TODAVÍA LE FALTAN',                                                 // v98/v99
]) ok(smNuevo.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)
ok(smNuevo.split('acaba de decir que NO entrega ningún usado').length === 2,
  'la inyección nueva falta o está duplicada')
ok(smNuevo.split('!carr || !piso || !techo || piso <= techo').length === 4,
  'la guarda compartida con v97 tiene que aparecer 3 veces (v97 + v98 + la nueva)')

// ── PRUEBA OFFLINE 1: el techo de Listar stock, extraído del v100 GENERADO.
{
  const i = ls.parameters.query.indexOf('SELECT (')
  const src = ls.parameters.query.slice(ls.parameters.query.indexOf('{{', i) + 2,
    ls.parameters.query.indexOf('})() }}', i) + 5)
  try {
    const f = new Function('$fromAI', '$', `return (${src})`)
    const run = (p, permuta, fin, c) => f(
      (k) => ({ precio_objetivo: p, tiene_permuta: permuta, con_financiacion: fin }[k]),
      () => ({ item: { json: c } }),
    )
    const casos = [
      // EL CASO MEDIDO (12423): el modelo pide 60M, el cliente tiene 7M de anticipo del historial
      [60000000, 0, 1, { entrega_plata_hist: 7000000 }, 7000000],
      // el anticipo del turno también sirve
      [60000000, 0, 1, { entrega_plata: 5000000 }, 5000000],
      [60000000, 0, 1, { entrega_plata_resp: 6000000 }, 6000000],
      // si el modelo pide MENOS que el capital real, manda el modelo (esto nunca ensancha)
      [9000000, 0, 1, { entrega_plata_hist: 7000000 }, 7000000],
      // sin presupuesto declarado, el capital pasa a ser el anticipo conocido
      [0, 0, 1, { entrega_plata_hist: 7000000 }, 7000000],
      // CON PERMUTA no acota (la capacidad incluye el usado)
      [60000000, 1, 1, { entrega_plata_hist: 7000000 }, 60000000],
      // CONTADO no acota (ahí el techo no es anticipo x 2)
      [60000000, 0, 0, { entrega_plata_hist: 7000000 }, 60000000],
      // sin anticipo conocido, todo como antes
      [60000000, 0, 1, {}, 60000000],
      [0, 0, 0, {}, 0],
    ]
    let bien = 0
    for (const [p, pe, fi, c, esp] of casos) {
      const got = run(p, pe, fi, c)
      if (got === esp) bien++
      else fallas.push(`techo: p=${p} permuta=${pe} fin=${fi} ${JSON.stringify(c)} -> ${got}, esperaba ${esp}`)
    }
    // Y que NUNCA rompa: si Config no está accesible, devuelve el precio_objetivo de siempre.
    const fSinConfig = new Function('$fromAI', '$', `return (${src})`)
    const sinConfig = fSinConfig((k) => ({ precio_objetivo: 60000000, tiene_permuta: 0, con_financiacion: 1 }[k]),
      () => { throw new Error('nodo no accesible') })
    if (sinConfig === 60000000) bien++
    else fallas.push(`techo: sin Config accesible devolvió ${sinConfig}, esperaba el precio_objetivo (60000000)`)
    console.log(`  capital de Listar stock: ${bien}/${casos.length + 1}`)
  } catch (e) {
    fallas.push(`la expresión del capital NO COMPILA: ${e.message}`)
  }
}

// ── PRUEBA OFFLINE 2: la frase, y que no se pise con las otras dos inyecciones.
{
  const MAPA = { suv: 19800000, sedan: 16800000, pickup: 32000000, hatchback: 8200000, utilitario: 18500000 }
  const extraer = (marca) => {
    const i = smNuevo.indexOf(marca)
    return smNuevo.slice(smNuevo.lastIndexOf('{{', i) + 2, smNuevo.indexOf('})() }}', i) + 5)
  }
  try {
    const base = { empresa_moneda_simbolo: '$', carroceria_pedida: '', mensaje_usuario: '', monto_financiar: 0, monto_financiar_hist: 0, entrega_plata: 0, entrega_plata_resp: 0, entrega_plata_hist: 0 }
    const mk = (f) => (o) => f({ Config: { json: Object.assign({}, base, o) } }, () => ({ item: { json: { pisos_map: MAPA } } }))
    const fTecho = mk(new Function('$node', '$', `return (${extraer('acaba de decir que NO entrega ningún usado')})`))
    const fFalta = mk(new Function('$node', '$', `return (${extraer('TODAVÍA LE FALTAN')})`))
    const fV97 = mk(new Function('$node', '$', `return (${extraer('NO HAY NINGUNA ')})`))

    // EL CASO DE LA CAPTURA: turno "no tengo usado", anticipo 7M del historial.
    const caso = { mensaje_usuario: 'no tengo usado', entrega_plata_hist: 7000000, monto_financiar_hist: 30000000 }
    const con = fTecho(caso)
    ok(con.includes('$14.000.000'), 'la frase no trae el techo calculado')
    ok(/"Perfecto\. Con un anticipo de \$7\.000\.000 y sin un usado para entregar, podríamos buscar vehículos de hasta aproximadamente \$14\.000\.000, ya que financiamos hasta el 50% del valor de la unidad\./.test(con),
      'el guion de Agustina no quedó TEXTUAL')
    // No dispara donde no debe.
    ok(fTecho({ mensaje_usuario: 'no tengo usado' }) === '', 'dispara sin anticipo conocido')
    ok(fTecho({ mensaje_usuario: '7 millones', entrega_plata_hist: 7000000 }) === '',
      'dispara en un turno donde el cliente NO negó el usado')
    ok(fTecho({ mensaje_usuario: 'no tengo usado', entrega_plata: 7000000, monto_financiar_hist: 30000000 }) === '',
      'se pisa con la de v98/v99 cuando el anticipo es de ESTE turno')
    // Las TRES inyecciones, nunca dos juntas.
    for (const msg of ['', 'no tengo usado', '7 millones', 'dale mostrame']) {
      for (const carr of ['', 'pickup', 'hatchback']) {
        for (const ep of [0, 5000000]) for (const er of [0, 6000000]) for (const eh of [0, 7000000]) {
          for (const fi of [0, 30000000]) {
            const o = { mensaje_usuario: msg, carroceria_pedida: carr, entrega_plata: ep, entrega_plata_resp: er, entrega_plata_hist: eh, monto_financiar_hist: fi }
            const n = [fTecho(o), fFalta(o), fV97(o)].filter(Boolean).length
            ok(n <= 1, `disparan ${n} inyecciones juntas: ${JSON.stringify(o)}`)
          }
        }
      }
    }
    console.log('  frase del techo: ' + con.slice(con.indexOf('"Perfecto.'), con.indexOf('unidad.') + 7))
  } catch (e) {
    fallas.push(`la inyección NO COMPILA: ${e.message}`)
  }
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Config · Franco (AI Agent) · Leer lead (estado) · Listar stock')
console.log(`  systemMessage: ${sm.length} -> ${smNuevo.length} chars`)
console.log(`  Leer lead (estado) query: ${qAntes.length} -> ${lead.parameters.query.length} chars`)
console.log(`  Listar stock query: ${qls.length} -> ${ls.parameters.query.length} chars`)
