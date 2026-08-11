// v112 -> v113 · SI NO PIDIÓ VER Y ESTÁ DANDO DATOS, NO SE LISTA — AUNQUE LOS ids EXISTAN
//
// EL SABOR 2, EL ÚLTIMO DE LOS TRES. v111 tapa el turno cuando los ids que devolvió el modelo NO
// hidratan. Pero cuando trae ids REALES de memoria, hidratan, salen cards y el bloque no dispara.
// MEDIDO SOBRE v112 (ventana 21:04:46–21:12:13): el turno 2 de `capacidad-de-compra-financiada`
// falla 3 de 3 con `cards_empty: esperaba 0 cards, hay 6` (y 5, y 6) más el texto listando
// "Gol Trend". Es el MISMO turno de siempre: el cliente contesta los km de su usado y no pide ver.
// Antes, en `13583`, las cards ni siquiera coincidían con los autos del texto.
//
// LA SEÑAL, Y POR QUÉ NO ES UNA RÉPLICA DE LA REGLA: se usan los MISMOS campos que ya deciden esto
// en otros lados, no una paráfrasis.
//   · `Config.pidio_ver` — el mismo campo que lee el gate de `Listar stock`.
//   · el usado — la MISMA expresión que ya usa el fallback de TB-3 en este nodo
//     (`lead_entrega === 'Sí' || lead_usado !== 'No mencionado'`).
//   · la plata — los MISMOS campos de `Config` que lee el gate gemelo de v88 en el SQL.
//   · `ya_derivado` — el mismo criterio que ya usa el guard de cierre de este nodo.
//
// EL `ya_derivado` NO ES UN DETALLE: ES LO QUE EVITA CAMBIAR UN ROJO POR OTRO PEOR. En la ejecución
// `13797` (turno 10 de `charla-real`) el lead trae `ya_derivado: true` y `lead_usado: "No
// mencionado"`; sin esta guarda, el guion saldría "Querés que te contacte un asesor para avanzar?"
// **a alguien que ya está derivado**, que es un bug que este proyecto ya arregló. Con la guarda,
// ese turno NO se toca — sigue abierto y con su propia evidencia, como corresponde.
//
// EL CAMBIO — UN NODO, UNA CONDICIÓN MÁS en la guarda que v107 escribió y v111 revivió:
//   if (centinela || (ids.length > 0 && autos.length === 0))
//   -> ... || (noPidioVer && estaDandoDatos && !yaDerivado)
// El cuerpo del bloque NO se toca (assert byte a byte): sigue exigiendo DOS o más renglones de
// lista CON PRECIO que nombren un auto del catálogo, que es lo que separa "listó un abanico" de
// "contestó una pregunta". Y sigue reemplazando por el guion de v102.
//
// LO QUE ADEMÁS HACE FALTA: cuando el bloque dispara, las cards tienen que irse con el texto. Hoy
// `autos` puede tener filas hidratadas (por eso salían 6 cards), así que el bloque también las
// vacía. Sin eso quedaría el guion con seis fotos abajo, que es peor que el bug.
//
// EL RIESGO RESIDUAL, DICHO DERECHO: si el cliente pide ver con una frase que el regex de
// `pidio_ver` no reconoce (por ejemplo "y de esos cuáles me convienen?"), teniendo un usado
// declarado y sin estar derivado, este bloque le reemplazaría una respuesta legítima por el guion.
// El requisito de DOS renglones de lista con precio lo acota, pero no lo elimina. Es la contracara
// de cerrar el sabor 2 por código, y hay que medirlo en los controles.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v112.json'
const DESTINO = 'workflows/franco-n8n-v113.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ar = wf.nodes.find((n) => n.name === 'Armar respuesta')
const jsAntes = ar.parameters.jsCode

