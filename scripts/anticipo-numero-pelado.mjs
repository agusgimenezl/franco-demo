// v98 -> v99 · el anticipo contestado con un NÚMERO PELADO ("6 millones")
//
// EL BUG, reportado por Agustina con captura YA SOBRE v98, sesión REAL
// `adab421d-4f8e-43c5-9891-dcee41e2ab91`. Turno 1 "Quiero financiar 30.000.000": Franco dice bien
// el guion de v92 y pide el anticipo. Turno 2 "6 millones": contesta "Perfecto, con $6.000.000 de
// anticipo ya tengo un parámetro para la financiación. Para armar bien la simulación exacta, qué
// auto tenés para entregar como parte de pago? Necesito marca, modelo y año." — no dice que faltan
// $24.000.000, y pide el usado SIN el para qué (el cuestionario que Agustina marcó).
//
// REPRODUCIDO ANTES DE TOCAR NADA: `financiacion-cuanto-falta-numero-pelado` (caso 83, la captura
// tal cual) mide **0/3 sobre v98**, y la única roja es la de los $24.000.000.
//
// CAUSA LEÍDA DEL LOG (ejecución `12256`), NO SUPUESTA: `Leer lead (estado)` trajo
// `msg_financiar_hist = "Quiero financiar 30.000.000"` — o sea LA MITAD NUEVA DE v98 FUNCIONÓ, el
// minuendo llegó. El que faltó fue el sustraendo: el regex de `entrega_plata` exige un VERBO
// (entrego/entregar/doy/pongo/adelanto/aporto) delante del número, y "6 millones" es un número
// PELADO. Probado offline contra la expresión DESPLEGADA: "6 millones" -> 0, "entrego 6 millones"
// -> 6000000. Sin anticipo no hay resta y la inyección de v98 no dispara.
//
// LA SEÑAL QUE HACE DETERMINÍSTICO EL NÚMERO PELADO — y es la razón por la que esto NO es
// adivinar: que la ÚLTIMA burbuja de Franco haya PEDIDO el anticipo. Es el mismo patrón que
// `franco_ofrecio_mostrar` (v85), que existe justo para esto: un "dale sí" del cliente sólo
// significa algo a la luz de lo que se le acababa de preguntar.
//
// VALIDADO CONTRA EL CORPUS REAL DE LA BASE (Supabase por MCP) ANTES DE ESCRIBIR ESTO: sobre las
// 1.136 burbujas de Franco que dicen "anticipo", el detector marca 375 como pedido genuino y
// descarta 411 donde el anticipo YA ESTÁ DADO ("10 millones de anticipo es una base para
// empezar"). Revisadas a mano las dos muestras: las que marca son pedidos del anticipo; las que
// descarta piden OTRA cosa (el usado, marca/modelo/año, el presupuesto). Los falsos negativos que
// quedan (Franco pidiéndolo con otra vuelta de frase) sólo dejan la conducta como está hoy: no
// dispara. Los falsos positivos serían el daño, y por eso el patrón es estrecho a propósito.
//
// EL CAMBIO — 3 nodos:
//   (A) `Leer lead (estado)`: subconsulta ESCALAR `franco_pidio_anticipo` (boolean), sobre el
//       ÚLTIMO mensaje de Franco, igual que `franco_ofrecio_mostrar`.
//   (B) `Config`: campo nuevo `entrega_plata_resp` (number). Dispara SÓLO si Franco pidió el
//       anticipo Y el mensaje del cliente es ENTERO un monto (relleno + número + unidad +
//       puntuación, nada más). "6 millones" sí; "6 millones y entrego el Yaris" no. `entrega_plata`
//       NO se toca: es la entrada del gate de v88 y del `precio_objetivo` de `Listar stock`, y es
//       el mismo argumento por el que v98 no tocó `monto_financiar`.
//   (C) La inyección de v98 usa `entrega_plata || entrega_plata_resp` para el ANTICIPO. El TECHO
//       sigue calculándose con `entrega_plata` a secas, a propósito: esa cuenta existe sólo para
//       replicar la guarda de v97, y v97 lee `entrega_plata`. Si acá usara el combinado, las dos
//       inyecciones dejarían de estar de acuerdo sobre cuándo dispara cada una y podrían callarse
//       las dos. DEUDA ANOTADA: v97 tampoco ve el número pelado, así que con "pickup" + "6
//       millones" no sale su frase. Es la conducta de hoy, no una regresión; se ataca aparte.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v98.json'
const DESTINO = 'workflows/franco-n8n-v99.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// ─────────────────────────────────────────────────────────── (A) SQL
const lead = wf.nodes.find((n) => n.name === 'Leer lead (estado)')
const qAntes = lead.parameters.query

