// v128 -> v129 · EL PORQUÉ NO SE COME EL PEDIDO DE ANTICIPO
//
// REGRESIÓN INTRODUCIDA POR v128, MEDIDA Y ATRIBUIDA. v128 arregló su caso
// (`cuotas-el-plazo-se-contesta-y-se-deriva` 0/5 -> 5/5) y rompió `financiacion-pide-anticipo`
// (0/3). La atribución no es una sospecha: los TRES turnos 3 contestaron con el guion NUEVO de
// v128, palabra por palabra (sesiones 2276e660, 4fe58204, 92c245a9 del 2026-08-11):
//
//   Franco:  "...de cuánto pensás poner de anticipo más o menos?"
//   Cliente: "24 creo que sería mejor"          <- son CUOTAS, no un anticipo
//   Franco:  "Perfecto, con 24 cuotas el plan y el valor de la cuota te los confirma un asesor,
//             porque depende de las condiciones de financiación. Me dejás tu nombre y apellido...?"
//
// Franco SALTEA el anticipo y va al nombre. La conducta correcta —la que costó v47— es re-pedir el
// monto: sin anticipo el lead pierde el dato clave.
//
// POR QUÉ PASÓ, Y ES LA TRAMPA 6 EN CONTRA DEL QUE ESCRIBE EL FIX: v128 agregó "SI EL CLIENTE
// PREGUNTÓ POR UN PLAZO, eso es una PREGUNTA y se contesta antes de pedirle nada". Esa frase quedó
// DENTRO del guion del name-ask y le ganó a la regla de DATO INCOMPLETO que está justo abajo
// ("si te da las cuotas pero no el anticipo, volvé a pedir el que falta ANTES de seguir").
// El ejemplo nuevo se comió la regla vieja. Es exactamente el patrón que documenta la trampa 6,
// esta vez provocado por un fix.
//
// EL FIX: acotar el disparador con la CONDICIÓN que faltaba (que el anticipo YA esté) y, sobre
// todo, poner el CONTRA-EJEMPLO CONCRETO con su guion. Una condición sola sería otra regla
// abstracta, y contra un ejemplo las reglas pierden — por eso va el diálogo medido, textual.
//
// NO SE TOCA: el porqué (las 3 apariciones), el name-ask, la prohibición de dar montos de cuota.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v128.json'
const DESTINO = 'workflows/franco-n8n-v129.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const agente = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = agente.parameters.options.systemMessage

const VIEJO = ' SI EL CLIENTE PREGUNTÓ POR UN PLAZO ("cómo sería con 24 cuotas?"), eso es una'
  + ' PREGUNTA y se contesta antes de pedirle nada: primero el plazo que nombró y el porqué, y recién'
  + ' después el nombre, en el mismo mensaje.'

const NUEVO = ' SI EL CLIENTE PREGUNTÓ POR UN PLAZO ("cómo sería con 24 cuotas?") Y YA TENÉS SU'
  + ' ANTICIPO, eso es una PREGUNTA y se contesta antes de pedirle nada: primero el plazo que nombró'
  + ' y el porqué, y recién después el nombre, en el mismo mensaje.'
  + ' PERO SI TODAVÍA NO TENÉS EL MONTO DEL ANTICIPO, ESTE GUION NO CORRE, y no importa que haya'
  + ' nombrado un plazo: te falta el dato clave y lo único que hacés es pedirlo.'
  + ' EL CASO CONCRETO, MEDIDO, Y ES EL QUE MÁS SE EQUIVOCA: vos le preguntaste "de cuánto pensás'
  + ' poner de anticipo, más o menos?" y él te contestó "24 creo que sería mejor". ESO SON CUOTAS,'
  + ' NO UN ANTICIPO: no te dio el dato. El guion de ese turno es, entero: "dale, y de cuánto sería'
  + ' el anticipo, más o menos?". Prohibido en ese turno: contestarle con el plan y el asesor,'
  + ' hablarle del porqué, y pedirle el nombre.'

ok(smAntes.split(VIEJO).length === 2, `no encontré (1 vez) el texto de v128; hay ${smAntes.split(VIEJO).length - 1}`)
const sm = smAntes.replace(VIEJO, () => NUEVO)
agente.parameters.options.systemMessage = sm

// ── Aserciones ──────────────────────────────────────────────────────────────────────────────
ok(sm.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Franco (AI Agent)']),
  `esperaba SÓLO Franco (AI Agent); hay: ${JSON.stringify(distintos)}`)

// El texto viejo ya no está (la aserción que pide el proyecto).
ok(!sm.includes(VIEJO), 'el texto de v128 sigue estando')
// Y no puede quedar el disparador SIN la condición: es la firma exacta de la regresión.
ok(!/PLAZO \("cómo sería con 24 cuotas\?"\), eso es una PREGUNTA/.test(sm),
  'quedó el disparador sin la condición "Y YA TENÉS SU ANTICIPO"')

// El contra-ejemplo TIENE que estar, y con el guion textual: es lo único que le gana al ejemplo.
ok(sm.includes('"24 creo que sería mejor"'), 'falta el contra-ejemplo medido')
ok(sm.includes('ESO SON CUOTAS, NO UN ANTICIPO'), 'falta la aclaración de por qué no es el dato')
// El guion del re-pedido tiene que coincidir CON EL QUE YA EXISTE en la regla de DATO INCOMPLETO:
// dos redacciones distintas para lo mismo es pedirle al modelo que elija.
const GUION_REPEDIDO = '"dale, y de cuánto sería el anticipo, más o menos?"'
ok(sm.split(GUION_REPEDIDO).length === 3,
  `el guion del re-pedido tiene que aparecer 2 veces (la regla vieja + el contra-ejemplo), aparece ${sm.split(GUION_REPEDIDO).length - 1}`)
ok(sm.includes('DATO INCOMPLETO: si el cliente contesta solo una parte'),
  'se perdió la regla de DATO INCOMPLETO, que es la que este fix refuerza')

// Lo que v128 ganó no se puede perder.
const PORQUE = 'el plan y el valor de la cuota te los confirma un asesor, porque depende de las condiciones de financiación'
ok(sm.split(PORQUE).length === 4, `el porqué tiene que seguir 3 veces, está ${sm.split(PORQUE).length - 1}`)
ok(sm.includes('Me dejás tu nombre y apellido así te contacta y te pasa el detalle?'),
  'se perdió el pedido de nombre')
ok(sm.includes('NUNCA des un monto exacto en pesos de una cuota'),
  'se perdió la prohibición de dar un monto de cuota')

const delta = sm.length - smAntes.length
ok(delta > 0 && delta < 1200, `el systemMessage cambió ${delta} chars, esperaba un cambio chico y positivo`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log('  nodos con diferencias: Franco (AI Agent)')
console.log(`  systemMessage: ${smAntes.length} -> ${sm.length} chars (+${delta})`)