const VIEJO = `    if (centinela || (ids.length > 0 && autos.length === 0)) {`
const NUEVO = `    // SI NO PIDIÓ VER Y ESTÁ DANDO DATOS, ESTE TURNO NO ERA DE MOSTRAR (v113) — aunque los ids
    // existan y hidraten. Medido sobre v112: el turno 2 de \`capacidad-de-compra-financiada\` sale
    // con 5 y 6 cards de autos traídos de memoria.
    // Cada pieza es el MISMO dato que ya decide esto en otro lado, no una paráfrasis:
    // \`pidio_ver\` es el campo que lee el gate de \`Listar stock\`; el usado usa la misma expresión
    // que el fallback de TB-3 de este nodo; la plata, los mismos campos de Config que el gate de
    // v88; y \`ya_derivado\`, el mismo criterio que el guard de cierre de acá abajo.
    // LA GUARDA DE \`ya_derivado\` NO SE SACA: sin ella, en la ejecución 13797 (ya_derivado true) el
    // guion le ofrecería un asesor a alguien que YA está derivado. Ese turno queda sin tocar.
    let _noEraDeMostrar = false;
    try {
      const _le2 = $('Leer lead (estado)').first().json;
      const _tieneUsado = String(_le2.lead_entrega || '') === 'Sí' ||
        (_le2.lead_usado && _le2.lead_usado !== 'No mencionado');
      const _dioPlata = Number(cfg.monto_financiar || 0) > 0 || Number(cfg.entrega_plata || 0) > 0 ||
        Number(cfg.entrega_plata_resp || 0) > 0;
      const _yaDerivado = String(_le2.lead_estado || '') === 'Requiere asesor' || _le2.ya_derivado === true;
      _noEraDeMostrar = Number(cfg.pidio_ver || 0) === 0 && (_tieneUsado || _dioPlata) && !_yaDerivado;
    } catch (e) {}
    if (centinela || (ids.length > 0 && autos.length === 0) || _noEraDeMostrar) {`
ok(jsAntes.split(VIEJO).length === 2, 'no encontré (una sola vez) la guarda de v111')

// Y cuando dispara, las cards se van con el texto: si no, quedaría el guion con las fotos abajo.
const CIERRE_VIEJO = `        messages = [{ type: 'text', content: _conUsado`
const CIERRE_NUEVO = `        // Las cards se van con el texto (v113): si el turno no era de mostrar, tampoco van las
        // fotos. Sin esto quedaría el guion con seis autos abajo, que es peor que el bug.
        autos.length = 0;
        messages = [{ type: 'text', content: _conUsado`
ok(jsAntes.split(CIERRE_VIEJO).length === 2, 'no encontré (una sola vez) el cierre del bloque de v107')

ar.parameters.jsCode = jsAntes.replace(VIEJO, () => NUEVO).replace(CIERRE_VIEJO, () => CIERRE_NUEVO)
const jsDespues = ar.parameters.jsCode

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Armar respuesta']),
  `esperaba SÓLO Armar respuesta; hay: ${JSON.stringify(distintos)}`)
ok(jsDespues.split(VIEJO).length === 1, 'la guarda vieja sigue en el código')
ok(jsDespues.split('_noEraDeMostrar').length === 4, 'la señal nueva tiene que aparecer 3 veces (declarar, asignar, usar)')
ok(jsDespues.split('        autos.length = 0;\n        messages = [{').length === 2, 'el vaciado de cards falta o está duplicado')

