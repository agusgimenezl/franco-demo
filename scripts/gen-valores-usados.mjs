#!/usr/bin/env node
// Genera scripts/valores-usados.sql: tabla de referencia de valores de usados para la permuta.
// Desde valores_usados.csv (investigación de mercado AR, julio 2026). (2026-07-23)
//
//   node scripts/gen-valores-usados.mjs
//
// PARA QUÉ: que el Capital Base de la permuta (v42) no dependa de que Franco adivine el valor
// del usado. Franco clasifica (marca/modelo/año/categoría) y el SQL valúa desde esta tabla.
// El ajuste por año lo hace la consulta (depreciación ~7%/año en pesos). Fallback: si el modelo
// no está, se usa el promedio de la categoría (chico/mediano/grande).
//
// Los valores son ancla 2020. Fuente por fila en la columna `fuente` (dato duro vs estimado).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const lineas = readFileSync(join(ROOT, 'valores_usados.csv'), 'utf8').split(/\r?\n/).filter((l) => l.trim())
const head = lineas[0].split(',')
const idx = (n) => { const i = head.indexOf(n); if (i === -1) throw new Error(`falta columna ${n}`); return i }
const iMarca = idx('Marca'), iModelo = idx('Modelo'), iCat = idx('Categoria'), iVal = idx('Valor_Ref_2020'), iF = idx('Fuente')

const CATS = new Set(['chico', 'mediano', 'grande'])
const esc = (s) => { if (/[;{}\\]/.test(s)) throw new Error(`caracter peligroso: ${s}`); return s.replace(/'/g, "''") }

const filas = lineas.slice(1).map((l, k) => {
  const c = l.split(',')
  const val = parseInt(c[iVal], 10)
  if (!CATS.has(c[iCat])) throw new Error(`fila ${k + 2}: categoria inválida "${c[iCat]}"`)
  if (!Number.isInteger(val) || val <= 0) throw new Error(`fila ${k + 2}: valor inválido "${c[iVal]}"`)
  return { marca: c[iMarca].trim(), modelo: c[iModelo].trim(), cat: c[iCat].trim(), val, fuente: (c[iF] || '').trim() }
})
if (filas.length < 10) throw new Error(`esperaba >=10 filas, hay ${filas.length}`)

const values = filas
  .map((f) => `  ('${esc(f.marca)}', '${esc(f.modelo)}', '${f.cat}', ${f.val}, '${esc(f.fuente)}')`)
  .join(',\n')

const sql = `-- Tabla de referencia de valores de usados para la permuta.
-- Generado por scripts/gen-valores-usados.mjs desde valores_usados.csv (2026-07-23). No editar a mano.
--
-- Idempotente: crea la tabla si no existe, la vacía y la recarga. Correr las veces que haga falta.
-- El valor es ancla 2020; la consulta lo ajusta por año. Fallback por categoría (chico/mediano/grande).

CREATE TABLE IF NOT EXISTS valores_usados_referencia (
  id             serial PRIMARY KEY,
  marca          text   NOT NULL,
  modelo         text   NOT NULL,
  categoria      text   NOT NULL,
  valor_ref_2020 bigint NOT NULL,
  fuente         text
);

DELETE FROM valores_usados_referencia;

INSERT INTO valores_usados_referencia (marca, modelo, categoria, valor_ref_2020, fuente) VALUES
${values};

-- Verificación: filas cargadas, y valor de referencia por categoría (para el fallback).
SELECT categoria, count(*) AS modelos, round(avg(valor_ref_2020)) AS promedio_2020
FROM valores_usados_referencia
GROUP BY categoria
ORDER BY 1;
`

writeFileSync(join(ROOT, 'scripts', 'valores-usados.sql'), sql)
console.log(`✓ ${filas.length} modelos · categorías: ${[...new Set(filas.map((f) => f.cat))].join(', ')}`)
const dur = filas.filter((f) => !/estimado/i.test(f.fuente)).length
console.log(`  ${dur} con dato duro (Infobae/LA NACION), ${filas.length - dur} estimados por segmento`)
console.log('  escrito -> scripts/valores-usados.sql')
