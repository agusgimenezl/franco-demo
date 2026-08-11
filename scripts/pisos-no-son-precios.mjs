// v95 -> v96 · los PISOS DE STOCK no son el precio de ningún auto (regresión mía de v95)
//
// QUÉ MIDIÓ v95: `no-ofrecer-lo-que-no-existe` **0/3 -> 1/3** (ventana 00:31:58–00:35:00,
// `search_executions`: 0 en `error`). Las dos capas funcionan:
//   · `Leer lead (estado)` devuelve `pisos_carroceria` (visto en el log de `12073`);
//   · el guion adhiere: *"la pickup más accesible está en $32.000.000. Necesitarías $16.000.000
//     de anticipo, porque financiamos hasta el 50% del valor del vehículo."*
//
// EL DAÑO NUEVO, Y ES UN ERROR DE DISEÑO MÍO. PRUEBA VINCULANTE, ejecución `12073`:
// **`Listar stock` NO aparece en el runData —no la llamó— y aun así listó**
//   `- Volkswagen Gol Trend 2022 — 30.000 km — $8.200.000`
//   `- Toyota Etios 2019 — 45.000 km — $9.500.000`
// **$8.200.000 es el piso del Hatchback de MI PROPIA LÍNEA**; el Gol Trend sale $9.200.000.
// `no_inventa_autos` lo cazó en 2 de 3. Sobre v94 ese check NO se disparaba en este caso: es
// REGRESIÓN, no ruido.
//
// LA CAUSA, EXACTA: el bullet que escribí dice "decile el número Y MOSTRALE IGUAL lo que SÍ le
// entra" en el turno donde **el gate de v89 le prohíbe llamar la herramienta** (el cliente está
// DANDO plata y `pidio_ver = 0`). Le pedí listar sin darle de dónde sacar los datos, y llenó el
// hueco con el único número que tenía a mano — el mío. Es el patrón que ya documentó v93 (el
// modelo llena el vacío), pero esta vez el vacío lo abrió la línea nueva. Mi propio caso de eval
// lo delata: pide `cards_empty` en el turno 3 y el prompt le pedía mostrar.
//
// EL CAMBIO, dos ediciones en el mismo bullet-block:
//   (1) el guion termina OFRECIENDO, no listando: los autos se muestran en el turno siguiente,
//       cuando el cliente dice que sí y la herramienta los trae. Así deja de chocar con v89.
//   (2) bullet nuevo con ANTI-EJEMPLO TEXTUAL de `12073` (trampa 6: sin ejemplo, la regla pierde
//       contra lo que el modelo ya está haciendo): los montos de PISOS DE STOCK son pisos de
//       SEGMENTO, nunca el precio de un auto en una lista; sin llamada a la herramienta, no se
//       listan autos.
//
// 1 NODO, 1 CAMPO: `Franco (AI Agent)` → System Message.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v95.json'
const DESTINO = 'workflows/franco-n8n-v96.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage no arranca con "="')

const VIEJO =
  '- Cuando lo que pidió NO le entra, no se lo escondas ni se lo maquilles: decile el número y mostrale igual lo que SÍ le entra. Guion, TEXTUAL, con los dos números de la línea de arriba (el piso de esa carrocería y su mitad): "La pickup más accesible que tengo es de $32.000.000. Necesitarías $16.000.000 de anticipo, ya que el máximo a financiar es el 50% del valor del vehículo." Y seguís con lo que sí le entra, llamándolo por su carrocería REAL: "con tu anticipo te entran estos hatchbacks: ...".'

