// Caso de eval del bug que capturó Agustina el 2026-08-12 sobre v134, sesión REAL
// `16787147-4cba-4816-9e68-16eb6c8f3faf`, ejecución de n8n **15903**.
//
// EL BUG: el cliente pregunta "perfecto y el corolla que vi en el instagram?" y Franco contesta
// "No tengo en stock un Toyota Corolla ahora" — y el Corolla 2022 ESTÁ en stock a $24.800.000.
// Dos mensajes después, ante "mostrame todo el stock", lo lista. Y en el turno siguiente, ante
// "me das mas info del corolla?", contesta bien y manda las fotos.
//
// LA CAUSA, LEÍDA DEL LOG ANTES DE TEORIZAR (método del proyecto), comparando la ejecución del bug
// contra la del turno anterior de la MISMA conversación:
//   · 15899 ("info del onix y de la t cross")  -> Buscar auto x2, Detalle auto x2 · 13,1 s
//   · 15903 ("y el corolla que vi en instagram") -> NINGUNA herramienta          ·  5,4 s
// **Franco afirmó que no hay stock sin haber consultado el stock.** No es que la query falló ni que
// un filtro se comió al Corolla: no hubo query. En su contexto sólo estaban el Onix y la T-Cross
// del turno anterior, no encontró el Corolla ahí, y leyó su propio contexto como si fuera el
// inventario.
//
// POR QUÉ IMPORTA MÁS QUE UN ERROR DE REDACCIÓN: negar stock que existe mata la venta en el acto, y
// la demo se muestra en reuniones con dueños de concesionaria. Es el peor síntoma posible.
//
// EL CHECK QUE DEFINE EL BUG es el `text_not_matches` de la negación. El `text_matches` de "corolla"
// es secundario: existe para que no pase por ignorar la pregunta.
//
// TIENE QUE FALLAR ANTES DE ARREGLAR NADA. Ojo: el bug es que el modelo DECIDE no llamar la
// herramienta, así que puede no reproducir las 3 veces. Con que falle una alcanza para tenerlo
// agarrado; si diera 3/3 verde, hay que decirlo y no inventar la falla.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATH = join(ROOT, 'evals', 'cases.json')

// La negación tiene que ser sobre DISPONIBILIDAD, no sobre un dato. La primera versión de este
// patrón pedía "…{0,40}(corolla|en stock|stock)" y daba rojo con "No tengo ese dato del Corolla",
// que es una respuesta legítima — lo cazó el assert de abajo antes de que costara una corrida.
// Por eso lo que se exige cerca de la negación es `stock|disponible`, no el nombre del auto.
const NIEGA_STOCK =
  '(?i)(no (lo )?ten(go|emos)|no hay|no contamos con|no dispon\\w+)[^.!?]{0,35}(stock|disponible)' +
  '|corolla[^.!?]{0,30}no (est[aá]|hay|lo ten)'

