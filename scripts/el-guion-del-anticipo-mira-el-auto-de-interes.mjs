// v133 -> v134 · EL GUION DEL TURNO DEL ANTICIPO DEPENDE DE SI ESE ANTICIPO CUBRE EL AUTO DE INTERÉS
//
// TRAMPA 7, LA CUARTA VEZ. La respuesta que Agustina capturó (sesión REAL edc12363, Julieta Vega)
// está escrita TEXTUAL en la inyección de v113, como el `guion` del else:
//   'Perfecto, ya lo tengo anotado. Querés que te contacte un asesor para avanzar, o preferís que
//    te muestre opciones que te podrían servir?'
// …y el bloque termina con "Decí TEXTUAL esta frase, que YA ESTÁ ARMADA". Franco no desobedece:
// obedece. Verificado EJECUTANDO el bloque con los datos del caso, no leyéndolo.
//
// ESE MISMO BLOQUE EXPLICA LAS DOS MITADES DEL BUG:
//   (a) no dice que el anticipo no alcanza -> porque le PROHÍBE "dar precios o kilómetros";
//   (b) no pregunta las cuotas -> porque le ordena decir esa frase y nada más.
// No falta una guarda: sobra un guion que ordena la respuesta mala.
//
// EL FIX, MISMO PATRÓN QUE v133 (ramificar un guion con datos que ya están en el lead). Las 4 ramas
// son mutuamente excluyentes y cada caso de eval mide una distinta:
//   · entrega un usado con datos            -> el guion de tasación, INTACTO
//   · UN auto de interés y no le alcanza    -> precio, anticipo mínimo, cuánto falta y su techo
//   · VARIOS autos de interés               -> le recuerda el 50%, sin acusar a ninguno
//   · le alcanza (o no hay auto claro)      -> pregunta las cuotas, que es el paso que faltaba
//
// LA RAMA DE "VARIOS" ES DECISIÓN DE AGUSTINA (2026-08-11): decir "no te alcanza" a alguien a quien
// quizás le entra uno de los tres es el falso positivo más caro de una venta. No compara, pero
// tampoco se calla el criterio.
//
// CÓMO SE CUENTAN LOS AUTOS, Y SALIÓ DEL DATO REAL: NO por las barras. El vehiculo_interes de
// Julieta es "Toyota Etios 2021 / Algo chico, primer auto" — una barra, pero UN auto y una
// descripción. Se cuenta cuántos títulos del catálogo aparecen DE VERDAD en el texto.
//
// RESERVA DECLARADA ANTES DE MEDIR: esto depende de que el CRM ya haya escrito `vehiculo_interes`,
// y el CRM escribe DESPUÉS de responder (>=1 turno tarde). Si en el turno del anticipo el lead
// todavía no lo tiene, no hay contra qué comparar y cae en la rama de las cuotas. En la sesión real
// el dato ESTABA. Si el caso 1 queda flaky, esta es la primera sospecha, no el guion.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v133.json'
const DESTINO = 'workflows/franco-n8n-v134.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const agente = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = agente.parameters.options.systemMessage
let sm = smAntes

const una = (s, t) => s.split(t).length === 2

// ── 1) EL CÁLCULO, insertado justo antes del guion ───────────────────────────────────────────
const ANCLA_CALC = "  const usado = String(lead.lead_usado || '');\n"
ok(una(sm, ANCLA_CALC), `el ancla del cálculo tiene que estar 1 vez; está ${sm.split(ANCLA_CALC).length - 1}`)

