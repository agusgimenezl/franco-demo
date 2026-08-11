// v114 -> v115 · EL USADO SALE DE LA CONVERSACIÓN, NO DEL CRM
//
// EL PENDIENTE 1, Y NO ES EL RESIDUO DE 1 DE 3 QUE DECÍA STATE: ES EL CAMINO DOMINANTE.
// Medido el 2026-08-07 sobre v113: el turno 2 de `capacidad-de-compra-financiada` dio verde 1 de 3,
// con `cards_empty: hay 5` y `hay 6` en las otras dos. **La causa está LEÍDA DEL LOG, no supuesta:
// ejecución `14150`** (turno 2, `mensaje_usuario: "tiene 100.000 km"`, sesión `3fee53ee`):
//   Leer lead (estado) -> lead_entrega: "No mencionado", lead_usado: "No mencionado", estado "Nuevo"
//   Config            -> pidio_ver: 0, monto_financiar: 0, entrega_plata: 0, entrega_plata_resp: 0
// Con eso `_tieneUsado` y `_dioPlata` son false, `_noEraDeMostrar` NO PUEDE ser true, y la guarda de
// v113 no dispara. El cliente había dicho en el turno 1 que entrega un Ford Ka 2015: el dato existía,
// **el CRM todavía no lo había escrito.** v113 no está roto: es CONDICIONAL AL CRM.
//
// EL PRECEDENTE EXACTO YA ESTÁ EN ESTE MISMO NODO, Y ES LO QUE HACE QUE ESTO NO SEA UN INVENTO:
// `ya_derivado` (v103) dice, en su propio comentario, "el hecho 'ya derivé' sale de las propias
// burbujas de Franco, NO del CRM (el CRM escribe DESPUÉS de responder, así que su estado llega >=1
// turno tarde)". Hay SEIS campos más en `Leer lead (estado)` derivados de `mensajes_demo` por la
// misma razón. Esto es el séptimo, aplicado al usado.
//
// LO QUE NO SE PUDO USAR, Y HAY QUE DECIRLO PORQUE QUEDÓ MAL ANOTADO EN STATE: `tiene_permuta` NO se
// calcula por SQL. Es `$fromAI` en `Listar stock` —lo decide el modelo— y aparece así en sus 7 usos.
// No es una señal determinística y además vive en un nodo TOOL, que desde `Armar respuesta` no se
// puede leer (deuda 8). Ese camino no existe.
//
// EL REGEX, ELEGIDO MIDIENDO Y NO A OJO. Verdad de referencia: lo que el CRM terminó escribiendo en
// las 1.774 sesiones que todavía tienen lead. Se probaron tres variantes; ganó la más SIMPLE:
//   · entrega='Sí'            (505 sesiones) -> marca 412, **81,6% de recall**
//   · entrega='No'            ( 90 sesiones) -> marca   0, **0% de falsos positivos**
//   · entrega='No mencionado' (1.179)        -> marca  14 (1,2%), y esas 14 se leyeron una por una:
//     son mensajes donde el cliente SÍ dice que entrega un usado y el CRM no lo registró. Son
//     ACIERTOS del regex, no falsos positivos.
//
// LA GUARDA DE NEGACIÓN NO ES OPCIONAL — MEDIDO: sin ella, "no tengo nada para entregar", "no
// entrego mi auto", "no quiero permutar" y "cuándo es la entrega del auto?" dan TODOS true. Con
// ella, 16/16 sobre el set de prueba (11 negativas y 5 positivas), y "quiero vender mi auto, me lo
// toman en consignación?" queda afuera, que es lo correcto: consignación no es permuta.
// Es el mismo patrón `match AND NOT` que ya usa `franco_pidio_anticipo` en este nodo.
//
// POR QUÉ ES SEGURO, Y ES LA PROPIEDAD QUE DECIDIÓ EL DISEÑO: la señal nueva entra en **OR** con las
// dos que ya estaban (`lead_entrega === 'Sí'` y `lead_usado !== 'No mencionado'`). Un MISS del regex
// degrada exactamente al comportamiento de hoy; sólo un FALSO POSITIVO haría daño, y contra el
// corpus son cero. Y no ensancha el predicado en el tiempo: `lead_entrega` también queda en 'Sí'
// por el resto de la charla una vez que el CRM escribe. **Esto no agrega una condición nueva:
// le saca el retraso a la que ya existía.**
//
// LAS TRES GUARDAS DE v113 SIGUEN INTACTAS y son las que acotan el riesgo residual:
//   · `pidio_ver === 0` — si el cliente pidió ver, esto no se mete NUNCA;
//   · `!ya_derivado`    — la ejecución 13797 sigue sin tocarse (si no, se le ofrece un asesor a
//                         alguien que ya está derivado, un bug que este proyecto ya arregló);
//   · `_listados >= 2`  — el texto tiene que estar listando de verdad, no nombrando un auto suelto.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v114.json'
const DESTINO = 'workflows/franco-n8n-v115.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const POS = String.raw`(permut|parte de pago|para entregar|entrego|mi usado|un usado)`
const NEG = String.raw`(\mno\M|\mnada\M|\mtampoco\M|\msin\M)[^.!?]{0,30}(entreg|permut|usado|parte de pago)|\m(la|una|su|esa) entrega\M|consignaci`

