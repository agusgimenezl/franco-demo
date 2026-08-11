#!/usr/bin/env node
// PISO DE GAMA — no ofrecer autos muy por debajo del presupuesto. v78 -> v79. 2026-08-04.
//
// EL BUG (captura de Agustina, reproducido 3/3 con `presupuesto-no-baja-de-gama` sobre v78):
// a "quiero un auto de 20 millones o menos" Franco contesta con EcoSport 19,8M y Kangoo 18,5M
// (bien) y en la MISMA lista mete el Cronos 16,8M (84% del presupuesto) y el Etios 12,5M (62%),
// y encima agrega una burbuja aparte: "Además, te menciono una opción económica por debajo del
// presupuesto: Volkswagen Gol Trend 2018 — $9.200.000" (46%). El que va a poner 20 millones no
// compra uno de 9: bajarle la gama sin que lo pida no es un extra, es ofrecerle lo que sobra.
// Regla de Agustina: la banda es 10% por abajo y 20% por arriba, y al final se ofrece el stock
// completo (que ya se ofrece hoy).
//
// ROOT CAUSE — DOS CAPAS, Y HAY QUE TOCAR LAS DOS (esto es la trampa 6 del CLAUDE.md):
//
//   (A) DETERMINÍSTICA, en el CASE de `Listar stock`: `categoria='entra'` abarca [0, presupuesto]
//       SIN PISO, así que el Cronos y el Etios llegan etiquetados igual que la EcoSport, y el
//       prompt dice "Recomendás 2 a 5 de los entra". Franco no está eligiendo mal: está
//       obedeciendo la etiqueta. Va a SQL, que es donde vive el cálculo (regla del proyecto).
//
//   (B) DE LENGUAJE, en `# Enfoque comercial`: el guion "Si hay una `economica` que aporta,
//       mencionás una sola" es literalmente la burbuja del Gol Trend. Arreglar SOLO el SQL
//       EMPEORA la cosa: con el piso nuevo hay MÁS autos etiquetados `economica` (Cronos, Etios,
//       Gol, Fiesta para un presupuesto de 20M) y ese guion sigue mandando a mencionar uno.
//       Por eso el guion se REEMPLAZA, no se le pone una prohibición arriba (eso ya falló tres
//       veces en este proyecto), y el reemplazo trae ANTI-EJEMPLO textual de las dos frases que
//       producen el bug.
//
// PRECEDENTE QUE OBLIGA A HACERLO JUNTO: v14 arregló el dato y dejó el lenguaje para después;
// el prompt no conocía la etiqueta nueva y el resultado fue el bug de "no hay opciones", que
// costó v19. Está escrito en STATE.md. Dato y vocabulario van en la misma versión.
//
// LA BANDA: `economica` pasa de `<= presupuesto*0.60` a `< presupuesto*0.90`. El 0.90 sale de
// los números de Agustina y coincide con su ejemplo: el Cronos (0.84) tiene que quedar afuera,
// y con un piso de 0.80 seguiría adentro.
//
// LO QUE NO SE TOCA, A PROPÓSITO (un cambio por vez):
//   · El TECHO sigue en 1.25 (contado) / 1.40 (permuta). Agustina pidió 20%; bajarlo a 1.20
//     obliga a cambiar también la receta de `precio_max` del prompt (hoy "estirado 25%"), o
//     quedan filas dentro de `en_presupuesto` etiquetadas `fuera`, que dispara todo el protocolo
//     de "fuera" para autos que no lo son. Es un cambio aparte, de una línea, y va cuando ella
//     confirme.
//   · La rama de permuta/financiación del CASE y todo el ladder de `tramo` (v49/a2, medido y
//     ganado con esfuerzo) quedan intactos. El piso nuevo SÍ aplica también con permuta, porque
//     la razón comercial es la misma; si Agustina quiere que con permuta se muestre más abajo,
//     se acota el piso con `tiene_permuta` en una línea.
//   · `auto_ids` sigue llevando TODAS las filas que devuelve la herramienta, así que las cards
//     siguen mostrando el catálogo completo mientras el texto recomienda la banda. Es el diseño
//     documentado ("el texto es tu recomendación, las cards el catálogo").
//
// TRAMPAS:
//   · Trampa 3: los `$fromAI('precio_objetivo', ...)` quedan byte-idénticos — sólo cambian el
//     operador y el multiplicador de afuera. Verificado por aserción sobre las 10 ocurrencias.
//   · Trampa 2: no se agregan parámetros; `queryReplacement` ni se toca.
//   · Trampa 4: `Listar stock` es una tool, no está en la cadena principal; y además el cambio no
//     puede alterar la cantidad de filas (sólo reetiqueta), verificado por aserción.
//   · Trampa 1: el systemMessage sigue arrancando con "=".
//   · Trampa 5: cero llamadas nuevas a LLM.
//   · Trampa 6: se reemplaza el guion y se agrega anti-ejemplo textual.
//
// Base: franco-n8n-v78.json (el vivo).
//
//   node scripts/piso-de-gama-presupuesto.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v78.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v79.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const base = JSON.parse(readFileSync(SRC, 'utf8'))

