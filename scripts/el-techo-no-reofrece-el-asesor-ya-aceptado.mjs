// v132 -> v133 · EL GUION DEL TECHO NO RE-OFRECE UN ASESOR QUE EL CLIENTE YA ACEPTÓ
//
// TRAMPA 7, LA TERCERA VEZ EN EL DÍA: antes de culpar al modelo, fijate si la frase la escribe el
// código. `derivacion-aceptada-igual-pide-nombre` viene rojo desde v128 y NO es adherencia de
// prompt: la respuesta que falla está escrita TEXTUAL en una inyección determinística (la de v100).
//
// LA PRUEBA — la inyección ordena, literalmente, "Decí TEXTUAL esta frase":
//   "Perfecto. Con un anticipo de $15.000.000 y sin un usado para entregar, podríamos buscar
//    vehículos de hasta aproximadamente $30.000.000, ya que financiamos hasta el 50% del valor de
//    la unidad. Si te parece, puedo mostrarte las opciones disponibles dentro de ese rango o, si
//    preferís, puedo ponerte en contacto con un asesor para revisar alternativas de financiación."
// Y lo que Franco entregó en las 3 corridas de la línea de base de v131 es esa frase, palabra por
// palabra. El check que da rojo (`text_not_matches`) matchea "preferís, puedo ponerte en contacto
// con un asesor" — o sea, EL CIERRE QUE LA PROPIA INYECCIÓN LE MANDA DECIR.
//
// POR QUÉ ES UN BUG: el caso llega a ese turno con el cliente que YA ACEPTÓ la derivación (turno 2)
// y sin nombre. Re-ofrecerle el asesor le dice que no lo escucharon, y encima se come el name-ask,
// que es lo único que falta para completar la derivación. La inyección de v100 se escribió para el
// cliente que reciÉn declara su anticipo, y no distingue si ya está derivado.
//
// POR ESO RESTAURAR EL FIX DE v75 (v131) NO ALCANZÓ: la inyección restaurada ESTÁ y dispara, pero
// ésta se declara "la regla que manda sobre cualquier otra" y le gana. Dos inyecciones peleando en
// el mismo turno; la más imperativa se lleva el turno.
//
// EL FIX: el cierre de esa frase pasa a depender de dos datos que YA EXISTEN en el lead —
// determinístico, regla del proyecto:
//   · no derivado todavía  -> el cierre de hoy, intacto (ofrecer opciones o un asesor)
//   · ya derivado, sin nombre -> pedir el nombre
//   · ya derivado, con nombre -> ofrecer las opciones, SIN re-ofrecer el asesor
// El resto de la frase (los números, el techo, la prohibición de nombrar autos más caros) no se toca.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v132.json'
const DESTINO = 'workflows/franco-n8n-v133.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const agente = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = agente.parameters.options.systemMessage

// ── 1) El cálculo del cierre, insertado justo antes del return ───────────────────────────────
const ANCLA = '  const techo = ant * 2;\n'
ok(smAntes.split(ANCLA).length === 2, `el ancla "const techo = ant * 2;" tiene que estar 1 vez; está ${smAntes.split(ANCLA).length - 1}`)

const CALCULO = ANCLA
  + '  // v133 · EL CIERRE DEPENDE DE SI YA ESTÁ DERIVADO. Esta frase se escribió para el cliente que\n'
  + '  // reciÉn declara su anticipo; a uno que YA aceptó la derivación, re-ofrecerle el asesor le dice\n'
  + '  // que no lo escucharon y encima se come el name-ask. Los dos datos ya están en el lead.\n'
  + '  const _lead = $(\'Leer lead (estado)\').item.json;\n'
  + '  const _derivado = _lead.lead_estado === \'Requiere asesor\' || _lead.ya_derivado === true || _lead.ya_derivado === \'t\' || _lead.ya_derivado === \'true\';\n'
  + '  const cierre = !_derivado\n'
  + '    ? \'Si te parece, puedo mostrarte las opciones disponibles dentro de ese rango o, si preferís, puedo ponerte en contacto con un asesor para revisar alternativas de financiación."\'\n'
  + '    : (_lead.lead_nombre\n'
  + '      ? \'Si te parece, puedo mostrarte las opciones disponibles dentro de ese rango."\'\n'
  + '      : \'Me dejás tu nombre y apellido así un asesor te contacta y te pasa el detalle?"\');\n'

let sm = smAntes.replace(ANCLA, () => CALCULO)