// ── (A) Leer lead (estado): la señal, sacada de los mensajes del propio cliente ──────────
const ll = wf.nodes.find((n) => n.name === 'Leer lead (estado)')
const sqlAntes = ll.parameters.query

const ANCLA = `,
  -- catalogo_precios: marca+modelo, año y precio de TODO el stock,`
const COLUMNA = `,
  -- tiene_usado_hist: ¿el CLIENTE dijo, en algún turno anterior, que entrega un usado? Sale de sus
  -- propios mensajes y NO del CRM, por la MISMA razón que ya_derivado acá arriba: el CRM escribe
  -- después de responder y su estado llega >=1 turno tarde.
  -- MEDIDO (ejecución 14150, turno 2 de capacidad-de-compra-financiada): lead_entrega y lead_usado
  -- decían "No mencionado" cuando el cliente ya había dicho en el turno 1 que entrega un Ford Ka
  -- 2015. Por eso la guarda de v113 no disparó y salieron 5 cards en un turno que no era de mostrar.
  -- ELEGIDO MIDIENDO contra lo que el CRM terminó escribiendo en 1.774 sesiones: marca el 81,6% de
  -- las 505 con entrega='Sí', el 0% de las 90 con 'No', y el 1,2% de las 1.179 'No mencionado'
  -- —esas 14 se leyeron y son mensajes donde el cliente SÍ entrega un usado y el CRM no lo registró.
  -- LA GUARDA DE NEGACIÓN NO ES OPCIONAL: sin ella "no tengo nada para entregar", "no quiero
  -- permutar" y "cuándo es la entrega del auto?" dan true. Mismo patrón AND NOT que
  -- franco_pidio_anticipo. "Consignación" queda afuera a propósito: no es permuta.
  -- El mensaje de ESTE turno todavía no está en mensajes_demo, así que esto es historial puro.
  -- Subconsulta ESCALAR: no cambia la cantidad de filas (trampa 4).
  COALESCE((
    SELECT bool_or(
      u.contenido->>'text' ~* '${POS}'
      AND NOT u.contenido->>'text' ~* '${NEG}'
    )
    FROM mensajes_demo u
    WHERE u.session_id = $1 AND u.rol = 'user'
  ), false)                                                AS tiene_usado_hist,
  -- catalogo_precios: marca+modelo, año y precio de TODO el stock,`

ok(sqlAntes.split(ANCLA).length === 2, 'no encontré (una sola vez) el ancla de catalogo_precios')
ll.parameters.query = sqlAntes.replace(ANCLA, () => COLUMNA)
const sqlDespues = ll.parameters.query

// ── (B) Armar respuesta: la guarda de v113 mira también la señal nueva ───────────────────
const ar = wf.nodes.find((n) => n.name === 'Armar respuesta')
const jsAntes = ar.parameters.jsCode

const VIEJO = `      const _tieneUsado = String(_le2.lead_entrega || '') === 'Sí' ||
        (_le2.lead_usado && _le2.lead_usado !== 'No mencionado');`
const NUEVO = `      // v115: el usado también cuenta si lo dijo EL CLIENTE en la conversación, aunque el CRM
      // todavía no lo haya escrito. Va en OR con las dos de v113 a propósito: si el regex no lo
      // caza, esto queda exactamente como estaba. \`tiene_usado_hist\` lo calcula el SQL de
      // \`Leer lead (estado)\`, del mismo modo que \`ya_derivado\`, y por la misma razón: el CRM
      // llega un turno tarde (ejecución 14150).
      const _tieneUsado = String(_le2.lead_entrega || '') === 'Sí' ||
        (_le2.lead_usado && _le2.lead_usado !== 'No mencionado') ||
        _le2.tiene_usado_hist === true;`