const CASO = {
  id: 'no-niega-stock-sin-consultarlo',
  bug:
    'CAPTURA DE AGUSTINA 2026-08-12, sesión REAL 16787147-4cba-4816-9e68-16eb6c8f3faf, ejecución de n8n 15903. ' +
    'El cliente pregunta "perfecto y el corolla que vi en el instagram?" y Franco contesta "No tengo en stock un ' +
    'Toyota Corolla ahora": el Corolla 2022 ESTÁ en stock a $24.800.000, y dos mensajes después lo lista cuando le ' +
    'piden todo el stock. CAUSA LEÍDA DEL LOG: en esa ejecución NO corrió ninguna herramienta (5,4 s), mientras que ' +
    'el turno anterior de la misma charla corrió Buscar auto x2 y Detalle auto x2 (13,1 s). Franco afirmó que no hay ' +
    'stock SIN CONSULTAR EL STOCK: en su contexto sólo estaban el Onix y la T-Cross del turno previo, no encontró el ' +
    'Corolla ahí y leyó su propio contexto como si fuera el inventario. Negar stock que existe mata la venta en el ' +
    'acto y la demo se muestra a dueños de concesionaria.',
  turns: [
    {
      say: 'Buenas, me darias mas info del onix y de la t cross?',
      checks: [['text_matches', '(?i)onix']],
    },
    {
      say: 'perfecto y el corolla que vi en el instagram?',
      checks: [
        // EL CHECK DEL CASO: no puede negar un auto que está en stock.
        ['text_not_matches', NIEGA_STOCK],
        // Secundario: que no pase por ignorar la pregunta.
        ['text_matches', '(?i)corolla'],
        [
          'manual',
          'EL TURNO DEL CASO. El Toyota Corolla 2022 ESTÁ en stock: $24.800.000, 35.000 km. Franco tiene que ' +
            'consultar el stock antes de afirmar nada sobre disponibilidad. Puede pedir precisiones o pasar la ficha, ' +
            'pero NO puede decir que no lo tiene. Que la pregunta venga con contexto de afuera ("que vi en el ' +
            'instagram") no cambia que el auto está en el stock.',
        ],
      ],
    },
  ],
}

const doc = JSON.parse(readFileSync(PATH, 'utf8'))
const antes = doc.cases.length

if (antes !== 96) throw new Error(`esperaba 96 casos antes del cambio, hay ${antes}`)
if (doc.cases.some((c) => c.id === CASO.id)) throw new Error(`el caso "${CASO.id}" YA EXISTE`)

// ── LOS PATRONES SE EJECUTAN ACÁ, contra la respuesta REAL de la captura y contra una buena ──
const negacion = new RegExp(NIEGA_STOCK.replace(/^\(\?i\)/, ''), 'i')
const laDeLaCaptura =
  'No tengo en stock un Toyota Corolla ahora. Si querés te puedo mostrar las opciones similares que tenemos, como sedanes o SUV, o un asesor te puede ayudar con más info. Qué preferís?'
const buena = 'Sí, tenemos el Toyota Corolla 2022 con 35.000 km a $24.800.000. Te paso las fotos?'
// Negaciones LEGÍTIMAS que NO tienen que dar rojo: Franco puede no tener un dato puntual o una
// foto, y eso no es negar stock. La primera de estas dos rompió la versión anterior del patrón.
const legitima = 'No tengo ese dato del Corolla en la ficha, te lo confirma un asesor.'
const legitima2 = 'No tengo fotos del interior del Corolla, las puede facilitar un asesor.'
// Y otra forma REAL de negar stock, con el orden invertido: también tiene que dar rojo.
const malaInvertida = 'El Corolla no está disponible en este momento.'

if (!negacion.test(laDeLaCaptura)) throw new Error('el check NO caza la respuesta real del bug')
if (!negacion.test(malaInvertida)) throw new Error('el check NO caza la negación con el orden invertido')
if (negacion.test(buena)) throw new Error('el check marca en rojo una respuesta correcta')
if (negacion.test(legitima)) throw new Error('el check caza un "no tengo ese dato" legítimo, que no es el bug')
if (negacion.test(legitima2)) throw new Error('el check caza un "no tengo fotos" legítimo, que no es el bug')

doc.cases.push(CASO)
writeFileSync(PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8')

const releido = JSON.parse(readFileSync(PATH, 'utf8'))
if (releido.cases.length !== antes + 1) throw new Error(`quedaron ${releido.cases.length} casos`)
if (!releido.cases.find((c) => c.id === CASO.id)) throw new Error('el caso no quedó guardado')

console.log(`✓ ${antes} → ${releido.cases.length} casos`)
console.log('✓ el check caza la respuesta real de la captura')
console.log('✓ no marca en rojo una respuesta correcta ni un "no tengo ese dato" legítimo')
console.log(`  + ${CASO.id}`)
