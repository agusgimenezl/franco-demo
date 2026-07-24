#!/usr/bin/env node
// BUG-embudo: interés puntual (uno o varios modelos) + permuta + SIN presupuesto declarado → Franco NO debe
// tirar un abanico de otros autos ni inventar efectivo/anticipo/contado. Debe ofrecer el embudo: asesor para
// la tasación O ver más opciones (y si ver más, pedir presupuesto o full stock).
// Base: franco-n8n-v57.json. (2026-07-24)
//
//   node scripts/embudo-interes-puntual-sin-presupuesto.mjs [--check]
//
// EL BUG (captura Agustina + repro `permuta-interes-puntual-sin-presupuesto`, 3/3, log 7548): cliente busca
//   VW, interesado en T-Cross y Amarok, ofrece permuta, NO da presupuesto. Tras juntar los datos del usado,
//   Franco llama a Listar stock con precio_objetivo=0, tiene_permuta=1 → la query etiqueta TODO el catálogo
//   como 'entra' → Franco dumpea 17 autos (Ranger $57M, S10, Hilux…) a quien quería una T-Cross. Dos caras:
//   contado (precio_objetivo=0 → all 'entra') y financiación (inventa un anticipo → tramos). Mismo root:
//   sin presupuesto, Franco se fabrica un camino y dumpea.
//
// POR QUÉ LAS REGLAS ACTUALES NO AGUANTAN: (1) "auto puntual" era singular (el cliente nombró DOS modelos);
//   (2) el guion rico de la CAPACIDAD (## Permuta pto 5, "Presentá su CAPACIDAD DE COMPRA REAL…") le gana a
//   las reglas de arriba (trampa 6: el ejemplo concreto le gana a la regla abstracta).
//
// EL FIX (trampa 6: se REEMPLAZA el guion + se GATEA el abanico):
//   (A) El gate del abanico pasa a ser DURO y explícito: corre SOLO si (a) pidió opciones EN GENERAL y
//       (b) declaró presupuesto/anticipo. Interés puntual = uno o VARIOS modelos → embudo, NO abanico.
//       Guion concreto del embudo (asesor O ver-más; ver-más → presupuesto o full stock) + anti-dump
//       explícito ("NO llamás a Listar stock", como ya hace el punto 2 con el usado desconocido).
//   (B) La narrativa de CAPACIDAD arranca condicionada ("SOLO si … presupuesto … NO esto").
// NO toca: name-ask gate, ramas financiación/contado (solo se gatean), colapso a1a, anti-eco, etc.
// ⚠️ Riesgo: roza flujos de permuta ganados → correr controles. PEGA A MANO Agustina.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v57.json')
const OUT = join(ROOT, 'franco-n8n-v58.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no existe Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
const EXPR = (m.match(/\{\{/g) || []).length

// ── (A) gate del abanico + guion del embudo
const A_OLD = 'Este punto (el abanico) corre SOLO cuando el cliente pide ver opciones EN GENERAL, sin un auto puntual ya elegido. Si el cliente vino interesado en UN AUTO PUNTUAL (te preguntó por ese modelo) y te ofrece su usado como parte de pago, NO le tires el abanico de otros modelos —y JAMÁS autos más caros o de otra categoría que no pidió (una pickup a quien mira un hatchback)—: reconocé la permuta sobre ESE auto y ofrecé UNA de dos, que un asesor coordine la tasación, o mostrarle modelos PARECIDOS al que le gustó si quiere ver más.'
const A_NEW = 'Este punto (el abanico de capacidad) corre SOLO si se cumplen DOS cosas a la vez: (a) el cliente pidió ver opciones EN GENERAL —no vino por autos puntuales— Y (b) declaró un presupuesto o anticipo. Si falta cualquiera de las dos, NO armás abanico, NO llamás a Listar stock para listar opciones y NUNCA inventás un efectivo/anticipo/contado que no te dieron: pasar precio_objetivo=0 devuelve TODO el catálogo etiquetado "entra" y termina en un dump de pickups de $50M a quien no las pidió, el peor error de la demo. INTERÉS PUNTUAL (el cliente nombró uno o VARIOS modelos concretos —"me interesa la T-Cross y la Amarok"— o figura en vehiculo_interes de "Lo que ya sabés de este cliente") + permuta: NO le tires un abanico de otros modelos, y JAMÁS autos más caros o de otra categoría que no pidió (una pickup a quien mira un hatchback). Cuando ya tenés los datos del usado, reconocés la permuta sobre lo que le interesa y ofrecés UNA de dos, en UNA sola pregunta: "querés que te conecte con un asesor para la tasación de tu vehículo, o preferís ver más opciones en stock?". Si elige el ASESOR: pedís su nombre y apellido y cerrás ofreciéndote a resolver otras dudas. Si elige VER MÁS: preguntás "tenés un presupuesto en mente para acercarte opciones, o preferís que te pase todo el stock?", y recién con esa respuesta mostrás (te da un presupuesto: el abanico de abajo; quiere ver todo: el stock completo). Nunca saltees directo al abanico ni le muestres autos que no pidió.'
unaVez(m, A_OLD, 'prompt (gate del abanico / auto puntual)')
m = m.replace(A_OLD, A_NEW)

// ── (B) la narrativa de CAPACIDAD arranca condicionada
const B_OLD = 'Presentá su CAPACIDAD DE COMPRA REAL. Se arma con:'
const B_NEW = 'SOLO si el cliente pidió opciones EN GENERAL Y declaró un anticipo/presupuesto (si vino por autos puntuales o no dio presupuesto, seguí el embudo de arriba, NO esto), presentás su CAPACIDAD DE COMPRA REAL. Se arma con:'
unaVez(m, B_OLD, 'prompt (narrativa capacidad)')
m = m.replace(B_OLD, B_NEW)

franco.parameters.options.systemMessage = m

// ── post-condiciones
assert(m !== mAntes && m.startsWith('='), 'el prompt no cambió o perdió el =')
assert((m.match(/\{\{/g) || []).length === EXPR, 'cambió el número de expresiones {{ }} (no debía)')
assert(m.includes('querés que te conecte con un asesor para la tasación de tu vehículo, o preferís ver más opciones en stock?'), 'no quedó el guion del embudo')
assert(m.includes('tenés un presupuesto en mente para acercarte opciones, o preferís que te pase todo el stock?'), 'no quedó el sub-paso ver-más')
assert(m.includes('NO llamás a Listar stock para listar opciones'), 'no quedó el anti-dump')
assert(m.includes('uno o VARIOS modelos concretos'), 'no quedó la generalización a varios modelos')
assert(!m.includes('Si el cliente vino interesado en UN AUTO PUNTUAL (te preguntó por ese modelo)'), 'quedó el guion viejo de auto puntual')
assert(m.includes('SOLO si el cliente pidió opciones EN GENERAL Y declaró un anticipo/presupuesto'), 'no quedó el gate de la capacidad')
// fixes previos del prompt sobreviven
assert(m.includes('andá directo a pedir el nombre'), 'se perdió el name-ask gate')
assert(m.includes('Listar stock valúa el usado internamente y arma los tramos'), 'se perdió el colapso a1a (financiación)')
assert(m.includes('Listar stock valúa el usado internamente y el camino "entregando tu usado"'), 'se perdió el colapso a1a (contado)')
assert(m.includes('genial, y cuántos km tiene?'), 'se perdió el pto 3 seco (v48)')
assert(m.includes('arrancás por el ANTICIPO'), 'se perdió el fix de financiación (v47)')
assert(m.includes('le dejo anotado al asesor la simulación'), 'se perdió la Excepción 2 (v52)')
assert(m.includes('decí "tu usado"'), 'se perdió el anti-eco (v50/v51)')

// trampa 3 (no debería cambiar nada de fromAI, pero chequeamos consistencia global)
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
console.log('  (A) gate del abanico DURO (pedido general + presupuesto) + guion del embudo + anti-dump')
console.log('  (B) narrativa de capacidad condicionada')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
