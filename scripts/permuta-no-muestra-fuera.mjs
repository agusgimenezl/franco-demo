#!/usr/bin/env node
// C-a2.1: en el path permuta (contado), NO exponer las filas categoria='fuera'.
// Base: franco-n8n-v53.json. (2026-07-23, sesión C — completa a2)
//
//   node scripts/permuta-no-muestra-fuera.mjs [--check]
//
// EL BUG (efecto colateral de a2, medido en run4 del c-a2-medicion): a2 dejó de aplicar precio_max en el
//   path capacidad/permuta, así que Listar stock ahora devuelve TODO el stock, incluidas las 12 filas
//   categoria='fuera' (>techo estirar). En contado esas NO se strippean (solo financiación strippea
//   tramo='fuera', v45). Resultado: con 10M + Yaris (capacidad ~18.68M) Franco ofreció Renegade $25.5M,
//   Corolla $24.8M y Duster $22.5M como "gama estirar" → overshoot, la misma clase que el $38M que v45
//   blindó en financiación, ahora reintroducida en contado. Antes de a2, precio_max las escondía cuando
//   Franco lo seteaba; a2 lo hizo consistente y por eso el overshoot se ve seguido.
//
// EL FIX (regla del proyecto: el techo es determinístico, el LLM no muestra lo que no entra):
//   El techo 'estirar' YA define qué entra. Strippear categoria='fuera' cuando tiene_permuta=1, espejo
//   EXACTO del strip de financiación (tramo='fuera'). Franco no ve las inaccesibles → no las puede ofrecer.
//   Completa a2: el techo estirar es el cap, el LLM no lo achica (a2) NI lo excede (a2.1).
//
// NO toca: el prompt, el techo estirar (v49), los tramos, el guard de precio_max (a2/v53), el km_factor.
//   Cambia UNA cláusula del WHERE final.
// ⚠️ Trampa 4 (≥1 fila): mismo perfil de riesgo que el strip de financiación que ya vive desde v45 (si
//   TODO cae 'fuera' quedaría 0 filas). En permuta real siempre hay 'entra' (Gol/Fiesta 8-9M son el piso)
//   → riesgo despreciable, y no agrego un patrón nuevo: replico el que ya está probado.
// Verificación vinculante: sim offline (abajo) + log post-paste (permuta ya no trae filas 'fuera').

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v53.json')
const OUT = join(ROOT, 'franco-n8n-v54.json')
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
const CF = "{{ $fromAI('con_financiacion', 'Poner 1 si el cliente va a financiar, dio un anticipo, o pregunto por cuotas/financiacion. 0 si paga al contado o no lo menciono.', 'number') }}"
const PM = "{{ $fromAI('precio_max', 'Precio maximo en pesos. Poner 0 si no hay techo.', 'number') }}"

// ── Listar stock: strippear categoria='fuera' en el path permuta
{
  const n = nodo('Listar stock')
  let q = n.parameters.query
  const OLD = `WHERE NOT (${CF} = 1 AND u.tramo = 'fuera')`
  const NEW = `WHERE NOT (${CF} = 1 AND u.tramo = 'fuera')\n  AND NOT (${TP} = 1 AND u.categoria = 'fuera')`
  unaVez(q, OLD, 'Listar stock (WHERE final)')
  assert(!q.includes("u.categoria = 'fuera'"), 'ya está el strip de categoria fuera — ¿ya se aplicó?')
  q = q.replace(OLD, NEW)
  n.parameters.query = q
}

// ── post-condiciones (los fixes previos sobreviven)
const ls = nodo('Listar stock').parameters.query
assert(ls.includes(`AND NOT (${TP} = 1 AND u.categoria = 'fuera')`), 'no quedó el strip de categoria fuera')
assert(ls.includes(`WHERE NOT (${CF} = 1 AND u.tramo = 'fuera')`), 'se perdió el strip de financiación (v45)')
assert(ls.includes(`AND (${PM} = 0 OR ${TP} = 1 OR ${CF} = 1 OR precio_num <= ${PM})`), 'se perdió el guard de precio_max (a2/v53)')
assert(ls.includes('GREATEST(') && ls.includes('* 0.70 ELSE 0 END)'), 'se perdió el techo estirar (v49)')
assert(ls.includes("THEN 'estirar'"), 'se rompió la categoría estirar')
assert(ls.includes('NOT EXISTS (SELECT 1 FROM en_presupuesto)'), 'se perdió el fallback de v14')
assert(nodo('Valuar usado').parameters.query.includes('EXTRACT(YEAR FROM CURRENT_DATE)'), 'se perdió el km_factor (v46)')
const m = nodo('Franco (AI Agent)').parameters.options.systemMessage
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')

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

// ── SIM OFFLINE: escenario run4 (10M + Yaris, contado) — el strip saca las 'fuera', deja estirar/entra
{
  const stock = [
    { id: 3, t: 'Ford Fiesta 2017', precio: 8200000 },
    { id: 2, t: 'VW Gol Trend 2018', precio: 9200000 },
    { id: 4, t: 'Toyota Etios 2019', precio: 12500000 },
    { id: 1, t: 'Fiat Cronos 2023', precio: 16800000 },
    { id: 17, t: 'Renault Kangoo 2021', precio: 18500000 },
    { id: 9, t: 'Ford EcoSport 2020', precio: 19800000 },
    { id: 11, t: 'Renault Duster 2023', precio: 22500000 },
    { id: 5, t: 'Toyota Corolla 2022', precio: 24800000 },
    { id: 12, t: 'Jeep Renegade 2021', precio: 25500000 },
  ]
  const precio_objetivo = 10000000, tiene_permuta = 1, usado_valor = 12406105
  const techoEstirar = Math.max(precio_objetivo * 1.40, precio_objetivo + usado_valor * 0.70)
  const categoria = (p) => {
    if (p <= precio_objetivo * 0.60) return 'economica'
    if (p <= precio_objetivo) return 'entra'
    if (p <= techoEstirar) return 'estirar'
    return 'fuera'
  }
  const conCat = stock.map((a) => ({ ...a, c: categoria(a.precio) }))
  const antes = conCat.map((a) => a.t) // sin strip: se ven todas
  const despues = conCat.filter((a) => !(tiene_permuta === 1 && a.c === 'fuera')).map((a) => a.t)

  const overshoot = ['Renault Duster 2023', 'Toyota Corolla 2022', 'Jeep Renegade 2021']
  assert(overshoot.every((t) => antes.includes(t)), 'sim: sin strip las fuera deberían estar (repro run4)')
  assert(overshoot.every((t) => !despues.includes(t)), 'sim: el strip DEBE sacar Renegade/Corolla/Duster')
  assert(['Fiat Cronos 2023', 'Renault Kangoo 2021', 'Toyota Etios 2019'].every((t) => despues.includes(t)),
    'sim: estirar (Cronos/Kangoo/Etios) DEBE sobrevivir')
  assert(['VW Gol Trend 2018', 'Ford Fiesta 2017'].every((t) => despues.includes(t)), 'sim: entra debe sobrevivir')
  assert(despues.length >= 1, 'sim: trampa 4 — quedó ≥1 fila')

  console.log('  SIM run4 (10M + Yaris, contado): techo estirar =', Math.round(techoEstirar).toLocaleString('es-AR'))
  console.log('    antes (sin strip):', antes.length, 'filas — incluye', overshoot.join(', '))
  console.log('    después (strip)  :', despues.join(', '))
}

console.log('✓ todas las aserciones pasan')
console.log("  Listar stock: strippea categoria='fuera' cuando tiene_permuta=1 (espejo del strip de financiación)")

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
