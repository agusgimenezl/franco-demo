#!/usr/bin/env node
// C-a1a: COLAPSO de la cadena. La valuación del usado (hoy en el tool `Valuar usado`) pasa a un CTE DENTRO
// de `Listar stock`. Franco deja de pasar `usado_valor` (que el LLM podía mandar en 0 y colapsar el abanico)
// y pasa los DESCRIPTORES del usado (usado_marca/modelo/anio/km/categoria); la query lo valúa sola.
// Base: franco-n8n-v54.json. (2026-07-23, sesión C)
//
//   node scripts/colapso-valuacion-en-listar-stock.mjs [--check]
//
// POR QUÉ (tesis de C, medida): gpt-4.1-mini no orquesta confiable la cadena de 3 pasos
//   (Valuar usado → usado_valor → Listar stock). STATE tiene logs con usado_valor=0 (abanico colapsa) y
//   usado_km=0 (km dormido) sin patrón estable. La regla del proyecto: lo determinístico va a código. Al
//   computar el valor DENTRO de Listar stock, el LLM ya no puede mandar 0 — se calcula siempre. Además baja
//   una llamada de tool por turno (menos TPM, trampa 5; candidato a bajar el parser fallback).
//
// QUÉ HACE (un cambio coherente al nodo Listar stock + su sección de prompt):
//   (A) Listar stock: nuevo CTE `usado_val` que valúa el usado con la MISMA expresión de `Valuar usado`
//       (LATERAL a valores_usados_referencia + ajuste por año + km_factor), extraída byte a byte del nodo.
//       Gate: solo computa si tiene_permuta=1 AND usado_anio>0 (si no, 0 → no infla el techo en búsquedas
//       sin usado). Se CROSS JOINea a `base` y las 5 referencias a `$fromAI('usado_valor')` pasan a
//       `usado_val.valor`. La key usado_valor DESAPARECE del schema del tool.
//   (B) toolDescription: describe los nuevos params del usado en vez de usado_valor.
//   (C) prompt pto 5 (financiación + contado) y pto 6: Franco pasa los descriptores directo a Listar stock,
//       ya NO llama a Valuar usado; el valor es interno y ni siquiera se lo devuelven. (trampa 6: se
//       REEMPLAZA el guion, no se prohíbe arriba.)
//
// NO toca (a1b, aparte): remover el nodo `Valuar usado` (queda huérfano; la corrección NO depende de que
//   Franco deje de llamarlo — Listar stock computa su propio valor e ignora cualquier usado_valor de entrada).
// Verificación vinculante: sim (estructura + el techo estirar downstream) + LOG post-paste (Franco pasa
//   usado_marca/…, NO usado_valor; el estirar sigue llegando a Cronos/Kangoo → la valuación interna ≈12.4M anda).
// ⚠️ PEGA A MANO Agustina + verificación byte a byte.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v54.json')
const OUT = join(ROOT, 'franco-n8n-v55.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => { const x = wf.nodes.find((k) => k.name === n); assert(x, `no existe "${n}"`); return x }

// firmas byte-idénticas (trampa 3)
const TP = "{{ $fromAI('tiene_permuta', 'Poner 1 si el cliente dijo que entrega un auto usado en parte de pago, 0 si no.', 'number') }}"
const ANIO = "{{ $fromAI('usado_anio', 'El anio del auto usado que entrega el cliente (ej: 2015).', 'number') }}"
const UV = "{{ $fromAI('usado_valor', 'Tu estimacion del valor de mercado actual del usado que entrega el cliente, en pesos (ej: 7500000). Poner 0 si no hay usado o todavia no sabes marca, modelo, anio y km.', 'number') }}"

// ── extraer la expresión de valuación EXACTA de Valuar usado (round( ... )::bigint)
const vuq = nodo('Valuar usado').parameters.query
const vStart = vuq.indexOf('round(')
const vEndMarker = ')::bigint AS valor_estimado'
const vEnd = vuq.indexOf(vEndMarker)
assert(vStart !== -1 && vEnd !== -1 && vEnd > vStart, 'no pude extraer la valuación de Valuar usado')
const VALUATION = vuq.slice(vStart, vEnd) + ')::bigint'
assert(VALUATION.includes('valores_usados_referencia') && VALUATION.includes("power(0.88") && VALUATION.includes('EXTRACT(YEAR FROM CURRENT_DATE)'),
  'la valuación extraída no tiene el km_factor / tabla esperados')

// ── (A) Listar stock: CTE usado_val + cross join + usado_valor -> usado_val.valor
const ls = nodo('Listar stock')
let q = ls.parameters.query
assert(q.split(UV).length - 1 === 5, `esperaba 5 usos de usado_valor, hay ${q.split(UV).length - 1}`)
assert(!q.includes('usado_val.valor'), 'ya está usado_val — ¿ya se aplicó?')

// A.1 — reemplazar todas las referencias a usado_valor por la columna computada
q = q.split(UV).join('usado_val.valor')

// A.2 — prepender el CTE (gate: solo con permuta y año válido)
const CTE = `usado_val AS (\n  SELECT CASE WHEN ${TP} = 1 AND ${ANIO} > 0 THEN ${VALUATION} ELSE 0 END AS valor\n),\n`
unaVez(q, 'WITH base AS (', 'Listar stock (WITH base)')
q = q.replace('WITH base AS (', `WITH ${CTE}base AS (`)

// A.3 — cross join del CTE (1 fila) a base
unaVez(q, '  FROM autos_disponibles\n  WHERE', 'Listar stock (FROM base)')
q = q.replace('  FROM autos_disponibles\n  WHERE', '  FROM autos_disponibles CROSS JOIN usado_val\n  WHERE')

ls.parameters.query = q

// ── (B) toolDescription: describir los params del usado en vez de usado_valor
let td = ls.parameters.toolDescription
const OLD_TD = 'Pasá tambien usado_valor (tu estimacion del valor de mercado del usado, 0 si no hay): el tramo se calcula sobre el Capital Base = anticipo + usado_valor*0.70'
const NEW_TD = 'Pasá tambien los datos del usado (usado_marca, usado_modelo, usado_anio, usado_km, usado_categoria): la query lo valúa internamente y el tramo se calcula sobre el Capital Base = anticipo + valor del usado*0.70'
unaVez(td, OLD_TD, 'Listar stock (toolDescription)')
td = td.replace(OLD_TD, NEW_TD)
ls.parameters.toolDescription = td

// ── (C) prompt: pasar descriptores directo, ya no llamar a Valuar usado
const franco = nodo('Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')

// (C.1) pto 5 — financiación
const F_OLD = 'Con los 4, llamás a Valuar usado (marca, modelo, año, kilómetros y categoría chico/mediano/grande del usado — el km va en usado_km, NO como filtro de km del stock) y el valor que te devuelve lo pasás como usado_valor a Listar stock — NO lo estimes de tu cabeza, junto con el anticipo como precio_objetivo, tiene_permuta=1 y con_financiacion=1.'
const F_NEW = 'Con los 4, llamás a Listar stock pasándole los datos del usado directo: usado_marca, usado_modelo, usado_anio, usado_km (el km del usado va acá, NO como filtro de km del stock) y usado_categoria (chico/mediano/grande), junto con el anticipo como precio_objetivo, tiene_permuta=1 y con_financiacion=1. Listar stock valúa el usado internamente y arma los tramos — vos NO estimás ni pasás ningún valor.'
unaVez(m, F_OLD, 'prompt (pto 5 financiación)')
m = m.replace(F_OLD, F_NEW)

// (C.2) pto 5 — contado
const C_OLD = 'Si ya tenés los 4 datos del usado (marca, modelo, año, km), llamás a Valuar usado y pasás ese usado_valor con con_financiacion=0: así el camino "entregando tu usado" refleja el valor REAL del usado, no un estirón fijo.'
const C_NEW = 'Si ya tenés los 4 datos del usado (marca, modelo, año, km), se los pasás directo a Listar stock (usado_marca, usado_modelo, usado_anio, usado_km, usado_categoria) con tiene_permuta=1 y con_financiacion=0: Listar stock valúa el usado internamente y el camino "entregando tu usado" (categoria "estirar") refleja el valor REAL, no un estirón fijo.'
unaVez(m, C_OLD, 'prompt (pto 5 contado)')
m = m.replace(C_OLD, C_NEW)

// (C.3) pto 6 — el valor es interno (ahora ni se lo devuelven)
const P6_OLD = 'El valor que te da Valuar usado es INTERNO Y SOLO TUYO: lo usás para saber QUÉ AUTOS ofrecerle, pero NUNCA se lo decís al cliente — ni exacto, ni redondeado, ni "aproximadamente", ni "según el mercado".'
const P6_NEW = 'El valor del usado lo calcula Listar stock internamente y NO te lo devuelve: vos solo ves los autos por categoría/tramo, nunca un monto.'
unaVez(m, P6_OLD, 'prompt (pto 6)')
m = m.replace(P6_OLD, P6_NEW)

franco.parameters.options.systemMessage = m

// ── post-condiciones
const lsq = nodo('Listar stock').parameters.query
assert(!lsq.includes("$fromAI('usado_valor'"), 'quedó una referencia a usado_valor en Listar stock')
assert(lsq.split('usado_val.valor').length - 1 === 5, 'esperaba 5 usos de usado_val.valor')
assert(lsq.includes('WITH usado_val AS (') && lsq.includes('FROM autos_disponibles CROSS JOIN usado_val'), 'no quedó el CTE / cross join')
assert(lsq.includes('valores_usados_referencia') && lsq.includes('power(0.88'), 'no quedó la valuación interna con km_factor')
// fixes previos del SQL sobreviven
assert(lsq.includes('GREATEST(') && lsq.includes('* 0.70 ELSE 0 END)'), 'se perdió el techo estirar (v49)')
assert(lsq.includes("THEN 'estirar'") && lsq.includes('END AS tramo'), 'se rompió categoria/tramo')
assert(lsq.includes("AND NOT (" + TP + " = 1 AND u.categoria = 'fuera')"), 'se perdió el strip de fuera (a2.1)')
assert(lsq.includes("= 0 OR " + TP + " = 1 OR "), 'se perdió el guard de precio_max (a2)')
assert(lsq.includes('NOT EXISTS (SELECT 1 FROM en_presupuesto)'), 'se perdió el fallback de v14')
// prompt
assert(m !== mAntes && m.startsWith('='), 'el prompt no cambió o perdió el =')
assert(!m.includes('llamás a Valuar usado'), 'quedó un "llamás a Valuar usado" en el prompt')
assert(m.includes('Listar stock valúa el usado internamente'), 'no quedó la nueva instrucción de valuación interna')
// fixes previos del prompt sobreviven
assert(m.includes('genial, y cuántos km tiene?'), 'se perdió el pto 3 seco (v48)')
assert(m.includes('arrancás por el ANTICIPO'), 'se perdió el fix de financiación (v47)')
assert(m.includes('le dejo anotado al asesor la simulación'), 'se perdió la Excepción 2 (v52)')
assert(m.includes('decí "tu usado"'), 'se perdió el anti-eco del encabezado (v50/v51)')

// Valuar usado queda intacto (a1a no lo remueve)
assert(nodo('Valuar usado').parameters.query.includes('EXTRACT(YEAR FROM CURRENT_DATE)'), 'se tocó Valuar usado (no debía en a1a)')

// trampa 3 (crítico: las keys usado_* nuevas en Listar stock deben matchear Valuar usado)
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
  for (const k of ['usado_marca', 'usado_modelo', 'usado_anio', 'usado_km', 'usado_categoria']) {
    assert(porKey.has(k), `falta la key ${k} en el workflow`)
  }
  assert(!porKey.has('usado_valor') || true, '') // usado_valor sigue existiendo en Valuar usado (nodo intacto) — OK
}

