// Caso de eval del bug que reportó Agustina el 2026-08-12: **Franco contesta el fallback a TODO**.
//
// EL BUG, REPRODUCIDO 3/3 CONTRA PRODUCCIÓN antes de escribir una línea de fix: al mensaje
// "Hola! busco un auto de 20M aprox, que tenes disonible?" Franco contesta *"Uy, se me trabó el
// sistema un segundo. Me repetís lo último?"*. Determinístico, no intermitente.
//
// LA CAUSA, LEÍDA DEL LOG DE n8n (ejecuciones 16613 y 16614) ANTES DE TEORIZAR — el nodo
// `Franco (AI Agent)` devuelve, en vez de `output`:
//     Received tool input did not match expected schema
//     ✖ Required → con_financiacion, usado_anio, usado_marca, usado_modelo, usado_categoria, usado_km
// El cliente pide autos POR PRESUPUESTO y NO nombra ningún usado, así que el modelo no tiene qué
// poner en los cinco `usado_*`, los omite, n8n **rechaza la llamada entera** y `Armar respuesta`
// cae al fallback. Es la misma familia que v135 arregló a medias.
//
// EL DATO QUE HACE EL FIX PRECISO, Y QUE v139 NO VIO: en el log, `tiene_permuta` **NO** figura
// entre los rechazados — el modelo SÍ lo mandó (en 0). O sea: el modelo dice "no hay permuta" y aun
// así se le exigen los datos de un usado que no existe. Los `usado_*` sólo tienen sentido con
// `tiene_permuta=1`, y de hecho la propia SQL los ignora (`usado_val` los usa sólo dentro de
// `CASE WHEN tiene_permuta = 1 ...`).
//
// POR QUÉ NO LO CAZÓ LA SUITE, Y ES EL AGUJERO A CERRAR: `no_fallback_bubble` YA corre en ALWAYS,
// o sea en todos los turnos de todos los casos. El check estaba; lo que faltaba era un caso que
// pisara este camino. Los casos con presupuesto de la suite lo dan SIEMPRE junto a un usado
// ("mi fiat mobi 2018, tengo 13 millones"), y ahí el modelo sí tiene con qué llenar los campos y la
// llamada pasa. **El camino más común de la demo —pedir autos por plata, a secas— no estaba en
// ningún caso.**
//
// NO SE ESCRIBE CON LA FRASE QUE EL PARSER ENTIENDE: el turno 1 es, textual, el mensaje que escribió
// Agustina, typo de "disonible" incluido.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATH = join(ROOT, 'evals', 'cases.json')

const CASO = {
  id: 'presupuesto-sin-usado-no-se-traba',
  bug:
    'REPORTADO POR AGUSTINA 2026-08-12 sobre v140/v137 (pasa en las dos: se aisló revirtiendo). ' +
    'Franco contesta "Uy, se me trabo el sistema un segundo. Me repetis lo ultimo?" a un pedido de ' +
    'autos por presupuesto. REPRODUCIDO 3/3 contra produccion, deterministico. CAUSA leida del log ' +
    '(ejecuciones 16613 y 16614): "Received tool input did not match expected schema - Required at ' +
    'con_financiacion / usado_anio / usado_marca / usado_modelo / usado_categoria / usado_km". El ' +
    'cliente no nombra ningun usado, el modelo omite los cinco usado_*, n8n rechaza la llamada ' +
    'entera y Armar respuesta cae al fallback. OJO: tiene_permuta NO esta entre los rechazados, el ' +
    'modelo lo mando en 0 - se le exigen los datos de un usado que el propio modelo declaro que no ' +
    'existe. AGUJERO QUE LO DEJO PASAR: no_fallback_bubble ya corre en ALWAYS, pero NINGUN caso de ' +
    'la suite pedia autos por plata SIN mencionar un usado; los que tienen presupuesto lo dan junto ' +
    'a un usado (km-con-presupuesto: "mi fiat mobi 2018, tengo 13 millones") y ahi la llamada pasa.',
  turns: [
    {
      // El mensaje REAL de Agustina, textual, con el typo incluido.
      say: 'Hola! busco un auto de 20M aprox, que tenes disonible?',
      checks: [
        // El check que define el bug es `no_fallback_bubble`, que ya corre en ALWAYS. Estos exigen
        // que además CONTESTE: sin ellos, una respuesta vacía pero sin fallback daría verde.
        ['text_matches', '(?i)(etios|cronos|kangoo|ecosport|duster|onix|renegade|corolla|208)'],
        ['cards_min', 1],
        ['ends_with_question'],
        [
          'manual',
          'EL TURNO DEL BUG. Con $20.000.000 el cliente tiene que ver opciones reales (el Onix ' +
            '$21.500.000 esta apenas arriba; entran Duster $22.500.000 no, Renegade no; si entran ' +
            'Etios $14.500.000, Cronos $16.800.000, Kangoo $18.500.000, EcoSport $19.800.000). Lo ' +
            'que NO puede pasar, y es el bug, es la burbuja "se me trabo el sistema". Tampoco puede ' +
            'pedirle datos de un usado que el cliente no nombro.',
        ],
      ],
    },
    {
      // Segundo turno: el cliente sigue SIN usado. Cubre que el arreglo no se agote en el turno 1.
      say: 'y algo un poco más nuevo?',
      checks: [
        ['text_matches', '(?i)20(2[0-9])'],
        [
          'manual',
          'Sigue sin usado. No puede caer al fallback ni pedir marca/modelo/anio de un usado ' +
            'inexistente. Tiene que ofrecer los mas nuevos que entren o decir con el numero por que no.',
        ],
      ],
    },
  ],
}

const data = JSON.parse(readFileSync(PATH, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

ok(Array.isArray(data.cases), 'cases.json no tiene el array `cases`')
ok(!data.cases.some((c) => c.id === CASO.id), `el caso ${CASO.id} ya existe`)

// Los regex compilan y hacen lo que dicen: se verifican ANTES de gastar una corrida.
const reAuto = new RegExp(CASO.turns[0].checks[0][1].replace(/^\(\?i\)/, ''), 'i')
ok(reAuto.test('Mirá, con $20.000.000 te entran el Toyota Etios 2021 y el Fiat Cronos 2023.'), 'el regex de autos no matchea una respuesta buena')
ok(!reAuto.test('Uy, se me trabó el sistema un segundo. Me repetís lo último?'), 'el regex de autos matchea el fallback')
const reNuevo = new RegExp(CASO.turns[1].checks[0][1].replace(/^\(\?i\)/, ''), 'i')
ok(reNuevo.test('El Fiat Cronos 2023 y el Chevrolet Onix 2024 son los más nuevos que te entran.'), 'el regex de año nuevo no matchea')
ok(!reNuevo.test('Uy, se me trabó el sistema un segundo.'), 'el regex de año nuevo matchea el fallback')

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

data.cases.push(CASO)
writeFileSync(PATH, JSON.stringify(data, null, 2) + '\n')
console.log(`OK: caso "${CASO.id}" agregado · ${data.cases.length} casos en total`)
console.log('   TIENE QUE FALLAR ANTES DE ARREGLAR NADA. Ya se reprodujo 3/3 a mano contra producción.')
