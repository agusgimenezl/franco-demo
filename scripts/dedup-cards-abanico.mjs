#!/usr/bin/env node
// TB-1 (target-b): DEDUP de product_cards. No repetir el mismo mazo de cards si ya se mandó hace poco
// y el cliente sigue hablando de esos autos. Base: franco-n8n-v56.json. (2026-07-23, sesión C / target-b)
//
//   node scripts/dedup-cards-abanico.mjs [--check]
//
// PEDIDO (Agustina): "que no repita exactamente las mismas cards si ya se mandaron y luego se continúa
//   hablando sobre esos autos". Hoy la rama de abanico (autos>=3) en `Armar respuesta` manda las cards
//   SIN dedup (el dedup existente sólo mira `images`, no `product_cards`, a propósito). Si Franco re-emite
//   los mismos auto_ids en un turno de continuación, el mazo se reenvía.
//
// FIX (regla del proyecto: la decisión es determinística → código, no LLM):
//   (A) `Autos ya mostrados`: además de `ids_recientes` (fotos), devuelve `cards_recientes` = ids de autos
//       cuyas product_cards se mandaron en los últimos 8 mensajes de la sesión.
//   (B) `Armar respuesta`: en la rama autos>=3, si TODOS los autos de este turno ya están en
//       cards_recientes → NO se mandan cards (no se repite el mazo). Si hay AL MENOS UNO nuevo → va la
//       lista completa (filtrar auto por auto dejaría huecos en el catálogo). Interpretación de "exactamente
//       las mismas": se suprime sólo cuando el set entero ya se mostró (repeticiones/subsets), no cuando
//       hay algo nuevo.
//
// NO toca: el dedup de `images` (fichas 1-2 autos), el guard de cierre, el saludo, el strip de ¿/¡, el
//   historial. Verificación: test offline de la decisión (abajo) + log post-paste (product_cards vacío en
//   el turno de repetición). ⚠️ PEGA A MANO Agustina.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v56.json')
const OUT = join(ROOT, 'franco-n8n-v57.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => { const x = wf.nodes.find((k) => k.name === n); assert(x, `no existe "${n}"`); return x }

// ── (A) Autos ya mostrados: agregar cards_recientes
{
  const n = nodo('Autos ya mostrados')
  const q = n.parameters.query
  assert(q.includes('AS ids_recientes'), 'la query no es la esperada (falta ids_recientes)')
  assert(!q.includes('cards_recientes'), 'ya está cards_recientes — ¿ya se aplicó?')
  n.parameters.query = [
    'WITH recientes AS (',
    '  SELECT contenido',
    '  FROM mensajes_demo',
    '  WHERE session_id = $1',
    '  ORDER BY id DESC',
    '  LIMIT 8',
    ')',
    'SELECT',
    '  COALESCE((',
    '    SELECT string_agg(DISTINCT m[1], \',\')',
    '    FROM recientes r',
    "    LEFT JOIN LATERAL regexp_matches(COALESCE(r.contenido->'images', '[]'::jsonb)::text, 'foto-(\\d+)-', 'g') AS m ON TRUE",
    "  ), '') AS ids_recientes,",
    '  COALESCE((',
    "    SELECT string_agg(DISTINCT pc->>'id', ',')",
    '    FROM recientes r',
    '    CROSS JOIN LATERAL jsonb_array_elements(',
    "      CASE WHEN jsonb_typeof(r.contenido->'product_cards') = 'array' THEN r.contenido->'product_cards' ELSE '[]'::jsonb END",
    '    ) AS pc',
    "    WHERE pc->>'id' IS NOT NULL",
    "  ), '') AS cards_recientes;",
  ].join('\n')
  // queryReplacement (session_id, forma array — trampa 2) intacto
  assert(n.parameters.options.queryReplacement.includes("$('Config').item.json.session_id"), 'se perdió el queryReplacement')
}

// ── (B) Armar respuesta: leer cards_recientes + dedup en la rama autos>=3
{
  const n = nodo('Armar respuesta')
  let code = n.parameters.jsCode

  // B.1 — leer cards_recientes justo antes de construir `autos`
  const ANCHOR_A = '  const autos = [...new Set(ids)].map(id => porId.get(id)).filter(Boolean);'
  unaVez(code, ANCHOR_A, 'Armar respuesta (const autos)')
  const INS_A = [
    '  // Autos cuyas CARDS (product_cards) ya se mandaron en los últimos 8 mensajes. Pedido de',
    '  // Agustina: no repetir el mismo mazo cuando el cliente sigue hablando de esos autos.',
    '  let cardsMostradas = new Set();',
    '  try {',
    "    const crudoCards = String($('Autos ya mostrados').first().json.cards_recientes || '');",
    '    cardsMostradas = new Set(crudoCards.split(\',\').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n)));',
    '  } catch (e) {}',
    ANCHOR_A,
  ].join('\n')
  code = code.replace(ANCHOR_A, INS_A)

  // B.2 — rama autos>=3: dedup del mazo
  const ANCHOR_B = [
    '  if (autos.length >= 3) {',
    '    // Las listas van completas: filtrar acá dejaría huecos en el catálogo.',
    '    product_cards = autos.map(a => ({',
    '      id: a.id, titulo: a.titulo, precio: a.precio, foto_principal: a.foto_principal,',
    '    }));',
    '  } else if (autos.length >= 1) {',
  ].join('\n')
  unaVez(code, ANCHOR_B, 'Armar respuesta (rama product_cards)')
  const NEW_B = [
    '  if (autos.length >= 3) {',
    '    // Dedup del mazo: si TODOS los autos de este turno ya se mandaron como card hace poco,',
    '    // no se repite (el cliente sigue hablando de esos y ya los tiene en pantalla). Si hay al',
    '    // menos uno nuevo, va la lista completa: filtrar auto por auto dejaría huecos en el catálogo.',
    '    const hayNuevo = autos.some(a => !cardsMostradas.has(Number(a.id)));',
    '    if (hayNuevo) {',
    '      product_cards = autos.map(a => ({',
    '        id: a.id, titulo: a.titulo, precio: a.precio, foto_principal: a.foto_principal,',
    '      }));',
    '    }',
    '  } else if (autos.length >= 1) {',
  ].join('\n')
  code = code.replace(ANCHOR_B, NEW_B)

  n.parameters.jsCode = code
}

// ── post-condiciones
const q = nodo('Autos ya mostrados').parameters.query
assert(q.includes('AS ids_recientes') && q.includes('AS cards_recientes'), 'faltan las dos columnas')
assert(q.includes("jsonb_typeof(r.contenido->'product_cards') = 'array'"), 'falta el guard de tipo (trampa 4)')
const code = nodo('Armar respuesta').parameters.jsCode
assert(code.includes('cardsMostradas') && code.includes('cards_recientes'), 'no quedó la lectura de cards_recientes')
assert(code.includes('const hayNuevo = autos.some'), 'no quedó el dedup del mazo')
// lo que NO debía cambiar sobrevive
assert(code.includes("json.ids_recientes"), 'se perdió el dedup de images (ids_recientes)')
assert(code.includes('Guard de cierre comercial') || code.includes("!texto.includes('?')"), 'se tocó el guard de cierre')
assert(code.includes('esPrimero') && code.includes('asistente de'), 'se tocó el saludo')
assert(code.includes("replace(/[¿¡]/g, '')"), 'se perdió el strip de ¿/¡')

// ── TEST OFFLINE de la decisión de dedup
{
  const decide = (autoIds, recientes) => {
    const cardsMostradas = new Set(recientes)
    const autos = [...new Set(autoIds)].map((id) => ({ id }))
    if (autos.length >= 3) {
      const hayNuevo = autos.some((a) => !cardsMostradas.has(Number(a.id)))
      return hayNuevo ? autos.map((a) => a.id) : []
    }
    return 'rama-images'
  }
  // mazo nuevo (nada mostrado) → se muestra completo
  assert(JSON.stringify(decide([1, 17, 4, 2, 3], [])) === JSON.stringify([1, 17, 4, 2, 3]), 'test: mazo nuevo debe mostrarse')
  // mismo mazo ya mostrado → suprimido
  assert(JSON.stringify(decide([1, 17, 4, 2, 3], [1, 17, 4, 2, 3])) === '[]', 'test: mazo repetido debe suprimirse')
  // subset ya mostrado → suprimido
  assert(JSON.stringify(decide([1, 17, 4], [1, 17, 4, 2, 3])) === '[]', 'test: subset repetido debe suprimirse')
  // uno nuevo (7) → lista completa (sin huecos)
  assert(JSON.stringify(decide([1, 17, 4, 2, 3, 7], [1, 17, 4, 2, 3])) === JSON.stringify([1, 17, 4, 2, 3, 7]), 'test: con uno nuevo va completo')
  // 1-2 autos → no toca esta rama (dedup de images aparte)
  assert(decide([1, 17], [1, 17]) === 'rama-images', 'test: 1-2 autos van por images')
  console.log('  TEST dedup: mazo nuevo→completo · repetido→[] · subset→[] · +1 nuevo→completo · 1-2→images  ✓')
}

console.log('✓ todas las aserciones pasan')
console.log('  (A) Autos ya mostrados: + cards_recientes (product_cards de los últimos 8 msgs)')
console.log('  (B) Armar respuesta: dedup del mazo (autos>=3) — no repite si todos ya se mostraron')

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