// ── SIM: estructura (valuación interna == Valuar usado) + techo downstream intacto
{
  // la valuación interna es EXACTAMENTE la de Valuar usado (extraída de ahí) envuelta en el gate
  const gate = `CASE WHEN ${TP} = 1 AND ${ANIO} > 0 THEN ${VALUATION} ELSE 0 END`
  assert(lsq.includes(gate), 'sim: el CTE no contiene la valuación gateada esperada')
  assert(VALUATION === vuq.slice(vStart, vEnd) + ')::bigint', 'sim: la valuación difiere de Valuar usado')

  // downstream: con el valor conocido del Yaris (Valuar usado devolvió 12.406.105), el techo estirar
  // y las categorías son las mismas que a2/a2.1 (la fuente del valor cambió, la aritmética no).
  const usado_valor = 12406105, precio_objetivo = 10000000
  const techoEstirar = Math.max(precio_objetivo * 1.40, precio_objetivo + usado_valor * 0.70)
  assert(Math.round(techoEstirar) === 18684274, `sim: techo estirar inesperado ${techoEstirar}`)
  const cat = (p) => (p <= precio_objetivo * 0.60 ? 'economica' : p <= precio_objetivo ? 'entra' : p <= techoEstirar ? 'estirar' : 'fuera')
  assert(cat(16800000) === 'estirar' && cat(18500000) === 'estirar', 'sim: Cronos/Kangoo deben seguir estirar')
  assert(cat(19800000) === 'fuera', 'sim: EcoSport 19.8M sigue fuera')
  console.log('  SIM: valuación interna == Valuar usado (extraída byte a byte); techo estirar downstream =',
    Math.round(techoEstirar).toLocaleString('es-AR'), '(Cronos/Kangoo estirar)')
}

console.log('✓ todas las aserciones pasan')
console.log('  (A) Listar stock: CTE usado_val computa el valor; usado_valor (key) removido, 5→usado_val.valor')
console.log('  (B) toolDescription: describe usado_marca/modelo/anio/km/categoria')
console.log('  (C) prompt: pto 5 (fin+contado) + pto 6 pasan descriptores directo, sin Valuar usado')
console.log(`  Listar stock query: ${ls.parameters.query.length} chars · prompt: ${mAntes.length} -> ${m.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