// EL CUERPO DEL BLOQUE (el que decide y arma el guion) NO SE TOCA, salvo el vaciado de cards.
{
  const cuerpo = (js) => {
    const i = js.indexOf("      const _le = $('Leer lead (estado)').first().json;\n      const _cat = _le.catalogo_precios")
    return js.slice(i, js.indexOf('if (_listados >= 2)', i))
  }
  ok(cuerpo(jsAntes) === cuerpo(jsDespues) && cuerpo(jsAntes).length > 200,
    'se tocó el detector de renglones del bloque y no debe')
}
for (const frag of ['EL PRECIO LO PONE LA BASE, NO EL MODELO (v105)', 'EL AÑO TAMBIÉN LO PONE LA BASE (v109)',
                    'SE BORRA (v109)', 'LAS CARDS SE RECUPERAN DEL TEXTO (v112)', 'Guard de cierre comercial',
                    "/^s[ií]$/i.test(String(le.lead_financia", 'CENTINELA DE CERO FILAS (v102)']) {
  ok(jsDespues.includes(frag), `se perdió algo de Armar respuesta: ${frag}`)
}
// El bloque de v112 (recuperar cards) tiene que seguir DESPUÉS, para no re-armar lo que este vacía.
ok(jsDespues.indexOf('_noEraDeMostrar') < jsDespues.indexOf('LAS CARDS SE RECUPERAN DEL TEXTO (v112)'),
  'v112 tiene que ir después de v113 en el flujo')
