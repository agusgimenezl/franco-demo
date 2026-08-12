// Caso de eval del bug capturado por Agustina el 2026-08-12 sobre v134 (charla de "Valen uria",
// Toyota Etios, 01:09-01:11): Franco pide el nombre y apellido SIN haber preguntado las cuotas.
//
// LO QUE HACE INTERESANTE A ESTE BUG: v134 arregló exactamente eso — su rama "alcanza" pregunta el
// plazo. Con el Etios ($14.500.000) y $10.000.000 de anticipo la operación entra holgada, así que
// la rama tenía que disparar. No disparó.
//
// LA CAUSA, VERIFICADA EJECUTANDO EL PARSER REAL DE `Config` CON EL MENSAJE TEXTUAL:
//   "Puedo dar un anticipo de 10M"  -> entrega_plata = 0   · entrega_plata_resp = 0   ← la captura
//   "doy 10M de anticipo"           -> entrega_plata = 10.000.000
//   "puedo dar 10 millones"         -> entrega_plata = 10.000.000
//   "tengo 10M"                     -> entrega_plata_resp = 10.000.000
//   "un anticipo de 10 millones"    -> 0 · 0
// NO ES "10M": eso el parser lo entiende. Es la palabra **"anticipo" entre el verbo y el número**.
// El regex de `entrega_plata` sabe saltar relleno (de|un|unos|como|hasta|aprox…) pero "anticipo" no
// está en esa lista, así que "dar un anticipo de 10M" no matchea. Y `entrega_plata_resp` exige que
// el mensaje EMPIECE con el número, y éste empieza con "Puedo dar…".
//
// EN CADENA: los dos parsers dan 0 -> `dioPlata` es false -> el bloque de v113/v134 no dispara ->
// no sale la rama de las cuotas -> Franco cae en el guion del name-ask del prompt.
//
// LO QUE ESTO REVELA, Y ES MÁS GRANDE QUE EL SÍNTOMA: **la guarda del anticipo de v134 depende de
// un parser que falla con una de las formas más naturales de decirlo.** Con "un anticipo de 10M" el
// número nunca llega, así que ni la rama de las cuotas ni la del anticipo insuficiente protegen.
//
// EL CASO SE ESCRIBE A NIVEL DE COMPORTAMIENTO, NO DE IMPLEMENTACIÓN: mide que Franco pregunte las
// cuotas antes del nombre. Si mañana el fix es otro (parser, prompt o guion), el caso sigue valiendo.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATH = join(ROOT, 'evals', 'cases.json')

// Los mismos patrones que usa `preperfilado-pregunta-las-cuotas-tras-el-anticipo`: si alguien los
// afina en un lado y no en el otro, los dos casos dejan de medir lo mismo y conviene que se note.
const PREGUNTA_CUOTAS =
  '(?i)cu[aá]ntas cuotas|qu[eé] plazo|plazo[^.?]{0,30}(pens|prefer|ten[eé]s)|12,? ?24|24,? ?36|36 (o|y) 48'
const PIDE_NOMBRE = '(?i)nombre y apellido|dej[aá]s tu nombre|dejame tu nombre|pas[aá]s tu nombre|c[oó]mo te llam[aá]s'

const CASO = {
  id: 'preperfilado-cuotas-aunque-diga-la-palabra-anticipo',
  bug:
    'CAPTURA DE AGUSTINA 2026-08-12 sobre v134, charla del Toyota Etios (01:09-01:11). El cliente dice "Puedo dar un ' +
    'anticipo de 10M" y Franco salta directo a "me dejás tu nombre y apellido?" SIN preguntar las cuotas, que es el ' +
    'paso que v134 agregó. CAUSA VERIFICADA EJECUTANDO EL PARSER DE Config: no es "10M" (eso lo entiende: "doy 10M de ' +
    'anticipo" da 10.000.000), es la palabra "anticipo" ENTRE EL VERBO Y EL NÚMERO — el regex de entrega_plata sabe ' +
    'saltar relleno (de|un|unos|como|hasta) pero no "anticipo", y entrega_plata_resp exige que el mensaje empiece con ' +
    'el número. Los dos dan 0, dioPlata queda false y el bloque de v113/v134 no dispara. LO GRAVE: la guarda del ' +
    'anticipo de v134 depende de ese mismo parser, así que con esta redacción tampoco protege del anticipo insuficiente.',
  turns: [
    { say: 'me interesa el toyota etios', checks: [['text_matches', '(?i)etios']] },
    { say: 'hacen financiación?', checks: [['text_matches', '(?i)anticipo|50\\s?%']] },
    {
      say: 'Puedo dar un anticipo de 10M',
      checks: [
        // Con $10.000.000 el Etios ($14.500.000) entra: acá NO va ningún "no te alcanza", va el
        // paso que falta del pre-perfilado.
        ['text_matches', PREGUNTA_CUOTAS],
        ['text_not_matches', PIDE_NOMBRE],
        [
          'manual',
          'EL TURNO DEL CASO. "Puedo dar un anticipo de 10M" son $10.000.000 y el Etios sale $14.500.000, así que la ' +
            'operación entra. Franco tiene que preguntar en cuántas cuotas (12, 24, 36 o 48) ANTES de pedir el nombre. ' +
            'Que el cliente use la palabra "anticipo" en el medio de la frase no puede cambiar lo que Franco entiende.',
        ],
      ],
    },
  ],
}

const doc = JSON.parse(readFileSync(PATH, 'utf8'))
const antes = doc.cases.length
if (antes !== 98) throw new Error(`esperaba 98 casos antes del cambio, hay ${antes}`)
if (doc.cases.some((c) => c.id === CASO.id)) throw new Error(`el caso "${CASO.id}" YA EXISTE`)

// ── LOS PATRONES, EJECUTADOS contra la respuesta REAL de la captura y contra la esperada ─────
const cuotas = new RegExp(PREGUNTA_CUOTAS.replace(/^\(\?i\)/, ''), 'i')
const nombre = new RegExp(PIDE_NOMBRE.replace(/^\(\?i\)/, ''), 'i')
const laDeLaCaptura =
  'Perfecto, con $10.000.000 de anticipo el plan y el valor de las cuotas te los confirma un asesor, porque depende de las condiciones de financiación. Para que te contacte, me dejás tu nombre y apellido?'
const buena = 'Perfecto. En cuántas cuotas lo pensabas, 12, 24, 36 o 48?'

if (cuotas.test(laDeLaCaptura)) throw new Error('el patrón de cuotas da verde con la respuesta que falla')
if (!nombre.test(laDeLaCaptura)) throw new Error('el patrón del name-ask no caza la respuesta que falla')
if (!cuotas.test(buena)) throw new Error('el patrón de cuotas no reconoce la respuesta esperada')
if (nombre.test(buena)) throw new Error('el patrón del name-ask marca en rojo la respuesta esperada')

doc.cases.push(CASO)
writeFileSync(PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8')

const releido = JSON.parse(readFileSync(PATH, 'utf8'))
if (releido.cases.length !== antes + 1) throw new Error(`quedaron ${releido.cases.length} casos`)

console.log(`✓ ${antes} → ${releido.cases.length} casos`)
console.log('✓ los patrones dan ROJO con la respuesta real de la captura y VERDE con la esperada')
console.log(`  + ${CASO.id}`)