const CALCULO = [
  "  // v134 · EL GUION DE ABAJO DEPENDE DE SI EL ANTICIPO CUBRE EL AUTO POR EL QUE VINO.",
  "  // Hasta v133 este bloque contestaba SIEMPRE \"Perfecto, ya lo tengo anotado...\" y encima prohíbe",
  "  // dar precios: por eso Franco no podía decirle a la clienta de la sesión edc12363 que con",
  "  // $6.000.000 no llegaba al Etios ($14.500.000, anticipo mínimo $7.250.000). Los dos datos ya",
  "  // viajan a este bloque —lead_vehiculo y catalogo_precios— y nada los cruzaba. Es una cuenta,",
  "  // así que va en código: regla del proyecto.",
  "  const _ant = antTurno || Number(cfg.entrega_plata_hist || 0);",
  "  const _norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');",
  "  const _cat = Array.isArray(lead.catalogo_precios) ? lead.catalogo_precios : [];",
  "  // NO se cuenta por barras: \"Toyota Etios 2021 / Algo chico, primer auto\" es UN auto y una",
  "  // descripción (sesión edc12363). Se cuenta cuántos títulos del catálogo aparecen de verdad.",
  "  // catalogo_precios ya viene ordenado por largo de título DESC, así que el título largo matchea",
  "  // primero y se saca del texto: \"Gol Trend\" no cuenta además como \"Gol\".",
  "  let _resto = _norm(lead.lead_vehiculo);",
  "  const _hall = [];",
  "  for (const _a of _cat) {",
  "    const _t = _norm(_a.t);",
  "    if (_t && _resto.includes(_t)) { _hall.push(_a); _resto = _resto.split(_t).join(' '); }",
  "  }",
  "  const _m = (n) => cfg.empresa_moneda_simbolo + String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');",
  "  const _uno = _hall.length === 1 ? _hall[0] : null;",
  "  const _precio = _uno ? Number(_uno.p || 0) : 0;",
  "  const _minimo = _precio ? Math.round(_precio / 2) : 0;",
  "  const _noEntra = !!(_ant && _precio && _ant * 2 < _precio);",
  "",
].join('\n')

sm = sm.replace(ANCLA_CALC, CALCULO + ANCLA_CALC)

// ── 2) EL GUION, que pasa de un ternario a las 4 ramas ───────────────────────────────────────
const GUION_VIEJO =
  "    : 'Perfecto, ya lo tengo anotado. Querés que te contacte un asesor para avanzar, o preferís que te muestre opciones que te podrían servir?';\n"
ok(una(sm, GUION_VIEJO), `el guion viejo tiene que estar 1 vez; está ${sm.split(GUION_VIEJO).length - 1}`)

const GUION_NUEVO = [
  "    : (_noEntra",
  "      ? 'Perfecto. Te comento que el ' + _uno.t + ' sale ' + _m(_precio) + ' y, como financiamos hasta el 50% del valor, el anticipo mínimo para ese auto es ' + _m(_minimo) + ': con ' + _m(_ant) + ' te faltarían ' + _m(_minimo - _ant) + '. Con ese anticipo podríamos buscar hasta ' + _m(_ant * 2) + '. Querés que te muestre lo que entra en ese rango?'",
  "      : (_ant && _hall.length > 1",
  "        ? 'Perfecto. Tené en cuenta que el anticipo tiene que ser como mínimo el 50% del valor del vehículo, así que va a depender de cuál elijas. Querés que te muestre cuáles entran con ese anticipo?'",
  "        : (_ant",
  "          ? 'Perfecto. En cuántas cuotas lo pensabas, 12, 24, 36 o 48?'",
  "          : 'Perfecto, ya lo tengo anotado. Querés que te contacte un asesor para avanzar, o preferís que te muestre opciones que te podrían servir?')));",
  "",
].join('\n')

sm = sm.replace(GUION_VIEJO, GUION_NUEVO)

// ── 3) LA PROHIBICIÓN DE DAR PRECIOS NECESITA SU EXCEPCIÓN ───────────────────────────────────
// Sin esto el bloque se contradice: le ordena decir un guion con precios y en el renglón de arriba
// le prohíbe darlos. La excepción es puntual —el auto que el cliente YA nombró— y sólo en la rama
// que lleva números; en las otras tres `_permiso` es '' y el texto queda EXACTAMENTE como estaba.
const ANCLA_PROHIB = 'y armar tramos (entrada/intermedio/alto).'
ok(una(sm, ANCLA_PROHIB), `el ancla de la prohibición tiene que estar 1 vez; está ${sm.split(ANCLA_PROHIB).length - 1}`)
sm = sm.replace(ANCLA_PROHIB, ANCLA_PROHIB + "' + _permiso + '")

