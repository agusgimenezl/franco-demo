// Prueba el check `no_vocabulario_interno` de `evals/run.mjs`. NO prueba una copia: extrae la
// función real del archivo y la ejecuta, así que si alguien la edita, esto corre sobre lo editado.
//
// POR QUÉ EXISTE, Y POR QUÉ ES MÁS QUE UN CAPRICHO: el check entra en `ALWAYS`, o sea que corre en
// los 91 casos. Un falso positivo acá no rompe un caso: pinta de rojo la suite entera y hace
// perder una tanda. Es la lección de v122 aplicada a una regex — no alcanza con que el patrón
// PAREZCA bien, hay que correrlo contra los datos reales antes de confiarle todo.
//
// EL BUG QUE LO ORIGINA (medido el 2026-08-11 contra `mensajes_demo`): Franco le dice al cliente
// las etiquetas internas que le llegan de `Listar stock`. 19 sesiones sobre 2701, y 3 de las 26
// corridas del guion de `chico-no-es-utilitario` (~12%). El ejemplo que lo abrió, sesión
// 89f55764: «La opción chico más accesible ... pero es categoría "económica"» — dos fugas
// distintas en una sola oración.
//
// LA TRAMPA DEL DISEÑO: "económica" y "estirar" son español normal y aparecen 91 y 404 veces de
// forma legítima en el historial. Prohibir el token habría pintado de rojo medio corpus. Por eso
// los NEGATIVOS de abajo pesan tanto como los positivos: son frases REALES del historial que
// tienen que seguir pasando.
//
// TODOS los textos de abajo son literales de `mensajes_demo`, con la sesión de la que salieron.
// La única excepción está marcada como SINTÉTICO y dice por qué.

import fs from 'node:fs'

const RUNNER = 'evals/run.mjs'
const src = fs.readFileSync(RUNNER, 'utf8')
const lines = src.split('\n')

// ── Extracción de la función real ───────────────────────────────────────────────────────────
const iAll = lines.findIndex((l) => l.startsWith('const allText ='))
const iFn = lines.findIndex((l) => l.startsWith('  no_vocabulario_interno: (r) => {'))
if (iAll === -1 || iFn === -1) {
  console.error(`no encontré \`allText\` o \`no_vocabulario_interno\` en ${RUNNER} — ¿los renombraron?`)
  process.exit(1)
}
let fin = iFn
let prof = 0
for (let k = iFn; k < lines.length; k++) {
  prof += (lines[k].match(/\{/g) || []).length - (lines[k].match(/\}/g) || []).length
  if (k > iFn && prof === 0) { fin = k; break }
}
const cuerpo = lines.slice(iFn, fin + 1).join('\n')
  .replace(/^\s*no_vocabulario_interno:\s*/, 'const no_vocabulario_interno = ')
  .replace(/,\s*$/, '')
const check = new Function(`${lines[iAll]}\n${cuerpo}\nreturn no_vocabulario_interno`)()

// Comprobación de que el check está enchufado donde tiene que estar. Una función perfecta que
// nadie llama no protege nada.
const enAlways = /const ALWAYS = \[[^\]]*'no_vocabulario_interno'/s.test(src)

const como = (texto) => check({ messages: [{ content: texto }] })

// ── POSITIVOS: fugas REALES. Todas tienen que dar rojo ──────────────────────────────────────
const FUGAS = [
  ['89f55764 · el caso que abrió el pendiente (dos fugas en una oración)',
    'La opción chico más accesible dentro del presupuesto es el Toyota Etios 2021, que está en $14.500.000, pero es categoría "económica".'],
  ['7501adc4 · el gemelo, un minuto después, con otro token',
    'Dentro de tu presupuesto de 20 millones, para un auto chico del 2021 en adelante, no hay opciones exactas, pero entrando un poco de categoría y con el presupuesto ajustado, podés ver estas opciones "estirar":'],
  ['0bebd771 · "entra" como nombre de segmento',
    'Acá tenés las pickups 4x2 que están dentro del segmento de precio "entra":'],
  ['47a6246a · el bloque de arriba nombrado por su etiqueta',
    'Y si querés algo de más categoría, entregando tu usado podrías llegar a estas "estirar":'],
  ['7925632c · la etiqueta como aposición',
    'Toyota Etios 2019 — 45.000 km — $12.500.000 (hatchback, más nuevo y con menor consumo, opción "estirar" con tu permuta y entrada).'],
  ['f1cff763 · "gama" en vez de "categoría", misma fuga',
    'Si querés algo un poco más caro con la entrega de tu usado, están estas opciones de gama "estirar":'],
  ['224a8710 · sin ninguna palabra de encuadre, sólo las comillas',
    'Y si querés un auto un poco más nuevo o diferente, estas otras opciones que están "estirar":'],
  ['d4901cb4 · idem, con el guion del efectivo',
    'Tu efectivo cubre autos un poco más arriba de tu techo, que serían estas opciones "estirar":'],
  ['320808b9 · dentro de una pregunta de cierre',
    'Querés que te pase todo el stock que entra en tu presupuesto, o te interesa ver más opciones "estirar" de las que podrían cubrir tu permuta?'],
  ['99da7d6a · la etiqueta ARRANCANDO la oración, con mayúscula',
    '"Entra" dentro de posibles opciones tenés pickups nuevas y seminuevas.'],
  ['f4d9488e · el guion viejo del efectivo, con la etiqueta pegada',
    'Con tu presupuesto, tu efectivo cubre el total de estas opciones en "entra" y el valor de tu usado te queda a favor.'],
  ['f236c13b · "en la categoría X", con comillas',
    'Y si querés mirar un poco más arriba, en la categoría "estirar":'],
  ['694c24c4 · la etiqueta usada como VERBO, que es lo más raro de todo',
    'Con 30 millones y entregando tu Yaris 2021 con 80k km, dentro de tu presupuesto "entra" un Volkswagen Vento 2024 de 9.000 km en $29.500.000.'],
  ['bbcb48c0 · lista numerada y la etiqueta abajo',
    'Estas opciones "estirar" pueden financiarse o aprovechar una permuta para llegar más lejos.'],
  ['8d8fed95 · `tamano` crudo como sustantivo, sin comillas y sin "categoría"',
    'La opción chico que entra en tu presupuesto de hasta 20 millones es el Renault Kangoo 2021.'],
  ['d20ede2c · el mismo, en plural, y sigue sin concordar',
    'Las otras opciones chico que teníamos como el Chevrolet Onix 2024 y el Peugeot 208 2025 se pasan del techo.'],
  ['26a43023 · dos valores crudos pegados con una barra',
    'Si no te molesta algo un poco más grande, hay varias opciones mediano/grande, como SUV o pickup.'],
  ['8ff66d5c · idem, con "o" en el medio',
    'Con tamaño similar al Fiat Mobi y bajo consumo, te recomiendo estas opciones chico o mediano:'],
  ['SINTÉTICO · nombre de campo interno. No hay ninguno medido todavía: v118 sumó `otro_tamano` y ' +
   'v126 `anticipo_minimo`, así que la superficie crece con cada campo nuevo y este es el lugar ' +
   'donde se vería. El check de `chico-no-es-utilitario` que prohibía `otro_tamano` en un turno ' +
   'suelto queda cubierto por acá, en los 91 casos.',
    'Te paso las del otro_tamano que también podrían servirte.'],
]

