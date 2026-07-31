#!/usr/bin/env node
// Cards de otra marca en consulta por MARCA (captura Agustina, baseline buscar-marca-solo-esa-marca
// ~2/6 falla): "algo de Volkswagen?" a veces trae cards Ford/Chevrolet/Toyota/Jeep. Root: Buscar auto
// devuelve el match exacto + alternativas de la MISMA carrocería. Esa lógica sirve para un modelo/tipo
// puntual ("una Amarok" -> otras pickups), pero una MARCA abarca varias carrocerías (VW = SUV, pickup,
// sedán, hatchback), así que las alternativas se vuelven casi todo el stock de otras marcas.
//
// Fix (determinístico, SQL): las alternativas por carrocería salen SOLO cuando la consulta apunta a UNA
// carrocería (carr_pedida tiene exactamente 1 fila = un modelo o un tipo). Una marca que abarca varias
// carrocerías devuelve SOLO esa marca. Con esto Franco no puede mostrar ni mal-etiquetar autos ajenos.
//
// NO rompe "modelo/tipo -> alternativas" (Amarok o "una pickup" = 1 carrocería -> siguen saliendo).
// Solo toca el query de Buscar auto. Base: franco-n8n-v69.json. (2026-07-29)
//
//   node scripts/buscar-auto-alternativas-una-carroceria.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v69.json')
const OUT = join(ROOT, 'franco-n8n-v70.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const buscar = wf.nodes.find((n) => n.name === 'Buscar auto')
assert(buscar, 'no encontré el nodo Buscar auto')
let q = buscar.parameters.query

const OLD = "    OR metadata->>'carroceria' IN (SELECT carroceria FROM carr_pedida)"
const NEW = "    OR (metadata->>'carroceria' IN (SELECT carroceria FROM carr_pedida) AND (SELECT count(*) FROM carr_pedida) = 1)"
assert(cuenta(q, OLD) === 1, `ancla de alternativas aparece ${cuenta(q, OLD)} veces, esperaba 1`)
assert(cuenta(q, '(SELECT count(*) FROM carr_pedida) = 1') === 0, 'el fix ya está aplicado')
q = q.replace(OLD, NEW)
buscar.parameters.query = q

// post
assert(cuenta(q, '(SELECT count(*) FROM carr_pedida) = 1') === 1, 'el gate no quedó una vez')
assert(cuenta(q, 'carr_pedida') === 3, `esperaba 3 refs a carr_pedida (CTE def + 2 usos), hay ${cuenta(q, 'carr_pedida')}`)
assert(cuenta(q, "$fromAI('transmision'") === 2, 'se perdió el filtro de transmisión (v69)')

console.log('✓ todas las aserciones pasan')
console.log(`  Buscar auto: alternativas por carrocería solo con 1 carrocería (marca -> solo esa marca). query ${q.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
