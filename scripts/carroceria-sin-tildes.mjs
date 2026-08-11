#!/usr/bin/env node
// "SEDÁN" NO MATCHEA "sedan" — el ILIKE de `Buscar auto` no ignora tildes. v79 -> v80. 2026-08-04.
//
// EL BUG (captura de Agustina): a "pasame todas las opciones de sedan con menos de 30.000 km"
// Franco mezcló carrocerías (metió el Peugeot 208, hatchback) y en el turno siguiente listó el
// Toyota Etios (hatchback) DENTRO de "todo el stock de sedanes". Además las alternativas de otra
// carrocería ignoraron el presupuesto y el km que el cliente ya había dado.
//
// PRUEBA EN EL LOG — ejecución 10763, turno "Pasame todas las opciones de sedan con menos de
// 30.000 km" (trampa del método: leer el log antes de teorizar). Los DOS runIndex del turno:
//   · `Buscar auto` con `marca_o_modelo: "sedan"`  ->  `response: [{"success": true}]`, o sea
//     CERO FILAS. La tool que SÍ sabe filtrar por carrocería devolvió nada.
//   · Franco cayó entonces a `Listar stock` con `km_max: 30000` y TODO lo demás en 0, que le
//     devolvió 6 autos de todas las carrocerías (Ranger Pickup, T-Cross SUV, Vento Sedán, Onix
//     Sedán, 208 Hatchback, Cronos Sedán) — y el filtro "sedán" lo hizo el MODELO, de cabeza.
//     Esa corrida acertó; la de la captura, no.
//   · Y de paso: `precio_objetivo: 0` y `precio_max: 0`. Ahí se pierde el presupuesto, que es
//     por qué las alternativas no respetan el contexto acumulado.
//
// ROOT CAUSE: en Postgres `ILIKE` NO ignora tildes. `'Sedán' ILIKE '%sedan%'` es FALSO. Como el
// modelo escribe "sedan" sin tilde (lo hizo 2 de 2 veces en ese log), el CTE `carr_pedida` sale
// vacío, el `ILIKE` directo tampoco matchea, y la query devuelve 0 filas.
//
// POR QUÉ ESTE BUG ES SÓLO DE LOS SEDANES, Y POR QUÉ NADIE LO VIO ANTES: `Sedán` es la ÚNICA
// carrocería del stock con tilde (las otras son Hatchback, SUV, Pickup, Utilitario). Por eso los
// flujos de pickup y SUV se midieron bien en v61 y v70 y el de sedanes nunca funcionó.
//
// POR QUÉ EL EVAL DE CONDUCTA NO ALCANZA — LO DIGO EXPLÍCITO: se corrieron 8 conversaciones
// completas del flujo de sedanes (3 del eval, 1 sonda con precio, 3 réplica exacta de la captura
// con el typo "sedanws" incluido, 1 réplica larga que llena la ventana de memoria) y el síntoma
// visible NO se reprodujo ni una vez: cuando `Listar stock` le devuelve 6 filas, el modelo suele
// acertar el filtro manual. El síntoma es intermitente porque depende de esa suerte. **La CAUSA,
// en cambio, es determinística y está en el log: 2 de 2 llamadas a `Buscar auto` con "sedan"
// devolvieron 0 filas.** Se arregla la causa, y el instrumento es la PRUEBA VINCULANTE de abajo
// (el patrón que este proyecto ya usó en TB-3, a2, v74 y v75 cuando el eval no falla solo).
//
// EL FIX: plegar tildes de los DOS lados de la comparación, en SQL, con `translate()`. No se usa
// `unaccent()` a propósito: es una extensión de Postgres que puede no estar instalada en esta
// base, y si no está la query rompe — y `Buscar auto` sin filas deja al cliente sin respuesta.
// `translate()` es core de Postgres, no necesita nada.
//
// TRAMPAS:
//   · Trampa 3: los `$fromAI(...)` quedan BYTE-IDÉNTICOS. El plegado va en SQL, alrededor de la
//     expresión, nunca dentro. Verificado por aserción contando las ocurrencias exactas.
//   · Trampa 2: no se agregan parámetros; `queryReplacement` ni se toca.
//   · Trampa 4: `Buscar auto` es una tool (no está en la cadena principal), pero igual el cambio
//     sólo puede AGREGAR filas, nunca sacar: plegar tildes relaja el match, no lo restringe.
//   · Trampa 5: cero LLM nuevo, es SQL.
//
// LO QUE NO SE TOCA (un cambio por vez): `Listar stock` NO recibe parámetro de carrocería en esta
// versión. Con `Buscar auto` devolviendo las filas correctas, Franco ya no necesita filtrar de
// cabeza. Si después de medir sigue mezclando, el paso siguiente es ese parámetro.
//
// Base: franco-n8n-v79.json (piso de gama).
//
//   node scripts/carroceria-sin-tildes.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v79.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v80.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const base = JSON.parse(readFileSync(SRC, 'utf8'))

