#!/usr/bin/env node
// Franco se dirige al cliente por el NOMBRE DE PILA, aunque pida y guarde nombre y
// apellido (2026-07-21).
//
//   node scripts/trato-nombre-de-pila.mjs            # escribe franco-n8n-v15.json
//   node scripts/trato-nombre-de-pila.mjs --check    # solo valida
//
// BUG MEDIDO (corrida previa, --repeat 3 sobre los 3 casos de nombre):
//     nombre-con-apostrofe          0/3   "Perfecto Martín D'Angelo, le paso tu nombre..."
//     control-nombre-sin-apostrofe  1/3   "Perfecto Martin Dangelo, le paso tu nombre..."
//     derivacion-no-repite-asesor   3/3   "Listo Julieta"  (el check de nombre PASA acá)
// La forma del bug no es la que sugería la captura: depende de CÓMO llega el nombre. Si el
// cliente lo suelta dentro de una frase ("soy Martín D'Angelo, quiero que me contacte un
// asesor"), Franco eco-a el string entero casi siempre; si responde a un pedido explícito
// ("Julieta Miguez"), acorta bien la mayoría de las veces (falló 2/5 en otra corrida).
// Por eso la regla nueva nombra explícitamente el caso de la frase.
//
// POR QUÉ VA AL PROMPT Y NO A CÓDIGO: la regla del proyecto manda a SQL/código lo
// determinístico, pero acá no lo es. Partir "Martín D'Angelo" en nombre/apellido por código
// es exactamente el problema que no tiene solución determinística (apellidos compuestos,
// "de la Vega", nombres de pila dobles), y el texto donde habría que reemplazarlo lo escribe
// el modelo en cualquier parte de la frase. El TRATO es lenguaje: va al prompt.
//
// RIESGO DE YO-YO: los 5 refuerzos de "pedí nombre Y apellido" son de 2026-07-20 y están
// ahí porque Franco pedía sólo el nombre. Este cambio NO toca ninguno: agrega una regla que
// separa PEDIR/GUARDAR (nombre + apellido) de DIRIGIRSE (nombre de pila). Las aserciones de
// abajo verifican que los 5 sobrevivan byte a byte, que es el guardarraíl.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v14.json')
const OUT = join(ROOT, 'franco-n8n-v15.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`✗ ASERCIÓN FALLIDA: ${msg}`)
    process.exit(1)
  }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe "Franco (AI Agent)"')

const antes = franco.parameters.options.systemMessage
assert(typeof antes === 'string' && antes.length > 0, 'el systemMessage está vacío')

// Trampa 1: sin el "=" inicial, las 19 expresiones {{ }} son texto literal.
assert(antes.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')

// Estado esperado de partida: los refuerzos de 2026-07-20 puestos, la regla nueva no.
const REFUERZOS = antes.match(/nombre y (el )?apellido/gi) || []
assert(REFUERZOS.length === 7, `esperaba 7 menciones de "nombre y apellido", hay ${REFUERZOS.length}`)
assert(!antes.includes('TRATO:'), 'ya hay una regla de TRATO — ¿ya se aplicó este cambio?')

const EXPRESIONES = (antes.match(/\{\{/g) || []).length
assert(EXPRESIONES === 19, `esperaba 19 expresiones {{ }}, hay ${EXPRESIONES}`)

// El ancla es el bullet del cierre de derivación: es el turno EXACTO donde se mide la
// falla, y su ejemplo ("listo Julio") ya usa el nombre de pila. La regla va pegada ahí para
// que el modelo la lea junto al ejemplo que ya hace lo correcto.
const ANCLA =
  '- Una vez que tenés el nombre y apellido y confirmaste que un asesor lo va a contactar, ' +
  'CERRÁ preguntando si necesita algo más mientras tanto ("listo Julio, un asesor te contacta ' +
  'por acá. Necesitás que te ayude con algo más mientras tanto?"). No pidas datos de contacto ' +
  'adicionales: ya está todo lo necesario.'

const ocurrencias = antes.split(ANCLA).length - 1
assert(ocurrencias === 1, `el ancla aparece ${ocurrencias} veces, esperaba exactamente 1`)

const REGLA =
  '\n- TRATO: pedís y registrás nombre Y apellido, pero al cliente le hablás SOLO por el ' +
  'nombre de pila. Si te dice "Martín D\'Angelo", le contestás "Perfecto Martín", nunca ' +
  '"Perfecto Martín D\'Angelo": repetirle el apellido suena a formulario, no a vendedor. ' +
  'Vale para el resto de la charla y da igual cómo te lo haya dado, suelto ("Julieta Miguez") ' +
  'o dentro de una frase ("soy Martín D\'Angelo, quiero que me contacte un asesor"). El ' +
  'apellido lo seguís pidiendo y pasando al asesor: lo que cambia es sólo cómo lo nombrás a él.'

const despues = antes.replace(ANCLA, ANCLA + REGLA)

// --- post-condiciones
assert(despues !== antes, 'no se aplicó ningún cambio')
assert(despues.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert(despues.length === antes.length + REGLA.length, 'cambió más texto del esperado')

// Los 5 refuerzos de "pedí nombre y apellido" siguen intactos: la regla nueva SUMA una
// mención (la suya), no reemplaza ninguna.
const refuerzosDespues = despues.match(/nombre y (el )?apellido/gi) || []
assert(
  refuerzosDespues.length === REFUERZOS.length + 1,
  `los refuerzos de "nombre y apellido" cambiaron: ${REFUERZOS.length} -> ${refuerzosDespues.length}`,
)
assert(despues.includes(ANCLA), 'se rompió el bullet de cierre de derivación')
assert((despues.match(/\{\{/g) || []).length === EXPRESIONES, 'se perdió alguna expresión {{ }}')
assert((despues.match(/TRATO:/g) || []).length === 1, 'la regla quedó duplicada')

franco.parameters.options.systemMessage = despues

console.log('✓ todas las aserciones pasan')
console.log(`  systemMessage: ${antes.length} -> ${despues.length} chars (+${REGLA.length})`)
console.log(`  refuerzos "nombre y apellido": ${REFUERZOS.length} -> ${refuerzosDespues.length} (ninguno tocado)`)
console.log('  la regla va pegada al bullet de cierre de derivación, junto al ejemplo "listo Julio"')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
  console.log('\n--- PEGAR EN n8n: Franco (AI Agent) -> System Message ---')
  console.log('BUSCAR (fin del bullet, en "# Derivación a un asesor"):')
  console.log('  ...No pidas datos de contacto adicionales: ya está todo lo necesario.')
  console.log('\nAGREGAR JUSTO DEBAJO, como bullet nuevo:')
  console.log(REGLA.trimStart())
}