// ================================================================ (A) SQL: el piso
const listar = wf.nodes.find((n) => n.name === 'Listar stock')
assert(listar, 'no encontré el nodo Listar stock')
let q = listar.parameters.query

const OBJ = "{{ $fromAI('precio_objetivo', 'El techo de presupuesto real del cliente en pesos, sin estirar. Poner 0 si no dio presupuesto.', 'number') }}"
const ocurrenciasObjetivo = cuenta(q, OBJ)
assert(ocurrenciasObjetivo === 11, `esperaba 11 ocurrencias de $fromAI('precio_objetivo') y hay ${ocurrenciasObjetivo} (trampa 3)`)

const OLD_SQL = `WHEN (metadata->>'precio')::int <= (${OBJ} * 0.60) THEN 'economica'`
const NEW_SQL = `WHEN (metadata->>'precio')::int < (${OBJ} * 0.90) THEN 'economica'`
assert(cuenta(q, OLD_SQL) === 1, 'no encontré la rama `economica` del CASE de categoria como esperaba')

q = q.replace(OLD_SQL, NEW_SQL)
listar.parameters.query = q

// El resto del CASE queda igual: la rama `entra` ahora es [0.90*objetivo, objetivo].
assert(cuenta(q, `WHEN (metadata->>'precio')::int <= ${OBJ} THEN 'entra'`) === 1, 'se perdió la rama `entra`')
assert(cuenta(q, "THEN 'estirar'") === 1 && cuenta(q, "ELSE 'fuera'") === 1, 'se perdieron las ramas estirar/fuera')
assert(cuenta(q, '1.25') === 1 && cuenta(q, '1.40') === 1, 'cambió el techo y NO debía (va aparte)')
assert(cuenta(q, OBJ) === ocurrenciasObjetivo, 'cambió la cantidad de $fromAI(precio_objetivo) (trampa 3)')
assert(cuenta(q, '0.60') === 0 && cuenta(q, '0.90') === 1, 'el piso no quedó bien aplicado')
// El cambio sólo reetiqueta: no toca ningún WHERE, así que no puede cambiar la cantidad de filas.
const soloWheres = (s) => s.split('\n').filter((l) => /\bWHERE\b|\bNOT EXISTS\b|UNION ALL/.test(l)).join('\n')
assert(soloWheres(q) === soloWheres(base.nodes.find((n) => n.name === 'Listar stock').parameters.query),
  'cambió algún WHERE: el fix sólo debe reetiquetar, no filtrar (trampa 4)')

