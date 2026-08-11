#!/usr/bin/env node
// FILTRO DE TRACCIÓN 4x2 / 4x4 — el criterio no era filtrable. v81 -> v82. 2026-08-05.
//
// EL BUG (captura de Agustina): el cliente dice *"Estoy buscando una 4x2"* y Franco le vuelve a
// ofrecer LA MISMA Volkswagen Amarok 2018, que es **4x4**, justificándolo con *"si no te molesta
// que una sea 4x4 y la otra 4x2"*. Le está empujando inventario que no coincide con la búsqueda.
//
// ROOT CAUSE — EL CRITERIO ES INFILTRABLE: **ninguna de las 3 tools tiene parámetro de tracción.**
// No es que Franco elija mal: no tiene con qué filtrar, así que lo hace de cabeza sobre las filas
// que le vuelven. Es el mismo modo de falla que el filtro por año antes de v30 y el de carrocería
// antes de v80.
//
// EL DATO SÍ EXISTE, Y ESTÁ EN `content` (no en `metadata`): `armar_content()` del .py concatena
// `Versión/Edición`, así que la fila del id 15 arranca con *"Volkswagen Amarok 4x4 2018, color
// negro, 135000 km."*. `armar_metadata()` NO lo guarda. Por eso el filtro va contra `content`.
//
// EL MECANISMO YA EXISTE EN ESTE MISMO NODO: `Buscar auto` filtra TRANSMISIÓN con exactamente este
// patrón (`content ILIKE '%transmisión autom%'`). Este cambio es su gemelo para la tracción, con
// la misma forma, para no inventar un patrón nuevo.
//
// ES LA OTRA MITAD DE UN BUG DE v61. Aquella captura era literalmente *"Amarok 4x2 2022-24"*.
// Entonces se arreglaron las **alternativas por carrocería** (y funcionó, se midió), pero el
// **filtro de tracción nunca se implementó** y quedó abierto sin figurar como abierto. Anotarlo:
// arreglar la mitad visible de un bug deja la otra mitad esperando una captura nueva.
//
// LO QUE NO SE TOCA, A PROPÓSITO (un cambio por vez): `Listar stock` NO recibe el parámetro en
// esta versión. La captura pasa por el camino de "busco por característica", que es `Buscar auto`;
// y `Listar stock` hoy no referencia `content` en ningún lado, así que sumarlo ahí es un cambio de
// otra forma. Si al medir se ve que Franco resuelve el pedido de tracción por `Listar stock`, ese
// es el paso siguiente — y el log lo dice sin ambigüedad (se mira qué tool llamó).
//
// TRAMPAS:
//   · Trampa 3: la key `traccion` es NUEVA y aparece 2 veces; las dos con descripción y tipo
//     BYTE-IDÉNTICOS, verificado por aserción. Es la trampa que rompe el workflow entero
//     ("Duplicate key found with different description or type").
//   · Trampa 2: no se agregan parámetros al nodo; `queryReplacement` ni se toca.
//   · Trampa 4: `Buscar auto` es una tool, no está en la cadena principal.
//   · Trampa 5: cero LLM nuevo, es SQL.
//   · El filtro sólo RESTRINGE cuando el cliente pidió una tracción; con el parámetro vacío el
//     `ELSE TRUE` deja todo pasar igual que hoy (verificado por aserción y por simulación).
//
// Base: franco-n8n-v81.json (el vivo).
//
//   node scripts/traccion-4x2-4x4.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v81.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v82.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const base = JSON.parse(readFileSync(SRC, 'utf8'))

const buscar = wf.nodes.find((n) => n.name === 'Buscar auto')
assert(buscar, 'no encontré el nodo Buscar auto')
let q = buscar.parameters.query
assert(!q.includes("'traccion'"), 'el fix ya está aplicado (¿script ya corrido?)')