const buscar = wf.nodes.find((n) => n.name === 'Buscar auto')
assert(buscar, 'no encontré el nodo Buscar auto')
let q = buscar.parameters.query
assert(!q.includes('translate('), 'el fix ya está aplicado (¿script ya corrido?)')

// La expresión $fromAI de marca_o_modelo, tal cual está hoy. NO se toca (trampa 3).
const MM = "{{ $fromAI('marca_o_modelo', 'La marca y/o el modelo del auto que busca el cliente, ya corregido de typos (ej: Toyota Corolla, Volkswagen Amarok). Tambien vale una carroceria (pickup, SUV, sedan). Poner vacio si el cliente no nombro ninguno.', 'string').replace(/[^A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ \\-]/g, '').trim() }}"
const nMM = cuenta(q, MM)
assert(nMM === 8, `esperaba 8 ocurrencias de $fromAI('marca_o_modelo') y hay ${nMM} (trampa 3)`)

// Plegado de tildes. `translate()` es core de Postgres: no necesita la extensión unaccent.
const DE = 'áéíóúüñÁÉÍÓÚÜÑ'
const A = 'aeiouunAEIOUUN'
const pliega = (expr) => `translate(${expr}, '${DE}', '${A}')`

// Las dos formas de concat que se comparan contra marca_o_modelo en esta query.
const CONCAT_A = "(metadata->>'marca' || ' ' || (metadata->>'modelo') || ' ' || COALESCE(metadata->>'carroceria',''))"
const CONCAT_B = "(metadata->>'marca' || ' ' || (metadata->>'modelo') || ' ' || COALESCE(metadata->>'carroceria','') || ' ' || COALESCE(metadata->>'color',''))"

const OLD_A = `${CONCAT_A} ILIKE '%' || '${MM}' || '%'`
const OLD_B = `${CONCAT_B} ILIKE '%' || '${MM}' || '%'`
const nA = cuenta(q, OLD_A)
const nB = cuenta(q, OLD_B)
assert(nA === 1, `esperaba 1 comparación con el concat sin color (carr_pedida) y hay ${nA}`)
assert(nB === 3, `esperaba 3 comparaciones con el concat con color (match_tipo, WHERE, ORDER BY) y hay ${nB}`)

const NEW_A = `${pliega(CONCAT_A)} ILIKE '%' || ${pliega(`'${MM}'`)} || '%'`
const NEW_B = `${pliega(CONCAT_B)} ILIKE '%' || ${pliega(`'${MM}'`)} || '%'`
q = q.split(OLD_A).join(NEW_A).split(OLD_B).join(NEW_B)
buscar.parameters.query = q

// ---------------------------------------------------------------- post
assert(cuenta(q, OLD_A) === 0 && cuenta(q, OLD_B) === 0, 'quedó alguna comparación sin plegar')
assert(cuenta(q, NEW_A) === 1 && cuenta(q, NEW_B) === 3, 'no quedaron los 4 reemplazos')
assert(cuenta(q, MM) === nMM, 'cambió la cantidad de $fromAI(marca_o_modelo) (trampa 3)')
assert(cuenta(q, 'translate(') === 8, `esperaba 8 translate() (4 comparaciones x 2 lados) y hay ${cuenta(q, 'translate(')}`)
assert(!q.includes('unaccent'), 'se coló unaccent(), que es una extensión y puede no estar instalada')
// Paréntesis y comillas balanceados, y la query sigue terminando en ';'.
assert(cuenta(q, '(') === cuenta(q, ')'), 'paréntesis desbalanceados en la query')
assert(cuenta(q, "'") % 2 === 0, 'comillas simples desbalanceadas en la query')
assert(q.trim().endsWith(';'), 'la query dejó de terminar en ;')
// El resto de los filtros de Buscar auto, intactos.
for (const marcador of ['carr_pedida', 'match_tipo', "'exacto'", "'alternativa'", 'transmision', 'km_max', 'precio_min', 'precio_max']) {
  assert(q.includes(marcador), `se perdió ${marcador} de Buscar auto`)
}
// El fix de v70 (alternativas de UNA sola carrocería) tiene que seguir vivo.
assert(q.includes('(SELECT count(*) FROM carr_pedida) = 1'), 'se perdió el gate de una-sola-carrocería de v70')