// ================================================================ (B) prompt: el guion
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no encontré el nodo Franco (AI Agent)')
let sm = franco.parameters.options.systemMessage
assert(sm.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(!sm.includes('NO las ofrecés'), 'el fix ya está aplicado (¿script ya corrido?)')

// (B1) El vocabulario de la etiqueta: "bastante más barato" no dice qué hacer con ella.
const OLD_VOCAB = '"economica" (bastante más barato)'
const NEW_VOCAB = '"economica" (más de un 10% por debajo del presupuesto: es OTRA GAMA, no lo que este cliente vino a comprar)'
assert(cuenta(sm, OLD_VOCAB) === 1, 'no encontré la definición de la etiqueta `economica` como esperaba')
sm = sm.replace(OLD_VOCAB, NEW_VOCAB)

// (B2) El guion que produce la burbuja del Gol Trend. Se REEMPLAZA (trampa 6), con anti-ejemplo.
const OLD_GUION = '- Si hay una "economica" que aporta, mencionás una sola. Si no, la salteás.'
const NEW_GUION = '- Las "economica" NO se ofrecen. Están abajo de la gama que el cliente dijo que ' +
  'quiere: el que va a poner 20 millones no quiere que le muestres uno de 9, y bajarle la gama sin ' +
  'que lo pida se lee como que le estás ofreciendo lo que sobra. NUNCA escribas "además, te menciono ' +
  'una opción económica por debajo del presupuesto" ni "y si querés algo más económico, también ' +
  'tenemos". Ya le ofreciste ver el stock completo: si quiere algo más barato lo pide, y AHÍ SÍ se lo ' +
  'mostrás.'
assert(cuenta(sm, OLD_GUION) === 1, 'no encontré el guion de la `economica` en # Enfoque comercial')
sm = sm.replace(OLD_GUION, NEW_GUION)

// (B3) Con el piso puesto, "entra" puede quedar vacío (ej: presupuesto 15M, donde el Cronos 16,8M
// es `estirar` y el Etios 12,5M es `economica`). Sin esta línea Franco improvisa, y lo más a mano
// que tiene para improvisar es justamente bajar de gama.
const OLD_ESTIRAR = '- Si hay "estirar", ofrecés hasta 2 como paso arriba, con el gancho de pago (financiación en cuotas o entregar el usado). Si no hay, lo salteás.'
const NEW_ESTIRAR = OLD_ESTIRAR + '\n- Si no quedó NINGÚN "entra", no bajes de gama para llenar la ' +
  'lista: mostrás los "estirar" y decís con todas las letras que se van un poco ("estos se pasan un ' +
  'poco de los 20, pero con financiación o entregando tu usado entran"). Una lista corta de la gama ' +
  'que pidió es mejor que una larga con autos que no va a querer.'
assert(cuenta(sm, OLD_ESTIRAR) === 1, 'no encontré la línea de `estirar` en # Enfoque comercial')
sm = sm.replace(OLD_ESTIRAR, NEW_ESTIRAR)

franco.parameters.options.systemMessage = sm

// ---------------------------------------------------------------- post
assert(cuenta(sm, OLD_VOCAB) === 0 && cuenta(sm, OLD_GUION) === 0, 'quedó algún texto viejo')
assert(cuenta(sm, 'NO se ofrecen') === 1, 'no quedó el reemplazo del guion')
assert(cuenta(sm, 'opción económica por debajo del presupuesto') === 1, 'falta el anti-ejemplo textual (trampa 6)')
assert(cuenta(sm, 'Si no quedó NINGÚN "entra"') === 1, 'falta la salida para cuando `entra` queda vacío')
assert(sm.startsWith('='), 'el systemMessage dejó de arrancar con "=" (trampa 1)')
// Lo que el resto del prompt sigue necesitando de esta sección.
assert(cuenta(sm, '- Recomendás 2 a 5 de los "entra", empezando por los de mayor precio (vienen primeros).') === 1,
  'se perdió la regla de los "entra"')
assert(cuenta(sm, 'y si querés te paso todo el stock que tenemos, avisame') === 2,
  'se perdió el ofrecimiento del stock completo, que es la contrapartida de no mostrar las economicas')
assert(cuenta(sm, 'la herramienta devuelve TODO el stock etiquetado "entra"') === 1,
  'se perdió el gate de "sin presupuesto todo es entra" (v16)')
// Las 21 expresiones {{ }} del prompt siguen ahí (C0 / trampa 1).
const exprs = (s) => (s.match(/\{\{/g) || []).length
assert(exprs(sm) === exprs(base.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage),
  'cambió la cantidad de expresiones {{ }} del prompt')

// Ningún otro nodo tocado.
for (const n of wf.nodes) {
  const b = base.nodes.find((x) => x.name === n.name)
  assert(b, `nodo nuevo inesperado: ${n.name}`)
  if (n.name === 'Franco (AI Agent)' || n.name === 'Listar stock') continue
  assert(JSON.stringify(n) === JSON.stringify(b), `cambió el nodo ${n.name} y NO debía`)
}
const lb = base.nodes.find((n) => n.name === 'Listar stock')
for (const k of Object.keys(listar.parameters)) {
  if (k === 'query') continue
  assert(JSON.stringify(listar.parameters[k]) === JSON.stringify(lb.parameters[k]), `cambió Listar stock.${k}`)
}
const fb = base.nodes.find((n) => n.name === 'Franco (AI Agent)')
for (const k of Object.keys(franco.parameters)) {
  if (k === 'options') continue
  assert(JSON.stringify(franco.parameters[k]) === JSON.stringify(fb.parameters[k]), `cambió Franco.parameters.${k}`)
}
for (const k of Object.keys(franco.parameters.options)) {
  if (k === 'systemMessage') continue
  assert(JSON.stringify(franco.parameters.options[k]) === JSON.stringify(fb.parameters.options[k]), `cambió Franco.options.${k}`)
}
assert(JSON.stringify(wf.connections) === JSON.stringify(base.connections), 'cambiaron las connections')
assert(wf.nodes.length === base.nodes.length, 'cambió la cantidad de nodos')

// ---------------------------------------------------------------- prueba vinculante offline
// Se reimplementa el CASE nuevo en JS y se corre contra los 17 autos reales de stock.csv, con el
// presupuesto EXACTO de la captura (20M). Patrón ya usado en TB-3, a2, v74 y v75.
const STOCK = [
  ['Fiat Cronos 2023', 16800000], ['Volkswagen Gol Trend 2018', 9200000], ['Ford Fiesta 2017', 8200000],
  ['Toyota Etios 2019', 12500000], ['Toyota Corolla 2022', 24800000], ['Volkswagen Vento 2023', 31000000],
  ['Chevrolet Onix 2024', 21500000], ['Peugeot 208 2025', 21000000], ['Ford EcoSport 2020', 19800000],
  ['Volkswagen T-Cross 2025', 34000000], ['Renault Duster 2023', 22500000], ['Jeep Renegade 2021', 25500000],
  ['Toyota Hilux 2021', 38000000], ['Ford Ranger 2024', 57000000], ['Volkswagen Amarok 2018', 32000000],
  ['Chevrolet S10 2022', 39500000], ['Renault Kangoo 2021', 18500000],
]
const categoria = (precio, P, permuta = 0) => {
  if (P === 0) return 'entra'
  if (precio < P * 0.90) return 'economica'
  if (precio <= P) return 'entra'
  if (precio <= P * (permuta === 1 ? 1.40 : 1.25)) return 'estirar'
  return 'fuera'
}
const clasificar = (P) => {
  const r = {}
  for (const [t, p] of STOCK) (r[categoria(p, P)] ||= []).push(`${t} ($${(p / 1e6).toFixed(1)}M)`)
  return r
}

const c20 = clasificar(20000000)
assert(!(c20.entra || []).some((s) => /Cronos|Etios/.test(s)), 'con 20M el Cronos o el Etios siguen en `entra`')
assert((c20.entra || []).length === 2 && c20.entra.every((s) => /EcoSport|Kangoo/.test(s)),
  `con 20M \`entra\` debería ser EcoSport + Kangoo y es: ${JSON.stringify(c20.entra)}`)
assert(['Cronos', 'Etios', 'Gol Trend', 'Fiesta'].every((m) => (c20.economica || []).some((s) => s.includes(m))),
  'con 20M faltan autos en `economica`')
assert(['208', 'Onix', 'Duster', 'Corolla'].every((m) => (c20.estirar || []).some((s) => s.includes(m))),
  'con 20M faltan autos en `estirar`')

// Controles de la simulación: el camino viejo no se rompe donde no tiene que romperse.
assert(clasificar(0).entra.length === 17, 'sin presupuesto tienen que salir los 17 como `entra` (gate de v16)')
assert(categoria(12500000, 13000000) === 'entra', 'con 13M el Etios (96%) tiene que seguir siendo `entra` (eval km-con-presupuesto)')
assert(categoria(16800000, 15000000) === 'estirar', 'con 15M el Cronos tiene que seguir siendo `estirar` (eval presupuesto-aproximado)')
assert(categoria(9200000, 10000000) === 'entra', 'con 10M el Gol Trend (92%) tiene que ser `entra`, no `economica`')
assert(categoria(18000000, 20000000) === 'entra', 'el borde exacto del piso (90%) tiene que ser `entra`')
assert(categoria(17999999, 20000000) === 'economica', 'un peso abajo del piso tiene que ser `economica`')

console.log('✓ todas las aserciones pasan')
console.log(`  Listar stock: piso de \`economica\` 0.60 -> 0.90 (una rama del CASE, ningún WHERE tocado)`)
console.log(`  systemMessage de Franco: ${fb.parameters.options.systemMessage.length} -> ${sm.length} chars (+${sm.length - fb.parameters.options.systemMessage.length})`)
console.log('  Techo (1.25 / 1.40) y ladder de `tramo`: SIN CAMBIOS')
console.log('\n  Prueba vinculante — presupuesto 20.000.000 (el de la captura):')
for (const k of ['entra', 'estirar', 'economica', 'fuera']) {
  console.log(`    ${k.padEnd(10)} ${(c20[k] || []).join(', ') || '(ninguno)'}`)
}

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
