// v97 -> v98 · "todavía faltan $25.000.000": la resta se RENDERIZA, no se le pide al modelo
//
// EL BUG (reporte de Agustina 2026-08-06, con captura). Cliente: "Quiero financiar 30.000.000"
// -> Franco dice bien el guion de v92 (el auto tiene que valer al menos $60.000.000). Cliente:
// "5.000.000" de anticipo -> Franco contesta "Perfecto, con $5.000.000 de anticipo y la
// posibilidad de financiar hasta el 50%, un asesor podrá armarte la simulación exacta" y DERIVA
// como si la operación cerrara, cuando todavía faltan ~$25.000.000. Y después pregunta por un
// usado SIN EXPLICAR PARA QUÉ, con lo que la charla se vuelve un cuestionario.
//
// REPRODUCIDO ANTES DE TOCAR NADA: `financiacion-cuanto-falta` (caso nuevo, 3 turnos, SIN
// carrocería a propósito) mide **0/3 sobre v97**, ventana 01:44:40-01:45:51 verificada con 0
// ejecuciones en error. La única roja es la que importa: no dice el número que falta. El turno 2
// (la precondición de v92) sale bien en las 3, así que el rojo del turno 3 mide lo que dice medir.
//
// LEÍDO DEL LOG, NO SUPUESTO — ejecución `12220` (turno 3), nodo `Config`:
//   monto_financiar: 0   ·   entrega_plata: 5000000   ·   estado_cliente: "(Todavía no te dio
//   ningún dato.)"  (el CRM no guardó ni el presupuesto ni lead_financia)
// O sea: el 30.000.000 que el cliente dijo un turno antes NO ESTÁ EN NINGUNA PARTE del contexto
// calculado. `monto_financiar` (v86) se calcula del mensaje de ESTE turno y en el turno del
// anticipo vale 0. Por eso Franco no puede restar: no tiene el minuendo.
//
// EL CAMBIO — el mismo patrón de v97 (`carroceria_pedida_hist`), tres nodos:
//   (A) `Leer lead (estado)`: UNA subconsulta ESCALAR más, `msg_financiar_hist` — el último
//       mensaje del CLIENTE (rol 'user') que habla de financiar y trae un número. Se trae el
//       TEXTO CRUDO, no el número: así el parseo lo hace UNA sola implementación (la de v86) y no
//       hay dos parsers para desincronizar. Probada contra la base real (Supabase por MCP) con
//       una session_id REAL (-> "Quiero financiar 30.000.000") y una INEXISTENTE (-> '', trampa 4).
//   (B) `Config`: campo nuevo `monto_financiar_hist`, DERIVADO por reemplazo de la expresión de
//       `monto_financiar` — literalmente el mismo parser, cambiándole la fuente del texto. No se
//       toca `monto_financiar`: es la entrada del gate de v88 y del precio_objetivo de
//       `Listar stock`, y ensancharlo movería cosas que ya están medidas.
//   (C) `Franco (AI Agent)`: la inyección RENDERIZADA con el guion de Agustina TEXTUAL, al
//       principio de `# Financiación`, justo debajo de la de v86/v92.
//
// PRIORIDAD, Y ES DELIBERADA: si dispara la inyección de v97 (el cliente pidió una carrocería que
// no existe a ese precio), ESTA NO DISPARA. Dos frases textuales en el mismo turno es pedirle al
// modelo que arbitre, que es justo lo que este proyecto ya midió que no funciona. La de v97 es más
// específica y está medida (0 de 3 ofrecimientos falsos); esta cubre el camino sin carrocería, que
// es el de la captura. CONSECUENCIA BUSCADA: en `entregar-plata-no-es-permuta` (turno 1 = "pickup
// 4x2") manda la de v97, así que ese caso NO cambia de conducta y su check ancho —que prohíbe
// "parte de pago" en ese turno— no hay que tocarlo todavía.
//
// CUÁNDO DISPARA: entrega_plata > 0 (el cliente dio plata, no un usado — el propio campo ya
// devuelve 0 si hay usado declarado) Y hay un monto a financiar (de este turno o del historial) Y
// la resta da positivo. Si el anticipo ya cubre la otra mitad, la operación cierra y no hay nada
// que avisar.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v97.json'
const DESTINO = 'workflows/franco-n8n-v98.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// ─────────────────────────────────────────────────────────── (A) SQL
const lead = wf.nodes.find((n) => n.name === 'Leer lead (estado)')
const qAntes = lead.parameters.query