const ANCLA_PERMISO = '  const _noEntra = !!(_ant && _precio && _ant * 2 < _precio);\n'
sm = sm.replace(
  ANCLA_PERMISO,
  ANCLA_PERMISO +
    "  // La excepción a \"no des precios\", sólo en la rama que los lleva y ya calculados.\n" +
    "  const _permiso = _noEntra ? ' LA ÚNICA EXCEPCIÓN, y YA ESTÁ CALCULADA, son los números del guion de abajo: el auto por el que el cliente YA preguntó, su precio y su anticipo mínimo van TEXTUALES como están escritos, sin recalcularlos ni redondearlos.' : '';\n",
)

agente.parameters.options.systemMessage = sm

// ── ASERCIONES DE NO-PÉRDIDA ─────────────────────────────────────────────────────────────────
ok(sm.includes('Decí TEXTUAL esta frase, que YA ESTÁ ARMADA'), 'se perdió la orden de decir el guion textual (v113)')
ok(sm.includes('Listo, ya tengo los datos de tu '), 'se perdió el guion de tasación del usado')
ok(sm.includes('Los autos van en el turno SIGUIENTE, si te dice que sí.'), 'se perdió el cierre del bloque de v113')
ok(sm.includes('PROHIBIDO EN ESTE TURNO, y es la regla que manda sobre cualquier otra: nombrar un auto'), 'se perdió la prohibición de inventar autos')
// El texto viejo YA NO ESTÁ como respuesta incondicional: sigue existiendo, pero sólo en la rama
// sin anticipo. Es la aserción que pide el proyecto (verificar que lo viejo se fue de donde estaba).
ok(!sm.includes(GUION_VIEJO), 'el guion viejo sigue siendo la respuesta incondicional del else')
// Lo ganado en la cadena v128-v133 sigue.
ok(sm.includes('el plan y el valor de la cuota te los confirma un asesor, porque depende de las condiciones de financiación'), 'se perdió el porqué (v128)')
ok(sm.includes('"24 creo que sería mejor"'), 'se perdió el contra-ejemplo (v129)')
ok(sm.includes('<su nombre de pila>'), 'se perdió el placeholder (v130)')
ok(!/[Pp]erfecto Mart[ií]n/.test(sm), 'volvió una plantilla de salida con nombre propio (v132)')
ok(sm.includes('Me dejás tu nombre y apellido así un asesor te contacta y te pasa el detalle?'), 'se perdió el name-ask del techo (v133)')

// ── LAS 4 RAMAS, EJECUTADAS DE VERDAD ────────────────────────────────────────────────────────
// No alcanza con que el string esté: tiene que evaluar y ramificar bien. Lección de v122.
const iIni = sm.lastIndexOf('{{ (() => {', sm.indexOf('if (Number(cfg.pidio_ver || 0) !== 0)'))
const iFin = sm.indexOf('})() }}', iIni)
ok(iIni !== -1 && iFin !== -1, 'no pude aislar el bloque de v113 para evaluarlo')
const cuerpo = sm.slice(iIni + 3, iFin + 4)

// El catálogo real al 2026-08-11, con el mismo orden (largo de título DESC) que arma la query.
const CAT = [
  { t: 'Volkswagen Gol Trend', a: 2018, p: 9200000 },
  { t: 'Volkswagen T-Cross', a: 2025, p: 34000000 },
  { t: 'Chevrolet Onix', a: 2024, p: 21500000 },
  { t: 'Toyota Corolla', a: 2022, p: 24800000 },
  { t: 'Renault Duster', a: 2023, p: 22500000 },
  { t: 'Toyota Etios', a: 2021, p: 14500000 },
].sort((x, y) => y.t.length - x.t.length)

