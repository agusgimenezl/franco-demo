// Caso de eval del bug capturado por Agustina el 2026-08-12 sobre v134, sesión REAL
// `d2ac87f0-d835-45d9-8ab0-5f236f4ccd80` (Guillermo Vilte).
//
// EL BUG: el cliente dice "perdon, si tengo un usado para entregar" —SIN marca, modelo ni año— y
// Franco contesta "Perfecto Guillermo, tenés una Volkswagen Amarok 2018 para entregar."
// **Le atribuyó como usado el auto que estaba MIRANDO PARA COMPRAR.**
//
// NO LO INVENTÓ FRANCO: LO ESCRIBIÓ EL CRM. El lead quedó así:
//     vehiculo_interes  = "Volkswagen Amarok 2018"
//     descripcion_usado = "Volkswagen Amarok 2018"   <-- idénticos
// Franco después leyó `lead_usado` y lo repitió de buena fe. Es la trampa 7 en su versión de datos:
// la frase la produce un dato mal escrito, no el modelo conversacional.
//
// Y NO ES QUE FALTE LA REGLA: el prompt del CRM ya dice, textual, "Si entrega pero TODAVÍA no dio
// ningún detalle: 'Auto usado mencionado, sin detalles'". El CRM (gpt-4.1) no la siguió porque vio
// "Amarok 2018" nombrada en la conversación y la tomó como el detalle del usado. Reforzar el prompt
// es exactamente lo que este proyecto ya sabe que no funciona.
//
// LA SEÑAL DETERMINÍSTICA QUE DEJA, y es el fix natural: **si `descripcion_usado` es igual a
// `vehiculo_interes`, es un error de copia.** Nadie entrega como usado exactamente la misma unidad
// que está por comprar. Es una comparación, así que va a código (regla del proyecto).
//
// POR QUÉ ES DE LOS PEORES: el lead va al asesor con un dato FALSO sobre el cliente, y la ficha del
// CRM es la pantalla que se le muestra al dueño en la demo. Además infla la operación: un usado que
// no existe cambia toda la cuenta.
//
// EL CASO MIDE LAS DOS CAPAS: el texto que ve el cliente Y el lead que ve el dueño. El `lead_checks`
// es el más objetivo de los dos.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATH = join(ROOT, 'evals', 'cases.json')

// Atribuirle al cliente un auto como usado. Acotado a la forma "tenés una Amarok" / "tu Amarok":
// hablar de "la Amarok que te interesa" es legítimo y NO tiene que dar rojo.
const LE_ATRIBUYE_EL_AUTO = '(?i)(ten[eé]s|ten[eé]es) (una |un )?(volkswagen )?amarok|tu (volkswagen )?amarok'

const CASO = {
  id: 'usado-sin-detalles-no-se-completa-con-el-auto-de-interes',
  bug:
    'CAPTURA DE AGUSTINA 2026-08-12 sobre v134, sesión REAL d2ac87f0-d835-45d9-8ab0-5f236f4ccd80 (Guillermo Vilte). ' +
    'El cliente dice "perdon, si tengo un usado para entregar" sin dar marca, modelo ni año, y Franco contesta ' +
    '"Perfecto Guillermo, tenés una Volkswagen Amarok 2018 para entregar": le atribuyó como usado el auto que estaba ' +
    'mirando para COMPRAR. NO lo inventó Franco — lo escribió el CRM: el lead quedó con vehiculo_interes y ' +
    'descripcion_usado IDÉNTICOS ("Volkswagen Amarok 2018"), y Franco leyó lead_usado y lo repitió. El prompt del CRM ' +
    'YA tiene la regla correcta ("Si entrega pero TODAVÍA no dio ningún detalle: Auto usado mencionado, sin ' +
    'detalles"), así que no falta regla: falta la comparación determinística. Si descripcion_usado == ' +
    'vehiculo_interes, es un error de copia — nadie entrega como usado la misma unidad que está por comprar. GRAVE ' +
    'porque el lead llega al asesor con un dato FALSO del cliente y la ficha del CRM es la pantalla de la demo.',
  turns: [
    {
      say: 'me interesa la volkswagen amarok',
      checks: [['text_matches', '(?i)amarok']],
    },
    {
      say: 'tengo un usado para entregar',
      checks: [
        ['text_not_matches', LE_ATRIBUYE_EL_AUTO],
        [
          'manual',
          'EL TURNO DEL CASO. El cliente NO dijo qué usado tiene: sólo que tiene uno. Franco tiene que PREGUNTARLE ' +
            'cuál es (marca, modelo, año), nunca darlo por sabido. Atribuirle la Amarok —que es el auto que quiere ' +
            'COMPRAR— es inventarle un patrimonio y cambia toda la cuenta de la operación.',
        ],
      ],
    },
  ],
  // La capa que ve el dueño en la demo. Es el check más objetivo del caso: no depende de cómo lo
  // redacte Franco, sino de lo que quedó escrito en el CRM.
  lead_checks: [['field_not_matches', 'descripcion_usado', '(?i)amarok']],
}

const doc = JSON.parse(readFileSync(PATH, 'utf8'))
const antes = doc.cases.length
if (doc.cases.some((c) => c.id === CASO.id)) throw new Error(`el caso "${CASO.id}" YA EXISTE`)

// ── EL PATRÓN, EJECUTADO contra la respuesta REAL y contra las legítimas ─────────────────────
const atribuye = new RegExp(LE_ATRIBUYE_EL_AUTO.replace(/^\(\?i\)/, ''), 'i')
const laDeLaCaptura =
  'Perfecto Guillermo, tenés una Volkswagen Amarok 2018 para entregar. La tasación final la hace un asesor viéndola en persona.'
const buena = 'Perfecto. Cuál es el auto que entregás? Decime marca, modelo y año y vemos cómo queda la operación.'
// Hablar del auto que le INTERESA no puede dar rojo: es media conversación.
const legitima = 'La Amarok 2018 que te interesa sale $32.000.000 y tiene 135.000 km.'

if (!atribuye.test(laDeLaCaptura)) throw new Error('el check NO caza la respuesta real del bug')
if (atribuye.test(buena)) throw new Error('el check marca en rojo la respuesta correcta')
if (atribuye.test(legitima)) throw new Error('el check caza una mención legítima del auto de interés')

// El check de lead tiene que existir con esa firma, o el caso no mide nada donde más importa.
const run = readFileSync(join(ROOT, 'evals', 'run.mjs'), 'utf8')
if (!run.includes('field_not_matches: (lead, field, pattern)')) {
  throw new Error('LEAD_CHECKS.field_not_matches no tiene la firma esperada (lead, field, pattern)')
}
if (!run.includes('c.lead_checks?.length')) throw new Error('run.mjs no lee `lead_checks` de los casos')

doc.cases.push(CASO)
writeFileSync(PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8')

const releido = JSON.parse(readFileSync(PATH, 'utf8'))
const g = releido.cases.find((c) => c.id === CASO.id)
if (!g) throw new Error('el caso no quedó guardado')
if (!g.lead_checks?.length) throw new Error('el caso quedó sin lead_checks')

console.log(`✓ ${antes} → ${releido.cases.length} casos`)
console.log('✓ el patrón da ROJO con la respuesta real y VERDE con la correcta y con la mención legítima')
console.log('✓ el caso mide las dos capas: el texto al cliente y el lead que ve el dueño')
console.log(`  + ${CASO.id}`)