const ANCLA_SQL = 'FROM (SELECT 1) d\nLEFT JOIN crm_leads l ON l.session_id = $1;'
if (qAntes.split(ANCLA_SQL).length !== 2) throw new Error('no encontré (una sola vez) el cierre del SELECT')

// Las dos mitades, sueltas, para poder probarlas contra la base por separado.
const RE_PIDE = "(de cu[aá]nto|cu[aá]nto|qu[eé] monto)[^.\\n]{0,60}anticipo|anticipo[^.\\n]{0,60}(de cu[aá]nto|cu[aá]nto|pens[aá]s poner|pens[aá]s manejar|ser[ií]a|ten[eé]s en mente)"
const RE_YA_DADO = "(\\$\\s*[\\d.]+[^.\\n]{0,25}de anticipo|anticipo (en efectivo )?de\\s*\\$?\\s*[\\d.]+|\\d+\\s*millones de anticipo|anticipo de\\s*\\d+\\s*millones)"

const COLUMNA = `,
  -- franco_pidio_anticipo: ¿la ÚLTIMA burbuja de Franco PIDIÓ el anticipo? Es lo que vuelve
  -- determinístico un número pelado: "6 millones" no significa nada solo, pero contestado a
  -- "de cuánto pensás poner de anticipo?" es el anticipo y no hay otra lectura.
  -- Hermana exacta de franco_ofrecio_mostrar (v85), que existe por la misma razón.
  -- La segunda mitad descarta las burbujas donde el anticipo YA ESTÁ DADO ("10 millones de
  -- anticipo es una base para empezar"): ahí Franco no está pidiendo nada.
  -- Medido contra el corpus real: de 1.136 burbujas con "anticipo", marca 375 y descarta 411
  -- por ya-dado; las que descarta piden otra cosa (el usado, marca/modelo, el presupuesto).
  -- Subconsulta ESCALAR: no cambia la cantidad de filas (trampa 4).
  COALESCE((
    SELECT bool_or(
      (b->>'content') ~* '${RE_PIDE}'
      AND NOT (b->>'content') ~* '${RE_YA_DADO}'
    )
    FROM (
      SELECT contenido
      FROM mensajes_demo
      WHERE session_id = $1 AND rol = 'franco'
      ORDER BY id DESC
      LIMIT 1
    ) r
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.contenido->'messages') = 'array'
           THEN r.contenido->'messages' ELSE '[]'::jsonb END
    ) AS b
  ), false)                                                AS franco_pidio_anticipo
`
lead.parameters.query = qAntes.replace(ANCLA_SQL, () => COLUMNA + ANCLA_SQL)

// ─────────────────────────────────────────────────────────── (B) Config
const cfg = wf.nodes.find((n) => n.name === 'Config')
const asg = cfg.parameters.assignments.assignments
ok(!asg.some((a) => a.name === 'entrega_plata_resp'), 'ya existía el campo entrega_plata_resp')

// La lista negra es la MISMA de entrega_plata (si nombra un auto, no es plata suelta) y se copia
// de ahí, no se reescribe, para que no se desincronicen.
const ep = asg.find((a) => a.name === 'entrega_plata')
ok(!!ep, 'no está el campo entrega_plata de v87')
const mNegra = String(ep.value).match(/if \(\/(\\bauto\\b.*?)\/\.test\(m\)\) return 0;/)
ok(!!mNegra, 'no pude extraer la lista negra de entrega_plata: revisá si cambió su forma')
const NEGRA = mNegra ? mNegra[1] : ''

