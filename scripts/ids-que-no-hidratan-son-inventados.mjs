// v110 -> v111 · SI NINGÚN id HIDRATA, LOS AUTOS QUE NOMBRÓ NO SALIERON DE LA BASE
//
// EL PENDIENTE 1, RESUELTO SIN LEER LA TOOL. El bloque de v107 (y el centinela de v102) preguntan
// "¿la herramienta devolvió cero filas?" leyendo `$('Listar stock').first().json`, y ESA LECTURA NO
// FUNCIONA en este nodo. Probado en producción dos veces: en `13583` la tool devolvió el centinela,
// Franco puso ids reales de memoria y **salieron las 6 product_cards igual**; y en `13522` el
// fallback de TB-3 corrió aunque la tool había devuelto filas con `eco_financia: 1`.
// **No hace falta averiguar qué devuelve esa lectura: alcanza con no usarla.**
//
// LA SEÑAL QUE SÍ SIRVE, Y ES 100% MAIN CHAIN — las dos piezas ya se leen en este mismo nodo, son
// de donde salen las cards:
//     `auto_ids` (de `Franco (AI Agent)`) tiene ids, y NINGUNO hidrata en `Hidratar autos`
//     => los autos que nombró no existen en el stock: los inventó.
//
// VERIFICADA DOS VECES EN PRODUCCIÓN, leída del log, no supuesta:
//   · ejecución `13306` (turno 2 de `capacidad-de-compra-financiada`): `auto_ids: [111,112,113,114,
//     115,116]` — el stock va del 1 al 17. Cero filas hidratadas, cero cards, y el texto listaba
//     SEIS autos con precios.
//   · ejecución `13702` (turno 2 de `capacidad-km-alto-achica`, ya sobre v110): `auto_ids:
//     [197,163,128,182,148,176]`. Mismo cuadro. Es el `media_si_lista_autos` TIPO B del eval.
// Y ES CONSISTENTE POR CONSTRUCCIÓN: si la herramienta le hubiera dado autos, usaría SUS ids. Que
// los invente significa que en ese turno no tenía ninguno — que es exactamente lo que v102 quería
// detectar.
//
// EL CAMBIO — UN NODO, UNA CONDICIÓN. El bloque de v107 ya existe, ya está probado y hoy está
// muerto porque su guarda nunca es verdadera. Se le suma la señal que sí funciona:
//     if (centinela)  ->  if (centinela || (ids.length > 0 && autos.length === 0))
// `ids` y `autos` están declarados arriba en este mismo nodo y son los que alimentan las cards.
// `centinela` se deja: si algún día esa lectura se arregla, sigue valiendo, y no cuesta nada.
// El resto del bloque de v107 NO se toca (hay un assert que compara su texto byte a byte): sigue
// exigiendo DOS o más renglones de lista con precio que nombren un auto del catálogo, y sigue
// reemplazando por el guion de v102.
//
// QUÉ VA A PASAR EN ESOS TURNOS: en vez de seis autos inventados sin una sola foto, sale el guion
// "Listo, ya tengo los datos de tu <usado>. La tasación final la hace un asesor viéndolo en
// persona. Querés que te contacte un asesor para coordinarla, o preferís que te muestre opciones
// que te podrían servir?" — que es el turno correcto: el cliente estaba DANDO datos, no pidiendo.
//
// LO QUE ESTE CAMBIO NO CUBRE, DICHO DERECHO: el caso de `13583`, donde los ids son REALES pero
// traídos de memoria. Ahí hidratan, así que este detector no dispara y salen cards que no coinciden
// con el texto. Esa es otra señal (texto contra cards) y va aparte.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v110.json'
const DESTINO = 'workflows/franco-n8n-v111.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ar = wf.nodes.find((n) => n.name === 'Armar respuesta')
const jsAntes = ar.parameters.jsCode

const VIEJO = `  try {
    if (centinela) {`
const NUEVO = `  try {
    // LA SEÑAL QUE SÍ FUNCIONA (v111): si Franco devolvió ids y NINGUNO hidrata, esos autos no
    // están en la base — los inventó. \`ids\` y \`autos\` son main chain y son de donde salen las
    // cards. Verificado en producción: ejecución 13306 (auto_ids [111..116]) y 13702 (auto_ids
    // [197,163,128,182,148,176]); el stock va del 1 al 17. \`centinela\` se deja por si algún día
    // la lectura de la tool se arregla, pero hoy nunca es verdadera y por eso este bloque estaba
    // muerto desde v107.
    if (centinela || (ids.length > 0 && autos.length === 0)) {`
ok(jsAntes.split(VIEJO).length === 2, 'no encontré (una sola vez) la guarda del bloque de v107')

