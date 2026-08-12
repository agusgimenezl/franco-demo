// Agrega los 3 casos de eval del bug reportado por Agustina el 2026-08-11 sobre la sesión REAL
// `edc12363-45c5-4860-9d5d-aeba606adfb0` (Julieta Vega, captura del chat de la demo).
//
// EL BUG, EN DOS PARTES, LAS DOS EN EL MISMO TURNO ("tengo 6 millones"):
//   (a) Franco NO detecta que el anticipo no cubre el auto por el que la clienta vino. El Etios
//       sale $14.500.000, el anticipo mínimo es $7.250.000 y ella tiene $6.000.000: le faltan
//       $1.250.000. Franco contestó "Perfecto, ya lo tengo anotado" y derivó.
//   (b) Franco NO pregunta las cuotas. La línea 330 del prompt lo manda TEXTUAL ("Recién con el
//       anticipo preguntás las cuotas (12, 24, 36 o 48) si no las dio") y además prohíbe los dos
//       cierres que usó ("se lo dejo anotado al asesor" / "querés ver otras opciones?").
//
// POR QUÉ (a) NO LO CAZA NINGUNA GUARDA EXISTENTE: las tres guardas de plata piden un camino que
// esta clienta no tomó. v98/v99 exige `monto_financiar` (nunca dijo cuánto quería financiar);
// v100 exige que el mensaje del turno diga "no tengo usado" (dijo "tengo 6 millones"); y
// v97/v113/v120 exigen `carroceria_pedida` y comparan contra el PISO DE UNA CARROCERÍA, no contra
// el precio de un auto puntual. `lead_vehiculo` no se usa en NINGUNA parte del systemMessage.
//
// TRAMPA 7 DESCARTADA ANTES DE ESCRIBIR ESTO: la pregunta de cierre NO la puso el guard de
// `Armar respuesta` — ese guard sólo corre si el turno mostró autos (`autos.length >= 1`) y ese
// turno no mostró ninguno; además su texto es otro ("prepare una cotización" / "algo parecido").
// La escribió Franco.
//
// LA TERCERA RAMA ES UNA DECISIÓN DE AGUSTINA (2026-08-11): cuando el cliente mostró interés en
// VARIOS autos, la guarda NO compara contra ninguno (no acusa "no te alcanza" a alguien a quien
// tal vez le alcanza uno de los tres) pero SÍ le recuerda que el anticipo tiene que ser como
// mínimo el 50% del valor del vehículo. Por eso el caso 3 no exige ningún número: exige la regla.
//
// LOS 3 CASOS TIENEN QUE FALLAR ANTES DEL FIX. El 2 es además el CONTROL del 1: con $8.000.000 la
// operación SÍ cierra ($16.000.000 de techo > $14.500.000), así que ahí la guarda nueva NO tiene
// que disparar y lo único que se mide es si pregunta las cuotas.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATH = join(ROOT, 'evals', 'cases.json')

// Los precios del stock vivo al 2026-08-11, verificados por SQL contra `autos_disponibles`.
// Están acá para que las aserciones de abajo comprueben que los números de los checks salen de
// ellos y no de la memoria de nadie.
const ETIOS = 14_500_000
const ANTICIPO_CORTO = 6_000_000
const ANTICIPO_QUE_ALCANZA = 8_000_000

const minimo = (precio) => precio / 2
const techo = (anticipo) => anticipo * 2

// ── ARITMÉTICA DEL CASO, EJECUTADA (no asserts de string): si el stock cambia de precio, esto
// se rompe acá y no en una corrida de 45 minutos.
if (minimo(ETIOS) !== 7_250_000) throw new Error(`anticipo mínimo del Etios: esperaba 7.250.000, dio ${minimo(ETIOS)}`)
if (techo(ANTICIPO_CORTO) !== 12_000_000) throw new Error(`techo con 6M: esperaba 12.000.000, dio ${techo(ANTICIPO_CORTO)}`)
if (!(techo(ANTICIPO_CORTO) < ETIOS)) throw new Error('el caso 1 no reproduce nada: con 6M el Etios SÍ entraría')
if (!(techo(ANTICIPO_QUE_ALCANZA) >= ETIOS)) throw new Error('el caso 2 no sirve de control: con 8M el Etios NO entra')