// El bloque de transmisión, tal cual está. Se usa de ancla y de molde.
const TRANS = "{{ $fromAI('transmision', 'La transmisión que busca el cliente: automatica (incluye CVT) o manual. Vacío si no mencionó ninguna.', 'string').replace(/[^A-Za-z]/g, '').toLowerCase() }}"
assert(cuenta(q, TRANS) === 2, `esperaba 2 ocurrencias de $fromAI('transmision') y hay ${cuenta(q, TRANS)}`)

const BLOQUE_TRANS = "AND (CASE\n" +
  `    WHEN '${TRANS}' ILIKE 'autom%' THEN (content ILIKE '%transmisión autom%' OR content ILIKE '%transmisión cvt%')\n` +
  `    WHEN '${TRANS}' ILIKE 'manual%' THEN content ILIKE '%transmisión manual%'\n` +
  '    ELSE TRUE\n' +
  '  END)'
assert(cuenta(q, BLOQUE_TRANS) === 1, 'no encontré el bloque de transmisión como esperaba')

// TRAMPA 3: la descripción y el tipo tienen que ser byte-idénticos en TODAS las ocurrencias.
// Se define UNA sola vez y se interpola, que es la única forma de garantizarlo.
const TRAC = "{{ $fromAI('traccion', 'La traccion que busca el cliente: 4x2 o 4x4. Vacio si no menciono ninguna.', 'string').replace(/[^A-Za-z0-9]/g, '').toLowerCase() }}"

const BLOQUE_TRAC = "AND (CASE\n" +
  `    WHEN '${TRAC}' = '4x2' THEN content ILIKE '%4x2%'\n` +
  `    WHEN '${TRAC}' = '4x4' THEN content ILIKE '%4x4%'\n` +
  '    ELSE TRUE\n' +
  '  END)'

q = q.replace(BLOQUE_TRANS, BLOQUE_TRANS + '\n  ' + BLOQUE_TRAC)
buscar.parameters.query = q