// ── 2) El cierre fijo del guion pasa a ser la variable ───────────────────────────────────────
const CIERRE_VIEJO = 'Si te parece, puedo mostrarte las opciones disponibles dentro de ese rango o, si preferís, puedo ponerte en contacto con un asesor para revisar alternativas de financiación."'
// Ojo: después del paso 1 el texto aparece DOS veces (la rama "no derivado" lo repite).
// Se reemplaza la ÚLTIMA, que es la del guion; la primera es la del cálculo.
const iUlt = sm.lastIndexOf(CIERRE_VIEJO)
ok(iUlt !== -1, 'no encontré el cierre viejo del guion')
ok(sm.split(CIERRE_VIEJO).length === 3, `esperaba 2 apariciones tras insertar el cálculo, hay ${sm.split(CIERRE_VIEJO).length - 1}`)
sm = sm.slice(0, iUlt) + "' + cierre + '" + sm.slice(iUlt + CIERRE_VIEJO.length)
agente.parameters.options.systemMessage = sm

// ── Aserciones ──────────────────────────────────────────────────────────────────────────────
ok(sm.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Franco (AI Agent)']),
  `esperaba SÓLO Franco (AI Agent); hay: ${JSON.stringify(distintos)}`)
ok(sm.includes("' + cierre + '"), 'el guion no quedó usando la variable')
ok(sm.split(CIERRE_VIEJO).length === 2, 'el cierre fijo tiene que quedar SÓLO dentro del cálculo (rama "no derivado")')
// Los números y la prohibición del techo no se tocan.
ok(sm.includes('así que su techo es '), 'se perdió el cálculo del techo')
ok(sm.includes('PROHIBIDO EN ESTE TURNO, y es la regla que manda sobre cualquier otra: nombrar, listar u ofrecer un auto que valga más de '),
  'se perdió la prohibición de ofrecer autos por encima del techo')
// Lo ganado en la cadena v128-v132 sigue.
ok(sm.includes('el plan y el valor de la cuota te los confirma un asesor, porque depende de las condiciones de financiación'), 'se perdió el porqué (v128)')
ok(sm.includes('"24 creo que sería mejor"'), 'se perdió el contra-ejemplo (v129)')
ok(sm.includes('<su nombre de pila>'), 'se perdió el placeholder (v130)')
ok(!/[Pp]erfecto Mart[ií]n/.test(sm), 'volvió una plantilla de salida con nombre propio (v132)')

// ── Las 3 ramas, EJECUTADAS de verdad ───────────────────────────────────────────────────────
// Es la lección de v122: no alcanza con que el string esté, tiene que evaluar y ramificar bien.
const iIni = sm.lastIndexOf('{{ (() => {', sm.indexOf('const ant = Number(cfg.entrega_plata || 0) || Number(cfg.entrega_plata_resp || 0) || Number(cfg.entrega_plata_hist || 0);'))
const iFin = sm.indexOf('})() }}', iIni)
ok(iIni !== -1 && iFin !== -1, 'no pude aislar el bloque para evaluarlo')
const cuerpo = sm.slice(iIni + 3, iFin + 4) // "(() => { ... })()"
const evaluar = (lead) => {
  const cfg = {
    entrega_plata: 0, entrega_plata_resp: 0, entrega_plata_hist: 15000000,
    monto_financiar: 0, monto_financiar_hist: 0, carroceria_pedida: '',
    mensaje_usuario: 'no tengo usado, y serian 36 cuotas', empresa_moneda_simbolo: '$',
  }
  const $node = { Config: { json: cfg } }
  const $ = () => ({ item: { json: { ...lead, pisos_map: {} } } })
  return new Function('$node', '$', `return ${cuerpo}`)($node, $)
}
try {
  const sinDerivar = evaluar({ lead_estado: 'Nuevo', lead_nombre: '' })
  const derivSinNombre = evaluar({ lead_estado: 'Requiere asesor', lead_nombre: '' })
  const derivConNombre = evaluar({ lead_estado: 'Requiere asesor', lead_nombre: 'Julieta Miguez' })
  ok(sinDerivar.includes('puedo ponerte en contacto con un asesor'), 'sin derivar: perdió el ofrecimiento de asesor, y ahí SÍ va')
  ok(derivSinNombre.includes('Me dejás tu nombre y apellido'), 'derivado sin nombre: no pide el nombre')
  ok(!derivSinNombre.includes('puedo ponerte en contacto con un asesor'), 'derivado sin nombre: RE-OFRECE el asesor')
  ok(!derivConNombre.includes('puedo ponerte en contacto con un asesor'), 'derivado con nombre: RE-OFRECE el asesor')
  ok(!derivConNombre.includes('Me dejás tu nombre'), 'derivado con nombre: le pide el nombre teniéndolo')
  ok(derivSinNombre.includes('$30.000.000') && derivConNombre.includes('$30.000.000'), 'se perdió el techo en alguna rama')
  console.log('  ramas evaluadas de verdad: 3/3')
} catch (e) {
  fallas.push(`el bloque no evalúa: ${e.message}`)
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log('  nodos con diferencias: Franco (AI Agent)')
console.log(`  systemMessage: ${smAntes.length} -> ${sm.length} chars (+${sm.length - smAntes.length})`)
