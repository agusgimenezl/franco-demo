#!/usr/bin/env node
// TB-3 refinamiento: el encabezado por código firaba solo cuando encabezado+lista van en LA MISMA burbuja.
// Cuando Franco los parte en burbujas separadas, el eco quedaba en la burbuja del header. Fix: buscar la
// burbuja que tiene la lista de autos y (a) si el header está en la misma burbuja, reemplazar el texto antes
// de la lista; (b) si la lista arranca sola, reemplazar la burbuja ANTERIOR (el header) por el template.
// Base: franco-n8n-v65.json. (2026-07-24)
//
//   node scripts/tb3-encabezado-burbujas.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v65.json')
const OUT = join(ROOT, 'franco-n8n-v66.json')
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
  "          const m0 = String(messages[0].content || '');",
  '          const iLista = m0.search(/\\n\\s*[-•]/);',
  '          if (iLista > 0) messages[0] = Object.assign({}, messages[0], { content: encabezado + m0.slice(iLista) });',
].join('\n')
const NEW = [
  '          // buscar la burbuja que tiene la lista de autos (viñetas)',
  '          let ib = -1, li = -1;',
  '          for (let k = 0; k < messages.length; k++) {',
  "            const c = String(messages[k].content || '');",
  '            const j = c.search(/(^|\\n)\\s*[-•]/);',
  '            if (j >= 0) { ib = k; li = j; break; }',
  '          }',
  '          if (ib >= 0) {',
  "            const c = String(messages[ib].content || '');",
  '            if (li > 0) {',
  '              // encabezado y lista en la misma burbuja: reemplazo el texto antes de la lista',
  '              messages[ib] = Object.assign({}, messages[ib], { content: encabezado + c.slice(li) });',
  '            } else if (ib > 0) {',
  '              // la lista arranca sola en su burbuja: la burbuja anterior es el encabezado (donde vive el eco)',
  '              messages[ib - 1] = Object.assign({}, messages[ib - 1], { content: encabezado });',
  '            }',
  '          }',
].join('\n')
unaVez(code, OLD, 'Armar respuesta (reemplazo de encabezado)')
code = code.replace(OLD, NEW)
n.parameters.jsCode = code

// post
assert(code.includes('for (let k = 0; k < messages.length; k++)') && code.includes('messages[ib - 1] = Object.assign'), 'no quedó la lógica de burbujas')
assert(code.includes("const encabezado = 'Con ' + unir"), 'se perdió la composición')
assert(code.includes('Array.isArray(_raw.response)'), 'se perdió el fix de acceso v65')
assert(code.includes('cardsMostradas'), 'se perdió el dedup TB-1')
try { new Function(code) } catch (e) { assert(false, 'jsCode con error de sintaxis: ' + e.message) }

console.log('✓ todas las aserciones pasan')
console.log('  Armar respuesta: encabezado por código robusto a burbujas separadas (header propio o header+lista)')

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
