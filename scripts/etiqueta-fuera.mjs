#!/usr/bin/env node
// Le enseña al prompt la etiqueta `fuera`, que v14 inventó en el SQL y nunca se declaró
// (2026-07-21). Es la mitad que le faltaba a v14.
//
//   node scripts/etiqueta-fuera.mjs            # escribe franco-n8n-v19.json
//   node scripts/etiqueta-fuera.mjs --check    # solo valida
//
// DIAGNÓSTICO MEDIDO (ejecución 4986). En `km-con-presupuesto` ("tengo 13 millones" +
// "menos de 50.000 km" + permuta), Franco llamó a `Listar stock` CUATRO veces y las cuatro
// le devolvieron los 5 autos correctos:
//     Ranger, S10, T-Cross, Vento, Onix   ->  categoria: "fuera"
// O sea: el SQL de v14 funciona perfecto y el dato que llega es el correcto. Franco igual
// contestó "no hay opciones que entren dentro del presupuesto".
//
// CAUSA RAÍZ. El prompt declara el vocabulario de categorías como una lista CERRADA:
//     "entra" (dentro del presupuesto), "estirar" (un poco arriba),
//     "economica" (bastante más barato). Confiá en esa etiqueta, no compares precios vos.
// `fuera` no está. Franco recibe 5 autos con una etiqueta que no conoce, en un vocabulario
// donde ninguna opción significa "sirve", y con la orden explícita de confiar en la
// etiqueta en vez de mirar los precios. La conclusión que saca es la única coherente con lo
// que se le dijo: no hay nada. Las 4 llamadas seguidas son él reintentando con otros
// parámetros para encontrar algo "de verdad".
//
// NO ES UNA REGRESIÓN de v15/v16/v17/v18: el agujero existe desde v14. El 2/3 que se midió
// entonces fue suerte de muestra chica (Franco improvisando bien a veces). Con 6 corridas
// hoy da 2/6. STATE.md afirmaba "categoria='fuera' ... es la etiqueta que el prompt ya sabe
// leer": esa frase era falsa y nunca se verificó. Queda corregida.
//
// POR QUÉ VA AL PROMPT Y NO A SQL. Lo determinístico ("qué autos cumplen el criterio") YA
// está en SQL desde v14 y anda. Lo que falta es puramente lenguaje: cómo se le cuenta al
// cliente que lo que cumple su criterio se va de su presupuesto. Eso es la mitad del par que
// sí corresponde al prompt.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v18.json')
const OUT = join(ROOT, 'franco-n8n-v19.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe "Franco (AI Agent)"')

const antes = franco.parameters.options.systemMessage
assert(antes.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(antes.includes('ARRANCA por el porqué'), 'falta la regla del detalle de v18 — ¿partiste de v18?')
const EXPR = (antes.match(/\{\{/g) || []).length
assert(EXPR === 19, `esperaba 19 expresiones {{ }}, hay ${EXPR}`)

// El agujero, verificado: la palabra no aparece NUNCA en el prompt.
assert(
  !/\bfuera\b/.test(antes.replace(/fuera de alcance|fuera de rubro|fuera de contexto/gi, '')),
  'el prompt ya menciona la categoría "fuera" — ¿ya se aplicó?',
)

const VIEJO =
  'La `categoria` de cada auto: "entra" (dentro del presupuesto), "estirar" (un poco arriba), ' +
  '"economica" (bastante más barato). Confiá en esa etiqueta, no compares precios vos.'
const n = antes.split(VIEJO).length - 1
assert(n === 1, `el ancla de categorías aparece ${n} veces, esperaba 1`)

const NUEVO =
  'La `categoria` de cada auto: "entra" (dentro del presupuesto), "estirar" (un poco arriba), ' +
  '"economica" (bastante más barato), "fuera" (se pasa del presupuesto, PERO cumple el ' +
  'criterio que pidió el cliente). Confiá en esa etiqueta, no compares precios vos.\n' +
  'Sobre "fuera": la herramienta te devuelve autos así SOLO cuando ninguno dentro del ' +
  'presupuesto cumplía el criterio que pidió el cliente (los km, la carrocería, lo que sea). ' +
  'Que aparezcan significa que SÍ EXISTEN opciones que cumplen. Entonces:\n' +
  '· NUNCA digas "no hay opciones" ni "no tengo nada" cuando recibiste autos "fuera": los ' +
  'tenés en la mano y el cliente los está esperando.\n' +
  '· Los mostrás, y decís con todas las letras que se van del presupuesto, sin rodeos ' +
  '("dentro de tu presupuesto no hay ninguno con menos de 50.000 km; estos sí lo cumplen, ' +
  'pero están por encima de lo que tenías pensado"). Después ofrecés los caminos que ' +
  'correspondan (permuta, financiación, o que un asesor tase el usado).\n' +
  '· No vuelvas a llamar a la herramienta con otros parámetros buscando algo mejor: si ' +
  'vinieron como "fuera" es porque no existe nada dentro del presupuesto que cumpla. ' +
  'Reintentar sólo te hace perder tiempo y llegar a la misma respuesta.'

const despues = antes.replace(VIEJO, NUEVO)

// --- post-condiciones
assert(despues !== antes, 'no se aplicó ningún cambio')
assert(despues.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((despues.match(/\{\{/g) || []).length === EXPR, 'se perdió alguna expresión {{ }}')
assert(despues.includes('"fuera" (se pasa del presupuesto'), 'no quedó la definición de fuera')
assert((despues.match(/Sobre "fuera":/g) || []).length === 1, 'la sección quedó duplicada')
// Lo de las versiones anteriores, intacto.
for (const [marca, versión] of [
  ['TRATO:', 'v15'],
  ['SIN PRESUPUESTO DECLARADO', 'v16'],
  ['ARRANCA por el porqué', 'v18'],
  ['viñeta "- "', 'v18'],
]) {
  assert((despues.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length === 1,
    `se tocó la regla de ${versión}: ${marca}`)
}
assert(despues.includes('"estirar" (un poco arriba)'), 'se perdió la categoría estirar')
assert(despues.includes('"economica" (bastante más barato)'), 'se perdió la categoría economica')

franco.parameters.options.systemMessage = despues

console.log('✓ todas las aserciones pasan')
console.log(`  prompt: ${antes.length} -> ${despues.length} chars (+${despues.length - antes.length})`)
console.log('  la categoría "fuera" queda declarada, con qué hacer y qué no')
console.log('  intactas: TRATO (v15), gate de permuta (v16), detalle y viñeta (v18)')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