const evaluar = (cfgX, leadX) => {
  const cfg = {
    pidio_ver: 0, monto_financiar: 0, monto_financiar_hist: 0,
    entrega_plata: 0, entrega_plata_resp: 0, entrega_plata_hist: 0,
    carroceria_pedida: '', mensaje_usuario: 'tengo 6 millones', empresa_moneda_simbolo: '$',
    ...cfgX,
  }
  const lead = {
    lead_entrega: 'No mencionado', lead_usado: 'No mencionado',
    lead_vehiculo: 'No mencionado', catalogo_precios: CAT, pisos_map: {},
    ...leadX,
  }
  const $node = { Config: { json: cfg } }
  const $ = () => ({ item: { json: lead } })
  return new Function('$node', '$', `return ${cuerpo}`)($node, $)
}

try {
  // RAMA 1 — el caso de la captura: 6M contra el Etios de $14.500.000.
  const noEntra = evaluar({ entrega_plata_resp: 6000000 }, { lead_vehiculo: 'Toyota Etios 2021 / Algo chico, primer auto' })
  ok(noEntra.includes('$7.250.000'), 'rama "no entra": no dice el anticipo mínimo del Etios')
  ok(noEntra.includes('$1.250.000'), 'rama "no entra": no dice cuánto le falta')
  ok(noEntra.includes('$12.000.000'), 'rama "no entra": no dice el techo')
  ok(noEntra.includes('$14.500.000'), 'rama "no entra": no dice el precio del auto')
  ok(!/lo tengo anotado/.test(noEntra), 'rama "no entra": sigue dando la operación por armada')
  ok(noEntra.includes('LA ÚNICA EXCEPCIÓN'), 'rama "no entra": no levantó la prohibición de dar precios')

  // RAMA 2 — varios autos: la regla, sin números y sin acusar a ninguno.
  const varios = evaluar({ entrega_plata_resp: 6000000 }, { lead_vehiculo: 'Chevrolet Onix / Toyota Corolla' })
  ok(/50% del valor del vehículo/.test(varios), 'rama "varios": no recuerda el 50%')
  ok(!/lo tengo anotado/.test(varios), 'rama "varios": sigue dando la operación por armada')
  ok(!/\$21\.500\.000|\$24\.800\.000|te faltarían/.test(varios), 'rama "varios": compara contra un auto, y la decisión es que NO')
  ok(!varios.includes('LA ÚNICA EXCEPCIÓN'), 'rama "varios": levantó la prohibición de precios sin necesitarlo')

  // RAMA 3 — le alcanza: 8M contra el mismo Etios. Acá va la pregunta que faltaba.
  const alcanza = evaluar({ entrega_plata_resp: 8000000 }, { lead_vehiculo: 'Toyota Etios 2021' })
  ok(/cuotas lo pensabas, 12, 24, 36 o 48/.test(alcanza), 'rama "alcanza": no pregunta las cuotas')
  ok(!/te faltarían|anticipo mínimo/.test(alcanza), 'rama "alcanza": le dice que no le alcanza y SÍ le alcanza')
  ok(!/lo tengo anotado/.test(alcanza), 'rama "alcanza": sigue con el cierre que se comía el paso')

  // RAMA 4 — sin anticipo (llegó por el usado): el guion de hoy, INTACTO.
  const sinAnt = evaluar({}, { lead_entrega: 'Sí', lead_vehiculo: 'Toyota Etios 2021' })
  ok(/Perfecto, ya lo tengo anotado\. Querés que te contacte un asesor para avanzar/.test(sinAnt),
    'rama "sin anticipo": se tocó un guion que no había que tocar')

  // EL USADO CON DATOS NO SE TOCÓ, tenga o no anticipo.
  const conUsado = evaluar({ entrega_plata_resp: 6000000 }, { lead_entrega: 'Sí', lead_usado: 'Ford Ka 2015 90.000 km', lead_vehiculo: 'Toyota Etios 2021' })
  ok(/Listo, ya tengo los datos de tu Ford Ka 2015/.test(conUsado), 'el guion de tasación del usado dejó de tener prioridad')

  // LAS GUARDAS QUE YA ESTABAN MEDIDAS SIGUEN GANANDO: si dispara v98/v99 o v100, este bloque cede.
  ok(evaluar({ entrega_plata_resp: 7000000, monto_financiar: 30000000 }, { lead_vehiculo: 'Toyota Etios 2021' }) === '',
    'dejó de ceder ante la guarda de v98/v99 ("todavía te faltan")')
  ok(evaluar({ entrega_plata_resp: 6000000, mensaje_usuario: 'no tengo usado' }, { lead_vehiculo: 'Toyota Etios 2021' }) === '',
    'dejó de ceder ante la guarda de v100 (el techo sin usado)')
  // OJO CON EL CAMPO: la guarda de v97 mira `Number(cfg.entrega_plata || 0)` A SECAS, sin la cadena
  // `|| entrega_plata_resp || entrega_plata_hist` que usan las otras. O sea que sólo dispara cuando
  // el anticipo vino en ESE campo, y por eso la cesión se ejercita con `entrega_plata`. Es una
  // asimetría PREEXISTENTE de v133, no algo que introduzca v134: queda anotada, no tocada
  // (un cambio por vez).
  ok(evaluar({ entrega_plata: 6000000, carroceria_pedida: 'pickup' }, { lead_vehiculo: 'Toyota Etios 2021', pisos_map: { pickup: 38000000 } }) === '',
    'dejó de ceder ante la guarda de v97 (la carrocería que no entra)')

  // Y NO DISPARA CUANDO NO TIENE QUE DISPARAR.
  ok(evaluar({ pidio_ver: 1, entrega_plata_resp: 6000000 }, { lead_vehiculo: 'Toyota Etios 2021' }) === '',
    'dispara en un turno en que el cliente PIDIÓ ver autos')

  // EL CONTROL MÁS SENSIBLE DE v134, Y ES EL RIESGO PROPIO DE LA RAMA DE LAS CUOTAS: el turno 3 de
  // `cuotas-el-plazo-se-contesta-y-se-deriva` llega con el anticipo YA dado turnos atrás (queda en
  // entrega_plata_hist) y con el cliente diciendo "cómo sería si hacemos 24 cuotas?". Si el bloque
  // disparara ahí, le preguntaría las cuotas a alguien que ACABA de decírselas — un bug nuevo,
  // hecho por el fix. No dispara porque el bloque exige plata en ESTE turno (`dioPlata`), no en el
  // historial. Se verifica ejecutando, no razonando: es justo la clase de cosa que se da por obvia.
  ok(evaluar({ entrega_plata_hist: 13000000 }, { lead_vehiculo: 'Peugeot 208' }) === '',
    'dispara con el anticipo SÓLO en el historial: le va a repreguntar las cuotas a quien ya las dio')

  console.log('  ramas evaluadas de verdad: 4/4 + 3 cesiones + 1 no-disparo')
} catch (e) {
  fallas.push(`el bloque no evalúa: ${e.message}`)
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

// El resto del workflow no se toca: un solo nodo cambia.
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i]))
  .map((n) => n.name)
if (distintos.length !== 1 || distintos[0] !== 'Franco (AI Agent)') {
  console.error(`ASERCIÓN FALLIDA: tocó ${distintos.length} nodos (${distintos.join(', ')}), tenía que tocar sólo "Franco (AI Agent)"`)
  process.exit(1)
}
if (wf.nodes.length !== 35) {
  console.error(`ASERCIÓN FALLIDA: quedaron ${wf.nodes.length} nodos, tenían que ser 35`)
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  nodos: ${wf.nodes.length} · con diferencias: ${distintos.join(', ')}`)
console.log(`  systemMessage: ${smAntes.length} -> ${sm.length} chars (+${sm.length - smAntes.length})`)