// El cierre que Franco usó en la captura y que la línea 330 prohíbe explícitamente. Es el mismo
// `text_not_matches` en los tres casos a propósito: es la firma del bug, no del auto.
const NO_DA_POR_ARMADA = '(?i)(ya )?lo tengo anotado|se lo dejo anotado|qued[oó] anotado'

const CASOS = [
  {
    id: 'anticipo-no-cubre-el-auto-de-interes',
    bug:
      'CAPTURA DE AGUSTINA 2026-08-11, sesión REAL edc12363-45c5-4860-9d5d-aeba606adfb0 (Julieta Vega). ' +
      'La clienta vino por el Toyota Etios ($14.500.000, anticipo mínimo $7.250.000), preguntó por financiación, ' +
      'Franco le pidió el anticipo y ella contestó "tengo 6 millones" — le faltan $1.250.000. Franco contestó ' +
      '"Perfecto, ya lo tengo anotado" y la derivó: NUNCA comparó el anticipo contra el precio del auto de interés. ' +
      'Ninguna guarda de plata cubre este camino: v98/v99 exige monto_financiar, v100 exige que diga "no tengo usado", ' +
      'y v97/v113/v120 comparan contra el piso de una CARROCERÍA, no contra un auto puntual. El dato está en el lead ' +
      '(vehiculo_interes) y el precio en catalogo_precios: los dos ya viajan en "Leer lead (estado)" y nada los cruza.',
    turns: [
      { say: 'me interesa el toyota etios', checks: [['text_matches', '(?i)etios']] },
      { say: 'cómo es el tema de la financiación?', checks: [['text_matches', '(?i)anticipo']] },
      {
        say: 'tengo 6 millones',
        checks: [
          // LA SEÑAL, DECLARADA ANTES DE MEDIR: tiene que aparecer UNO de los dos números reales —
          // el anticipo mínimo del Etios ($7.250.000) o el techo que le da su anticipo
          // ($12.000.000). Los dos los calcula el código; ninguno se le puede pedir al modelo.
          ['text_matches', '(?i)7[\\.\\s]?250[\\.\\s]?000|12[\\.\\s]?000[\\.\\s]?000|12 millones'],
          ['text_not_matches', NO_DA_POR_ARMADA],
          [
            'manual',
            'EL TURNO DEL CASO. El Etios sale $14.500.000 y el anticipo mínimo es $7.250.000: con $6.000.000 NO alcanza, ' +
              'le faltan $1.250.000. Franco tiene que decírselo con el número —el mínimo del Etios o el techo de $12.000.000— ' +
              'sin maquillarlo y sin dar la operación por armada. Puede seguir siendo comercial (ofrecer lo que sí le entra), ' +
              'pero NO puede anotar el anticipo como si cerrara.',
          ],
        ],
      },
    ],
  },
  {
    id: 'preperfilado-pregunta-las-cuotas-tras-el-anticipo',
    bug:
      'MISMA CAPTURA 2026-08-11 (sesión edc12363), la otra mitad del bug. La línea 330 del prompt manda TEXTUAL: ' +
      '"Recién con el anticipo preguntás las cuotas (12, 24, 36 o 48) si no las dio", y que el embudo termina en el ' +
      'NOMBRE recién cuando están el anticipo Y las cuotas. Franco tenía el anticipo y saltó directo al cierre con ' +
      '"Perfecto, ya lo tengo anotado. Querés que te contacte un asesor, o preferís que te muestre opciones?" — que es ' +
      'lo que esa misma línea prohíbe con todas las letras ("el embudo NO termina en \'se lo dejo anotado al asesor\'", ' +
      '"NO cierres con ... \'querés ver otras opciones?\'"). Sospecha a confirmar: la 330 es el párrafo más largo del ' +
      'prompt y encadena ~8 reglas con varios guiones de SALIDA listos para copiar; "preguntás las cuotas" es una ' +
      'cláusula suelta en el medio. Es la lección 1 (un ejemplo elegible le gana a una regla que está más abajo). ' +
      'ADEMÁS ES EL CONTROL DE anticipo-no-cubre-el-auto-de-interes: con $8.000.000 el techo es $16.000.000 y el Etios ' +
      '($14.500.000) SÍ entra, así que la guarda nueva NO tiene que disparar acá.',
    turns: [
      { say: 'me interesa el toyota etios', checks: [['text_matches', '(?i)etios']] },
      { say: 'cómo es el tema de la financiación?', checks: [['text_matches', '(?i)anticipo']] },
      {
        say: 'tengo 8 millones',
        checks: [
          // LA SEÑAL: tiene que PREGUNTAR el plazo. No alcanza con que la palabra "cuota" aparezca
          // —"el valor de la cuota lo confirma un asesor" la trae sin preguntar nada—, así que el
          // patrón pide la forma interrogativa o el menú de plazos.
          [
            'text_matches',
            '(?i)cu[aá]ntas cuotas|qu[eé] plazo|plazo[^.?]{0,30}(pens|prefer|ten[eé]s)|12,? ?24|24,? ?36|36 (o|y) 48',
          ],
          ['text_not_matches', NO_DA_POR_ARMADA],
          [
            'manual',
            'CONTROL DEL CASO ANTERIOR Y CASO PROPIO. Con $8.000.000 la operación SÍ cierra para el Etios ($14.500.000, ' +
              'mínimo $7.250.000): acá NO tiene que aparecer ningún "no te alcanza". Lo que sí tiene que hacer es el paso ' +
              'que falta del pre-perfilado: preguntar en cuántas cuotas (12, 24, 36 o 48) ANTES de cerrar o pedir el nombre.',
          ],
        ],
      },
    ],
  },
  {
    id: 'anticipo-varios-autos-recuerda-el-50',
    bug:
      'DECISIÓN DE AGUSTINA 2026-08-11, la tercera rama de la guarda del anticipo. Cuando el cliente mostró interés en ' +
      'VARIOS autos (vehiculo_interes trae "Chevrolet Onix / Volkswagen T-Cross / Toyota Corolla" en leads reales de hoy), ' +
      'la guarda NO compara contra ninguno: decir "no te alcanza" cuando quizás le entra uno de los tres es el falso ' +
      'positivo más caro en una venta. Pero tampoco se calla el criterio: le RECUERDA que el anticipo tiene que ser como ' +
      'mínimo el 50% del valor del vehículo, y deja que el cliente elija. Hoy Franco no hace ni una cosa ni la otra: ' +
      'anota el anticipo y sigue.',
    turns: [
      { say: 'me interesan el onix y el corolla', checks: [['text_matches', '(?i)onix']] },
      { say: 'cómo es el tema de la financiación?', checks: [['text_matches', '(?i)anticipo']] },
      {
        say: 'tengo 6 millones',
        checks: [
          // LA SEÑAL: la REGLA, no un número. Con varios autos la guarda no hace la cuenta.
          ['text_matches', '(?i)50\\s?%|cincuenta por ciento|la mitad'],
          ['text_not_matches', NO_DA_POR_ARMADA],
          [
            'manual',
            'Onix $21.500.000 (mínimo $10.750.000) y Corolla $24.800.000 (mínimo $12.400.000): con $6.000.000 no le alcanza ' +
              'para ninguno de los dos, PERO la decisión es que con varios autos Franco NO acuse "no te alcanza". Tiene que ' +
              'recordarle que el anticipo es como mínimo el 50% del valor del vehículo. NO tiene que anotar el anticipo y seguir.',
          ],
        ],
      },
    ],
  },
]

