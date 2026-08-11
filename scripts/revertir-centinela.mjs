// v93 -> v94 · REVERTIR la fila centinela. `Listar stock` vuelve a como estaba en v92.
//
// POR QUÉ SE REVIERTE — las dos razones están medidas, no supuestas:
//
// 1) NO ARREGLA EL BUG QUE QUERÍA ARREGLAR. La hipótesis era "el gate deja 0 filas y el modelo
//    llena el vacío". **Es falsa.** Ejecución `11993`: Franco listó "Volkswagen Saveiro 2019 —
//    $9.300.000" y "Fiat Strada 2018 — $8.900.000" —ninguno existe— y **`Listar stock` NO APARECE
//    EN EL LOG: no la llamó**. La invención no necesita el vacío de la tool.
//    Lo que la dispara es otra cosa: Franco dice un techo de $10.000.000, el cliente quiere una
//    pickup 4x2, y **no hay ninguna en ese rango** (verificado contra la base: en $10.000.000
//    entran 2 autos, los dos hatchback; la pickup más accesible está en $32.000.000).
//    Con el check `no_inventa_autos` puesto, v93 midió `entregar-plata-no-es-permuta` **3/4**:
//    igual que v92. Cero mejora.
//
// 2) HACE DAÑO, Y TAMBIÉN ESTÁ MEDIDO. `financiacion-no-dumpea-abanico-sin-pedirlo` bajó de
//    **4/4 a 2/4**, y una de las rojas es el turno 4 —*"dale, mostrame qué autos me entran"*,
//    justo donde SÍ hay que mostrar— quedando **sin autos**.
//    **PRUEBA VINCULANTE — ejecución `12009`:** `Listar stock` se llamó 3 veces; las dos primeras
//    (con `tiene_permuta: 1`) devolvieron la centinela porque todo quedaba `fuera`, y la tercera
//    (con `tiene_permuta: 0`) **SÍ devolvió autos reales** (Gol Trend y Fiesta). Franco igual no
//    mostró nada.
//    **EL ERROR DE DISEÑO ES MÍO Y ES EL TEXTO:** la centinela dice "ESTE TURNO NO ES PARA MOSTRAR
//    AUTOS", una instrucción a nivel TURNO. Alcanza con que UNA llamada devuelva la centinela para
//    que Franco dé el turno entero por "no mostrar", aunque otra llamada le traiga autos.
//
// LO QUE SÍ APORTABA v93 y se pierde al revertir: cortaba el loop de reintentos (en `11923` la
// tool se llamó 11 veces contra el vacío, 23 s). Es real, pero es mucho menor que dejar sin autos
// a un cliente que los pidió.
//
// SI ALGUIEN QUIERE RETOMAR LA IDEA: el problema no es la fila centinela, es que su texto habla
// del TURNO. Una centinela que hable sólo de ESA CONSULTA ("esta búsqueda no corresponde acá")
// no tendría ese efecto. Pero antes de eso conviene arreglar la causa real (que no ofrezca lo que
// no existe), porque la invención ocurre igual sin llamar a la tool.
//
// 1 NODO: `Listar stock` vuelve, byte a byte, al de v92.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v93.json'
const PREVIO = 'workflows/franco-n8n-v92.json'
const DESTINO = 'workflows/franco-n8n-v94.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const v93 = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const v92 = JSON.parse(fs.readFileSync(PREVIO, 'utf8'))

const iListar = wf.nodes.findIndex((n) => n.name === 'Listar stock')
if (iListar < 0) throw new Error('no encontré Listar stock')
const listarV92 = v92.nodes.find((n) => n.name === 'Listar stock')
if (!listarV92) throw new Error('no encontré Listar stock en v92')

// Sólo se revierten los `parameters`: id/position/credenciales del nodo vivo se conservan.
wf.nodes[iListar] = { ...wf.nodes[iListar], parameters: JSON.parse(JSON.stringify(listarV92.parameters)) }

// ── Aserciones ──────────────────────────────────────────────────────────────
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(v93.connections), 'cambiaron las connections')

const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(v93.nodes[i])).map((n) => n.name)
ok(JSON.stringify(distintos) === JSON.stringify(['Listar stock']),
  `esperaba UN solo nodo con diferencias; hay: ${JSON.stringify(distintos)}`)

// El nodo revertido queda IDÉNTICO al de v92 (es un revert, no una variante nueva).
ok(JSON.stringify(wf.nodes[iListar].parameters) === JSON.stringify(listarV92.parameters),
  'Listar stock no quedó idéntico al de v92')
ok(!JSON.stringify(wf.nodes[iListar]).includes('no_mostrar'), 'quedó rastro de la centinela')
ok(!JSON.stringify(wf.nodes[iListar]).includes('filtrado AS ('), 'quedó rastro del CTE de v93')

// Todo lo demás sigue en v93 = v92 en esos nodos (v93 sólo tocó Listar stock).
const vsV92 = wf.nodes
  .filter((n, i) => JSON.stringify(n.parameters) !== JSON.stringify(v92.nodes[i].parameters))
  .map((n) => n.name)
ok(vsV92.length === 0, `v94 debería ser idéntico a v92 en parameters; difieren: ${JSON.stringify(vsV92)}`)

// Los gates de v85 y v89 vuelven enteros, y no se le pregunta nada nuevo al modelo.
const q = wf.nodes[iListar].parameters.query
for (const gate of [
  "$('Config').item.json.pidio_ver }} = 0)",
  "$('Config').item.json.monto_financiar }} > 0 OR",
  "u.tramo = 'fuera'", "u.categoria = 'fuera'",
]) ok(q.includes(gate), `se perdió un gate: ${JSON.stringify(gate)}`)
ok(q.trim().endsWith('ORDER BY u.precio_num DESC;'), 'la query no volvió al ORDER BY de v92')
const nV92 = (JSON.stringify(v92.nodes).match(/\$fromAI\(/g) || []).length
const nV94 = (JSON.stringify(wf.nodes).match(/\$fromAI\(/g) || []).length
ok(nV92 === nV94, `cambió la cantidad de $fromAI: ${nV92} -> ${nV94}`)

// Los fixes de prompt de v86-v92 NO se tocan: siguen vivos.
const sm = wf.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage
for (const frag of [
  'MONTO A FINANCIAR',                                    // v86
  'está hablando de PLATA',                               // v87
  'ESTA SECCIÓN NO CORRE EN ESTE TURNO',                  // v88
  'financiamos hasta el 50% del valor del vehículo, así que para financiar', // v92
]) ok(sm.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  único nodo con diferencias vs v93: Listar stock`)
console.log(`  query: ${v93.nodes[iListar].parameters.query.length} -> ${q.length} chars (vuelve a v92)`)
console.log(`  v94 es idéntico a v92 en todos los parameters: sí`)