const ANCLA_SQL = 'FROM (SELECT 1) d\nLEFT JOIN crm_leads l ON l.session_id = $1;'
if (qAntes.split(ANCLA_SQL).length !== 2) throw new Error('no encontré (una sola vez) el cierre del SELECT')

const COLUMNA = `,
  -- msg_financiar_hist: el último mensaje del CLIENTE que habla de financiar Y trae un número.
  -- Hace falta porque monto_financiar (v86) se calcula del mensaje de ESTE turno, y en el turno
  -- en que el cliente contesta el anticipo el monto a financiar quedó 2 turnos atrás (verificado
  -- en la ejecución 12220: monto_financiar=0, entrega_plata=5000000).
  -- Se trae el TEXTO CRUDO y no el número a propósito: el parseo lo hace Config con el MISMO
  -- parser de monto_financiar, así no hay dos implementaciones que se desincronicen.
  -- El mensaje de ESTE turno todavía no está en mensajes_demo (se guarda después de responder),
  -- así que esto es historial puro y nunca le gana al turno actual.
  -- Subconsulta ESCALAR: no cambia la cantidad de filas (trampa 4).
  COALESCE((
    SELECT m.contenido->>'text'
    FROM mensajes_demo m
    WHERE m.session_id = $1 AND m.rol = 'user'
      AND m.contenido->>'text' ~* 'financi'
      AND m.contenido->>'text' ~ '[0-9]'
    ORDER BY m.id DESC
    LIMIT 1
  ), '')                                                   AS msg_financiar_hist
`
lead.parameters.query = qAntes.replace(ANCLA_SQL, () => COLUMNA + ANCLA_SQL)

// ─────────────────────────────────────────────────────────── (B) Config
const cfg = wf.nodes.find((n) => n.name === 'Config')
const asg = cfg.parameters.assignments.assignments
ok(!asg.some((a) => a.name === 'monto_financiar_hist'), 'ya existía el campo monto_financiar_hist')

const mf = asg.find((a) => a.name === 'monto_financiar')
ok(!!mf, 'no está el campo monto_financiar de v86')
const FUENTE_VIEJA = "String($('Webhook Render').item.json.body.content || '')"
const FUENTE_NUEVA = "String($('Leer lead (estado)').item.json.msg_financiar_hist || '')"
ok(String(mf.value).split(FUENTE_VIEJA).length === 2,
  'la expresión de monto_financiar no lee el mensaje del turno como esperaba: no puedo derivar el parser')
// El MISMO parser, cambiándole de dónde saca el texto. Un solo lugar donde arreglarlo.
const valorHist = String(mf.value).replace(FUENTE_VIEJA, () => FUENTE_NUEVA)
asg.push({
  id: 'a29-monto-financiar-hist',
  name: 'monto_financiar_hist',
  value: valorHist,
  type: 'number',
})

// ─────────────────────────────────────────────────────────── (C) prompt
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage no arranca con "="')

const ANCLA_SM = '\nCuando pregunten por financiación, cuotas, prenda, gastos o documentación,'
if (sm.split(ANCLA_SM).length !== 2) throw new Error('no encontré (una sola vez) el ancla de # Financiación')

// La guarda de v97, replicada TEXTUAL (se asierta abajo que sigue siendo la misma expresión que
// vive en la inyección de v97): si esa dispara, esta se calla.
const GUARDA_V97 = "!carr || !piso || !techo || piso <= techo"

