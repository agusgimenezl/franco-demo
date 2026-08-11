// v129 -> v130 · EL NOMBRE DE EJEMPLO NO SE LE DICE AL CLIENTE
//
// SEGUNDA REGRESIÓN DE LA CADENA v128/v129, MEDIDA Y ATRIBUIDA SIN AMBIGÜEDAD. Franco le dice
// "Martín" a clientes que NUNCA dieron su nombre. Corridas del guion de
// `derivacion-aceptada-igual-pide-nombre` (el cliente no da nombre en ningún turno):
//
//   2026-08-01  24 corridas  ->  0 dijeron un nombre inventado
//   2026-08-05   4 corridas  ->  0
//   2026-08-11   6 corridas  ->  3        <- v128 + v129
//
// Cero en 28 antes, 3 de 6 después. No es la flakiness histórica del caso: lo introdujo el fix.
//
// POR QUÉ, Y ES UNA VUELTA DE TUERCA DE LA TRAMPA 6 QUE NO ESTABA DOCUMENTADA: el guion con el
// nombre de ejemplo YA EXISTÍA y nunca se copiaba. v128 le agregó EL PORQUÉ —que es justo lo que
// el modelo quiere decir cuando el tema son las cuotas— y con eso volvió más atractiva la rama
// equivocada: ahora el modelo elige ESE guion (el de "ya tenés el nombre") en vez del anónimo, y
// se trae el nombre de ejemplo puesto.
//   -> No alcanza con preguntarse a qué REGLA le gana un ejemplo nuevo (lección de v129).
//      Hay que preguntarse también a qué OTRO EJEMPLO se lo hace parecer, porque el modelo copia
//      lo que más se parece a lo que está por escribir.
//
// EL FIX: sacar el nombre literal del guion y dejar un hueco que NO se puede copiar como nombre,
// más la condición explícita de cuándo el guion no corre. El texto nuevo NO vuelve a escribir el
// nombre de ejemplo: dárselo de nuevo, aunque sea dentro de una prohibición, es cómo se propaga.
//
// NO SE TOCAN las otras apariciones del nombre en el prompt: enseñan a acortar "Nombre Apellido"
// a nombre de pila y están enmarcadas con "si te dice X", que es un uso seguro y necesario.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v129.json'
const DESTINO = 'workflows/franco-n8n-v130.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const agente = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = agente.parameters.options.systemMessage
const martinesAntes = (smAntes.match(/Mart[ií]n/g) || []).length

const VIEJO = 'Guion para ese caso: "perfecto Martín, el plan y el valor de la cuota te los confirma'
  + ' un asesor, porque depende de las condiciones de financiación, y te contacta por acá con el'
  + ' detalle. Necesitás algo más mientras tanto?".'

const NUEVO = 'Guion para ese caso, Y EL NOMBRE VA INTERPOLADO —lo sacás de "Lo que ya sabés de este'
  + ' cliente" o de lo que él mismo te dijo en la charla, NUNCA de un ejemplo—:'
  + ' "perfecto <su nombre de pila>, el plan y el valor de la cuota te los confirma un asesor, porque'
  + ' depende de las condiciones de financiación, y te contacta por acá con el detalle. Necesitás algo'
  + ' más mientras tanto?".'
  + ' SI NO SABÉS CÓMO SE LLAMA, ESTE GUION NO CORRE Y NO INVENTÁS NINGÚN NOMBRE NI COPIÁS UNO DE'
  + ' NINGÚN EJEMPLO: corre el guion de arriba, el que se lo pide. Escribirle un nombre que no es el'
  + ' suyo es de las peores cosas que le podés hacer a una conversación de venta.'

ok(smAntes.split(VIEJO).length === 2, `no encontré (1 vez) el guion de v128/v129; hay ${smAntes.split(VIEJO).length - 1}`)
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
ok(!sm.includes(VIEJO), 'el guion viejo sigue estando')

// EL CORAZÓN DEL FIX: el guion ya no puede tener un nombre propio literal.
// Acotado a la forma de GUION —comilla, "perfecto", nombre, coma— y no a cualquier "perfecto
// Martín": la regla de hablar por el nombre de pila usa esa misma frase de forma legítima, dentro
// de un "si te dice X, le contestás Y". La primera versión de este assert era más ancha y frenó
// el build por esa aparición buena; se deja acotada a propósito.
ok(!/"perfecto Mart[ií]n,/i.test(sm), 'sobrevivió un guion que arranca con un nombre propio literal')
ok(!NUEVO.match(/Mart[ií]n/), 'el texto NUEVO volvió a escribir el nombre de ejemplo')
const martinesDespues = (sm.match(/Mart[ií]n/g) || []).length
ok(martinesDespues === martinesAntes - 1,
  `esperaba sacar exactamente 1 aparición del nombre (${martinesAntes} -> ${martinesAntes - 1}), quedaron ${martinesDespues}`)
// Las que quedan son las que enseñan a acortar nombre+apellido, y tienen que quedar.
ok(sm.includes('Si te dice "Martín D\'Angelo", le contestás "Perfecto Martín"'),
  'se perdió la regla de hablar por el nombre de pila')

// Lo ganado en v128 y v129 no se puede perder.
const PORQUE = 'el plan y el valor de la cuota te los confirma un asesor, porque depende de las condiciones de financiación'
ok(sm.split(PORQUE).length === 4, `el porqué tiene que seguir 3 veces, está ${sm.split(PORQUE).length - 1}`)
ok(sm.includes('"24 creo que sería mejor"'), 'se perdió el contra-ejemplo de v129')
ok(sm.includes('Me dejás tu nombre y apellido así te contacta y te pasa el detalle?'),
  'se perdió el pedido de nombre')
ok(sm.includes('DATO INCOMPLETO: si el cliente contesta solo una parte'), 'se perdió DATO INCOMPLETO')
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
console.log(`  nombre de ejemplo en el prompt: ${martinesAntes} -> ${martinesDespues} apariciones`)