const doc = JSON.parse(readFileSync(PATH, 'utf8'))
const antes = doc.cases.length

// ── ASERCIONES SOBRE EL ESTADO PREVIO ────────────────────────────────────────────────────────
if (antes !== 93) throw new Error(`esperaba 93 casos antes del cambio, hay ${antes}`)
for (const c of CASOS) {
  if (doc.cases.some((x) => x.id === c.id)) throw new Error(`el caso "${c.id}" YA EXISTE: este script no pisa nada`)
}

// ── LOS REGEX SE COMPILAN ACÁ, NO EN LA TANDA ────────────────────────────────────────────────
// Un patrón roto se lee como un bug de Franco y cuesta una corrida entera de 45 minutos.
let patrones = 0
for (const c of CASOS) {
  for (const t of c.turns) {
    for (const [tipo, arg] of t.checks) {
      if (tipo !== 'text_matches' && tipo !== 'text_not_matches') continue
      new RegExp(String(arg).replace(/^\(\?i\)/, ''), 'i')
      patrones++
    }
  }
}

// ── EL PATRÓN DEL CASO 1 TIENE QUE SER VERDE CON LA RESPUESTA BUENA Y ROJO CON LA DE LA CAPTURA ──
// Se ejecuta de verdad contra los dos textos: sin esto el check podría pasar trivialmente.
const patronCaso1 = new RegExp('7[\\.\\s]?250[\\.\\s]?000|12[\\.\\s]?000[\\.\\s]?000|12 millones', 'i')
const buena = 'Con $6.000.000 de anticipo podríamos buscar hasta $12.000.000, y el Etios necesita $7.250.000.'
const laDeLaCaptura = 'Perfecto, ya lo tengo anotado. Querés que te contacte un asesor para avanzar?'
if (!patronCaso1.test(buena)) throw new Error('el patrón del caso 1 NO reconoce una respuesta correcta')
if (patronCaso1.test(laDeLaCaptura)) throw new Error('el patrón del caso 1 da verde con la respuesta que falla')