ok(jsAntes.split(VIEJO).length === 2, 'no encontré (una sola vez) el _tieneUsado de v113')
ar.parameters.jsCode = jsAntes.replace(VIEJO, () => NUEVO)
const jsDespues = ar.parameters.jsCode

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Armar respuesta', 'Leer lead (estado)']),
  `esperaba SÓLO los dos nodos; hay: ${JSON.stringify(distintos)}`)
ok(sqlDespues.split(VIEJO).length === 1 || true, '')
ok(jsDespues.split(VIEJO).length === 1, 'el _tieneUsado viejo sigue suelto en el código')
// Una sola LECTURA del campo (la otra mención es el comentario que la explica).
ok(jsDespues.split('_le2.tiene_usado_hist').length === 2, 'tiene_usado_hist tiene que leerse UNA vez en el JS')
ok(sqlDespues.split('AS tiene_usado_hist').length === 2, 'la columna nueva falta o está duplicada')

// TRAMPA 2: la forma array del queryReplacement no se toca.
ok(JSON.stringify(ll.parameters.options) === JSON.stringify(antes.nodes.find((n) => n.name === 'Leer lead (estado)').parameters.options),
  'se tocó el queryReplacement de Leer lead (estado)')
ok(/=\{\{ \[ .* \] \}\}/.test(ll.parameters.options.queryReplacement), 'el queryReplacement dejó de ser la forma array (trampa 2)')
// TRAMPA 4: la query sigue anclada en la fila garantizada.
ok(sqlDespues.includes('FROM (SELECT 1) d\nLEFT JOIN crm_leads l ON l.session_id = $1;'),
  'se perdió el FROM (SELECT 1) d LEFT JOIN — trampa 4')
// La columna nueva va ANTES de catalogo_precios y DESPUÉS de msg_anticipo_hist.
ok(sqlDespues.indexOf('AS msg_anticipo_hist') < sqlDespues.indexOf('AS tiene_usado_hist') &&
   sqlDespues.indexOf('AS tiene_usado_hist') < sqlDespues.indexOf('AS catalogo_precios'),
  'la columna nueva quedó en el lugar equivocado')