// El mensaje tiene que ser ENTERO un monto: relleno + número + unidad + puntuación y nada más.
// Así "6 millones" entra y "6 millones y entrego el Yaris" no (para eso ya está entrega_plata).
const RESP = `={{ (() => {
  if (!$('Leer lead (estado)').item.json.franco_pidio_anticipo) return 0;
  const m = String($('Webhook Render').item.json.body.content || '').toLowerCase().trim();
  if (/${NEGRA}/.test(m)) return 0;
  if (/cuota|\\bmes(es)?\\b|a[nñ]os?\\b|\\bkm\\b|kil[oó]metr|%|por ciento|veces/.test(m)) return 0;
  const re = /^(?:unos|como|aprox\\w*|alrededor|cerca|casi|hasta|ser[ií]an?|tengo|pongo|con|de|y|\\\$|ar\\\$|[\\s,.]|)*(\\d{1,3}(?:[.\\s]\\d{3})+|\\d+(?:[,.]\\d+)?)\\s*(millones|millon|mill|palos|palo|lucas|luca|m|k)?[\\s.!?]*\$/;
  const h = m.match(re);
  if (!h) return 0;
  const crudo = h[1].replace(/\\s/g, '');
  const u = (h[2] || '').trim();
  let n = /^\\d{1,3}([.\\s]\\d{3})+\$/.test(crudo) ? Number(crudo.replace(/\\./g, '')) : Number(crudo.replace(',', '.'));
  if (!isFinite(n)) return 0;
  if (/^(millones|millon|mill|palos|palo|m)\$/.test(u)) n = n * 1000000;
  else if (/^(lucas|luca|k)\$/.test(u)) n = n * 1000;
  return n >= 1000000 ? Math.round(n) : 0;
})() }}`
asg.push({ id: 'a30-entrega-plata-resp', name: 'entrega_plata_resp', value: RESP, type: 'number' })

// ─────────────────────────────────────────────────────────── (C) prompt
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage no arranca con "="')

const VIEJO_ANT = '  const anticipo = Number(cfg.entrega_plata || 0);'
const NUEVO_ANT = '  const anticipo = Number(cfg.entrega_plata || 0) || Number(cfg.entrega_plata_resp || 0);'
if (sm.split(VIEJO_ANT).length !== 2) throw new Error('no encontré (una sola vez) la línea del anticipo de v98')

// El TECHO se sigue calculando con entrega_plata a secas: esa cuenta existe sólo para replicar la
// guarda de v97, y v97 lee entrega_plata. Ver el comentario de arriba.
const VIEJO_TECHO = '  const techo = anticipo * 2;'
const NUEVO_TECHO = '  const techo = Number(cfg.entrega_plata || 0) * 2;'
if (sm.split(VIEJO_TECHO).length !== 2) throw new Error('no encontré (una sola vez) la línea del techo de v98')

franco.parameters.options.systemMessage = sm
  .replace(VIEJO_ANT, () => NUEVO_ANT)
  .replace(VIEJO_TECHO, () => NUEVO_TECHO)
const smNuevo = franco.parameters.options.systemMessage

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Config', 'Franco (AI Agent)', 'Leer lead (estado)']),
  `esperaba exactamente esos 3 nodos; hay: ${JSON.stringify(distintos)}`)