// ---------------------------------------------------------------- prompt: dónde va el parámetro
// NO alcanza con crear el parámetro. El log 11127 muestra QUÉ hace Franco hoy: mete la tracción
// DENTRO de `marca_o_modelo` ("Amarok 4x2"), que se compara contra `marca || modelo || carroceria
// || color` — donde "4x2" no aparece nunca. Resultado: cero filas, reintento sin la tracción, y le
// vuelven las 4 pickups (3 de ellas 4x4), que es lo que termina listando.
// Por eso el mismo cambio toca el prompt: es UN mecanismo (hacer alcanzable el filtro) en dos
// lugares, no dos reglas que compiten. Mismo criterio que v30 con `anio_min`.
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no encontré el nodo Franco (AI Agent)')
let sm = franco.parameters.options.systemMessage
assert(sm.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')

const OLD_P = 'Para cuando el cliente busca por características, no por precio: una marca, un modelo, un tipo ("una SUV", "una pickup"), un color, o una transmisión (automática o manual).'
assert(cuenta(sm, OLD_P) === 1, 'no encontré la enumeración de criterios de ## Buscar auto')

const NEW_P = 'Para cuando el cliente busca por características, no por precio: una marca, un modelo, ' +
  'un tipo ("una SUV", "una pickup"), un color, una transmisión (automática o manual), o una ' +
  'TRACCIÓN (4x2 o 4x4). La tracción va SIEMPRE en el parámetro `traccion`, NUNCA metida adentro ' +
  'de `marca_o_modelo`: "Amarok 4x2" como marca_o_modelo no matchea nada y te vuelve VACÍO, ' +
  'porque la tracción no es parte del nombre del modelo. Se separa: marca_o_modelo="Amarok" y ' +
  'traccion="4x2". Y si el cliente pide una tracción, los autos de la OTRA tracción no son ' +
  'alternativas válidas: no se los ofrezcas "por si no le molesta", que es empujarle lo que no pidió.'
sm = sm.replace(OLD_P, NEW_P)
franco.parameters.options.systemMessage = sm

assert(cuenta(sm, OLD_P) === 0, 'quedó la enumeración vieja')
assert(cuenta(sm, 'NUNCA metida adentro') === 1, 'no quedó el reemplazo del prompt')
assert(cuenta(sm, 'traccion="4x2"') === 1, 'falta el ejemplo concreto de cómo separar (trampa 6)')
assert(sm.startsWith('='), 'el systemMessage dejó de arrancar con "=" (trampa 1)')
const exprsBase = (base.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage.match(/\{\{/g) || []).length
assert((sm.match(/\{\{/g) || []).length === exprsBase, 'cambió la cantidad de expresiones {{ }}')

// ---------------------------------------------------------------- post
assert(cuenta(q, BLOQUE_TRAC) === 1, 'no quedó el bloque de tracción')
assert(cuenta(q, BLOQUE_TRANS) === 1, 'se perdió o se duplicó el bloque de transmisión')
assert(cuenta(q, TRAC) === 2, `esperaba 2 ocurrencias de $fromAI('traccion') y hay ${cuenta(q, TRAC)}`)
// Trampa 3, la verificación que importa: las 2 ocurrencias son byte-idénticas. Se comprueba
// extrayendo cada $fromAI('traccion',...) del texto final y comparándolos entre sí.
const ocurrencias = [...q.matchAll(/\{\{ \$fromAI\('traccion'[^}]*\}\}/g)].map((m) => m[0])
assert(ocurrencias.length === 2, `esperaba 2 $fromAI('traccion') y encontré ${ocurrencias.length}`)
assert(new Set(ocurrencias).size === 1, 'las ocurrencias de $fromAI(traccion) NO son byte-idénticas (trampa 3: rompe el workflow)')
// Trampa 3 sobre TODO el workflow: ninguna key puede tener dos firmas distintas.
const firmas = new Map()
for (const n of wf.nodes) {
  const txt = JSON.stringify(n.parameters || {})
  for (const m of txt.matchAll(/\$fromAI\(\\?'([a-z_0-9]+)\\?',\s*\\?'((?:[^'\\]|\\.)*)\\?',\s*\\?'([a-z]+)\\?'/g)) {
    const [, key, desc, tipo] = m
    const firma = `${desc}||${tipo}`
    if (firmas.has(key)) assert(firmas.get(key) === firma, `TRAMPA 3: la key "${key}" tiene dos firmas distintas`)
    else firmas.set(key, firma)
  }
}
// El resto de Buscar auto, intacto.
assert(cuenta(q, 'translate(') === 8, 'se perdió el plegado de tildes de v80')
assert(q.includes('(SELECT count(*) FROM carr_pedida) = 1'), 'se perdió el gate de una-sola-carrocería de v70')
for (const marcador of ['carr_pedida', 'match_tipo', "'exacto'", "'alternativa'", 'km_max', 'precio_min', 'precio_max', 'color']) {
  assert(q.includes(marcador), `se perdió ${marcador} de Buscar auto`)
}
assert(cuenta(q, '(') === cuenta(q, ')'), 'paréntesis desbalanceados')
assert(cuenta(q, "'") % 2 === 0, 'comillas simples desbalanceadas')
assert(q.trim().endsWith(';'), 'la query dejó de terminar en ;')

// Ningún otro nodo tocado.
for (const n of wf.nodes) {
  const b = base.nodes.find((x) => x.name === n.name)
  assert(b, `nodo nuevo inesperado: ${n.name}`)
  if (n.name === 'Buscar auto' || n.name === 'Franco (AI Agent)') continue
  assert(JSON.stringify(n) === JSON.stringify(b), `cambió el nodo ${n.name} y NO debía`)
}
const bb = base.nodes.find((n) => n.name === 'Buscar auto')
for (const k of Object.keys(buscar.parameters)) {
  if (k === 'query') continue
  assert(JSON.stringify(buscar.parameters[k]) === JSON.stringify(bb.parameters[k]), `cambió Buscar auto.${k}`)
}
assert(JSON.stringify(wf.connections) === JSON.stringify(base.connections), 'cambiaron las connections')
assert(wf.nodes.length === base.nodes.length, 'cambió la cantidad de nodos')
// Los fixes anteriores siguen puestos.
assert(wf.nodes.find((n) => n.name === 'Listar stock').parameters.query.includes("* 0.90) THEN 'economica'"), 'se perdió el piso de v79')
assert(sm.includes('SE LO DAS EN EL ACTO'), 'se perdió el fix de v81')

// ---------------------------------------------------------------- prueba vinculante offline
// Se reimplementa el predicado (`content ILIKE '%4x2%'`) y se corre contra los `content` REALES de
// las 4 pickups del stock, armados igual que `armar_content()` del .py.
const PICKUPS = [
  [13, 'Toyota Hilux 4x4 2021, color blanco, 95000 km. Pickup, 4 puertas, 5 asientos.'],
  [14, 'Ford Ranger 4x4 2024, color gris, 18000 km. Pickup, 4 puertas, 5 asientos.'],
  [15, 'Volkswagen Amarok 4x4 2018, color negro, 135000 km. Pickup, 4 puertas, 5 asientos.'],
  [16, 'Chevrolet S10 4x2 2022, color blanco, 68000 km. Pickup, 4 puertas, 5 asientos.'],
]
const NO_PICKUPS = [
  [1, 'Fiat Cronos 2023, color gris, 28000 km. Sedán, 4 puertas, 5 asientos.'],
  [9, 'Ford EcoSport 2020, color negro, 55000 km. SUV, 5 puertas, 5 asientos.'],
]
const pasa = (content, traccion) => {
  if (traccion === '4x2') return content.toLowerCase().includes('4x2')
  if (traccion === '4x4') return content.toLowerCase().includes('4x4')
  return true // ELSE TRUE
}
const filtra = (t) => [...PICKUPS, ...NO_PICKUPS].filter(([, c]) => pasa(c, t)).map(([id]) => id)

const con4x2 = filtra('4x2')
assert(con4x2.length === 1 && con4x2[0] === 16, `con 4x2 tiene que quedar SOLO la S10 (id 16) y quedó: ${con4x2}`)
assert(!con4x2.includes(15), 'la Amarok (4x4) sigue pasando el filtro de 4x2 — es el bug de la captura')
const con4x4 = filtra('4x4')
assert(con4x4.length === 3 && [13, 14, 15].every((id) => con4x4.includes(id)), `con 4x4 tienen que quedar Hilux, Ranger y Amarok y quedó: ${con4x4}`)
// Control: sin tracción pedida NO se filtra nada (el ELSE TRUE). Es lo que evita romper todo el
// resto de las búsquedas, que es el riesgo real de este cambio.
assert(filtra('').length === 6, 'con el parámetro vacío el filtro NO debe restringir nada')
// Control: los que no son pickup nunca se cuelan por tracción.
assert(!con4x2.includes(1) && !con4x2.includes(9), 'un sedán o SUV pasó el filtro de tracción')

console.log('✓ todas las aserciones pasan')
console.log(`  Buscar auto: bloque de tracción agregado al lado del de transmisión (mismo patrón)`)
console.log(`  query: ${bb.parameters.query.length} -> ${q.length} chars`)
console.log(`  trampa 3: las 2 ocurrencias de $fromAI('traccion') son byte-idénticas, y ninguna key del workflow tiene firmas distintas`)
console.log('\n  Prueba vinculante — filtro sobre los `content` reales:')
console.log(`    traccion="4x2"  -> ids ${con4x2.join(', ')}  (solo la S10; la Amarok queda AFUERA)`)
console.log(`    traccion="4x4"  -> ids ${con4x4.join(', ')}`)
console.log(`    traccion=""     -> ids ${filtra('').join(', ')}  (no filtra nada)`)

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
