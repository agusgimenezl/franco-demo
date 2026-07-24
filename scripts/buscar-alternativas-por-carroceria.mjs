#!/usr/bin/env node
// BUG-A: pedido de modelo puntual sin stock → alternativas por CARROCERÍA (no por marca) + no ocultar el
// modelo que SÍ está en otro año/variante. Base: franco-n8n-v60.json. (2026-07-24)
//
//   node scripts/buscar-alternativas-por-carroceria.mjs [--check]
//
// EL BUG (captura + repro `modelo-no-stock-alternativas-carroceria`, log 7661): pidió "Amarok Highline 4x2
//   2022 a 2024". Franco llamó Buscar auto 5 veces, TODAS con anio_min=2022 → la Amarok 2018 (id 15) quedó
//   filtrada por el año → 0 filas → Franco cayó a buscar "Volkswagen" (marca) → mostró T-Cross/Vento, ocultando
//   la Amarok que SÍ está y sin ofrecer las otras pickups (S10/Hilux/Ranger).
//
// EL FIX (regla del proyecto → determinístico):
//   (A) Buscar auto NO filtra por año (los rangos año/precio son de Listar stock, ver línea 77 del prompt) →
//       el modelo pedido nunca se oculta por el año. Y devuelve, en una sola query: el modelo/tipo pedido
//       (match_tipo='exacto', cualquier año) + las alternativas de la MISMA CARROCERÍA (match_tipo='alternativa').
//       Sigue devolviendo descripcion (para BUG-B). Se cae el param anio_min de Buscar auto (Franco no lo pasa).
//   (B) prompt (## Buscar auto): presentar el exacto primero; si esa variante/año no está pero el modelo sí,
//       mencionarlo; alternativas por CARROCERÍA, nunca por marca al azar; cerrar ofreciendo todo el stock o
//       el detalle de un modelo.
// NO toca: Listar stock, el resto del flujo. ⚠️ Riesgo: reescritura grande de la query de Buscar auto; si la
//   búsqueda rompe post-paste, revertir. Verificación: estructura (parens/CTE) + log post-paste. PEGA A MANO.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v60.json')
const OUT = join(ROOT, 'franco-n8n-v61.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => { const x = wf.nodes.find((k) => k.name === n); assert(x, `no existe "${n}"`); return x }

// extraer las expresiones $fromAI EXACTAS del query actual (byte-idénticas, trampa 3)
const ba = nodo('Buscar auto')
const oldQ = ba.parameters.query
const extractExpr = (q, key) => {
  const start = q.indexOf(`{{ $fromAI('${key}'`)
  assert(start !== -1, `no encontré la expresión de ${key} en Buscar auto`)
  const end = q.indexOf('}}', start) + 2
  return q.slice(start, end)
}
const MM = extractExpr(oldQ, 'marca_o_modelo')
const COL = extractExpr(oldQ, 'color')
const PMIN = extractExpr(oldQ, 'precio_min')
const PMAX = extractExpr(oldQ, 'precio_max')
const KM = extractExpr(oldQ, 'km_max')
assert(MM.includes('.replace(') && MM.includes('.trim()'), 'MM no trae el sanitizado')
assert(oldQ.includes('anio_min'), 'esperaba anio_min en el query viejo (lo vamos a quitar)')

const conc = "metadata->>'marca' || ' ' || (metadata->>'modelo') || ' ' || COALESCE(metadata->>'carroceria','') || ' ' || COALESCE(metadata->>'color','')"
const concCarr = "metadata->>'marca' || ' ' || (metadata->>'modelo') || ' ' || COALESCE(metadata->>'carroceria','')"

const newQ = `WITH carr_pedida AS (
  SELECT DISTINCT metadata->>'carroceria' AS carroceria
  FROM autos_disponibles
  WHERE '${MM}' <> ''
    AND (${concCarr}) ILIKE '%' || '${MM}' || '%'
)
SELECT
  (metadata->>'id')::int AS id,
  metadata->>'marca' || ' ' || (metadata->>'modelo') || ' ' || (metadata->>'año') AS titulo,
  '$' || replace(to_char((metadata->>'precio')::bigint, 'FM999G999G999'), ',', '.') AS precio,
  metadata->>'foto_principal' AS foto_principal,
  metadata->>'carroceria' AS carroceria,
  metadata->>'color' AS color,
  (metadata->>'año')::int AS anio,
  (metadata->>'km')::text AS km,
  metadata->>'combustible' AS combustible,
  metadata->>'consumo' AS consumo,
  metadata->>'tamano' AS tamano,
  metadata->>'descripcion' AS descripcion,
  metadata->>'condicionantes' AS condicionantes,
  CASE
    WHEN '${MM}' = '' THEN 'exacto'
    WHEN (${conc}) ILIKE '%' || '${MM}' || '%' THEN 'exacto'
    ELSE 'alternativa'
  END AS match_tipo
FROM autos_disponibles
WHERE
  ('${COL}' = '' OR metadata->>'color' ILIKE '${COL}')
  AND (${PMIN} = 0 OR (metadata->>'precio')::int >= ${PMIN})
  AND (${PMAX} = 0 OR (metadata->>'precio')::int <= ${PMAX})
  AND (${KM} = 0 OR COALESCE(NULLIF(regexp_replace(metadata->>'km', '[^0-9]', '', 'g'), '')::int, 0) <= ${KM})
  AND (
    '${MM}' = ''
    OR (${conc}) ILIKE '%' || '${MM}' || '%'
    OR metadata->>'carroceria' IN (SELECT carroceria FROM carr_pedida)
  )
ORDER BY (('${MM}' = '' OR (${conc}) ILIKE '%' || '${MM}' || '%')) DESC, (metadata->>'precio')::int DESC;`

ba.parameters.query = newQ

// toolDescription: reflejar el nuevo comportamiento
let td = ba.parameters.toolDescription
const TD_OLD = 'Si no devuelve ninguna fila, ese auto no esta en el stock.'
const TD_NEW = 'Devuelve el modelo/tipo pedido (match_tipo="exacto", de CUALQUIER anio) MAS alternativas de la MISMA carroceria (match_tipo="alternativa"). NO filtra por anio (para anio/precio usa Listar stock). Si no devuelve NINGUNA fila, ni ese modelo ni esa carroceria estan en stock.'
unaVez(td, TD_OLD, 'Buscar auto (toolDescription)')
td = td.replace(TD_OLD, TD_NEW)
ba.parameters.toolDescription = td

// (B) prompt ## Buscar auto
const franco = nodo('Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'trampa 1')
const P_OLD = 'Para cuando el cliente busca por características, no por precio: una marca, un tipo ("una SUV familiar", "una pickup"), una feature. Devuelve autos parecidos por similitud. Los datos, tal cual vienen.'
const P_NEW = 'Para cuando el cliente busca por características, no por precio: una marca, un modelo, un tipo ("una SUV", "una pickup"), un color. Te devuelve el modelo/tipo pedido (match_tipo="exacto", de CUALQUIER año) MÁS alternativas de la MISMA CARROCERÍA (match_tipo="alternativa"). Cómo lo presentás: 1) si el modelo/variante exacto está, mostralo. 2) Si esa variante o año no está pero el MODELO sí está en otro año, DECÍLO en vez de esconderlo ("no tengo la Amarok 4x2 2022, pero sí una Amarok 2018 4x4"). 3) Las alternativas van SIEMPRE por CARROCERÍA (pidió una pickup → le ofrecés las pickups; una SUV → las SUV), NUNCA otra marca al azar de otra carrocería. 4) Cerrás ofreciendo ver todo el stock o el detalle de algún modelo. NO filtres por año acá (para año/precio usá Listar stock). Los datos, tal cual vienen.'
unaVez(m, P_OLD, 'prompt (## Buscar auto)')
m = m.replace(P_OLD, P_NEW)
franco.parameters.options.systemMessage = m

// ── post-condiciones
const q = nodo('Buscar auto').parameters.query
assert(q.includes('WITH carr_pedida AS (') && q.includes("match_tipo") && q.includes("ELSE 'alternativa'"), 'no quedó el nuevo query')
assert(!q.includes('anio_min'), 'quedó anio_min en Buscar auto (debía irse)')
assert(q.includes("metadata->>'descripcion' AS descripcion"), 'se perdió descripcion (BUG-B lo necesita)')
const op = (q.match(/\(/g) || []).length, cl = (q.match(/\)/g) || []).length
assert(op === cl, `parens desbalanceados en Buscar auto: ${op} vs ${cl}`)
assert(nodo('Buscar auto').parameters.toolDescription.includes('match_tipo="exacto"'), 'no quedó la toolDescription')
assert(m !== mAntes && m.startsWith('='), 'el prompt no cambió o perdió el =')
assert(m.includes('Las alternativas van SIEMPRE por CARROCERÍA'), 'no quedó la regla de carrocería')
assert(m.includes('DECÍLO en vez de esconderlo'), 'no quedó la regla de no ocultar el modelo')
// Listar stock intacto
assert(nodo('Listar stock').parameters.query.includes('WITH usado_val AS ('), 'se tocó Listar stock (no debía)')

// trampa 3
{
  const porKey = new Map()
  for (const nn of wf.nodes) {
    for (const mm of String(nn.parameters?.query ?? '').matchAll(/\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g)) {
      const [, key, desc, tipo] = mm
      const firma = `${desc}||${tipo}`
      if (porKey.has(key)) assert(porKey.get(key) === firma, `trampa 3: la key '${key}' tiene firmas distintas`)
      else porKey.set(key, firma)
    }
  }
}

console.log('✓ todas las aserciones pasan')
console.log('  (A) Buscar auto: sin anio_min; devuelve exacto + alternativas por carrocería (match_tipo)')
console.log('  (B) prompt ## Buscar auto: no ocultar el modelo, alternativas por carrocería, ofrecer stock/detalle')
console.log(`  Buscar auto query: ${oldQ.length} -> ${q.length} · prompt: ${mAntes.length} -> ${m.length}`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