ok(smNuevo.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok(String(lead.parameters.options.queryReplacement).trim().startsWith('={{ ['),
  'TRAMPA 2: el queryReplacement de Leer lead (estado) dejó de estar en forma array')
const fromAI = (o) => (JSON.stringify(o).match(/fromAI\(/g) || []).length
ok(fromAI(wf) === fromAI(antes), `cambió la cantidad de $fromAI: ${fromAI(antes)} -> ${fromAI(wf)}`)
ok(lead.parameters.query.includes('FROM (SELECT 1) d\nLEFT JOIN crm_leads l ON l.session_id = $1;'),
  'TRAMPA 4: se rompió el patrón FROM (SELECT 1) d LEFT JOIN')
for (const col of ['AS pisos_carroceria', 'AS pisos_map', 'AS carroceria_pedida_hist',
                   'AS msg_financiar_hist', 'AS ya_derivado', 'AS franco_ofrecio_mostrar']) {
  ok(lead.parameters.query.includes(col), `se perdió una columna previa: ${col}`)
}
ok(lead.parameters.query.split('AS franco_pidio_anticipo').length === 2,
  'la columna nueva falta o está duplicada')

// Los dos campos de los que este cambio depende NO se tocan.
const antesCfg = antes.nodes.find((n) => n.name === 'Config').parameters.assignments.assignments
for (const nm of ['entrega_plata', 'monto_financiar', 'monto_financiar_hist', 'carroceria_pedida']) {
  ok(JSON.stringify(asg.find((a) => a.name === nm)) === JSON.stringify(antesCfg.find((a) => a.name === nm)),
    `se tocó el campo ${nm} y no debe`)
}
// Lo que no se toca
for (const nm of ['Listar stock', 'Buscar auto', 'Detalle auto', 'Armar respuesta', 'Guardar mensajes (historial)']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}
for (const frag of [
  'ESTA SECCIÓN NO CORRE EN ESTE TURNO', 'está hablando de PLATA', 'MONTO A FINANCIAR',
  'Tené en cuenta que financiamos hasta el 50% del valor del vehículo',
  'LOS MONTOS DE "PISOS DE STOCK" NO SON EL PRECIO DE NINGÚN AUTO',   // v96
  'EL ENCABEZADO NO LLEVA NOMBRE DE CARROCERÍA',                       // v95
  'OFRECER ALGO QUE NO EXISTE TAMBIÉN ES INVENTAR',                    // v97
  'TODAVÍA LE FALTAN',                                                 // v98
]) ok(smNuevo.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)
ok(!smNuevo.includes(VIEJO_ANT), 'el texto viejo del anticipo sigue ahí')
ok(!smNuevo.includes(VIEJO_TECHO), 'el texto viejo del techo sigue ahí')
ok(smNuevo.split('!carr || !piso || !techo || piso <= techo').length === 3,
  'la guarda compartida con v97 dejó de aparecer exactamente 2 veces')

// ── PRUEBA OFFLINE 1: el detector del número pelado, extraído del v99 GENERADO.
{
  const src = RESP.replace(/^=\{\{/, '').replace(/\}\}\s*$/, '')
  try {
    const f = new Function('$', `return (${src})`)
    const run = (txt, pidio = true) => f((n) => (n === 'Leer lead (estado)'
      ? { item: { json: { franco_pidio_anticipo: pidio } } }
      : { item: { json: { body: { content: txt } } } }))
    const casos = [
      ['6 millones', true, 6000000],            // EL CASO REAL de la captura
      ['6.000.000', true, 6000000],
      ['$6.000.000', true, 6000000],
      ['unos 6 millones', true, 6000000],
      ['serían 6 millones', true, 6000000],
      ['5 palos', true, 5000000],
      ['6 millones', false, 0],                 // Franco NO lo pidió: no se asume nada
      ['36', true, 0],                          // cuotas: no llega al piso de 1.000.000
      ['36 cuotas', true, 0],
      ['100.000 km', true, 0],
      ['6 millones y entrego el Yaris 2018', true, 0],  // eso ya es permuta, no plata suelta
      ['tengo un auto de 6 millones', true, 0],
      ['en 24 meses', true, 0],
      ['', true, 0],
    ]
    let bien = 0
    for (const [txt, pidio, esp] of casos) {
      const got = run(txt, pidio)
      if (got === esp) bien++
      else fallas.push(`detector: ${JSON.stringify(txt)} (pidio=${pidio}) -> ${got}, esperaba ${esp}`)
    }
    console.log(`  detector del número pelado: ${bien}/${casos.length}`)
  } catch (e) {
    fallas.push(`el detector NO COMPILA: ${e.message}`)
  }
}

// ── PRUEBA OFFLINE 2: la inyección renderiza con el anticipo que viene del número pelado, y
//    sigue sin pisarse con la de v97.
{
  const MAPA = { suv: 19800000, sedan: 16800000, pickup: 32000000, hatchback: 8200000, utilitario: 18500000 }
  const extraer = (marca) => {
    const i = smNuevo.indexOf(marca)
    return smNuevo.slice(smNuevo.lastIndexOf('{{', i) + 2, smNuevo.indexOf('})() }}', i) + 5)
  }
  try {
    const fNueva = new Function('$node', '$', `return (${extraer('TODAVÍA LE FALTAN')})`)
    const fV97 = new Function('$node', '$', `return (${extraer('NO HAY NINGUNA ')})`)
    const correr = (f, o) => f(
      { Config: { json: Object.assign({ empresa_moneda_simbolo: '$', carroceria_pedida: '', monto_financiar: 0, monto_financiar_hist: 0, entrega_plata: 0, entrega_plata_resp: 0 }, o) } },
      () => ({ item: { json: { pisos_map: MAPA } } }),
    )
    // EL CASO DE LA CAPTURA: financiar 30.000.000 del historial, anticipo 6.000.000 del pelado.
    const con = correr(fNueva, { monto_financiar_hist: 30000000, entrega_plata_resp: 6000000 })
    ok(con.includes('$24.000.000'), 'la frase no trae lo que falta con el anticipo del número pelado')
    ok(/"Perfecto\. Con un anticipo de \$6\.000\.000 y queriendo financiar \$30\.000\.000, todavía faltarían aproximadamente \$24\.000\.000 para completar la otra mitad del valor del vehículo\./.test(con),
      'el guion no quedó textual con el anticipo del número pelado')
    // El camino de v98 (anticipo con verbo) no cambia.
    ok(correr(fNueva, { monto_financiar_hist: 30000000, entrega_plata: 5000000 }).includes('$25.000.000'),
      'se rompió el camino que ya medía 3/3 en v98')
    // Sigue sin disparar donde no debe.
    ok(correr(fNueva, { monto_financiar_hist: 30000000 }) === '', 'dispara sin ningún anticipo')
    ok(correr(fNueva, { entrega_plata_resp: 6000000 }) === '', 'dispara sin monto a financiar')
    ok(correr(fNueva, { monto_financiar_hist: 6000000, entrega_plata_resp: 6000000 }) === '',
      'dispara cuando el anticipo ya cubre la otra mitad')
    // Y las dos inyecciones nunca juntas, ahora también con el anticipo del número pelado.
    for (const carr of ['', 'pickup', 'suv', 'sedan', 'hatchback', 'utilitario']) {
      for (const ep of [0, 5000000, 16000000]) {
        for (const er of [0, 6000000, 20000000]) {
          for (const fi of [0, 5000000, 30000000, 60000000]) {
            const o = { carroceria_pedida: carr, entrega_plata: ep, entrega_plata_resp: er, monto_financiar_hist: fi }
            ok(!(correr(fNueva, o) && correr(fV97, o)),
              `disparan las dos juntas: carr=${carr || '(ninguna)'} ep=${ep} er=${er} fin=${fi}`)
          }
        }
      }
    }
    console.log('  inyección (anticipo del número pelado): ' + con.slice(con.indexOf('"Perfecto.'), con.indexOf('vehículo.') + 9))
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
console.log('  nodos con diferencias: Config · Franco (AI Agent) · Leer lead (estado)')
console.log(`  systemMessage: ${sm.length} -> ${smNuevo.length} chars`)
console.log(`  Leer lead (estado) query: ${qAntes.length} -> ${lead.parameters.query.length} chars`)
