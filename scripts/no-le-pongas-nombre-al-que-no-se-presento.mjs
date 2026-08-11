// Prueba el check `no_nombre_inventado` de `evals/run.mjs`. NO prueba una copia: extrae la función
// real del archivo y la ejecuta.
//
// EL BUG QUE LO ORIGINA: Franco saluda por su nombre a clientes que NUNCA se lo dieron —
// "Perfecto Martín, ..." a un desconocido. Es de las cosas más caras que pueden pasar en una demo
// delante del dueño de la concesionaria, y **ningún caso de los 93 lo cazaba**: se encontró
// leyendo `mensajes_demo` a mano el 2026-08-11.
//
// MEDIDO CONTRA LAS 2701 SESIONES: 380 vocativos con nombre en todo el historial.
//   · 358 legítimos (el cliente había dado el nombre): Agustina 152, Julieta 78, Pedro 42,
//     Martin 14, Natalia 11, y una cola larga de uno o dos.
//   ·  22 INVENTADOS: Martín 19, Lucía 2, Agustín 1.
// Y NO ES UN BUG NUEVO, aunque la sesión del 2026-08-11 lo haya amplificado: 20–25/07 hubo 16,
// más 1 el 06/08, 1 el 10/08 y 4 el 11/08. Vive hace meses sin que nadie lo midiera.
//
// POR QUÉ EL CHECK NECESITA MÁS QUE LA RESPUESTA: un check ve sólo lo que Franco contestó, y para
// saber si un nombre es inventado hay que saber si el cliente lo dijo alguna vez. Por eso
// `run.mjs` acumula lo que dijo el cliente en `dichoPorCliente`, igual que ya acumula la media
// vista en `mediaPorTurno`.

import fs from 'node:fs'

const RUNNER = 'evals/run.mjs'
const src = fs.readFileSync(RUNNER, 'utf8')
const lines = src.split('\n')

const iFn = lines.findIndex((l) => l.startsWith('  no_nombre_inventado: (r) => {'))
if (iFn === -1) {
  console.error(`no encontré \`no_nombre_inventado\` en ${RUNNER} — ¿lo renombraron?`)
  process.exit(1)
}
let fin = iFn
let prof = 0
for (let k = iFn; k < lines.length; k++) {
  prof += (lines[k].match(/\{/g) || []).length - (lines[k].match(/\}/g) || []).length
  if (k > iFn && prof === 0) { fin = k; break }
}
const cuerpo = lines.slice(iFn, fin + 1).join('\n')
  .replace(/^\s*no_nombre_inventado:\s*/, 'const no_nombre_inventado = ')
  .replace(/,\s*$/, '')

const iAll = lines.findIndex((l) => l.startsWith('const allText ='))
// `dichoPorCliente` lo provee el harness: acá se controla qué "dijo" el cliente en cada escenario.
const dichoPorCliente = []
const check = new Function('dichoPorCliente',
  `${lines[iAll]}\n${cuerpo}\nreturn no_nombre_inventado`)(dichoPorCliente)