// Ningún otro nodo tocado.
for (const n of wf.nodes) {
  const b = base.nodes.find((x) => x.name === n.name)
  assert(b, `nodo nuevo inesperado: ${n.name}`)
  if (n.name === 'Buscar auto') continue
  assert(JSON.stringify(n) === JSON.stringify(b), `cambió el nodo ${n.name} y NO debía`)
}
const bb = base.nodes.find((n) => n.name === 'Buscar auto')
for (const k of Object.keys(buscar.parameters)) {
  if (k === 'query') continue
  assert(JSON.stringify(buscar.parameters[k]) === JSON.stringify(bb.parameters[k]), `cambió Buscar auto.${k}`)
}
assert(JSON.stringify(wf.connections) === JSON.stringify(base.connections), 'cambiaron las connections')
assert(wf.nodes.length === base.nodes.length, 'cambió la cantidad de nodos')
// El fix de v79 (piso de gama) sigue puesto.
assert(wf.nodes.find((n) => n.name === 'Listar stock').parameters.query.includes("* 0.90) THEN 'economica'"),
  'se perdió el piso de gama de v79: base equivocada')

// ---------------------------------------------------------------- prueba vinculante offline
// Se reimplementa en JS el predicado de match de la query (plegado + ILIKE de substring) y se
// corre contra las carrocerías REALES del stock, con el término EXACTO que mandó el modelo en el
// log 10763 ("sedan"). Es el mismo patrón de TB-3 / a2 / v74.
const CARROCERIAS = ['Sedán', 'Hatchback', 'SUV', 'Pickup', 'Utilitario']
const fold = (s) => { let r = ''; for (const ch of s) { const i = DE.indexOf(ch); r += i === -1 ? ch : A[i] } return r }
const matchViejo = (carr, termino) => carr.toLowerCase().includes(termino.toLowerCase())
const matchNuevo = (carr, termino) => fold(carr).toLowerCase().includes(fold(termino).toLowerCase())

// El bug, reproducido: "sedan" (lo que mandó el modelo) NO matcheaba "Sedán".
assert(matchViejo('Sedán', 'sedan') === false, 'la simulación no reproduce el bug viejo')
assert(matchNuevo('Sedán', 'sedan') === true, 'el fix no hace matchear "sedan" con "Sedán"')
// Y con tilde tiene que seguir andando (era el único camino que funcionaba).
assert(matchNuevo('Sedán', 'sedán') === true, 'se rompió el camino que SÍ funcionaba (con tilde)')
// Control: no se afloja de más — "sedan" no puede matchear otra carrocería.
for (const c of CARROCERIAS.filter((c) => c !== 'Sedán')) {
  assert(matchNuevo(c, 'sedan') === false, `"sedan" matchea ${c} y no debería`)
}
// Control: las carrocerías sin tilde seguían y siguen andando igual (v61/v70 no regresan).
for (const [c, t] of [['Pickup', 'pickup'], ['SUV', 'suv'], ['Hatchback', 'hatchback'], ['Utilitario', 'utilitario']]) {
  assert(matchViejo(c, t) === matchNuevo(c, t) && matchNuevo(c, t) === true, `regresión en ${c}`)
}
// Control: las marcas y modelos con tilde no existen en el stock, pero el plegado no puede
// romper los que sí hay.
for (const [m, t] of [['Volkswagen Amarok', 'amarok'], ['Toyota Corolla', 'corolla'], ['Peugeot 208', '208']]) {
  assert(matchNuevo(m, t) === true, `regresión buscando ${t}`)
}

console.log('✓ todas las aserciones pasan')
console.log(`  Buscar auto: 4 comparaciones plegadas con translate() (8 llamadas), $fromAI intactos`)
console.log(`  query: ${bb.parameters.query.length} -> ${q.length} chars`)
console.log('\n  Prueba vinculante — término "sedan" (el exacto del log 10763):')
for (const c of CARROCERIAS) {
  console.log(`    ${c.padEnd(12)} antes: ${matchViejo(c, 'sedan') ? 'MATCH' : 'no'}   ahora: ${matchNuevo(c, 'sedan') ? 'MATCH' : 'no'}`)
}

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
