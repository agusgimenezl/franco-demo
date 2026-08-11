// v127 -> v128 · LAS CUOTAS SE CONTESTAN CON EL PORQUÉ
//
// EL BUG, medido 0/5 sobre v127 (`cuotas-el-plazo-se-contesta-y-se-deriva`): el cliente pregunta
// "cómo sería si hacemos 24 cuotas??" y Franco contesta, TEXTUAL:
//   "Perfecto, le dejo anotado al asesor la simulación con $13.000.000 de anticipo en 24 cuotas.
//    Me dejás tu nombre y apellido"
// Nunca dice de qué depende, así que se lee como una evasiva: el cliente preguntó algo concreto y
// le contestaron con un trámite. Es la charla real de Valentina Uria (sesión 340c6109).
//
// TRAMPA 6 EN ESTADO PURO, Y LA PRUEBA ES QUE LA FRASE ESTÁ ESCRITA EN EL PROMPT:
//   línea 320: Guion: "perfecto, le dejo anotado al asesor la simulación con $15.000.000 de
//              anticipo en 36 cuotas. Me dejás tu nombre y apellido así te contacta?"
// Franco no está fallando: está OBEDECIENDO. Por eso esto NO se arregla agregando una regla que
// diga "explicá el porqué" — el ejemplo de abajo le gana a la regla de arriba, y ya pasó tres
// veces en este proyecto. Se arregla REEMPLAZANDO EL GUION, que es lo único que el modelo copia.
//
// LA CONDUCTA CORRECTA LA DEFINIÓ AGUSTINA (2026-08-11), textual:
//   "Con 24 cuotas, el plan y el valor de la cuota te los confirma un asesor, porque depende de las
//    condiciones de financiación. Si querés, te derivo para que te pase el detalle."
//
// DECISIÓN QUE ESTE FIX RESPETA Y QUE NO HAY QUE REVERTIR: Franco NO dice el monto a financiar
// (precio - anticipo). Se evaluó, era determinístico y habría ido a SQL por la regla del proyecto,
// pero Agustina decidió que no hace falta. De paso evita un problema ya medido: el corrector de
// precios de v105 se comía ese número en 2 de 7 redacciones (probado con el corrector real).
//
// LO QUE NO SE TOCA, A PROPÓSITO:
//   · Que Franco no invente un valor de cuota. No hay tasa en Config y la FAQ ya dice que la
//     simulación la arma un asesor. Eso está bien y sigue igual.
//   · El name-ask. Sin nombre la derivación queda incompleta y el lead anónimo — es una decisión
//     vieja del proyecto. El guion nuevo CONSERVA el pedido de nombre, sólo le antepone el porqué.
//   · NADA de SQL, ningún corrector, ninguna tool. 1 nodo, 1 campo.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v127.json'
const DESTINO = 'workflows/franco-n8n-v128.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const agente = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = agente.parameters.options.systemMessage

// EL PORQUÉ, una sola redacción para las tres apariciones: si cada guion lo dice distinto, el
// modelo elige y volvemos al problema de siempre.
const PORQUE = 'el plan y el valor de la cuota te los confirma un asesor, porque depende de las condiciones de financiación'