// ── NEGATIVOS: español LEGÍTIMO, todo real. Ninguno puede dar rojo ──────────────────────────
// Si alguno de estos se pone rojo, el check es inservible: "categoría" aparece 220 veces en el
// historial y la enorme mayoría es prosa normal de un vendedor.
const LEGITIMO = [
  ['el guion estándar del bloque de arriba, bien escrito',
    'Y si querés algo de más categoría, entregando tu usado podrías llegar a estas otras opciones, dependiendo de cuánto te lo tomen:'],
  ['"categoría" como segmento de mercado, que es su uso normal',
    'La EcoSport 2020 Titanium 1.5 Dragon es una SUV mediana, muy equipada para su categoría: tiene cámara, sensores y pantalla flotante.'],
  ['"categoría" + carrocería, no + etiqueta',
    'Es uno de los que menos consume en la categoría hatchback y tiene buena reventa por la confiabilidad de Toyota.'],
  ['"económico" como adjetivo, que es exactamente lo que hay que dejar pasar',
    'Si te interesa algo un poco más económico o de otra categoría, también puedo ayudarte a mostrarte más opciones.'],
  ['"estirando" como verbo — el uso correcto de la misma raíz',
    'Y si querés algo un poco de más categoría, estirando un poco están: Jeep Renegade 2021 y Toyota Corolla 2022.'],
  ['"estirar" como verbo, sin comillas',
    'Con ese presupuesto podés estirar un poco y mirar estas otras opciones.'],
  ['"categoría" en una pregunta de cierre',
    'Te llama la atención o querés que te muestre más hatchbacks o alguna otra categoría?'],
  ['el tamaño CON concordancia — la forma correcta de decir lo mismo',
    'Si no te molesta que sea un poco más grande, estas opciones medianas también están disponibles.'],
  ['el fix que se espera del bug: femenino y superlativo',
    'La opción más chica que entra en tu presupuesto es el Toyota Etios 2021, que está en $14.500.000.'],
  ['plural femenino, que es como se dice',
    'Estas opciones chicas te pueden servir para lo que buscás.'],
  ['"para su categoría" con un dato técnico al lado',
    'La S10 4x2 2022 es una pickup de trabajo con muy buena potencia para su categoría (200 HP).'],
  ['"entra" como VERBO normal, sin comillas — el borde más filoso de todos',
    'Con ese anticipo te entra el Peugeot 208 2025 y también entra el Chevrolet Onix 2024.'],
  ['"entrar en categoría" como giro natural',
    'Para modelo 2021 en adelante no hay opciones exactas, pero entrando un poco de categoría podés ver estas.'],
]

// ── Corrida ─────────────────────────────────────────────────────────────────────────────────
const fallas = []
let okPos = 0
for (const [nombre, texto] of FUGAS) {
  const out = como(texto)
  if (out) okPos++
  else fallas.push(`FUGA NO DETECTADA · ${nombre}\n        ${texto.slice(0, 120)}`)
}
let okNeg = 0
for (const [nombre, texto] of LEGITIMO) {
  const out = como(texto)
  if (!out) okNeg++
  else fallas.push(`FALSO POSITIVO · ${nombre}\n        ${texto.slice(0, 120)}\n        dio: ${out}`)
}

console.log(`  fugas reales detectadas:     ${okPos}/${FUGAS.length}`)
console.log(`  español legítimo que pasa:   ${okNeg}/${LEGITIMO.length}`)
console.log(`  enchufado en ALWAYS:         ${enAlways ? 'sí' : 'NO'}`)

if (!enAlways) fallas.push('el check NO está en ALWAYS: no va a correr en ningún caso')

if (fallas.length) {
  console.error('\nASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}
console.log(`\nOK: ${FUGAS.length + LEGITIMO.length}/${FUGAS.length + LEGITIMO.length}`)