const INYECCION = `{{ (() => {
  const cfg = $node["Config"].json;
  const anticipo = Number(cfg.entrega_plata || 0);
  const financiar = Number(cfg.monto_financiar || 0) || Number(cfg.monto_financiar_hist || 0);
  const falta = financiar - anticipo;
  if (!anticipo || !financiar || falta <= 0) return '';
  const carr = String(cfg.carroceria_pedida || '');
  const mapa = $('Leer lead (estado)').item.json.pisos_map || {};
  const piso = Number(mapa[carr] || 0);
  const techo = anticipo * 2;
  if (!(${GUARDA_V97})) return '';
  const m = (n) => cfg.empresa_moneda_simbolo + String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
  return 'DATO YA CALCULADO DE ESTA CONVERSACIÓN, ES VERDAD Y NO SE DISCUTE: el cliente quiere financiar ' + m(financiar) + ' y su anticipo es ' + m(anticipo) + ', así que para completar la otra mitad del valor del vehículo TODAVÍA LE FALTAN ' + m(falta) + '. CON ESTOS NÚMEROS LA OPERACIÓN NO CIERRA. PROHIBIDO EN ESTE TURNO, y es la regla que manda sobre cualquier otra: darla por armada, decir que un asesor le arma la simulación, derivarlo o pedirle el nombre. Decí TEXTUAL esta frase, que YA ESTÁ CALCULADA —no la recalcules, no la resumas y no le cambies los números—: "Perfecto. Con un anticipo de ' + m(anticipo) + ' y queriendo financiar ' + m(financiar) + ', todavía faltarían aproximadamente ' + m(falta) + ' para completar la otra mitad del valor del vehículo. Tenés un auto para entregar como parte de pago? Si es así, decime cuál es (marca, modelo y año) y vemos si la operación puede cerrar con esos valores." El usado se lo pedís ASÍ, con el para qué adelante: preguntárselo suelto convierte la charla en un cuestionario. Nada más en este turno.\\n';
})() }}`

franco.parameters.options.systemMessage = sm.replace(ANCLA_SM, () => '\n' + INYECCION + ANCLA_SM)
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
for (const col of ['AS pisos_carroceria', 'AS pisos_map', 'AS carroceria_pedida_hist']) {
  ok(lead.parameters.query.includes(col), `se perdió la columna de v95/v97: ${col}`)
}
ok(lead.parameters.query.split('AS msg_financiar_hist').length === 2, 'la columna nueva falta o está duplicada')

// El parser derivado tiene que ser el MISMO, salvo la fuente del texto.
ok(valorHist.split(FUENTE_NUEVA).length === 2 && !valorHist.includes(FUENTE_VIEJA),
  'monto_financiar_hist no quedó apuntando (solo) al historial')
ok(valorHist.length === String(mf.value).length - FUENTE_VIEJA.length + FUENTE_NUEVA.length,
  'monto_financiar_hist difiere del parser de monto_financiar en algo más que la fuente')
ok(JSON.stringify(asg.find((a) => a.name === 'monto_financiar')) ===
   JSON.stringify(antes.nodes.find((n) => n.name === 'Config').parameters.assignments.assignments
     .find((a) => a.name === 'monto_financiar')),
  'se tocó monto_financiar y no debe (es la entrada del gate de v88 y de Listar stock)')

// Lo que no se toca
for (const nm of ['Listar stock', 'Buscar auto', 'Detalle auto', 'Armar respuesta', 'Guardar mensajes (historial)']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}
for (const frag of [
  'ESTA SECCIÓN NO CORRE EN ESTE TURNO', 'está hablando de PLATA', 'MONTO A FINANCIAR',
  'El abanico va SOLO después de que el cliente diga que SÍ',
  'Tené en cuenta que financiamos hasta el 50% del valor del vehículo',
  'Las "economica" NO se ofrecen',
  'LOS MONTOS DE "PISOS DE STOCK" NO SON EL PRECIO DE NINGÚN AUTO',   // v96
  'EL ENCABEZADO NO LLEVA NOMBRE DE CARROCERÍA',                       // v95
  'OFRECER ALGO QUE NO EXISTE TAMBIÉN ES INVENTAR',                    // v97
  'DATO YA CALCULADO DE ESTA CONVERSACIÓN',                            // v97 (inyección carrocería)
]) ok(smNuevo.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)
ok(smNuevo.split('TODAVÍA LE FALTAN').length === 2, 'la inyección nueva falta o está duplicada')

// La guarda replicada tiene que ser LA MISMA que la de v97: si alguien toca una y no la otra,
// las dos inyecciones se pisan y este assert lo caza.
ok(smNuevo.split(GUARDA_V97).length === 3,
  `esperaba la guarda ${JSON.stringify(GUARDA_V97)} exactamente 2 veces (v97 + la nueva)`)