ar.parameters.jsCode = jsAntes.replace(VIEJO, () => NUEVO)
const jsDespues = ar.parameters.jsCode

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Armar respuesta']),
  `esperaba SÓLO Armar respuesta; hay: ${JSON.stringify(distintos)}`)

// EL TEXTO VIEJO YA NO ESTÁ.
ok(jsDespues.split(VIEJO).length === 1, 'la guarda vieja sigue en el código')
ok(jsDespues.split('ids.length > 0 && autos.length === 0').length === 2, 'la guarda nueva falta o está duplicada')
// `ids` y `autos` tienen que estar declarados ANTES del bloque.
ok(jsDespues.indexOf('  const ids = Array.isArray(output.auto_ids)') < jsDespues.indexOf('ids.length > 0 && autos.length === 0'),
  '`ids` se usa antes de declararse')
ok(jsDespues.indexOf('  const autos = [...new Set(ids)]') < jsDespues.indexOf('ids.length > 0 && autos.length === 0'),
  '`autos` se usa antes de declararse')

// EL RESTO DEL BLOQUE DE v107, BYTE A BYTE IGUAL.
{
  const cuerpo = (js) => {
    const i = js.indexOf('      const _le = $(\'Leer lead (estado)\').first().json;\n      const _cat = _le.catalogo_precios')
    return js.slice(i, js.indexOf('} catch (e) {}', i) + 14)
  }
  ok(cuerpo(jsAntes) === cuerpo(jsDespues) && cuerpo(jsAntes).length > 100,
    'se tocó el cuerpo del bloque de v107 y no debe')
}
for (const frag of ['EL PRECIO LO PONE LA BASE, NO EL MODELO (v105)', 'EL AÑO TAMBIÉN LO PONE LA BASE (v109)',
                    'SE BORRA (v109)', 'CENTINELA DE CERO FILAS (v102)', 'Guard de cierre comercial',
                    "/^s[ií]$/i.test(String(le.lead_financia", 'TB-3: encabezado del abanico']) {
  ok(jsDespues.includes(frag), `se perdió algo de Armar respuesta: ${frag}`)
}
for (const nm of ['Config', 'Leer lead (estado)', 'Franco (AI Agent)', 'Listar stock', 'Detalle auto']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

// ── PRUEBA OFFLINE, sobre los CASOS REALES del log.
{
  const desde = jsDespues.indexOf('  // EL TEXTO TAMBIÉN, NO SÓLO LAS CARDS (v107).')
  const hasta = jsDespues.indexOf('  // Guard de cierre comercial')
  const src = jsDespues.slice(desde, hasta)
  const srcViejo = jsAntes.slice(
    jsAntes.indexOf('  // EL TEXTO TAMBIÉN, NO SÓLO LAS CARDS (v107).'),
    jsAntes.indexOf('  // Guard de cierre comercial'))

  // El catálogo tal cual lo devolvió `Leer lead (estado)` en la ejecución 13306.
  const CAT = [
    { a: 2018, p: 9200000, t: 'Volkswagen Gol Trend' }, { a: 2022, p: 24800000, t: 'Toyota Corolla' },
    { a: 2024, p: 21500000, t: 'Chevrolet Onix' }, { a: 2020, p: 19800000, t: 'Ford EcoSport' },
    { a: 2021, p: 25500000, t: 'Jeep Renegade' }, { a: 2019, p: 12500000, t: 'Toyota Etios' },
    { a: 2025, p: 21000000, t: 'Peugeot 208' }, { a: 2023, p: 16800000, t: 'Fiat Cronos' },
  ]
  try {
    const correr = (fuente, { ids, autos, centinela, messages, lead }) => {
      const $ = () => ({ first: () => ({ json: Object.assign({ catalogo_precios: CAT }, lead) }) })
      const msgs = messages.map((m) => Object.assign({}, m))
      const f = new Function('ids', 'autos', 'centinela', 'messages', '$', fuente + '\nreturn messages;')
      return f(ids, autos, centinela, msgs, $)
    }
    const LEAD = { lead_entrega: 'Sí', lead_usado: 'Ford Ka 2015' }
    const GUION = 'Listo, ya tengo los datos de tu Ford Ka 2015. La tasación final la hace un asesor viéndolo en persona. Querés que te contacte un asesor para coordinarla, o preferís que te muestre opciones que te podrían servir?'
    const casos = []
    const chk = (nombre, cond, extra) => { casos.push(nombre); if (!cond) fallas.push(`offline · ${nombre}${extra ? ' :: ' + extra : ''}`) }

    // (1) EL CASO REAL 13702, con sus ids inventados y su texto tal cual.
    const M_13702 = [
      { type: 'text', content: 'Teniendo en cuenta tu anticipo, una estimación preliminar de tu usado y la posibilidad de financiar hasta el 50%, te preparé un abanico de opciones.' },
      { type: 'text', content: 'Entrada:\n- Volkswagen Gol Trend 2018, hatchback, mismo porte que el tuyo — 30.000 km — $9.200.000\n- Toyota Etios 2019, hatchback, consume 6,3 L/100km — 45.000 km — $12.500.000' },
      { type: 'text', content: 'Intermedio:\n- Chevrolet Onix 2024, hatchback — 60.000 km — $21.500.000\n- Fiat Cronos 2023, sedán — 55.000 km — $16.800.000' },
      { type: 'text', content: 'Alto:\n- Jeep Renegade 2021, SUV — 38.000 km — $25.500.000' },
    ]
    const ent13702 = { ids: [197, 163, 128, 182, 148, 176], autos: [], centinela: false, messages: M_13702, lead: LEAD }
    chk('13702 · sobre v110 NO disparaba (el bloque estaba muerto)',
      JSON.stringify(correr(srcViejo, ent13702)) === JSON.stringify(M_13702))
    const r1 = correr(src, ent13702)
    chk('13702 · sobre v111 sale el guion', r1.length === 1 && r1[0].content === GUION, JSON.stringify(r1))

    // (2) EL CASO REAL 13306: ids [111..116], cero hidratados.
    const M_13306 = [
      { type: 'text', content: 'Teniendo en cuenta tu anticipo de $7.000.000, el Ford Ka 2015 que entregás, tenés este abanico:' },
      { type: 'text', content: 'Entrada:\n- Volkswagen Gol Trend 2018, hatchback, $9.200.000\n- Toyota Etios 2019, sedán, $12.500.000\n\nAlto:\n- Jeep Renegade 2021, SUV, $25.500.000' },
    ]
    const r2 = correr(src, { ids: [111, 112, 113, 114, 115, 116], autos: [], centinela: false, messages: M_13306, lead: LEAD })
    chk('13306 · sobre v111 sale el guion', r2.length === 1 && r2[0].content === GUION, JSON.stringify(r2))

    // (3) LO QUE NO DEBE DISPARAR.
    const TRES = [{ id: 4 }, { id: 2 }, { id: 3 }]
    chk('ids que SÍ hidratan: no toca nada',
      JSON.stringify(correr(src, { ids: [4, 2, 3], autos: TRES, centinela: false, messages: M_13306, lead: LEAD })) === JSON.stringify(M_13306))
    chk('sin ids (turno sin autos): no toca nada',
      JSON.stringify(correr(src, { ids: [], autos: [], centinela: false, messages: M_13306, lead: LEAD })) === JSON.stringify(M_13306))
    const SINLISTA = [{ type: 'text', content: 'Listo, ya tengo los datos de tu Ford Ka 2015. Querés que te contacte un asesor?' }]
    chk('ids inventados pero texto SIN lista: no toca nada',
      JSON.stringify(correr(src, { ids: [197], autos: [], centinela: false, messages: SINLISTA, lead: LEAD })) === JSON.stringify(SINLISTA))
    const UNA = [{ type: 'text', content: 'Algo así:\n- Toyota Etios 2019, $12.500.000' }]
    chk('un solo renglón: por debajo del umbral, no toca nada',
      JSON.stringify(correr(src, { ids: [197], autos: [], centinela: false, messages: UNA, lead: LEAD })) === JSON.stringify(UNA))

    // (4) EL CAMINO DEL CENTINELA SIGUE EXISTIENDO (por si esa lectura se arregla algún día).
    const r4 = correr(src, { ids: [], autos: [], centinela: true, messages: M_13306, lead: LEAD })
    chk('centinela solo (sin ids) sigue disparando', r4.length === 1 && r4[0].content === GUION, JSON.stringify(r4))

    // (5) SIN USADO DECLARADO, el otro guion.
    const r5 = correr(src, { ids: [197], autos: [], centinela: false, messages: M_13306, lead: { lead_entrega: 'No mencionado', lead_usado: 'No mencionado' } })
    chk('sin usado sale el guion genérico', r5.length === 1 && r5[0].content.startsWith('Perfecto, ya lo tengo anotado.'), JSON.stringify(r5))

    const malas = fallas.filter((f) => f.startsWith('offline ·')).length
    console.log(`  detector de ids inventados: ${casos.length - malas}/${casos.length}`)
    console.log(`  13702 antes: ${M_13702.length} burbujas con 5 autos y CERO cards`)
    console.log(`  13702 ahora: "${r1[0] && r1[0].content}"`)
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
