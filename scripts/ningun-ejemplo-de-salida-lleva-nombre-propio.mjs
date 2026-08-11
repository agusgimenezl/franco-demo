// v131 -> v132 · NINGÚN EJEMPLO DE SALIDA LLEVA UN NOMBRE PROPIO
//
// v130 sacó el nombre literal de UN guion y NO alcanzó: el 2026-08-11, ya con v131 en producción,
// `no_nombre_inventado` disparó de nuevo — Franco le dijo "Martín" a un cliente anónimo en el
// turno 3 de `derivacion-aceptada-igual-pide-nombre`. **Lo cazó el eval, no una lectura a mano.**
//
// POR QUÉ SEGUÍA PASANDO: quedaban 5 apariciones del nombre en el prompt y DOS son plantillas de
// SALIDA, o sea el formato exacto de lo que Franco escribe, listo para copiar:
//   línea  32: Esto NO aplica a nombrarlo por su nombre de pila ("perfecto Martín"), que sí va.
//   línea 246: Si te dice "Martín D'Angelo", le contestás "Perfecto Martín", nunca
//              "Perfecto Martín D'Angelo"
//
// LA DISTINCIÓN QUE IMPORTA, y es la lección que generaliza lo de v130:
//   · un ejemplo de ENTRADA ("si te dice X") describe lo que llega. Es información.
//   · un ejemplo de SALIDA ("le contestás X") es una PLANTILLA. El modelo copia plantillas.
// Por eso este fix borra las de salida y deja las de entrada: sin plantilla no hay qué copiar.
// Es la misma forma que v124 ("quitar el insumo gana; agregar una prohibición pierde").
//
// NO SE AGREGA NINGUNA PROHIBICIÓN CON EL NOMBRE ADENTRO: escribir "no digas Martín" es volver a
// darle el ejemplo. La advertencia que se agrega no nombra a nadie.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v131.json'
const DESTINO = 'workflows/franco-n8n-v132.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const agente = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = agente.parameters.options.systemMessage

const CAMBIOS = [
  // 1) La plantilla escondida en la regla de "no repitas los datos" (línea 32).
  [
    'Esto NO aplica a nombrarlo por su nombre de pila ("perfecto Martín"), que sí va.',
    'Esto NO aplica a nombrarlo por su nombre de pila, que sí va —siempre que él te lo haya dado en'
    + ' esta charla.',
  ],
  // 2) Las dos plantillas de la regla de TRATO (línea 246). El ejemplo de ENTRADA se conserva:
  //    es lo que describe el caso, y no es copiable como salida.
  [
    'Si te dice "Martín D\'Angelo", le contestás "Perfecto Martín", nunca "Perfecto Martín D\'Angelo":'
    + ' repetirle el apellido suena a formulario, no a vendedor.',
    'Si te dice "Martín D\'Angelo", de ahí en más lo nombrás SÓLO por el nombre de pila y NUNCA con el'
    + ' apellido: repetirle el apellido suena a formulario, no a vendedor.'
    + ' ⚠️ EL NOMBRE DE ESTE EJEMPLO ES UN EJEMPLO Y NO SE COPIA: el nombre que usás es SIEMPRE el que'
    + ' te dio el cliente EN ESTA CHARLA, y si no te dio ninguno, no lo nombrás.',
  ],
]

let sm = smAntes
for (const [viejo, nuevo] of CAMBIOS) {
  ok(sm.split(viejo).length === 2, `no encontré (1 vez) el texto: ${JSON.stringify(viejo.slice(0, 55))}`)
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
for (const [viejo] of CAMBIOS) ok(!sm.includes(viejo), `el texto VIEJO sigue estando: ${JSON.stringify(viejo.slice(0, 45))}`)

// EL CORAZÓN: ya no puede quedar NINGUNA plantilla de salida con nombre propio. v130 tuvo que
// acotar este mismo assert a la forma de guion porque la regla de trato lo hacía fallar; ahora
// que esa regla también está limpia, se puede exigir la forma AMPLIA.
ok(!/[Pp]erfecto Mart[ií]n/.test(sm), 'sobrevivió una plantilla de salida "Perfecto <nombre propio>"')
ok(!/le contest[aá]s "[A-ZÁÉÍÓÚÑ]?[Pp]?erfecto [A-ZÁÉÍÓÚÑ]/.test(sm),
  'quedó un ejemplo de SALIDA que arranca con un nombre propio')

// Los ejemplos de ENTRADA se conservan: son los que enseñan la regla y no son copiables.
ok(sm.includes('Si te dice "Martín D\'Angelo"'), 'se perdió el ejemplo de entrada de la regla de trato')
ok(sm.includes('soy Martín D\'Angelo'), 'se perdió el ejemplo de entrada "dentro de una frase"')
const cuantos = (sm.match(/Mart[ií]n/g) || []).length
ok(cuantos === 2, `esperaba que queden 2 apariciones (las dos de ENTRADA), quedan ${cuantos}`)

// La ADVERTENCIA que se agrega no puede nombrar a nadie: escribir el nombre dentro de una
// prohibición es volver a darle el ejemplo (lección de v130). Ojo: el assert va sobre la
// advertencia SOLA, no sobre todo el reemplazo — el reemplazo conserva a propósito el ejemplo de
// ENTRADA. La primera versión de este assert miraba el texto entero y frenó el build por eso.
const ADVERTENCIA = '⚠️ EL NOMBRE DE ESTE EJEMPLO ES UN EJEMPLO Y NO SE COPIA: el nombre que usás es'
  + ' SIEMPRE el que te dio el cliente EN ESTA CHARLA, y si no te dio ninguno, no lo nombrás.'
ok(sm.includes(ADVERTENCIA), 'no quedó la advertencia')
ok(!/Mart[ií]n/.test(ADVERTENCIA), 'la advertencia nombra a alguien y no debe')

// Lo ganado antes no se pierde.
ok(sm.includes('el plan y el valor de la cuota te los confirma un asesor, porque depende de las condiciones de financiación'),
  'se perdió el porqué de las cuotas (v128)')
ok(sm.includes('"24 creo que sería mejor"'), 'se perdió el contra-ejemplo del anticipo (v129)')
ok(sm.includes('<su nombre de pila>'), 'se perdió el placeholder del guion de derivación (v130)')

const delta = sm.length - smAntes.length
ok(Math.abs(delta) < 700, `el systemMessage cambió ${delta} chars, esperaba un cambio chico`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log('  nodos con diferencias: Franco (AI Agent)')
console.log(`  systemMessage: ${smAntes.length} -> ${sm.length} chars (${delta >= 0 ? '+' : ''}${delta})`)
console.log(`  nombres propios en el prompt: 5 -> ${cuantos} (las dos que quedan son ejemplos de ENTRADA)`)
console.log('  plantillas de SALIDA con nombre propio: 0')
