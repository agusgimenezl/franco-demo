// Corrige el caso `usado-sin-detalles-no-se-completa-con-el-auto-de-interes`, escrito hoy mismo.
//
// POR QUÉ SE CORRIGE: en su primera medición dio 1/3, pero **las fallas no eran del bug que el caso
// existe para medir**. Eran (a) la burbuja de fallback en el turno 1 y (b) el `text_matches` de
// "amarok" que se cae junto con ella. El bug objetivo —que Franco le atribuya al cliente, como
// usado, el auto que está mirando para comprar— NO se reprodujo ni una vez.
//
// LA RAZÓN, y es la misma deuda que ya está documentada: el CRM escribe `vehiculo_interes` DESPUÉS
// de responder, con un turno de retraso. Con sólo dos turnos, en el turno del usado todavía no hay
// nada escrito de donde copiar. En la charla real de Guillermo el interés llevaba varios turnos
// fijado. Se agrega un turno intermedio para darle al CRM el tiempo que tiene en la vida real.
//
// Y SE LIMPIA EL TURNO 1: sus checks propios lo hacían fallar por el fallback, que es OTRO bug y ya
// lo caza `no_fallback_bubble` en ALWAYS. Un caso que da rojo por dos motivos distintos no permite
// atribuir ninguno. El turno 1 queda como contexto puro y la verificación de que Franco habla del
// auto se mueve al turno 2, donde no compite con nada.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATH = join(ROOT, 'evals', 'cases.json')
const ID = 'usado-sin-detalles-no-se-completa-con-el-auto-de-interes'

const doc = JSON.parse(readFileSync(PATH, 'utf8'))
const caso = doc.cases.find((c) => c.id === ID)
if (!caso) throw new Error(`no está el caso "${ID}"`)
if (caso.turns.length !== 2) throw new Error(`esperaba 2 turnos, hay ${caso.turns.length}: ya fue modificado`)

// El turno del bug se conserva TAL CUAL: sus checks son los que miden el bug y ya se verificaron
// ejecutándolos contra la respuesta real de la captura.
const turnoDelBug = caso.turns[1]
if (turnoDelBug.say !== 'tengo un usado para entregar') throw new Error('el turno del bug no es el que esperaba')
if (!turnoDelBug.checks.some(([t]) => t === 'text_not_matches')) throw new Error('el turno del bug perdió su check')

caso.turns = [
  // Contexto puro: fija el auto de interés. Sin checks propios para no mezclar el fallback.
  { say: 'me interesa la volkswagen amarok', checks: [] },
  // Turno intermedio: le da al CRM el turno de retraso que necesita para escribir vehiculo_interes.
  // Además verifica acá que Franco esté hablando del auto correcto, sin competir con el turno del bug.
  { say: 'cuánto sale?', checks: [['text_matches', '(?i)32[\\.\\s]?000[\\.\\s]?000|amarok']] },
  turnoDelBug,
]

caso.bug = caso.bug.replace(
  'GRAVE porque',
  'EL CASO TIENE UN TURNO INTERMEDIO A PROPÓSITO: el CRM escribe vehiculo_interes con un turno de retraso, así que ' +
    'con sólo dos turnos no hay nada escrito de donde copiar y el bug no se reproduce (medido: 1/3, y esa falla era ' +
    'del fallback, no de este bug). GRAVE porque',
)

writeFileSync(PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8')

const releido = JSON.parse(readFileSync(PATH, 'utf8')).cases.find((c) => c.id === ID)
if (releido.turns.length !== 3) throw new Error(`quedaron ${releido.turns.length} turnos`)
if (releido.turns[2].say !== 'tengo un usado para entregar') throw new Error('el turno del bug no quedó último')
if (releido.turns[0].checks.length !== 0) throw new Error('el turno 1 quedó con checks propios')
if (!releido.lead_checks?.length) throw new Error('se perdieron los lead_checks')

console.log(`✓ ${ID}: 2 → 3 turnos`)
console.log('✓ el turno del bug quedó último y con sus checks intactos')
console.log('✓ el turno 1 quedó sin checks propios: el fallback ya lo caza ALWAYS y no contamina la atribución')
