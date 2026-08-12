// v137 -> v138 · LOS PISOS DE STOCK NO VAN EN UN TURNO DE "DAR UN DATO"
//
// POR QUÉ: v136 hizo que "Puedo dar un anticipo de 10M" se parsee (antes daba 0). Eso arregló lo
// que tenía que arreglar, pero **despertó DOS inyecciones en vez de una**. Verificado ejecutando
// los bloques del systemMessage con ese turno exacto:
//     v135 (monto = 0)          -> NINGÚN bloque dispara  (por eso Franco improvisaba)
//     v137 (monto = 10.000.000) -> disparan L300 (el guion de v113/v134) Y L149 (PISOS DE STOCK)
//
// El guion de v113 dice "Decí TEXTUAL esta frase" y prohíbe dar precios. PISOS DE STOCK, en cambio,
// le entrega el piso de cada carrocería y el anticipo mínimo. Con las dos cosas juntas el modelo
// armó "podés buscar un auto de hasta $20.000.000" en vez del guion — que es exactamente la falla
// que dejó a `preperfilado-cuotas-aunque-diga-la-palabra-anticipo` en 2/3 sobre v137.
//
// **v136 NO CREÓ ESTE BUG: LO DESTAPÓ.** El conflicto estaba latente y no se veía porque el monto
// nunca llegaba. Es la lección de v128 en otra forma: al agregar algo, preguntate a qué le gana —
// sólo que acá lo agregado no fue un ejemplo sino un DATO, y el dato despertó un bloque dormido.
//
// EL FIX es el patrón de v124 (sacar el insumo): PISOS DE STOCK existe para que Franco no ofrezca
// una carrocería que no entra **cuando va a listar autos**. En un turno donde el cliente está DANDO
// un dato y no pidió ver nada, no hay lista que nombrar: los pisos no aportan y sí compiten.
//
// LO QUE NO SE TOCA, y es lo que hace seguro el cambio: cuando el cliente PIDIÓ ver autos
// (`pidio_ver != 0`) los pisos siguen yendo intactos. El bug que motivó v124 —"y qué pickups
// tenés?", ejecución 15019— es justamente un turno de pedir ver, así que queda cubierto igual.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v137.json'
const DESTINO = 'workflows/franco-n8n-v138.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const agente = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = agente.parameters.options.systemMessage

const ANCLA = "  if (!plata && !tienePresu) return '';\n"
ok(smAntes.split(ANCLA).length === 2, `el ancla de PISOS tenía que estar 1 vez; está ${smAntes.split(ANCLA).length - 1}`)

const GUARDA = [
  "  // v138 · SI ESTE TURNO ES DE DAR UN DATO, LOS PISOS NO VAN. El turno en que el cliente declara",
  "  // su anticipo (o su usado) sin pedir ver nada tiene su propio guion TEXTUAL —el de v113/v134— y",
  "  // esa inyección prohíbe dar precios. Mandarle además los pisos le da material para improvisar un",
  "  // techo y saltearse el guion: medido en `preperfilado-cuotas-aunque-diga-la-palabra-anticipo`,",
  "  // donde contestó \"podés buscar un auto de hasta $20.000.000\" en vez de preguntar las cuotas.",
  "  // Cuando el cliente SÍ pidió ver autos, los pisos van intactos: ahí es donde sirven, y es el",
  "  // caso que motivó v124 (\"y qué pickups tenés?\", ejecución 15019).",
  "  // Y TAMPOCO SE SUPRIMEN SI PIDIÓ UNA CARROCERÍA, aunque no haya pedido ver: el guion de \"lo que",
  "  // pediste no te entra\" saca sus dos números (el piso de esa carrocería y su mitad) DE ESTA",
  "  // MISMA LÍNEA — está escrito así unas líneas más abajo. Sin ella, `no-ofrecer-lo-que-no-existe`",
  "  // se quedaría sin el $32.000.000 y el $16.000.000 que su check exige, en un turno que además es",
  "  // de dar plata (\"Puedo entregar 5.000.000?\").",
  "  {",
  "    const _tieneUsado = (() => { try { return String($('Leer lead (estado)').item.json.lead_entrega || '') === 'Sí'; } catch (e) { return false; } })();",
  "    const _pidioCarroceria = String(c.carroceria_pedida || '').trim() !== '';",
  "    if (Number(c.pidio_ver || 0) === 0 && (plata || _tieneUsado) && !_pidioCarroceria) return '';",
  "  }",
  '',
].join('\n')

let sm = smAntes.replace(ANCLA, ANCLA + GUARDA)
agente.parameters.options.systemMessage = sm

