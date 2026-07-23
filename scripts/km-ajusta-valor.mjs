#!/usr/bin/env node
// v46: "el 2" — el km del usado AJUSTA el valor de mercado (Valuar usado), así el gate del km
// tiene sentido (hoy Franco lo saltea porque el km no cambia nada). Base: franco-n8n-v45.json. (2026-07-23)
//
//   node scripts/km-ajusta-valor.mjs [--check]
//
// EL PROBLEMA (STATE, backlog "el 2"): la valuación era valor = base_2020 * 0.93^(edad); el km NO
//   entraba. El gate ("pedí el km antes de mostrar") quedaba sin razón computacional y gpt-4.1-mini lo
//   salteaba (reforzarlo por prompt fue whack-a-mole). Log 6897 (v45): Ka 2015 con 250k km → Valuar usado
//   devolvió 8.83M (km ignorado) → Listar stock devolvió Corolla/Renegade en tramo 'alto'. Con el km real
//   ese usado vale menos y esos autos deberían caer.
//
// EL FIX (regla del proyecto: lo determinístico va al SQL):
//   (A) Valuar usado: multiplica el valor por un km_factor. El km se compara con el km ESPERADO para la
//       edad (15.000/año). Por encima del esperado, castiga (clamp 0.65..1.0); por debajo o igual, neutral
//       (1.0, PENALIZA el exceso, no premia). Con km=0 (Franco no lo pidió) → factor 1.0 → degrada a v45
//       exacto (no rompe nada si el gate leakea). Param nuevo usado_km.
//   (B) prompt pto 5: (1) corrige la frase que le sacaba sentido al gate ("aunque no cambie el cálculo del
//       valor" era FALSO ahora → el km SÍ cambia el valor); (2) agrega usado_km a la llamada de Valuar usado
//       y aclara que el km del usado NO es un filtro de stock (en el log Franco lo mandaba como km_max).
//
// VERIFICACIÓN VINCULANTE (el chat-text NO discrimina, la presentación floja de Franco confunde):
//   - sim offline: scratchpad/sim-km-valor.mjs (misma fórmula) — Ka 2015 250k → valor ~7.1M, techo ~24M,
//     Corolla/Renegade FUERA (los filtra el WHERE de v45).
//   - post-paste: correr eval capacidad-km-alto-achica y LEER el output de Listar stock en el log
//     (get_execution): Corolla/Renegade NO deben venir (en v45 vienen en 'alto').
// NO toca Listar stock (el filtro de 'fuera' de v45 hace el trabajo) ni Buscar auto ni los demás flujos.
// ⚠️ PEGA A MANO Agustina + verificación byte a byte por MCP.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v45.json')
const OUT = join(ROOT, 'franco-n8n-v46.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => { const x = wf.nodes.find((k) => k.name === n); assert(x, `no existe "${n}"`); return x }

// firmas byte-idénticas (trampa 3)
const ANIO = "{{ $fromAI('usado_anio', 'El anio del auto usado que entrega el cliente (ej: 2015).', 'number') }}"
const KM = "{{ $fromAI('usado_km', 'Los kilometros del auto usado que entrega el cliente (ej: 100000). Poner 0 si no los sabes.', 'number') }}"

// ── (A) Valuar usado: multiplicar el valor por el km_factor
{
  const n = nodo('Valuar usado')
  let q = n.parameters.query
  assert(q.includes('valor_ref_2020'), 'Valuar usado sin valor_ref_2020 — ¿base equivocada?')
  assert(!q.includes('usado_km'), 'usado_km ya está — ¿ya se aplicó?')
  const OLD_Q = `* power(0.93, GREATEST(LEAST(2020 - ${ANIO}, 20), -5))`
  unaVez(q, OLD_Q, 'Valuar usado (age_factor)')
  // km_esperado = 15.000 * (año_actual - año); por encima castiga (0.88 por cada 50.000 km de exceso),
  // piso 0.65, techo 1.0 (no premia el bajo km). km<=0 -> neutral (1) -> degrada a v45.
  const KM_FACTOR =
    `* (CASE WHEN ${KM} <= 0 THEN 1 ` +
    `ELSE LEAST(1, GREATEST(0.65, power(0.88, (${KM} - 15000 * GREATEST(EXTRACT(YEAR FROM CURRENT_DATE)::int - ${ANIO}, 0)) / 50000.0))) END)`
  q = q.replace(OLD_Q, `${OLD_Q}\n      ${KM_FACTOR}`)
  n.parameters.query = q

  // toolDescription: sumar usado_km
  let td = n.parameters.toolDescription
  const OLD_TD = 'Pasale usado_marca, usado_modelo, usado_anio y usado_categoria (chico/mediano/grande).'
  const NEW_TD = 'Pasale usado_marca, usado_modelo, usado_anio, usado_km (los kilometros del usado) y usado_categoria (chico/mediano/grande). Mas kilometros que el promedio para la edad bajan el valor.'
  unaVez(td, OLD_TD, 'Valuar usado (toolDescription)')
  n.parameters.toolDescription = td.replace(OLD_TD, NEW_TD)
}

// ── (B) prompt pto 5
const franco = nodo('Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
const EXPR_ANTES = (m.match(/\{\{/g) || []).length

// (B1) la frase que le sacaba sentido al gate ahora es falsa: el km SÍ cambia el valor
const OLD_KM = 'EL KILOMETRAJE ES OBLIGATORIO aunque no cambie el cálculo del valor:'
const NEW_KM = 'EL KILOMETRAJE ES OBLIGATORIO y ahora SÍ cambia la valuación del usado (más kilómetros que el promedio para su edad = menos valor = menos capacidad):'
unaVez(m, OLD_KM, 'prompt (razón del gate del km)')
m = m.replace(OLD_KM, NEW_KM)

// (B2) sumar usado_km a la llamada y aclarar que el km del usado NO es filtro de stock (log: km_max)
const OLD_CALL = 'Con los 4, llamás a Valuar usado (marca, modelo, año y categoría chico/mediano/grande del usado) y el valor que te devuelve lo pasás como usado_valor a Listar stock —'
const NEW_CALL = 'Con los 4, llamás a Valuar usado (marca, modelo, año, kilómetros y categoría chico/mediano/grande del usado — el km va en usado_km, NO como filtro de km del stock) y el valor que te devuelve lo pasás como usado_valor a Listar stock —'
unaVez(m, OLD_CALL, 'prompt (llamada a Valuar usado)')
m = m.replace(OLD_CALL, NEW_CALL)

franco.parameters.options.systemMessage = m

// ── post-condiciones
assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES, 'cambió el número de expresiones {{ }} del prompt (no debía)')
assert(m.includes('ahora SÍ cambia la valuación del usado'), 'no quedó la razón del gate')
assert(!m.includes('aunque no cambie el cálculo del valor'), 'quedó la frase vieja que le sacaba sentido al gate')
assert(m.includes('el km va en usado_km, NO como filtro de km del stock'), 'no quedó la aclaración de usado_km')

// Valuar usado
const vq = nodo('Valuar usado').parameters.query
assert((vq.match(/usado_km/g) || []).length === 2, `usado_km debe aparecer 2 veces en la query, hay ${(vq.match(/usado_km/g) || []).length}`)
assert(vq.includes('EXTRACT(YEAR FROM CURRENT_DATE)'), 'no quedó el km_esperado')
assert(vq.includes('LEAST(1, GREATEST(0.65'), 'no quedó el clamp del km_factor')
assert(vq.includes('valor_ref_2020') && vq.includes('metodo'), 'se rompió Valuar usado')
assert(nodo('Valuar usado').parameters.toolDescription.includes('usado_km'), 'toolDescription sin usado_km')

// Listar stock intacto (el filtro de 'fuera' de v45 tiene que seguir)
const ls = nodo('Listar stock').parameters.query
assert(ls.includes("u.tramo = 'fuera'") && ls.includes('WHERE NOT ('), 'se perdió el filtro de fuera de v45')
assert(ls.includes('END AS tramo') && ls.includes('* 0.70'), 'se tocó Listar stock (no debía)')
assert(ls.includes('NOT EXISTS (SELECT 1 FROM en_presupuesto)'), 'se perdió el fallback de v14')
// fixes de prompt de v45 sobreviven
assert(m.includes('NUNCA lo ofrecés vos'), 'se perdió el fix del WhatsApp (v45)')
assert(m.includes('interesado en UN AUTO PUNTUAL'), 'se perdió el scope del abanico (v45)')
assert(m.includes('DESLINDE obligatorio'), 'se perdió el deslinde (v42)')
// Buscar auto intacto
assert(nodo('Buscar auto').parameters.query.includes("metadata->>'color' ILIKE"), 'se tocó Buscar auto (no debía)')

// trampa 3 sobre todo el workflow
const porKey = new Map()
for (const nn of wf.nodes) {
  for (const mm of String(nn.parameters?.query ?? '').matchAll(/\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g)) {
    const [, key, desc, tipo] = mm
    const firma = `${desc}||${tipo}`
    if (porKey.has(key)) assert(porKey.get(key) === firma, `trampa 3: la key '${key}' tiene firmas distintas`)
    else porKey.set(key, firma)
  }
}
assert(porKey.has('usado_km'), 'usado_km no quedó registrada como $fromAI')

console.log('✓ todas las aserciones pasan')
console.log('  (A) Valuar usado: el km ajusta el valor (km_factor, clamp 0.65..1.0, penaliza el exceso) + param usado_km')
console.log('  (B) prompt: el km ahora cambia el valor (razón del gate) + usado_km en la llamada (no km_max)')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars · trampa 3: ${porKey.size} keys $fromAI`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