const patronNoArmada = new RegExp(NO_DA_POR_ARMADA.replace(/^\(\?i\)/, ''), 'i')
if (!patronNoArmada.test(laDeLaCaptura)) throw new Error('el text_not_matches NO caza el cierre de la captura')
if (patronNoArmada.test(buena)) throw new Error('el text_not_matches marca en rojo una respuesta correcta')

const patronCuotas = new RegExp(
  'cu[aá]ntas cuotas|qu[eé] plazo|plazo[^.?]{0,30}(pens|prefer|ten[eé]s)|12,? ?24|24,? ?36|36 (o|y) 48',
  'i',
)
if (!patronCuotas.test('perfecto, en cuántas cuotas lo pensabas, 12, 24, 36 o 48?'))
  throw new Error('el patrón de cuotas NO reconoce la pregunta que se espera')
if (patronCuotas.test('el valor de la cuota te lo confirma un asesor, porque depende de las condiciones'))
  throw new Error('el patrón de cuotas da verde con una frase que NO pregunta el plazo')

// ── APLICAR ──────────────────────────────────────────────────────────────────────────────────
doc.cases.push(...CASOS)
if (doc.cases.length !== antes + 3) throw new Error(`esperaba ${antes + 3} casos, quedaron ${doc.cases.length}`)

writeFileSync(PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8')

// Releído del disco: que el JSON quedó parseable no se asume, se verifica.
const releido = JSON.parse(readFileSync(PATH, 'utf8'))
for (const c of CASOS) {
  const g = releido.cases.find((x) => x.id === c.id)
  if (!g) throw new Error(`"${c.id}" no quedó guardado`)
  if (g.turns.length !== 3) throw new Error(`"${c.id}" quedó con ${g.turns.length} turnos`)
}

console.log(`✓ ${antes} → ${releido.cases.length} casos`)
console.log(`✓ ${patrones} patrones compilados`)
console.log('✓ el patrón del caso 1 es verde con la respuesta buena y rojo con la de la captura')
console.log('✓ el patrón de cuotas distingue preguntar el plazo de nombrar la palabra "cuota"')
for (const c of CASOS) console.log(`  + ${c.id}`)