const NUEVO =
  '- Cuando lo que pidió NO le entra, no se lo escondas ni se lo maquilles: decile el número. Guion, TEXTUAL, con los dos números de la línea de arriba (el piso de esa carrocería y su mitad): "La pickup más accesible que tengo es de $32.000.000. Necesitarías $16.000.000 de anticipo, ya que el máximo a financiar es el 50% del valor del vehículo." Y después le OFRECÉS lo que sí le entra, llamándolo por su carrocería REAL y SIN listar todavía: "con tu anticipo sí te entran hatchbacks, querés que te los muestre?". Los autos se listan en el turno siguiente, cuando diga que sí y la herramienta te los traiga.\n' +
  '- LOS MONTOS DE "PISOS DE STOCK" NO SON EL PRECIO DE NINGÚN AUTO: son el piso de un segmento, el precio del más barato de esa carrocería. NUNCA los uses como precio en una lista. Ya pasó y es grave: con "Hatchback desde $8.200.000" en esa línea escribiste "- Volkswagen Gol Trend 2022 — 30.000 km — $8.200.000", y el Gol Trend sale $9.200.000. El precio, el año y los km de un auto SALEN SIEMPRE de la herramienta, nunca de esta línea ni de tu memoria. Y si en ese turno no llamaste a la herramienta, NO listás autos: ofrecés mostrarlos.'

if (sm.split(VIEJO).length !== 2) throw new Error('no encontré (una sola vez) el bullet de v95 a reemplazar')
franco.parameters.options.systemMessage = sm.replace(VIEJO, () => NUEVO)
const smNuevo = franco.parameters.options.systemMessage

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name)
ok(JSON.stringify(distintos) === JSON.stringify(['Franco (AI Agent)']),
  `esperaba UN solo nodo con diferencias; hay: ${JSON.stringify(distintos)}`)
ok(smNuevo.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')

// La capa A de v95 queda intacta: el SQL, el campo de Config y el gate de v89 no se tocan.
for (const nm of ['Leer lead (estado)', 'Config', 'Listar stock', 'Buscar auto', 'Armar respuesta']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}
ok(wf.nodes.find((n) => n.name === 'Leer lead (estado)').parameters.query.includes('AS pisos_carroceria'),
  'se perdió la columna pisos_carroceria de v95')
const fromAI = (o) => (JSON.stringify(o).match(/fromAI\(/g) || []).length
ok(fromAI(wf) === fromAI(antes), `cambió la cantidad de $fromAI: ${fromAI(antes)} -> ${fromAI(wf)}`)

// Lo que tiene que quedar (v95) y lo que tiene que aparecer (v96), una sola vez cada uno
for (const frag of [
  '## Antes de ofrecer una carrocería: fijate si existe a ese precio',
  'PISOS DE STOCK (el más accesible de cada carrocería',
  'EL ENCABEZADO NO LLEVA NOMBRE DE CARROCERÍA',
  'ANTES DE CERRAR ESE TURNO MIRÁ LA LÍNEA "PISOS DE STOCK"',
  'Necesitarías $16.000.000 de anticipo, ya que el máximo a financiar es el 50% del valor del vehículo.',
  'LOS MONTOS DE "PISOS DE STOCK" NO SON EL PRECIO DE NINGÚN AUTO',
  'querés que te los muestre?',
]) ok(smNuevo.split(frag).length === 2, `falta o está duplicado: ${JSON.stringify(frag)}`)

// Y lo que NO tiene que quedar: la orden de mostrar en ese turno, que chocaba con el gate de v89.
ok(!smNuevo.includes('decile el número y mostrale igual lo que SÍ le entra'),
  'quedó la orden de v95 que chocaba con el gate de v89')
ok(!smNuevo.includes('"con tu anticipo te entran estos hatchbacks: ..."'),
  'quedó el ejemplo de v95 que invitaba a listar sin herramienta')

// Los fixes previos, intactos
for (const frag of [
  'ESTA SECCIÓN NO CORRE EN ESTE TURNO',                       // v88
  'está hablando de PLATA',                                    // v87
  'MONTO A FINANCIAR',                                         // v86
  'El abanico va SOLO después de que el cliente diga que SÍ',  // v85
  'Tené en cuenta que financiamos hasta el 50% del valor del vehículo', // v92
  'Las "economica" NO se ofrecen',                             // v79
]) ok(smNuevo.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log('  único nodo con diferencias: Franco (AI Agent)')
console.log(`  systemMessage: ${sm.length} -> ${smNuevo.length} chars`)
