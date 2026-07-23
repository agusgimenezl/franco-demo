#!/usr/bin/env node
// v42: capacidad de compra con TOMA DEL USADO AL 70% + gate de datos obligatorios. (2026-07-23)
// Criterio comercial de Agustina. Base: franco-n8n-v41.json.
//
//   node scripts/capacidad-toma-70.mjs [--check]
//
// QUÉ CAMBIA (escenario CON FINANCIACIÓN; el contado y la purga global de "efectivo" van a v43):
//   (A) SQL Listar stock: parámetro `usado_valor` (estimación de Franco). El tramo pasa a
//       calcularse sobre el Capital Base = anticipo + usado_valor*0.70, con techo = Capital Base*2
//       (financiando hasta 50%). Bandas: entrada <=CB*1.2, intermedio <=CB*1.5, alto <=techo,
//       fuera > techo. Reemplaza el viejo capacidad = anticipo*(4/2).
//   (B) Prompt pto 5 (rama financiación): gate DURO de 4 datos del usado (marca/modelo/año/KM);
//       si falta uno, se pide, no se muestra nada. Franco estima el valor y lo pasa como
//       usado_valor. Muestra 2 por tramo (entrada/intermedio/alto), carrocerías distintas.
//       Lenguaje "anticipo"/"capital inicial" (no "efectivo") EN EL TEXTO NUEVO. Deslinde legal.
//   (C) Prompt pto 6: deja de prohibir estimar el usado (lo necesita para el abanico); ahora
//       aclara que la estimación es preliminar y no se afirma como valor cerrado.
//
// NO SE TOCA en v42 (deuda anotada, va a v43): la rama "SI PAGA AL CONTADO" (sigue con dos
// caminos), el gate de v16, y las ~6 menciones de "efectivo" fuera del pto 5.
// ⚠️ PEGA A MANO Agustina + verificación byte a byte por MCP.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v41.json')
const OUT = join(ROOT, 'franco-n8n-v42.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => { const x = wf.nodes.find((k) => k.name === n); assert(x, `no existe "${n}"`); return x }

// Firmas byte-idénticas a las de la query (trampa 3).
const OBJ = "{{ $fromAI('precio_objetivo', 'El techo de presupuesto real del cliente en pesos, sin estirar. Poner 0 si no dio presupuesto.', 'number') }}"
const PERM = "{{ $fromAI('tiene_permuta', 'Poner 1 si el cliente dijo que entrega un auto usado en parte de pago, 0 si no.', 'number') }}"
const FIN = "{{ $fromAI('con_financiacion', 'Poner 1 si el cliente va a financiar, dio un anticipo, o pregunto por cuotas/financiacion. 0 si paga al contado o no lo menciono.', 'number') }}"
const USADO = "{{ $fromAI('usado_valor', 'Tu estimacion del valor de mercado actual del usado que entrega el cliente, en pesos (ej: 7500000). Poner 0 si no hay usado o todavia no sabes marca, modelo, anio y km.', 'number') }}"

// ══════════════════ (A) SQL: reemplazar el tramo de v40/v41 por el del Capital Base
{
  const n = nodo('Listar stock')
  let q = n.parameters.query
  assert(q.includes('END AS tramo'), 'no hay tramo — ¿base equivocada?')
  assert(!q.includes('usado_valor'), 'usado_valor ya existe — ¿ya se aplicó?')

  const CAP_VIEJO = `(${OBJ} * (CASE WHEN ${PERM} = 1 THEN 4 ELSE 2 END))`
  const OLD_TRAMO =
    "    CASE\n" +
    `      WHEN ${FIN} = 1 AND ${OBJ} > 0 THEN\n` +
    "        CASE\n" +
    `          WHEN (metadata->>'precio')::int <= ${CAP_VIEJO} * 0.60 THEN 'entrada'\n` +
    `          WHEN (metadata->>'precio')::int <= ${CAP_VIEJO} * 0.80 THEN 'intermedio'\n` +
    `          WHEN (metadata->>'precio')::int <= ${CAP_VIEJO}        THEN 'techo'\n` +
    "          ELSE 'fuera'\n" +
    "        END\n" +
    "      ELSE 'n/a'\n" +
    "    END AS tramo,\n"

  const CB = `(${OBJ} + ${USADO} * 0.70)`
  const NEW_TRAMO =
    "    CASE\n" +
    `      WHEN ${FIN} = 1 AND ${OBJ} > 0 THEN\n` +
    "        CASE\n" +
    `          WHEN (metadata->>'precio')::int > ${CB} * 2   THEN 'fuera'\n` +
    `          WHEN (metadata->>'precio')::int <= ${CB} * 1.2 THEN 'entrada'\n` +
    `          WHEN (metadata->>'precio')::int <= ${CB} * 1.5 THEN 'intermedio'\n` +
    "          ELSE 'alto'\n" +
    "        END\n" +
    "      ELSE 'n/a'\n" +
    "    END AS tramo,\n"

  unaVez(q, OLD_TRAMO, 'Listar stock (bloque tramo)')
  q = q.replace(OLD_TRAMO, NEW_TRAMO)
  n.parameters.query = q

  // toolDescription
  let td = n.parameters.toolDescription
  const ANCLA_TD = 'Mostrá 2 por tramo; los tramo=fuera no se muestran.'
  unaVez(td, ANCLA_TD, 'Listar stock (toolDescription)')
  n.parameters.toolDescription = td.replace(
    ANCLA_TD,
    'Pasá tambien usado_valor (tu estimacion del valor de mercado del usado, 0 si no hay): el tramo se ' +
      'calcula sobre el Capital Base = anticipo + usado_valor*0.70, con techo al doble por la financiacion. ' +
      'Mostrá 2 por tramo (entrada/intermedio/alto); los tramo=fuera no se muestran.',
  )
}

// ══════════════════ (B)+(C) prompt
const franco = nodo('Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(m.includes('CAPACIDAD DE COMPRA REAL'), 'no encuentro el pto 5 de v40/v41 — ¿base equivocada?')
const EXPR_ANTES = (m.match(/\{\{/g) || []).length

// (B) intro (144) + rama financiación (145)
const OLD_144_145 =
  '   Presentá su CAPACIDAD DE COMPRA REAL, que se arma con TRES cosas y NO es solo el efectivo: (a) el anticipo en efectivo, (b) el valor de su usado —que tasa el asesor—, y (c) la financiación de hasta el 50% del auto. Por eso el efectivo NO es el techo: mostrarle un solo auto o arrancar por el más barato del stock es el error que hace perder la venta.\n' +
  '   · SI VA A FINANCIAR (habló de anticipo, de cuotas, de financiar, o preguntó por eso): pasás con_financiacion=1 y tiene_permuta=1. La herramienta te devuelve cada auto con un "tramo": "entrada", "intermedio" o "techo". Armás la respuesta con un encabezado que explica la capacidad ("teniendo en cuenta tu anticipo, el valor de tu usado que tasamos en la agencia y la posibilidad de financiar hasta el 50%, tenés un abanico amplio") y después DOS autos por cada tramo, de marcas o segmentos distintos (no dos iguales), eligiendo dentro de cada tramo los MEJORES —más nuevos o de menos km—, no los más baratos a secas: entrada (se paga casi solo con tu efectivo y tu usado), intermedio (con una financiación moderada) y techo (aprovechando hasta el 50% financiado). Los "tramo"="fuera" NO se muestran: se van de su alcance. Cerrás invitando a elegir un camino y a que un asesor haga la tasación oficial y arme el plan a medida.'

const NEW_144_145 =
  '   Presentá su CAPACIDAD DE COMPRA REAL. Se arma con: (a) el ANTICIPO o capital inicial (la plata que pone; deciles siempre "anticipo" o "capital inicial", NUNCA "efectivo"), (b) el valor de su usado tomado al 70% —una estimación preliminar—, y (c) la financiación de hasta el 50% del auto. Por eso el anticipo NO es el techo, y mostrarle un solo auto o el más barato del stock es el error que hace perder la venta.\n' +
  '   · SI VA A FINANCIAR (habló de anticipo, de cuotas, de financiar, o preguntó por eso): para armar el abanico necesitás SÍ O SÍ los 4 datos del usado — marca, modelo, año Y kilómetros. Si falta cualquiera, NO muestres stock ni calcules nada: pedí el que falte (uno por turno) y recién con los 4 seguís. Con los 4, estimás vos un valor de mercado preliminar del usado y lo pasás como usado_valor, junto con el anticipo como precio_objetivo, tiene_permuta=1 y con_financiacion=1. La herramienta calcula el Capital Base (anticipo + usado al 70%), lo duplica por la financiación (techo hasta 50% financiado) y te devuelve cada auto con un "tramo": "entrada", "intermedio", "alto" o "fuera". Mostrás DOS autos por cada tramo (entrada, intermedio, alto), de CARROCERÍAS distintas (hatchback, sedán, SUV), eligiendo los mejores de cada uno; los "tramo"="fuera" NO se muestran. Encabezás explicando la capacidad sin prometer nada ("teniendo en cuenta tu anticipo, una estimación preliminar de tu usado y la posibilidad de financiar hasta el 50%, tenés este abanico"). DESLINDE obligatorio: la estimación del usado es preliminar y de referencia; la tasación final y definitiva la hace un asesor en la inspección física en la agencia. Cerrás invitando a elegir y a que el asesor coordine la tasación oficial.'

unaVez(m, OLD_144_145, 'prompt (intro + rama financiación del pto 5)')
m = m.replace(OLD_144_145, NEW_144_145)

// (C) pto 6: deja de prohibir estimar
const OLD_6 = '6. NUNCA estimes vos el valor del usado ni prometas que "con eso te alcanza seguro": eso lo confirma el asesor al tasar.'
const NEW_6 = '6. La estimación preliminar del usado la usás para armar el abanico (usado_valor), pero NO se la afirmás al cliente como un valor cerrado ni prometas que "con eso te alcanza seguro": aclarás que es preliminar y de referencia, y que la tasación real la hace el asesor al inspeccionar el auto.'
unaVez(m, OLD_6, 'prompt (pto 6)')
m = m.replace(OLD_6, NEW_6)

franco.parameters.options.systemMessage = m

// ══════════════════ post-condiciones
assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES, 'cambió el número de expresiones {{ }} (no debía)')
assert((m.match(/Capital Base/g) || []).length === 1, 'Capital Base ausente o duplicado en el prompt')
assert(m.includes('tomado al 70%'), 'falta la toma al 70%')
assert(m.includes('usado_valor'), 'el prompt no menciona usado_valor')
assert(m.includes('DESLINDE obligatorio'), 'falta el deslinde legal')
assert(!m.includes('NUNCA estimes vos el valor del usado'), 'quedó la prohibición vieja de estimar (pto 6)')
assert(m.includes('SI PAGA AL CONTADO'), 'se perdió la rama de contado (no se debía tocar)')
assert((m.match(/ANTES DE MOSTRAR NADA/g) || []).length === 1, 'se perdió el guard de v41')

for (const [marca, versión] of [
  ['TRATO:', 'v15'], ['SIN PRESUPUESTO DECLARADO', 'v16'], ['LA DERIVACIÓN MANDA', 'v23'],
  ['UNA PREGUNTA POR TURNO', 'v25'], ['ASESOR EN MARCHA', 'v38'], ['NO presentes el abanico de tramos', 'v41'],
]) {
  const c = (m.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  assert(c === 1, `problema con la regla de ${versión}: "${marca}" aparece ${c} veces`)
}

// SQL: tramo nuevo, con Capital Base
const ls = nodo('Listar stock').parameters.query
assert(ls.includes("* 0.70") && ls.includes("'alto'"), 'no quedó el tramo por Capital Base')
assert(!ls.includes('THEN 4 ELSE 2 END'), 'quedó el multiplicador viejo (4/2)')
assert(ls.includes('con_financiacion') && ls.includes('usado_valor'), 'faltan params en la query')

// Trampa 3
const porKey = new Map()
for (const n of wf.nodes) {
  for (const mm of String(n.parameters?.query ?? '').matchAll(/\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g)) {
    const [, key, desc, tipo] = mm
    const firma = `${desc}||${tipo}`
    if (porKey.has(key)) assert(porKey.get(key) === firma, `trampa 3: la key '${key}' tiene firmas distintas`)
    else porKey.set(key, firma)
  }
}
assert(porKey.has('usado_valor'), 'usado_valor no quedó registrada')

console.log('✓ todas las aserciones pasan')
console.log('  (A) SQL: usado_valor + tramo sobre Capital Base (anticipo + usado*0.70), techo x2')
console.log('  (B) pto 5: gate de 4 datos (incluye km), Franco estima el usado, 2 por tramo, deslinde, "anticipo"')
console.log('  (C) pto 6: deja de prohibir estimar el usado')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars · expresiones ${EXPR_ANTES} (sin cambio)`)
console.log(`  trampa 3: ${porKey.size} keys $fromAI`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
