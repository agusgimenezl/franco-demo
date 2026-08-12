// Caso de eval del fallback, el bug más frecuente de Franco en producción.
//
// EL SÍNTOMA: el cliente escribe algo trivial ("me interesa la volkswagen amarok") y recibe
// "Uy, se me trabó el sistema un segundo. Me repetís lo último?".
//
// EL ALCANCE, MEDIDO CONTRA EL CORPUS: 400 burbujas de 13.486 (**2,97%**) son fallback, repartidas
// en **280 de 2.881 sesiones (9,7%)**. Casi 1 de cada 10 conversaciones le muestra al cliente un
// mensaje de error. La demo se muestra en reuniones con dueños de concesionaria.
//
// LA CAUSA RAÍZ, LEÍDA DEL LOG (ejecución 15996, turno 1 de la sesión 944c9746). El nodo
// `Franco (AI Agent)` no devolvió `output` sino:
//     "Received tool input did not match expected schema
//      ✖ Required → at precio_min
//      ✖ Required → at precio_max
//      ✖ Required → at km_max"
// El modelo llamó a la herramienta sin esos tres filtros, n8n RECHAZÓ la llamada entera, el agente
// terminó en error y `Armar respuesta` no encontró `output.messages` -> fallback (línea 73-75).
// Ni el Structured Output Parser ni las tools llegaron a correr.
//
// POR QUÉ PASA: **ninguno de los 31 `$fromAI` del workflow tiene defaultValue**, así que n8n los
// marca todos como REQUIRED en el schema. Muchos son filtros que sólo aplican a veces (km_max no
// tiene sentido si el cliente no habló de kilómetros). Cada vez que el modelo omite uno, se rompe.
//
// DAÑO SECUNDARIO, VISIBLE EN LA MEDICIÓN: como el turno se pierde, el turno siguiente **vuelve a
// saludar** ("Hola! Soy Franco…"). El cliente no sólo ve un error: pierde el hilo de la charla.
//
// EL CHECK QUE LO CAZA YA EXISTE Y CORRE EN ALWAYS (`no_fallback_bubble`), así que este caso no
// agrega checks nuevos: existe para EJERCITAR el turno que lo dispara y poder medir la TASA. Por eso
// se corre con --repeat alto: con 3 tiros un 30% se confunde con ruido.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATH = join(ROOT, 'evals', 'cases.json')

const CASO = {
  id: 'no-se-rompe-al-pedir-un-auto-puntual',
  bug:
    'EL BUG MÁS FRECUENTE DE FRANCO EN PRODUCCIÓN, medido contra el corpus el 2026-08-12: 400 burbujas de 13.486 ' +
    '(2,97%) son la burbuja de fallback "Uy, se me trabó el sistema un segundo", en 280 de 2.881 sesiones (9,7%). ' +
    'CAUSA RAÍZ leída del log (ejecución 15996): el agente devolvió "Received tool input did not match expected ' +
    'schema — Required at precio_min / precio_max / km_max". El modelo llamó a la herramienta sin esos filtros y n8n ' +
    'rechazó la llamada entera, así que `Armar respuesta` no encontró output.messages y cayó al fallback. RAÍZ ' +
    'ESTRUCTURAL: ninguno de los 31 $fromAI del workflow tiene defaultValue, así que TODOS quedan REQUIRED en el ' +
    'schema, incluidos filtros que sólo aplican a veces. DAÑO SECUNDARIO: el turno se pierde y el siguiente vuelve a ' +
    'saludar, o sea que además se corta el hilo. Lo caza `no_fallback_bubble`, que ya corre en ALWAYS: este caso ' +
    'existe para ejercitar el turno y medir la TASA, por eso se corre con --repeat alto.',
  turns: [
    {
      say: 'me interesa la volkswagen amarok',
      checks: [
        // Si cayó al fallback, ni siquiera nombra el auto. `no_fallback_bubble` (ALWAYS) es el que
        // pone el nombre al bug; éste sirve de refuerzo legible en el reporte.
        ['text_matches', '(?i)amarok'],
        [
          'manual',
          'Tiene que contestar sobre la Amarok 2018 ($32.000.000, 135.000 km). Cualquier variante de "se me trabó el ' +
            'sistema" o "no entendí bien" es el bug: el cliente escribió algo trivial y recibió un error.',
        ],
      ],
    },
  ],
}

const doc = JSON.parse(readFileSync(PATH, 'utf8'))
const antes = doc.cases.length
if (doc.cases.some((c) => c.id === CASO.id)) throw new Error(`el caso "${CASO.id}" YA EXISTE`)

// El caso se apoya en un check de ALWAYS: si dejara de estar ahí, mediría mucho menos de lo que dice.
const run = readFileSync(join(ROOT, 'evals', 'run.mjs'), 'utf8')
if (!/const ALWAYS = \[[^\]]*'no_fallback_bubble'/s.test(run)) {
  throw new Error('no_fallback_bubble ya no está en ALWAYS: este caso perdería su check principal')
}

doc.cases.push(CASO)
writeFileSync(PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8')

const releido = JSON.parse(readFileSync(PATH, 'utf8'))
if (releido.cases.length !== antes + 1) throw new Error(`quedaron ${releido.cases.length} casos`)

console.log(`✓ ${antes} → ${releido.cases.length} casos`)
console.log('✓ no_fallback_bubble sigue en ALWAYS, que es el check principal de este caso')
console.log(`  + ${CASO.id}`)