const enAlways = /const ALWAYS = \[[^\]]*'no_nombre_inventado'/s.test(src)
const acumula = /dichoPorCliente\.push\(/.test(src) && /dichoPorCliente\.length = 0/.test(src)

// escenario: [nombre, lo que dijo el CLIENTE (turnos), lo que contestó Franco]
const correr = (turnosCliente, respuesta) => {
  dichoPorCliente.length = 0
  for (const t of turnosCliente) dichoPorCliente.push(t)
  return check({ messages: [{ content: respuesta }] })
}

// ── INVENTADOS: tienen que dar rojo ─────────────────────────────────────────────────────────
const INVENTADOS = [
  ['el caso de hoy, guion de derivacion-aceptada (v128/v129): el cliente no da nombre en ningún turno',
    ['hola, me interesa el Corolla. lo puedo pagar en cuotas?', 'dale si! me interesa la financiacion',
      'serian unos 15 millones', 'no tengo usado, y serian 36 cuotas'],
    'Perfecto Martín, el plan y el valor de la cuota para 36 cuotas te los confirma un asesor, porque depende de las condiciones de financiación.'],
  ['el mismo, con el guion viejo (2026-08-10) — prueba que el bug es anterior a v128',
    ['dale si! me interesa la financiacion', 'serian unos 12 millones'],
    'Perfecto Martín, le dejo anotado al asesor la simulación con $12.000.000 de anticipo, y te contacta por acá.'],
  ['otro vocativo, mismo problema',
    ['hola, busco un auto chico'],
    'Gracias Lucía, con eso ya te puedo ayudar bien.'],
  ['saludo inicial con nombre inventado',
    ['hola, tienen pickups?'],
    'Hola Agustín! Soy Franco, asistente de Automotores Tucumán.'],
  ['el nombre aparece a mitad de la respuesta, no al principio',
    ['me interesa el 208', 'puedo dar 13 millones de anticipo'],
    'Con ese anticipo estás bien. Listo Martín, le paso todo a un asesor así te contacta.'],
]

// ── LEGÍTIMOS: el cliente SÍ dio el nombre. Ninguno puede dar rojo ──────────────────────────
const LEGITIMOS = [
  ['el cliente se presentó con nombre y apellido, Franco usa el de pila',
    ['quiero que me contacte un asesor', 'soy Martín D\'Angelo'],
    'Perfecto Martín, le paso todo a un asesor así te contacta y te arma la simulación.'],
  ['nombre suelto en un turno',
    ['hola', 'Agustina'],
    'Perfecto Agustina, un asesor te contacta por acá.'],
  ['nombre dentro de una frase',
    ['me llamo Julieta Miguez y quiero ver el Corolla'],
    'Gracias Julieta, te paso los datos del Corolla.'],
  ['el cliente lo escribió en minúscula y Franco lo capitaliza',
    ['soy pedro, me interesa la hilux'],
    'Perfecto Pedro, la Hilux 2021 la tenemos disponible.'],
  ['sin tilde de un lado y con tilde del otro NO puede dar rojo por eso solo',
    ['soy Martin'],
    'Perfecto Martin, seguimos.'],
  // Los que podrían romper el detector si estuviera mal hecho:
  ['"Perfecto." con punto y una palabra capitalizada atrás NO es un vocativo',
    ['serian unos 15 millones'],
    'Perfecto. Con un anticipo de $15.000.000 y sin un usado para entregar, podríamos buscar vehículos de hasta $30.000.000.'],
  ['una marca detrás del vocativo no es un nombre',
    ['que camionetas tenes?'],
    'Dale Ford tiene la Ranger 2024, y también está la Hilux.'],
  ['saludo normal sin nombre',
    ['hola'],
    'Hola! Soy Franco, asistente de Automotores Tucumán. Cómo estás?'],
  ['cierre normal sin nombre',
    ['gracias!'],
    'Genial, quedo a disposición si te surge cualquier otra consulta.'],
  ['la palabra que sigue al vocativo es una conectiva capitalizada por arranque de oración',
    ['me sirve'],
    'Perfecto Entonces te paso el detalle del Peugeot 208.'],
]

const fallas = []
let okPos = 0
for (const [nombre, turnos, resp] of INVENTADOS) {
  if (correr(turnos, resp)) okPos++
  else fallas.push(`NOMBRE INVENTADO NO DETECTADO · ${nombre}\n        ${resp.slice(0, 110)}`)
}
let okNeg = 0
for (const [nombre, turnos, resp] of LEGITIMOS) {
  const out = correr(turnos, resp)
  if (!out) okNeg++
  else fallas.push(`FALSO POSITIVO · ${nombre}\n        ${resp.slice(0, 110)}\n        dio: ${out}`)
}

console.log(`  nombres inventados detectados: ${okPos}/${INVENTADOS.length}`)
console.log(`  usos legítimos que pasan:      ${okNeg}/${LEGITIMOS.length}`)
console.log(`  enchufado en ALWAYS:           ${enAlways ? 'sí' : 'NO'}`)
console.log(`  run.mjs acumula lo del cliente: ${acumula ? 'sí' : 'NO'}`)

if (!enAlways) fallas.push('el check NO está en ALWAYS: no va a correr en ningún caso')
if (!acumula) fallas.push('run.mjs no acumula/resetea `dichoPorCliente`: el check no puede saber qué dijo el cliente')

if (fallas.length) {
  console.error('\nASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}
console.log(`\nOK: ${INVENTADOS.length + LEGITIMOS.length}/${INVENTADOS.length + LEGITIMOS.length}`)