// ── PRUEBA VINCULANTE: las dos inyecciones COMPILAN, renderizan lo que deben, y NUNCA
//    disparan las dos en el mismo turno.
{
  const MAPA = { suv: 19800000, sedan: 16800000, pickup: 32000000, hatchback: 8200000, utilitario: 18500000 }
  const extraer = (marca) => {
    const i = smNuevo.indexOf(marca)
    const ini = smNuevo.lastIndexOf('{{', i)
    const fin = smNuevo.indexOf('})() }}', i)
    return smNuevo.slice(ini + 2, fin + 5)
  }
  try {
    const compilar = (src) => new Function('$node', '$', `return (${src})`)
    const fNueva = compilar(extraer('TODAVÍA LE FALTAN'))
    const fV97 = compilar(extraer('NO HAY NINGUNA '))
    const correr = (f, o) => f(
      { Config: { json: Object.assign({ empresa_moneda_simbolo: '$', carroceria_pedida: '', monto_financiar: 0, monto_financiar_hist: 0, entrega_plata: 0 }, o) } },
      () => ({ item: { json: { pisos_map: MAPA } } }),
    )

    // EL CASO MEDIDO (ejecución 12220): sin carrocería, monto del historial, anticipo del turno.
    const caso = { monto_financiar: 0, monto_financiar_hist: 30000000, entrega_plata: 5000000 }
    const con = correr(fNueva, caso)
    ok(con.includes('$25.000.000'), 'la frase no trae lo que falta')
    ok(con.includes('$30.000.000') && con.includes('$5.000.000'), 'la frase no trae los dos números de origen')
    ok(/"Perfecto\. Con un anticipo de \$5\.000\.000 y queriendo financiar \$30\.000\.000, todavía faltarían aproximadamente \$25\.000\.000 para completar la otra mitad del valor del vehículo\. Tenés un auto para entregar como parte de pago\? Si es así, decime cuál es \(marca, modelo y año\) y vemos si la operación puede cerrar con esos valores\."/.test(con),
      'el guion de Agustina no quedó TEXTUAL')

    // Mismo turno pero el monto viene del mensaje de ESTE turno: tiene que dar igual.
    ok(correr(fNueva, { monto_financiar: 30000000, entrega_plata: 5000000 }) === con,
      'no renderiza igual cuando el monto viene del turno en vez del historial')

    // NO dispara donde no debe.
    ok(correr(fNueva, { monto_financiar_hist: 30000000, entrega_plata: 0 }) === '', 'dispara sin anticipo')
    ok(correr(fNueva, { entrega_plata: 5000000 }) === '', 'dispara sin monto a financiar')
    ok(correr(fNueva, { monto_financiar_hist: 5000000, entrega_plata: 5000000 }) === '',
      'dispara cuando el anticipo YA cubre la otra mitad (la operación cierra)')
    ok(correr(fNueva, { monto_financiar_hist: 5000000, entrega_plata: 9000000 }) === '',
      'dispara con la resta negativa')

    // LA PRIORIDAD: con carrocería sin stock a ese precio manda v97 y esta se calla.
    const conPickup = { carroceria_pedida: 'pickup', monto_financiar_hist: 30000000, entrega_plata: 5000000 }
    ok(correr(fNueva, conPickup) === '', 'las dos inyecciones disparan juntas con pickup + $5.000.000')
    ok(correr(fV97, conPickup) !== '', 'la de v97 dejó de disparar en el camino que ya estaba medido')

    // Y ninguna combinación las dispara a la vez.
    for (const carr of ['', 'pickup', 'suv', 'sedan', 'hatchback', 'utilitario']) {
      for (const ant of [0, 3000000, 5000000, 9000000, 16000000, 20000000]) {
        for (const fin of [0, 5000000, 30000000, 60000000]) {
          const o = { carroceria_pedida: carr, monto_financiar_hist: fin, entrega_plata: ant }
          ok(!(correr(fNueva, o) && correr(fV97, o)),
            `disparan las dos juntas: carroceria=${carr || '(ninguna)'} anticipo=${ant} financiar=${fin}`)
        }
      }
    }
    console.log('\n  frase renderizada (sin carrocería, financiar $30.000.000, anticipo $5.000.000):')
    console.log('  ' + con.slice(con.indexOf('"Perfecto.'), con.indexOf('valores."') + 9))
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
