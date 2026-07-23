#!/usr/bin/env node
// Genera scripts/stock-update-metadata.sql: actualiza `año`, `km`, `precio` y `condicion`
// en el metadata de autos_disponibles, y reescribe `content`, desde stock.csv (2026-07-23).
//
//   node scripts/gen-stock-update-sql.mjs
//
// PARA QUÉ: rediseño de stock (redistribución de años/km/precios manteniendo marca y modelo).
//
// POR QUÉ TAMBIÉN TOCA `content`: `Detalle auto` devuelve `ficha_completa` =
// regexp_replace(content, 'Condición: ...') — o sea el texto de `content` tal cual, sin la
// condición. Ese texto tiene el año, los km y el precio embebidos (ver armar_content en
// revectorizar_con_consumo_v2.py). Si se actualiza sólo metadata, Franco recibiría el precio
// nuevo (metadata) y el viejo (ficha_completa) en la misma llamada. Por eso se reescribe.
//
// POR QUÉ NO SE REVECTORIZA (no se corre el .py): (1) `Buscar auto` dejó de ser vectorial en
// v8 (pasó a postgresTool), así que la columna `embedding` ya no se usa para recuperar — no
// hace falta regenerarla. (2) armar_metadata() del .py NO incluye color/descripcion/
// condicionantes/tamano (se agregaron después por SQL), así que correr el .py los BORRARÍA.
// Este UPDATE es aditivo: sólo pisa las 4 claves que cambian y deja el resto intacto.
//
// MECANISMO: mismo que gen-color-sql.mjs y gen-descripcion-sql.mjs. Idempotente.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Consumos: los mismos que usa revectorizar_con_consumo_v2.py y gen-descripcion-sql.mjs.
const CONSUMO = {
  1: 6.5, 2: 7.0, 3: 6.8, 4: 6.3, 5: 7.2, 6: 7.5, 7: 6.0, 8: 6.6, 9: 8.0,
  10: 7.3, 11: 8.5, 12: 8.8, 13: 9.5, 14: 10.2, 15: 9.8, 16: 9.6, 17: 7.8,
}

const lineas = readFileSync(join(ROOT, 'stock.csv'), 'utf8').split(/\r?\n/).filter((l) => l.trim())
const head = lineas[0].split(',')
const col = (n) => {
  const i = head.indexOf(n)
  if (i === -1) throw new Error(`stock.csv no tiene la columna "${n}"`)
  return i
}
const I = {
  id: col('ID'), marca: col('Marca'), modelo: col('Modelo'), anio: col('Año'),
  version: col('Versión/Edición'), color: col('Color'), km: col('Kilometraje'),
  comb: col('Tipo de Combustible'), trans: col('Transmisión'), carr: col('Carrocería'),
  puertas: col('Número de Puertas'), asientos: col('Número de Asientos'), motor: col('Motor'),
  hp: col('Potencia (HP)'), aa: col('Aire Acondicionado'), pantalla: col('Pantalla Multimedia'),
  cond: col('Condición'), precio: col('Precio de Venta (ARS)'), camara: col('Cámara de Retroceso'),
  sensores: col('Sensores de Estacionamiento'), fotos: col('FOTOS (URLs)'),
}

const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1) }