const CAMBIOS = [
  // 1) La frase canónica. Antes decía cómo sonaba bien; ahora dice que sin el porqué NO alcanza.
  [
    'La frase es siempre "para que un asesor te arme la simulación exacta con los montos finales, ...";'
    + ' decir "el asesor te arma el cálculo exacto" se lee bien, no evasivo.',
    'LA FRASE SIEMPRE LLEVA EL PORQUÉ, y sin el porqué se lee como una excusa: "' + PORQUE + '".'
    + ' Decir sólo "para que un asesor te arme la simulación exacta con los montos finales" —sin decir'
    + ' DE QUÉ DEPENDE— es exactamente lo que se lee evasivo: el cliente preguntó algo concreto y le'
    + ' contestaste con un trámite. El porqué no es un adorno: es la respuesta.',
  ],
  // 2) EL GUION QUE CAUSA EL BUG. Es el que Franco recita palabra por palabra.
  [
    'Guion: "perfecto, le dejo anotado al asesor la simulación con $15.000.000 de anticipo en 36 cuotas.'
    + ' Me dejás tu nombre y apellido así te contacta?".',
    'Guion: "perfecto, con 36 cuotas ' + PORQUE + '. Me dejás tu nombre y apellido así te contacta y te'
    + ' pasa el detalle?". SI EL CLIENTE PREGUNTÓ POR UN PLAZO ("cómo sería con 24 cuotas?"), eso es una'
    + ' PREGUNTA y se contesta antes de pedirle nada: primero el plazo que nombró y el porqué, y recién'
    + ' después el nombre, en el mismo mensaje.',
  ],
  // 3) La variante para cuando el nombre ya lo tenés. Misma frase, sin pedir el nombre de nuevo.
  [
    'Guion para ese caso: "perfecto Martín, le dejo anotado al asesor la simulación con tu anticipo y las'
    + ' cuotas, y te contacta por acá. Necesitás algo más mientras tanto?".',
    'Guion para ese caso: "perfecto Martín, ' + PORQUE + ', y te contacta por acá con el detalle.'
    + ' Necesitás algo más mientras tanto?".',
  ],
]

let sm = smAntes
for (const [viejo, nuevo] of CAMBIOS) {
  ok(sm.split(viejo).length === 2, `no encontré (exactamente 1 vez) el texto: ${JSON.stringify(viejo.slice(0, 60))}`)
  sm = sm.replace(viejo, () => nuevo)
}
agente.parameters.options.systemMessage = sm

// ── Aserciones ──────────────────────────────────────────────────────────────────────────────
ok(sm.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Franco (AI Agent)']),
  `esperaba SÓLO Franco (AI Agent); hay: ${JSON.stringify(distintos)}`)

// EL TEXTO VIEJO YA NO ESTÁ. Es la aserción que pide el proyecto y la que de verdad importa acá:
// si el guion viejo sobrevive en algún lado, el modelo lo va a copiar igual (trampa 6).
for (const [viejo] of CAMBIOS) {
  ok(!sm.includes(viejo), `el texto VIEJO sigue estando: ${JSON.stringify(viejo.slice(0, 60))}`)
}
ok(!sm.includes('le dejo anotado al asesor la simulación con $15.000.000'),
  'sobrevivió el guion de $15.000.000, que es el que Franco recita')

// EL PORQUÉ ESTÁ, Y EN LOS TRES LUGARES.
ok(sm.split(PORQUE).length === 4, `el porqué tiene que estar 3 veces, está ${sm.split(PORQUE).length - 1}`)

// LO QUE NO SE PUEDE HABER PERDIDO: el name-ask y la prohibición de inventar montos de cuota.
ok(sm.includes('Me dejás tu nombre y apellido así te contacta y te pasa el detalle?'),
  'se perdió el pedido de nombre en el guion principal')
ok(sm.includes('NUNCA des un monto exacto en pesos de una cuota'),
  'se perdió la prohibición de dar un monto de cuota')
ok(sm.includes('Recién con el anticipo preguntás las cuotas (12, 24, 36 o 48)'),
  'se perdió el embudo de pre-perfilado')

// El resto del prompt no se movió más que en lo previsto.
const delta = sm.length - smAntes.length
ok(delta > 0 && delta < 1500, `el systemMessage cambió ${delta} chars, esperaba un cambio chico y positivo`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log('  nodos con diferencias: Franco (AI Agent)')
console.log(`  systemMessage: ${smAntes.length} -> ${sm.length} chars (+${delta})`)
console.log(`  guiones reemplazados: ${CAMBIOS.length} · el porqué queda 3 veces`)
