#!/usr/bin/env node
// BUG A — "primer auto" y la pregunta del usado (captura real Agustina, sesion Pedro Atenor
// 2b363055-1dc3-41eb-839e-0414f1d78e45, 2026-07-31). El cliente dice "Estoy buscando comprar mi
// primer auto" y unos turnos despues Franco cierra el detalle del Etios con:
//     "Te interesa saber cómo sería financiarlo o entregando tu usado?"
// Es incoherente: si es su PRIMER auto no tiene usado para entregar.
//
// Baseline MEDIDO contra v71 (eval `primer-auto-no-pregunta-usado`, --repeat 3 --delay 3000):
// falla 3/3 — deterministico. Las 3 corridas recitan el guion (2 con "entregando un usado",
// 1 con "entregando tu usado").
//
// Root cause (trampa 6, el ejemplo concreto le gana a la regla abstracta): el cierre comercial
// obligatorio de "## Paso 3" trae como PRIMER ejemplo, literal, el guion que produce el bug:
//     Ejemplos: "te interesa saber cómo sería financiarlo o entregando tu usado?" / ...
// Franco lo recita sin filtrar por el contexto de primer auto. No alcanza con prohibirlo arriba:
// hay que REEMPLAZAR el guion que lo ensena y dar el ejemplo concreto del caso.
//
// Fix: UN solo cambio, solo lenguaje (es NLU de texto libre, no determinístico -> va al prompt,
// no a SQL/codigo). Se reemplaza SOLO la lista de ejemplos del cierre comercial de "## Paso 3"
// (ocurrencia unica; las otras 3 menciones de "entregando tu usado" viven en "## Permuta", donde
// SI corresponden, y NO se tocan).
//
// NO toca "## Permuta", ni "# Consignacion", ni el FAQ, ni CRM, ni ningun nodo Postgres.
// Base: franco-n8n-v71.json (produccion vigente). (2026-07-31)
//
//   node scripts/primer-auto-no-ofrece-usado.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v71.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v72.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))

const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no encontré el nodo Franco (AI Agent)')
let sm = franco.parameters.options.systemMessage
assert(sm[0] === '=', 'el systemMessage no arranca con "=" (trampa 1)')

const OLD = 'Ejemplos: "te interesa saber cómo sería financiarlo o entregando tu usado?" / "querés que un asesor te prepare una cotización?" / "lo querés ver en persona o te muestro algo parecido?".'

assert(cuenta(sm, OLD) === 1, `esperaba la lista de ejemplos del cierre comercial UNA vez, hay ${cuenta(sm, OLD)} (¿base cambió o script ya corrido?)`)
// Las otras menciones viven en ## Permuta y NO se tocan.
assert(cuenta(sm, 'entregando tu usado') === 4, `esperaba 4 menciones de "entregando tu usado" en v71, hay ${cuenta(sm, 'entregando tu usado')}`)

const NEW = [
  'Ejemplos: "querés que un asesor te prepare una cotización?" / "lo querés ver en persona o te muestro algo parecido?" / "te interesa saber cómo sería financiarlo?".',
  'OJO CON EL USADO: sumarle "o entregando tu usado" a esa pregunta va SOLO si el cliente TIENE un auto para entregar —lo dijo él, o figura en "Lo que ya sabés de este cliente"—. Si te dijo que es su PRIMER auto ("mi primer auto", "es el primero", "nunca tuve auto", "me estoy por comprar el primero"), NO le ofrezcas entregar ni permutar nada en ningún turno de esa charla: no tiene usado, y ofrecérselo le demuestra que no lo escuchaste.',
  'Concreto: al que dijo que busca su PRIMER auto NO le cierres con "te interesa saber cómo sería financiarlo o entregando tu usado?" (ni con la variante "entregando un usado"); cerrale con "te interesa saber cómo sería financiarlo en cuotas?" o "lo querés ver en persona?".',
].join(' ')

sm = sm.replace(OLD, NEW)
franco.parameters.options.systemMessage = sm

// ---------------------------------------------------------------- post
assert(cuenta(sm, OLD) === 0, 'el guion viejo debería haber desaparecido')
assert(cuenta(sm, 'OJO CON EL USADO') === 1, 'no quedó la regla nueva')
assert(cuenta(sm, 'PRIMER auto') === 2, 'esperaba la regla + el ejemplo concreto del primer auto')
// El guion del bug solo puede seguir vivo como ANTI-ejemplo (dentro del "NO le cierres con").
const idxAnti = sm.indexOf('NO le cierres con "te interesa saber cómo sería financiarlo o entregando tu usado?"')
assert(idxAnti > -1, 'el anti-ejemplo concreto no quedó escrito')
// Menciones esperadas tras el fix = 5: las 3 de ## Permuta (intactas, ahí SÍ corresponde) +
// 2 nuevas en ## Paso 3, ambas en contexto NEGATIVO/condicional (la regla "va SOLO si tiene
// un auto para entregar" y el anti-ejemplo "NO le cierres con..."). Lo que desaparece es la
// única que estaba como GUION A IMITAR en la lista de ejemplos (trampa 6).
assert(cuenta(sm, 'entregando tu usado') === 5, `tras el fix esperaba 5 menciones (3 de Permuta + regla + anti-ejemplo), hay ${cuenta(sm, 'entregando tu usado')}`)
// y ninguna de las 5 puede volver a estar en la lista de "Ejemplos:" del cierre comercial
assert(!/Ejemplos: "te interesa saber cómo sería financiarlo o entregando tu usado\?"/.test(sm), 'el guion volvió a quedar como ejemplo a imitar')
assert(cuenta(sm, '## Permuta (cliente con efectivo + un usado para entregar)') === 1, 'Permuta debe seguir presente e intacta')
assert(cuenta(sm, '# Consignación (vender tu auto)') === 1, 'Consignación debe seguir intacta')
assert(sm[0] === '=', 'el systemMessage dejó de arrancar con "=" (trampa 1)')

console.log('✓ todas las aserciones pasan')
console.log(`  systemMessage total: ${sm.length} chars`)
console.log(`  delta: +${NEW.length - OLD.length} chars (solo la lista de ejemplos del cierre comercial de ## Paso 3)`)

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