// ── ASERCIONES DE NO-PÉRDIDA ─────────────────────────────────────────────────────────────────
ok(sm.includes('PISOS DE STOCK (el más accesible de cada carrocería'), 'se perdió el bloque de PISOS')
ok(sm.includes("if (!plata && !tienePresu) return '';"), 'se perdió la guarda de v124')
ok(sm.includes('Decí TEXTUAL esta frase, que YA ESTÁ ARMADA'), 'se perdió el guion de v113')
ok(sm.includes('En cuántas cuotas lo pensabas, 12, 24, 36 o 48?'), 'se perdió la rama de las cuotas (v134)')
ok(sm.includes('el anticipo mínimo para ese auto es '), 'se perdió la rama del anticipo insuficiente (v134)')

// ── EL BLOQUE DE PISOS, EJECUTADO EN LOS 4 ESCENARIOS QUE IMPORTAN ───────────────────────────
const cuerpoPisos = (() => {
  const i = sm.lastIndexOf('{{ (() => {', sm.indexOf('PISOS DE STOCK (el más accesible'))
  return sm.slice(i + 3, sm.indexOf('})() }}', i) + 4)
})()

const correr = (cfgX, leadX = {}) => {
  const cfg = {
    pidio_ver: 0, entrega_plata: 0, entrega_plata_hist: 0, entrega_plata_resp: 0,
    monto_financiar: 0, monto_financiar_hist: 0, empresa_moneda_simbolo: '$',
    pisos_carroceria: 'Hatchback desde $8.200.000 (anticipo mínimo $4.100.000)',
    ...cfgX,
  }
  const lead = { lead_presupuesto: 'No mencionado', lead_entrega: 'No mencionado', ...leadX }
  return new Function('$node', '$', `return ${cuerpoPisos}`)({ Config: { json: cfg } }, () => ({ item: { json: lead } }))
}

// 1) EL CASO DEL BUG: declara anticipo y NO pidió ver -> los pisos NO van.
ok(correr({ entrega_plata: 10000000 }) === '', 'el turno de dar el anticipo sigue recibiendo los pisos')
// 2) Declara que entrega un usado y no pidió ver -> tampoco.
ok(correr({ entrega_plata: 5000000 }, { lead_entrega: 'Sí' }) === '', 'el turno del usado sigue recibiendo los pisos')
// 3) EL CASO DE v124: pidió ver autos -> los pisos VAN, intactos.
const conPedido = correr({ entrega_plata: 10000000, pidio_ver: 1 })
ok(conPedido.includes('PISOS DE STOCK'), 'se rompió el caso de v124: pidió ver y no le llegan los pisos')
ok(conPedido.includes('$8.200.000'), 'los pisos llegaron sin los números')
// 4) Sin plata ni presupuesto -> sigue sin ir (guarda original de v124, intacta).
ok(correr({}) === '', 'la guarda original de v124 dejó de funcionar')
// 3bis) EL CASO `no-ofrecer-lo-que-no-existe`, turno 3: pidió una PICKUP y da plata sin pedir ver.
// Los pisos TIENEN que llegar igual, porque el guion de "lo que pediste no te entra" saca de ahí
// sus dos números ($32.000.000 y su mitad) y el check del caso los exige.
const conCarroceria = correr({ entrega_plata: 5000000, carroceria_pedida: 'pickup' })
ok(conCarroceria.includes('PISOS DE STOCK'), 'se rompió no-ofrecer-lo-que-no-existe: pidió pickup y se quedó sin los pisos')
ok(conCarroceria.includes('$8.200.000'), 'los pisos llegaron sin los números en el turno de la carrocería')
// 5) Con presupuesto declarado y pidió ver -> va.
ok(correr({ pidio_ver: 1 }, { lead_presupuesto: '$15.000.000' }).includes('PISOS DE STOCK'), 'con presupuesto y pedido de ver, los pisos tienen que ir')

// ── Nada más se movió ────────────────────────────────────────────────────────────────────────
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const distintos = wf.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name)
ok(distintos.length === 1 && distintos[0] === 'Franco (AI Agent)', `tocó ${distintos.length} nodos (${distintos.join(', ')})`)
ok(wf.nodes.length === 35, `quedaron ${wf.nodes.length} nodos, tenían que ser 35`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  nodos: ${wf.nodes.length} · con diferencias: ${distintos.join(', ')}`)
console.log(`  systemMessage: ${smAntes.length} -> ${sm.length} chars (+${sm.length - smAntes.length})`)
console.log('  bloque de PISOS ejecutado en 5 escenarios: 3 donde NO va, 2 donde SÍ va intacto')
