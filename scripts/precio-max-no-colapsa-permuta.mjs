#!/usr/bin/env node
// C-a2: el precio_max espurio NO debe colapsar el abanico de la capacidad/permuta.
// Base: franco-n8n-v52.json. (2026-07-23, sesión C)
//
//   node scripts/precio-max-no-colapsa-permuta.mjs [--check]
//
// EL BUG (log 7351, medido en el baseline de C): con 10M efectivo + Yaris 2020 (contado, sin financiar)
//   la CADENA FUNCIONÓ BIEN — Valuar usado devolvió 12.406.105 y Franco lo pasó como usado_valor a
//   Listar stock (con_financiacion=0, tiene_permuta=1). El techo 'estirar' del SQL (v49) daba
//   GREATEST(10M×1.40=14M, 10M+12.4M×0.70=18.68M)=18.68M, con lo que Cronos (16.8M) y Kangoo (18.5M)
//   caen en 'estirar'. PERO Franco ADEMÁS mandó precio_max=12.500.000 (de su cosecha, anclado en el
//   auto más barato), y ese filtro DURO de `en_presupuesto` los sacó ANTES de categorizar → el abanico
//   colapsó a Etios/Gol/Fiesta. Es la tesis de C en su forma pura: aun con la cadena bien, el ensamblado
//   free-form de params (precio_max) rompe el resultado determinístico.
//
// EL FIX (regla del proyecto: el techo es determinístico, el LLM no lo pisa):
//   En el path capacidad/permuta (tiene_permuta=1 O con_financiacion=1), precio_max NO se aplica: el
//   techo lo fija el SQL (estirar / tramos) a partir de anticipo + usado + financiación. En el path de
//   búsqueda normal (sin permuta ni financiación) precio_max sigue igual (un cliente que dice "no más de
//   X" en una búsqueda simple se respeta).
//   TRADE-OFF (documentado, decisión de Agustina si se quiere afinar): un tope REAL declarado por el
//   cliente DENTRO del path permuta ("tengo 10M + usado pero no quiero pasar de 15M") también se ignora
//   —SQL no puede distinguir un precio_max genuino de uno inventado—. Es raro en la demo y el costo de
//   respetarlo es el colapso de 7351 (subtasar y perder la venta), que es peor.
//
// NO toca: el prompt, el techo estirar (v49), los tramos de financiación, el filtro de 'fuera' (v45),
//   el km_factor (v46), ni el fallback de v14. Cambia UNA cláusula de en_presupuesto.
// Verificación vinculante: sim offline (abajo) + log de Listar stock post-paste (estirar llega a
//   Cronos/Kangoo con usado_valor>0 y SIN que precio_max los tire). ⚠️ PEGA A MANO Agustina.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v52.json')
const OUT = join(ROOT, 'franco-n8n-v53.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => { const x = wf.nodes.find((k) => k.name === n); assert(x, `no existe "${n}"`); return x }

// firmas byte-idénticas (trampa 3) — copiadas del query vivo
const PM = "{{ $fromAI('precio_max', 'Precio maximo en pesos. Poner 0 si no hay techo.', 'number') }}"
const TP = "{{ $fromAI('tiene_permuta', 'Poner 1 si el cliente dijo que entrega un auto usado en parte de pago, 0 si no.', 'number') }}"
const CF = "{{ $fromAI('con_financiacion', 'Poner 1 si el cliente va a financiar, dio un anticipo, o pregunto por cuotas/financiacion. 0 si paga al contado o no lo menciono.', 'number') }}"

// ── Listar stock: precio_max no se aplica en el path capacidad/permuta
{
  const n = nodo('Listar stock')
  let q = n.parameters.query
  const OLD = `AND (${PM} = 0 OR precio_num <= ${PM})`
  const NEW = `AND (${PM} = 0 OR ${TP} = 1 OR ${CF} = 1 OR precio_num <= ${PM})`
  unaVez(q, OLD, 'Listar stock (cláusula precio_max)')
  assert(!q.includes(NEW), 'ya está el guard — ¿ya se aplicó?')
  q = q.replace(OLD, NEW)
  n.parameters.query = q
}

// ── post-condiciones (los fixes previos sobreviven)
const ls = nodo('Listar stock').parameters.query
assert(ls.includes(`AND (${PM} = 0 OR ${TP} = 1 OR ${CF} = 1 OR precio_num <= ${PM})`), 'no quedó el guard de precio_max')
assert(ls.includes('GREATEST(') && ls.includes('* 0.70 ELSE 0 END)'), 'se perdió el techo estirar (v49)')
assert(ls.includes("THEN 'estirar'"), 'se rompió la categoría estirar')
assert(ls.includes('END AS tramo') && ls.includes(') * 2   THEN'), 'se tocó la rama financiación (tramos)')
assert(ls.includes("u.tramo = 'fuera'") && ls.includes('WHERE NOT ('), 'se perdió el filtro de fuera (v45)')
assert(ls.includes('NOT EXISTS (SELECT 1 FROM en_presupuesto)'), 'se perdió el fallback de v14')
assert(nodo('Valuar usado').parameters.query.includes('EXTRACT(YEAR FROM CURRENT_DATE)'), 'se perdió el km_factor (v46)')

// prompt intacto (a2 no lo toca)
const m = nodo('Franco (AI Agent)').parameters.options.systemMessage
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(m.includes('arrancás por el ANTICIPO') || m.includes('anticipo'), 'sanity del prompt')

// trampa 3: toda key $fromAI con firma consistente en TODO el workflow
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

// ── SIM OFFLINE: reproduce el escenario 7351 y prueba viejo (colapsa) vs nuevo (deja pasar)
// Espejo fiel de la lógica de categoria + en_presupuesto para el path contado+permuta.
{
  const stock = [
    { id: 3, t: 'Ford Fiesta 2017', precio: 8200000 },
    { id: 2, t: 'VW Gol Trend 2018', precio: 9200000 },
    { id: 4, t: 'Toyota Etios 2019', precio: 12500000 },
    { id: 1, t: 'Fiat Cronos 2023', precio: 16800000 },
    { id: 17, t: 'Renault Kangoo 2021', precio: 18500000 },
    { id: 9, t: 'Ford EcoSport 2020', precio: 19800000 },
  ]
  const precio_objetivo = 10000000, tiene_permuta = 1, usado_valor = 12406105, con_financiacion = 0
  const precio_max = 12500000 // el que Franco inventó en 7351

  const techoEstirar = Math.max(
    precio_objetivo * (tiene_permuta === 1 ? 1.40 : 1.25),
    (tiene_permuta === 1 && usado_valor > 0) ? precio_objetivo + usado_valor * 0.70 : 0,
  )
  const categoria = (p) => {
    if (precio_objetivo === 0) return 'entra'
    if (p <= precio_objetivo * 0.60) return 'economica'
    if (p <= precio_objetivo) return 'entra'
    if (p <= techoEstirar) return 'estirar'
    return 'fuera'
  }
  // filtro en_presupuesto viejo vs nuevo
  const pasaViejo = (p) => (precio_max === 0 || p <= precio_max)
  const pasaNuevo = (p) => (precio_max === 0 || tiene_permuta === 1 || con_financiacion === 1 || p <= precio_max)

  const estirar = stock.filter((a) => categoria(a.precio) === 'estirar')
  const viejoMuestra = estirar.filter((a) => pasaViejo(a.precio)).map((a) => a.t)
  const nuevoMuestra = estirar.filter((a) => pasaNuevo(a.precio)).map((a) => a.t)

  assert(Math.round(techoEstirar) === 18684274, `techo estirar inesperado: ${techoEstirar}`)
  assert(estirar.some((a) => a.id === 1) && estirar.some((a) => a.id === 17),
    'sim: Cronos y Kangoo deberían ser estirar con el techo 18.68M')
  assert(!viejoMuestra.includes('Fiat Cronos 2023') && !viejoMuestra.includes('Renault Kangoo 2021'),
    'sim: el precio_max viejo (12.5M) DEBERÍA colapsar Cronos/Kangoo (repro 7351)')
  assert(nuevoMuestra.includes('Fiat Cronos 2023') && nuevoMuestra.includes('Renault Kangoo 2021'),
    'sim: el guard nuevo DEBERÍA dejar pasar Cronos/Kangoo')
  assert(!nuevoMuestra.includes('Ford EcoSport 2020'),
    'sim: EcoSport (19.8M) sigue fuera del techo estirar (18.68M) — no es efecto de precio_max')

  console.log('  SIM 7351 (10M + Yaris, contado): techo estirar =', Math.round(techoEstirar).toLocaleString('es-AR'))
  console.log('    estirar viejo (precio_max=12.5M):', viejoMuestra.join(', ') || '—')
  console.log('    estirar nuevo (guard)         :', nuevoMuestra.join(', '))
}

console.log('✓ todas las aserciones pasan')
console.log('  Listar stock: precio_max no se aplica cuando tiene_permuta=1 OR con_financiacion=1')

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