// Port fiel de armar_content() de revectorizar_con_consumo_v2.py, para que ficha_completa
// quede idéntica en formato a la que generó el .py, sólo con los datos nuevos.
const armarContent = (c) => {
  const equip = []
  if (c[I.aa] === 'Sí') equip.push('aire acondicionado')
  if (c[I.pantalla] === 'Sí') equip.push('pantalla multimedia')
  if (c[I.camara] === 'Sí') equip.push('cámara de retroceso')
  if (c[I.sensores] === 'Sí') equip.push('sensores de estacionamiento')
  const equipStr = equip.length ? equip.join(', ') : 'equipamiento básico'
  const version = (c[I.version] || '').trim()
  const versionStr = version ? ` ${version}` : ''
  const consumo = CONSUMO[+c[I.id]].toFixed(1) // 6.5, 7.0, 10.2 — igual que str(float) en python
  const fotosList = String(c[I.fotos] || '').split('|').map((u) => u.trim()).filter(Boolean)
  const fotosStr = fotosList.length
    ? ' URLs de fotos de este auto (usar EXACTAMENTE estas, no inventar): ' + fotosList.join(' | ')
    : ''
  return (
    `${c[I.marca]} ${c[I.modelo]}${versionStr} ${c[I.anio]}, ` +
    `color ${c[I.color].toLowerCase()}, ${c[I.km]} km. ` +
    `${c[I.carr]}, ${c[I.puertas]} puertas, ${c[I.asientos]} asientos. ` +
    `Motor ${c[I.motor]} de ${c[I.hp]} HP, ${c[I.comb].toLowerCase()}, transmisión ${c[I.trans].toLowerCase()}. ` +
    `Consumo promedio aproximado: ${consumo}. ` +
    `Condición: ${c[I.cond].toLowerCase()}. ` +
    `Precio: $${c[I.precio]} ARS. ` +
    `Equipamiento: ${equipStr}.` +
    fotosStr
  )
}

const esc = (s) => s.replace(/'/g, "''")

const stock = lineas.slice(1).map((l) => l.split(','))
if (stock.length !== 17) fail(`esperaba 17 autos, hay ${stock.length}`)
if (new Set(stock.map((c) => +c[I.id])).size !== 17) fail('hay ids duplicados en stock.csv')

for (const c of stock) {
  if (!/^\d+$/.test(c[I.km])) fail(`km no numérico en id ${c[I.id]}: "${c[I.km]}"`)
  if (!/^\d+$/.test(c[I.precio])) fail(`precio no numérico en id ${c[I.id]}: "${c[I.precio]}"`)
  if (!/^\d{4}$/.test(c[I.anio])) fail(`año inválido en id ${c[I.id]}: "${c[I.anio]}"`)
}

const values = stock
  .sort((a, b) => +a[I.id] - +b[I.id])
  .map((c) => {
    const content = armarContent(c)
    return `  (${+c[I.id]}, ${+c[I.anio]}, '${c[I.km]}', ${+c[I.precio]}, '${esc(c[I.cond])}', '${esc(content)}')`
  })
  .join(',\n')

const sql = `-- Actualiza año, km, precio y condicion en metadata, y reescribe content, de autos_disponibles.
-- Generado por scripts/gen-stock-update-sql.mjs desde stock.csv (2026-07-23). No editar a mano.
--
-- Idempotente: se puede correr las veces que haga falta.
-- Pisa SÓLO las 4 claves que cambian (año, km, precio, condicion) y reescribe content.
-- NO toca color, descripcion, condicionantes, tamano, fotos, foto_principal, marca, modelo, id
-- ni embedding. marca y modelo quedan intactos (siguen atados a las fotos).
--
-- BACKUP ANTES DE CORRER:
--   CREATE TABLE autos_disponibles_backup_20260723 AS SELECT * FROM autos_disponibles;

UPDATE autos_disponibles a
SET metadata = a.metadata || jsonb_build_object(
      'año',      v.anio,
      'km',       v.km,
      'precio',   v.precio,
      'condicion', v.condicion
    ),
    content = v.content
FROM (VALUES
${values}
) AS v(id, anio, km, precio, condicion, content)
WHERE (a.metadata->>'id')::int = v.id;

-- Verificación: 17 filas, metadata y content coherentes.
SELECT (metadata->>'id')::int AS id,
       metadata->>'marca' || ' ' || (metadata->>'modelo') AS auto,
       (metadata->>'año')::int AS anio,
       metadata->>'km' AS km,
       '$' || replace(to_char((metadata->>'precio')::bigint, 'FM999G999G999'), ',', '.') AS precio,
       left(content, 60) AS content_ini
FROM autos_disponibles
ORDER BY 1;
`

writeFileSync(join(ROOT, 'scripts', 'stock-update-metadata.sql'), sql)
console.log(`✓ ${stock.length} autos · UPDATE de año/km/precio/condicion + content`)
console.log('  escrito -> scripts/stock-update-metadata.sql')