for (const nm of ['Config', 'Leer lead (estado)', 'Franco (AI Agent)', 'Listar stock', 'Detalle auto']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

// ── PRUEBA OFFLINE sobre el v113 GENERADO, con los datos REALES del log.
{
  const desde = jsDespues.indexOf('  // EL TEXTO TAMBIÉN, NO SÓLO LAS CARDS (v107).')
  const src = jsDespues.slice(desde, jsDespues.indexOf('  // LAS CARDS SE RECUPERAN DEL TEXTO (v112)'))
  const CAT = [
    { t: 'Volkswagen Gol Trend', a: 2018, p: 9200000, i: 2, f: 'u' }, { t: 'Toyota Corolla', a: 2022, p: 24800000, i: 5, f: 'u' },
    { t: 'Toyota Etios', a: 2019, p: 12500000, i: 4, f: 'u' }, { t: 'Ford Fiesta', a: 2017, p: 8200000, i: 3, f: 'u' },
    { t: 'Fiat Cronos', a: 2023, p: 16800000, i: 1, f: 'u' }, { t: 'Renault Kangoo', a: 2021, p: 18500000, i: 17, f: 'u' },
  ]
  try {
    const correr = ({ ids = [], autos = [], centinela = false, messages, cfg, lead }) => {
      const $ = () => ({ first: () => ({ json: Object.assign({ catalogo_precios: CAT }, lead) }) })
      const _autos = autos.slice()
      const msgs = messages.map((m) => Object.assign({}, m))
      const f = new Function('ids', 'autos', 'centinela', 'messages', 'cfg', '$',
        src + '\nreturn { messages, autos: autos.length };')
      return f(ids, _autos, centinela, msgs, cfg, $)
    }
    const GUION_USADO = 'Listo, ya tengo los datos de tu Ford Ka 2015. La tasación final la hace un asesor viéndolo en persona. Querés que te contacte un asesor para coordinarla, o preferís que te muestre opciones que te podrían servir?'
    // El texto REAL del turno 2 medido sobre v112.
    const T2 = [{ type: 'text', content: 'Con tu usado como parte de pago, tu anticipo y la posibilidad de financiar, estas opciones te pueden servir:\n- Volkswagen Gol Trend 2018, hatchback — 110.000 km — $9.200.000\n- Toyota Etios 2019, hatchback — 45.000 km — $12.500.000\n- Fiat Cronos 2023, sedán — 28.000 km — $16.800.000' }]
    const CFG0 = { pidio_ver: 0, monto_financiar: 0, entrega_plata: 0, entrega_plata_resp: 0 }
    const LEAD_USADO = { lead_entrega: 'Sí', lead_usado: 'Ford Ka 2015', lead_estado: 'En conversación', ya_derivado: false }
    const SEIS = [{ id: 2 }, { id: 4 }, { id: 1 }, { id: 5 }, { id: 3 }, { id: 17 }]

    const casos = []
    const chk = (n, c, extra) => { casos.push(n); if (!c) fallas.push(`offline · ${n}${extra ? ' :: ' + extra : ''}`) }

    // (1) EL CASO: ids REALES que hidratan, no pidió ver, tiene usado, no derivado.
    const r1 = correr({ ids: [2, 4, 1, 5, 3, 17], autos: SEIS, messages: T2, cfg: CFG0, lead: LEAD_USADO })
    chk('turno 2 · sale el guion', r1.messages.length === 1 && r1.messages[0].content === GUION_USADO, JSON.stringify(r1.messages))
    chk('turno 2 · las cards se van con el texto', r1.autos === 0, 'autos=' + r1.autos)

    // (2) `13797`: YA DERIVADO -> no se toca (evita el bug del asesor repetido).
    const LEAD_DERIV = { lead_entrega: 'No mencionado', lead_usado: 'No mencionado', lead_estado: 'Requiere asesor', ya_derivado: true }
    const r2 = correr({ ids: [], autos: [], messages: T2, cfg: CFG0, lead: LEAD_DERIV })
    chk('13797 · ya derivado: NO se toca', JSON.stringify(r2.messages) === JSON.stringify(T2), JSON.stringify(r2.messages))

    // (3) SI PIDIÓ VER, no se mete (es el turno 3, que hoy está verde 3/3).
    const r3 = correr({ ids: [2, 4, 1], autos: [{ id: 2 }, { id: 4 }, { id: 1 }], messages: T2, cfg: { ...CFG0, pidio_ver: 1 }, lead: LEAD_USADO })
    chk('pidió ver: NO se toca', JSON.stringify(r3.messages) === JSON.stringify(T2) && r3.autos === 3)

    // (4) SIN usado ni plata declarada, no se mete (no está dando datos).
    const LEAD_VACIO = { lead_entrega: 'No mencionado', lead_usado: 'No mencionado', lead_estado: 'Nuevo', ya_derivado: false }
    chk('sin usado ni plata: NO se toca',
      JSON.stringify(correr({ ids: [2], autos: [{ id: 2 }], messages: T2, cfg: CFG0, lead: LEAD_VACIO }).messages) === JSON.stringify(T2))
    // pero con PLATA sí (el gate gemelo de v88).
    chk('con plata declarada: sí dispara',
      correr({ ids: [2], autos: [{ id: 2 }], messages: T2, cfg: { ...CFG0, entrega_plata: 5000000 }, lead: LEAD_VACIO }).messages.length === 1)

    // (5) TEXTO SIN LISTA: no se mete, aunque la condición se cumpla.
    const FICHA = [{ type: 'text', content: 'El Toyota Etios 2019 tiene 45.000 km y sale $12.500.000. Querés que te pase las fotos?' }]
    chk('una ficha suelta (sin lista) NO se toca',
      JSON.stringify(correr({ ids: [4], autos: [{ id: 4 }], messages: FICHA, cfg: CFG0, lead: LEAD_USADO }).messages) === JSON.stringify(FICHA))

    // (6) v111 sigue funcionando: ids que NO hidratan, aunque el cliente HAYA pedido ver.
    const r6 = correr({ ids: [197, 163], autos: [], messages: T2, cfg: { ...CFG0, pidio_ver: 1 }, lead: LEAD_USADO })
    chk('v111 intacto: ids que no hidratan siguen tapados', r6.messages.length === 1 && r6.messages[0].content === GUION_USADO)

    const malas = fallas.filter((f) => f.startsWith('offline ·')).length
    console.log(`  no pidió ver / no se lista: ${casos.length - malas}/${casos.length}`)
    console.log(`  turno 2 ahora: "${r1.messages[0] && r1.messages[0].content}" · cards: ${r1.autos}`)
  } catch (e) {
    fallas.push(`el bloque NO COMPILA: ${e.message}`)
  }
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Armar respuesta')
console.log(`  jsCode: ${jsAntes.length} -> ${jsDespues.length} chars`)
