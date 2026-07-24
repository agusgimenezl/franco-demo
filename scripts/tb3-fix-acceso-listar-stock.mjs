#!/usr/bin/env node
// TB-3 fix: el encabezado por código no disparaba porque el output del tool Listar stock viene envuelto en
// { response: [...filas] }, así que `$('Listar stock').first().json.eco_permuta` daba undefined. Fix: leer
// `.response[0]`. Base: franco-n8n-v64.json. (2026-07-24)
//
//   node scripts/tb3-fix-acceso-listar-stock.mjs [--check]
//
// Además: fallback a `Leer lead (estado)` (nodo main-chain, siempre accesible) por si $('Listar stock') no
// fuese accesible desde Armar respuesta (sub-nodo tool). lead_entrega='Sí' → permuta; lead_financia='Si' →
// financia; lead_presupuesto != 'No mencionado' → presu. La primaria (Listar stock, este turno) manda; el
// fallback solo cubre el caso en que el acceso al tool falle.
// Solo cambia el bloque de lectura de flags en Armar respuesta.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v64.json')
const OUT = join(ROOT, 'franco-n8n-v65.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const n = wf.nodes.find((x) => x.name === 'Armar respuesta')
let code = n.parameters.jsCode

const OLD = [
  "      const ls = $('Listar stock').first().json;",
  '      const permuta = Number(ls.eco_permuta) === 1;',
  '      const financia = Number(ls.eco_financia) === 1;',
  '      const presu = Number(ls.eco_presu) === 1;',
].join('\n')
const NEW = [
  '      // el tool Listar stock envuelve las filas en { response: [...] }; los flags están en la fila.',
  "      let ls = {};",
  '      try {',
  "        const _raw = $('Listar stock').first().json;",
  '        ls = (_raw && Array.isArray(_raw.response)) ? (_raw.response[0] || {}) : (_raw || {});',
  '      } catch (e) {}',
  '      let permuta = Number(ls.eco_permuta) === 1;',
  '      let financia = Number(ls.eco_financia) === 1;',
  '      let presu = Number(ls.eco_presu) === 1;',
  '      // fallback si no se pudo leer del tool: usar el estado del CRM (nodo main-chain, siempre accesible).',
  '      if (ls.eco_permuta == null) {',
  '        try {',
  "          const le = $('Leer lead (estado)').first().json;",
  "          permuta = String(le.lead_entrega || '') === 'Sí' || (le.lead_usado && le.lead_usado !== 'No mencionado');",
  "          financia = String(le.lead_financia || '') === 'Si';",
  "          presu = le.lead_presupuesto && le.lead_presupuesto !== 'No mencionado';",
  '        } catch (e) {}',
  '      }',
].join('\n')
unaVez(code, OLD, 'Armar respuesta (lectura de flags)')
code = code.replace(OLD, NEW)
n.parameters.jsCode = code

// post
assert(code.includes('Array.isArray(_raw.response)'), 'no quedó el acceso .response')
assert(code.includes("$('Leer lead (estado)').first().json") && code.includes('lead_entrega'), 'no quedó el fallback a lead estado')
assert(code.includes("const encabezado = 'Con ' + unir"), 'se perdió la composición del encabezado')
assert(code.includes('cardsMostradas'), 'se perdió el dedup TB-1')
try { new Function(code) } catch (e) { assert(false, 'jsCode con error de sintaxis: ' + e.message) }

console.log('✓ todas las aserciones pasan')
console.log('  Armar respuesta: flags desde Listar stock (.response[0]) con fallback a Leer lead (estado)')

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