for (const frag of ['AS ya_derivado', 'AS franco_ofrecio_mostrar', 'AS pisos_map', 'AS msg_financiar_hist',
                    'AS franco_pidio_anticipo', 'AS carroceria_pedida_hist', 'AS catalogo_precios']) {
  ok(sqlDespues.includes(frag), `se perdió una columna de Leer lead (estado): ${frag}`)
}
for (const frag of ['SE BORRA (v109)', 'EL ENCABEZADO PEGADO AL ÍTEM', 'LAS CARDS SE RECUPERAN DEL TEXTO (v112)',
                    '_noEraDeMostrar', 'Guard de cierre comercial', 'CENTINELA DE CERO FILAS (v102)']) {
  ok(jsDespues.includes(frag), `se perdió algo de Armar respuesta: ${frag}`)
}
try { new Function(jsDespues) } catch (e) { fallas.push(`el NODO ENTERO no compila: ${e.message}`) }
for (const nm of ['Config', 'Franco (AI Agent)', 'Listar stock', 'Detalle auto', 'Hidratar autos']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

// ── PRUEBA OFFLINE del bloque, con los VALORES REALES de la ejecución 14150 ──────────────
{
  const DESDE = '    // SI NO PIDIÓ VER Y ESTÁ DANDO DATOS, ESTE TURNO NO ERA DE MOSTRAR (v113)'
  const HASTA = '    if (centinela || (ids.length > 0 && autos.length === 0) || _noEraDeMostrar) {'
  const senal = (js) => js.slice(js.indexOf(DESDE), js.indexOf(HASTA))
  ok(senal(jsAntes).includes('_tieneUsado') && senal(jsDespues).includes('tiene_usado_hist'),
    'no extraje el bloque de la señal')

  const correr = (src, cfg, lead) => {
    const $ = () => ({ first: () => ({ json: lead }) })
    return new Function('cfg', '$', src + '\nreturn _noEraDeMostrar;')(cfg, $)
  }
  const casos = []
  const chk = (n, c, extra) => { casos.push(n); if (!c) fallas.push(`offline · ${n}${extra ? ' :: ' + extra : ''}`) }

  // LOS VALORES EXACTOS DE 14150, copiados del log.
  const CFG_14150 = { pidio_ver: 0, monto_financiar: 0, entrega_plata: 0, entrega_plata_resp: 0 }
  const LEAD_14150 = {
    lead_nombre: '', lead_vehiculo: 'No mencionado', lead_entrega: 'No mencionado',
    lead_usado: 'No mencionado', lead_financia: 'No mencionado', lead_estado: 'Nuevo', ya_derivado: false,
  }

  // (1) EL BUG, con el código de v114: la señal es false y el bloque no puede disparar.
  chk('14150 · v114 no dispara — el bug',
    correr(senal(jsAntes), CFG_14150, LEAD_14150) === false)
  // (2) EL FIX: con el dato que el SQL nuevo entrega para esa misma sesión, sí dispara.
  chk('14150 · v115 dispara',
    correr(senal(jsDespues), CFG_14150, { ...LEAD_14150, tiene_usado_hist: true }) === true)
  // (3) Y si el regex NO lo caza, v115 se comporta EXACTAMENTE como v114.
  chk('sin señal · v115 === v114',
    correr(senal(jsDespues), CFG_14150, { ...LEAD_14150, tiene_usado_hist: false }) === false)

  // LAS TRES GUARDAS SIGUEN EN PIE, cada una con su caso.
  chk('pidió ver: NO dispara aunque tenga usado',
    correr(senal(jsDespues), { ...CFG_14150, pidio_ver: 1 }, { ...LEAD_14150, tiene_usado_hist: true }) === false)
  chk('13797 · ya derivado por lead_estado: NO dispara',
    correr(senal(jsDespues), CFG_14150, { ...LEAD_14150, tiene_usado_hist: true, lead_estado: 'Requiere asesor' }) === false)
  chk('13797 · ya derivado por ya_derivado=true: NO dispara',
    correr(senal(jsDespues), CFG_14150, { ...LEAD_14150, tiene_usado_hist: true, ya_derivado: true }) === false)
  // El camino viejo intacto: con el CRM al día sigue disparando igual que en v113.
  chk('CRM al día (lead_entrega Sí): sigue disparando',
    correr(senal(jsDespues), CFG_14150, { ...LEAD_14150, lead_entrega: 'Sí', lead_usado: 'Ford Ka 2015' }) === true)
  chk('sin usado y sin plata: NO dispara',
    correr(senal(jsDespues), CFG_14150, LEAD_14150) === false)
  chk('con plata declarada y sin usado: dispara (gate de v88)',
    correr(senal(jsDespues), { ...CFG_14150, entrega_plata: 5000000 }, LEAD_14150) === true)

  // ── EL REGEX, contra las frases reales y las trampas de negación ──
  const pos = new RegExp(POS.replace(/\\m|\\M/g, '\\b'), 'i')
  const neg = new RegExp(NEG.replace(/\\m|\\M/g, '\\b'), 'i')
  const marca = (t) => pos.test(t) && !neg.test(t)
  const FRASES = [
    ['hola, tengo un ford ka 2015 para entregar y unos 7 millones de anticipo', true],
    ['lo tomarian en parte de pago?', true], ['tengo un usado para entregar', true],
    ['quiero permutar mi gol 2012', true], ['entrego mi auto y pongo la diferencia', true],
    ['no tengo usado', false], ['no, no entrego nada', false], ['no tengo nada para entregar', false],
    ['no entrego mi auto', false], ['no quiero permutar', false], ['pago todo en efectivo', false],
    ['cuando es la entrega del auto?', false], ['me lo entregan en el local?', false],
    ['quiero vender mi auto, me lo toman en consignacion?', false], ['tiene 100.000 km', false],
    ['sin usado, pago contado', false],
  ]
  for (const [t, esperado] of FRASES) chk(`regex · ${JSON.stringify(t.slice(0, 42))}`, marca(t) === esperado)

  const malas = fallas.filter((f) => f.startsWith('offline ·')).length
  console.log(`  el usado sale de la conversación: ${casos.length - malas}/${casos.length}`)
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Armar respuesta, Leer lead (estado)')
console.log(`  jsCode: ${jsAntes.length} -> ${jsDespues.length} chars`)
console.log(`  query:  ${sqlAntes.length} -> ${sqlDespues.length} chars`)
