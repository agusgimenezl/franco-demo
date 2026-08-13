// Caso del bug que capturó Agustina el 2026-08-12 (11:48).
//
// EL BUG, EN TRES CAPAS Y LAS TRES DEL MISMO TURNO. El cliente YA eligió el Etios ($14.500.000) y
// dice "me quedo con el etios me parece. Me gustaria financiar 5 millones puede ser?". Franco:
//   1. NO cruza las dos variables que ya tiene (auto elegido + monto a financiar). Trata la pregunta
//      como si fuera abstracta sobre política de crédito.
//   2. Le RECITA LA REGLA para que el cliente saque la cuenta: "para financiar $5.000.000 el auto
//      tiene que valer al menos $10.000.000". Sabe que el Etios sale $14.500.000 y que entra: hacerle
//      hacer la cuenta parece que no supiera cuánto vale el auto que vende.
//   3. Cierra pidiendo el ANTICIPO, que en ese punto ya NO es una variable libre: es el precio menos
//      lo que financia ($14.500.000 - $5.000.000 = $9.500.000). Pide un dato que ya se deduce.
//
// LO QUE TENÍA QUE CONTESTAR (Agustina, textual): "Sí, se puede financiar $5.000.000 sin problema.
// En cuántas cuotas te gustaría financiarlo (12, 24 o 36)? Así le paso tu preferencia a un asesor
// para que te arme la simulación exacta."
//
// EL CHECK QUE DEFINE EL BUG es el `text_not_matches` de la regla recitada. Los otros dos existen
// para que no pase por contestar cualquier cosa.
//
// EL MENSAJE VA TEXTUAL, con la redacción del cliente y no con la que el parser entiende.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATH = join(ROOT, 'evals', 'cases.json')

const CASO = {
  id: 'financiar-monto-se-valida-contra-el-auto-elegido',
  bug:
    'CAPTURA DE AGUSTINA 2026-08-12 11:48. El cliente ya eligio el Etios ($14.500.000) y dice "me '
    + 'quedo con el etios me parece. Me gustaria financiar 5 millones puede ser?". Franco contesta '
    + '"Tene en cuenta que financiamos hasta el 50% del valor del vehiculo, asi que para financiar '
    + '$5.000.000 el auto tiene que valer al menos $10.000.000, y la otra mitad la cubris vos entre '
    + 'anticipo y usado" y cierra con "Y de anticipo, de cuanto pensas poner mas o menos?". TRES '
    + 'bugs en un turno: (1) no cruza el auto elegido con el monto, trata la pregunta como abstracta; '
    + '(2) le recita la regla para que el cliente saque una cuenta que Franco ya puede hacer -sabe '
    + 'que el Etios sale 14.500.000 y que 5.000.000 entra en el 50%-; (3) pide el anticipo, que ahi '
    + 'ya no es variable libre: es 14.500.000 - 5.000.000. Lo correcto es confirmar que se puede y '
    + 'pedir las CUOTAS para derivar. ES DETERMINISTICO: Config ya parsea monto_financiar, el precio '
    + 'sale de la base y la comparacion es aritmetica.',
  turns: [
    { say: 'me interesa el toyota etios', checks: [['text_matches', '(?i)etios']] },
    {
      say: 'perfecto, me quedo con el etios me parece. Me gustaria financiar 5 millones puede ser?',
      checks: [
        // Tiene que confirmar y avanzar a las cuotas.
        ['text_matches', '(?i)cuota'],
        // NO recitar la regla ni el piso calculado: es la cuenta que tiene que hacer él.
        ['text_not_matches', '(?i)tiene que valer|al menos \\$?10|deber[ií]a valer|valor m[ií]nimo'],
        // NO pedir el anticipo: en este punto ya se deduce del precio menos lo financiado.
        ['text_not_matches', '(?i)(de cu[aá]nto|cu[aá]nto)[^.?!]{0,40}anticipo|anticipo[^.?!]{0,25}pens[aá]s'],
        [
          'manual',
          'El Etios sale $14.500.000, asi que $5.000.000 entra comodo en el 50%. Franco tiene que '
            + 'confirmar que se puede y pedir las CUOTAS para derivar. Lo que NO puede hacer: recitar '
            + 'la regla del 50% con el piso de $10.000.000 para que el cliente saque la cuenta, ni '
            + 'preguntar cuanto pone de anticipo, que ahi ya es 14.500.000 - 5.000.000 = 9.500.000.',
        ],
      ],
    },
  ],
}

const data = JSON.parse(readFileSync(PATH, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }
ok(!data.cases.some((c) => c.id === CASO.id), `el caso ${CASO.id} ya existe`)

// Los regex se verifican contra la respuesta REAL de la captura y contra la que Agustina espera.
const mala = 'Tené en cuenta que financiamos hasta el 50% del valor del vehículo, así que para financiar '
  + '$5.000.000 el auto tiene que valer al menos $10.000.000, y la otra mitad la cubrís vos entre anticipo '
  + 'y usado. dale. Y de anticipo, de cuánto pensás poner más o menos?'
const buena = 'Sí, se puede financiar $5.000.000 sin problema. En cuántas cuotas te gustaría financiarlo '
  + '(12, 24 o 36)? Así le paso tu preferencia a un asesor para que te arme la simulación exacta.'
const re = (s) => new RegExp(String(s).replace(/^\(\?i\)/, ''), 'i')
ok(re(CASO.turns[1].checks[1][1]).test(mala), 'el check de la regla recitada NO caza la respuesta real del bug')
ok(!re(CASO.turns[1].checks[1][1]).test(buena), 'el check de la regla recitada caza la respuesta CORRECTA')
ok(re(CASO.turns[1].checks[2][1]).test(mala), 'el check del anticipo NO caza la respuesta real del bug')
ok(!re(CASO.turns[1].checks[2][1]).test(buena), 'el check del anticipo caza la respuesta CORRECTA')
ok(re(CASO.turns[1].checks[0][1]).test(buena), 'el check de cuotas no matchea la respuesta correcta')

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}
data.cases.push(CASO)
writeFileSync(PATH, JSON.stringify(data, null, 2) + '\n')
console.log(`OK: caso "${CASO.id}" agregado · ${data.cases.length} casos`)
console.log('   Los 3 checks se verificaron contra la respuesta REAL de la captura y contra la esperada.')
