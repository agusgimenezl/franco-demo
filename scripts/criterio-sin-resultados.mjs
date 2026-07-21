#!/usr/bin/env node
// Si el criterio del cliente no da resultados dentro del presupuesto, "Listar stock"
// devuelve igual los que cumplen el criterio, marcados como "fuera" (2026-07-21).
//
//   node scripts/criterio-sin-resultados.mjs            # escribe franco-n8n-v14.json
//   node scripts/criterio-sin-resultados.mjs --check    # solo valida
//
// DIAGNÓSTICO MEDIDO (ejecución 3963). Con "tengo 13 millones" + "menos de 50.000 km",
// Franco llamó a la tool con:
//     { precio_objetivo: 13000000, precio_max: 16250000, km_max: 50000 }  ->  response: []
// El filtro de km funciona; el problema es la COMBINACIÓN. Ningún auto cumple los dos
// (el más barato con menos de 50.000 km es el Onix a $21.800.000), la query vuelve vacía y
// desde ahí Franco no tiene forma de saber que esos autos existen: contesta "no tenemos
// opciones". Lo reintentó incluso sin permuta y volvió vacío igual.
//
// SOLUCIÓN: el techo de precio pasa a ser una PREFERENCIA, no un filtro duro. El criterio
// del cliente (km) sí filtra siempre. Si con presupuesto no queda nada, se devuelven los
// que cumplen el criterio con `categoria = 'fuera'`, que es la etiqueta que el prompt ya
// sabe leer para decir "se va de lo que tenías pensado".
//
// Es la regla del proyecto: "qué autos cumplen el criterio" es calculable, así que se
// resuelve en SQL. Antes se intentó por prompt (v12) y quedó en 1/4 — revertido.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v13.json')
const OUT = join(ROOT, 'franco-n8n-v14.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`✗ ASERCIÓN FALLIDA: ${msg}`)
    process.exit(1)
  }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const listar = wf.nodes.find((n) => n.name === 'Listar stock')
assert(listar, 'no existe "Listar stock"')

const q = listar.parameters.query
assert(q.includes('km_max'), '"Listar stock" no tiene km_max — hay que partir de v13')
assert(!q.includes('WITH base AS'), 'la query ya tiene el fallback — ¿ya se aplicó?')

// Las piezas de la query vieja que se reutilizan tal cual.
const P_MIN = `{{ $fromAI('precio_min', 'Precio minimo en pesos. Poner 0 si no hay piso.', 'number') }}`
const P_MAX = `{{ $fromAI('precio_max', 'Precio maximo en pesos. Poner 0 si no hay techo.', 'number') }}`
const KM = `{{ $fromAI('km_max', 'Kilometraje maximo que acepta el cliente, en kilometros (ej: 50000). Poner 0 si no menciono ninguno.', 'number') }}`
for (const [nombre, pieza] of [['precio_min', P_MIN], ['precio_max', P_MAX], ['km_max', KM]]) {
  assert(q.includes(pieza), `no encuentro la expresión de ${nombre} tal como se esperaba (trampa 3)`)
}

// El bloque CASE de `categoria` se conserva byte a byte: es la lógica de
// entra/estirar/economica que ya está calibrada y no se toca.
const iCase = q.indexOf('  CASE\n')
const iEnd = q.indexOf('END AS categoria')
assert(iCase !== -1 && iEnd !== -1, 'no encuentro el CASE de categoria')
const CASE_CATEGORIA = q.slice(iCase, iEnd + 'END AS categoria'.length)

// Columnas: las mismas de siempre, más precio_num para poder ordenar después del UNION.
const COLUMNAS = `    (metadata->>'id')::int AS id,
    metadata->>'marca' || ' ' || (metadata->>'modelo') || ' ' || (metadata->>'año') AS titulo,
    '$' || replace(to_char((metadata->>'precio')::bigint, 'FM999G999G999'), ',', '.') AS precio,
    metadata->>'foto_principal' AS foto_principal,
    metadata->>'carroceria' AS carroceria,
    metadata->>'color' AS color,
    metadata->>'condicion' AS condicion,
    (metadata->>'año')::int AS anio,
    (metadata->>'km')::text AS km,
    metadata->>'combustible' AS combustible,
    metadata->>'consumo' AS consumo,
${CASE_CATEGORIA.split('\n').map((l) => (l ? `  ${l}` : l)).join('\n')},
    (metadata->>'precio')::int AS precio_num`

const KM_LIMPIO = `COALESCE(NULLIF(regexp_replace(metadata->>'km', '[^0-9]', '', 'g'), '')::int, 0)`

const NUEVA = `WITH base AS (
  SELECT
${COLUMNAS}
  FROM autos_disponibles
  WHERE (${KM} = 0 OR ${KM_LIMPIO} <= ${KM})
),
en_presupuesto AS (
  SELECT * FROM base
  WHERE (${P_MIN} = 0 OR precio_num >= ${P_MIN})
    AND (${P_MAX} = 0 OR precio_num <= ${P_MAX})
)
SELECT id, titulo, precio, foto_principal, carroceria, color, condicion, anio, km,
       combustible, consumo, categoria
FROM (
  SELECT * FROM en_presupuesto
  UNION ALL
  -- Si el criterio del cliente no dejó nada dentro del presupuesto, se devuelven igual los
  -- que lo cumplen: vienen con categoria='fuera' y Franco los ofrece aclarando el precio.
  SELECT * FROM base WHERE NOT EXISTS (SELECT 1 FROM en_presupuesto)
) u
ORDER BY u.precio_num DESC;`

listar.parameters.query = NUEVA

// --- post-condiciones
const nq = listar.parameters.query
assert(nq.includes('WITH base AS'), 'no quedó el CTE')
assert(nq.includes('NOT EXISTS (SELECT 1 FROM en_presupuesto)'), 'no quedó el fallback')
assert(nq.includes('END AS categoria'), 'se perdió la categoría')
assert(!nq.includes('precio_num,\n       categoria'), 'precio_num no debe salir en la proyección final')
// Las 12 columnas que ve el agente (precio_num queda dentro del CTE).
const proy = nq.slice(nq.indexOf('SELECT id, titulo'), nq.indexOf('FROM (\n'))
assert(!proy.includes('precio_num'), 'precio_num se filtró a la salida y suma tokens al agente')
assert(proy.includes('color'), 'se perdió la columna color')

// Trampa 3 en todo el workflow.
const porKey = new Map()
for (const n of wf.nodes) {
  for (const m of String(n.parameters?.query ?? '').matchAll(/\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g)) {
    const [, key, desc, tipo] = m
    const firma = `${desc}||${tipo}`
    if (porKey.has(key)) assert(porKey.get(key) === firma, `trampa 3: la key '${key}' difiere`)
    else porKey.set(key, firma)
  }
}

console.log('✓ todas las aserciones pasan')
console.log('  Listar stock: el techo de precio pasa a preferencia; el criterio (km) filtra siempre')
console.log('  si no queda nada en presupuesto -> devuelve los que cumplen, con categoria="fuera"')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
