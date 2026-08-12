// Caso de eval del bug que anotó Agustina el 2026-08-12 sobre v134.
//
// EL BUG: el cliente escribe "Estoy buscando una Amarok 2023." y Franco arranca directamente con
// "La Volkswagen Amarok Comfortline 2.0 TDI 180 CV 4Motion 2018 es la 4x4 diésel más accesible del
// stock…". **Nunca aclara que la 2023 no existe.** Le presenta la 2018 como si fuera lo que pidió.
//
// LA REGLA QUE FIJÓ AGUSTINA, y son tres cosas en un mismo turno:
//   1. se dice que ESE modelo/año no lo tenemos,
//   2. se ofrece la o las opciones más similares,
//   3. se cierra con la pregunta comercial.
//
// POR QUÉ NO LO CAZA NADA HOY, y es un agujero fino: `no-repite-la-ficha` arranca con EXACTAMENTE
// este mensaje, pero todos sus checks están en el TURNO 2 ("2023 no tienen?"); su turno 1 sólo pide
// `media_min`. O sea que el bug ocurre en un turno que ya está en la suite y que nadie mira.
// Y `modelo-no-stock-alternativas-carroceria` cubre el error OPUESTO (Franco dijo "no tenemos" y
// ofreció SUVs en vez de pickups), así que tampoco.
//
// NO SE TOCA `no-repite-la-ficha` A PROPÓSITO: ese caso tiene línea de base y está en la lista de
// los dos "sin atribuir". Agregarle checks ahora mezclaría el bug nuevo con una medición abierta y
// no se podría atribuir ninguno de los dos.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATH = join(ROOT, 'evals', 'cases.json')

// LA SEÑAL, DECLARADA: tiene que quedar explícito que la 2023 no está. Se aceptan las dos formas
// naturales de decirlo —la negación directa y "la más nueva que tenemos es la 2018"— porque las dos
// cumplen el punto 1 de la regla. Lo que NO pasa es arrancar la ficha de la 2018 sin mencionarlo.
const AVISA_QUE_NO_ESTA =
  '(?i)(no (la |lo )?ten(emos|go)|no hay|no contamos con|no dispon\\w+)[^.!?]{0,45}(2023|amarok)' +
  '|(m[aá]s (nueva|reciente)|[uú]nica)[^.!?]{0,40}2018' +
  '|2023[^.!?]{0,30}(no la ten|no lo ten|no ten|no hay|no est)'

const CASO = {
  id: 'modelo-inexistente-se-avisa-y-se-ofrece',
  bug:
    'ANOTADO POR AGUSTINA 2026-08-12 sobre v134, con captura. El cliente dice "Estoy buscando una Amarok 2023." y ' +
    'Franco arranca con "La Volkswagen Amarok ... 2018 es la 4x4 diésel más accesible del stock": le presenta la 2018 ' +
    'como si fuera lo que pidió, sin aclarar NUNCA que la 2023 no existe. LA REGLA: si piden un modelo/año que no hay, ' +
    '(1) se dice que no lo tenemos, (2) se ofrece la o las opciones más similares, (3) se cierra con la pregunta ' +
    'comercial. AGUJERO QUE LO DEJÓ PASAR: `no-repite-la-ficha` arranca con este mismísimo mensaje pero todos sus ' +
    'checks están en el turno 2; su turno 1 sólo pide media_min. El bug ocurre en un turno que ya estaba en la suite ' +
    'y que nadie miraba.',
  turns: [
    {
      say: 'Estoy buscando una Amarok 2023.',
      checks: [
        // (1) que avise que ese año no está
        ['text_matches', AVISA_QUE_NO_ESTA],
        // (2) que ofrezca la que sí hay
        ['text_matches', '(?i)2018'],
        // (3) que cierre con la pregunta comercial
        ['ends_with_question'],
        [
          'manual',
          'EL TURNO DEL CASO. No hay Amarok 2023 en stock; la única Amarok es la 2018 ($32.000.000, 135.000 km). ' +
            'Franco tiene que decir que la 2023 no la tenemos, ofrecer la 2018 y/o las otras pickups (S10, Hilux, ' +
            'Ranger) como lo más parecido, y cerrar con la pregunta comercial. Lo que NO puede hacer es abrir con la ' +
            'ficha de la 2018 como si fuera lo que el cliente pidió.',
        ],
      ],
    },
  ],
}

const doc = JSON.parse(readFileSync(PATH, 'utf8'))
const antes = doc.cases.length
if (doc.cases.some((c) => c.id === CASO.id)) throw new Error(`el caso "${CASO.id}" YA EXISTE`)

// `no-repite-la-ficha` tiene que seguir intacto: si alguien lo tocó, esta medición ya no es limpia.
const vecino = doc.cases.find((c) => c.id === 'no-repite-la-ficha')
if (!vecino) throw new Error('no-repite-la-ficha no está: este caso se diseñó alrededor de él')
if (vecino.turns[0].checks.length !== 1) throw new Error('no-repite-la-ficha cambió su turno 1: revisar el solapamiento')

// ── EL PATRÓN, EJECUTADO contra la respuesta REAL de la captura y contra las buenas ──────────
const avisa = new RegExp(AVISA_QUE_NO_ESTA.replace(/^\(\?i\)/, ''), 'i')
const laDeLaCaptura =
  'La Volkswagen Amarok Comfortline 2.0 TDI 180 CV 4Motion 2018 es la 4x4 diésel más accesible del stock, con buena potencia y equipamiento completo. Es ideal si necesitás tracción real sin pagar una unidad muy reciente.'
const buena1 = 'No tenemos una Amarok 2023 en stock. La que sí tenemos es la 2018, con 135.000 km.'
const buena2 = 'La Amarok más nueva que tenemos es la 2018. Querés que te pase la ficha?'

if (avisa.test(laDeLaCaptura)) throw new Error('el patrón da VERDE con la respuesta que falla')
if (!avisa.test(buena1)) throw new Error('el patrón no reconoce la negación directa')
if (!avisa.test(buena2)) throw new Error('el patrón no reconoce "la más nueva que tenemos es la 2018"')

doc.cases.push(CASO)
writeFileSync(PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8')

const releido = JSON.parse(readFileSync(PATH, 'utf8'))
if (releido.cases.length !== antes + 1) throw new Error(`quedaron ${releido.cases.length} casos`)

console.log(`✓ ${antes} → ${releido.cases.length} casos`)
console.log('✓ el patrón da ROJO con la respuesta real de la captura y VERDE con las dos formas correctas')
console.log('✓ no-repite-la-ficha quedó intacto')
console.log(`  + ${CASO.id}`)
