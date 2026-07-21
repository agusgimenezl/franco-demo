#!/usr/bin/env node
// Política: si NINGÚN auto dentro del presupuesto cumple el criterio del cliente, mostrar
// igual los que lo cumplen aunque estén fuera de presupuesto (2026-07-21).
//
//   node scripts/criterio-fuera-de-presupuesto.mjs            # escribe franco-n8n-v12.json
//   node scripts/criterio-fuera-de-presupuesto.mjs --check    # solo valida
//
// POR QUÉ: con un presupuesto activo, al pedir "algo con menos de 50.000 km" Franco contesta
// "en el stock actual no hay opciones" y repite los autos que el cliente ya rechazó.
// Reproducido en el eval `km-con-presupuesto`: 0/4.
//
// LO QUE EL LOG DESCARTÓ (ejecución 3953): no es falta de datos ni de filtros.
// `Listar stock` corrió con `precio_max: 0` y devolvió los 17 autos con su kilometraje,
// incluidos los 5 que cumplen (Onix 6.500, T-Cross 7.600, Vento 9.000, Ranger 9.800,
// S10 11.500). Franco los TENÍA en contexto y los descartó igual, porque la tool los marca
// `categoria: "fuera"` y ninguna regla del prompt dice qué hacer cuando todos los que
// cumplen el criterio caen fuera de presupuesto. Por eso el fix es de prompt: la decisión
// es comercial, no calculable.
//
// (Se evaluó y DESCARTÓ agregar un parámetro `km_max` a las tools: el eval `km-maximo`
// pasa 3/3 sin ningún cambio — Franco filtra por kilometraje perfectamente cuando se lo
// piden sin presupuesto de por medio. El parámetro habría sido código muerto.)

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v11.json')
const OUT = join(ROOT, 'franco-n8n-v12.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`✗ ASERCIÓN FALLIDA: ${msg}`)
    process.exit(1)
  }
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const agente = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(agente, 'no existe el nodo "Franco (AI Agent)"')

const sm = agente.parameters?.options?.systemMessage
assert(typeof sm === 'string', 'no encuentro el systemMessage')
// Trampa 1: sin el "=" adelante, las expresiones {{ }} del prompt son texto literal.
assert(sm.startsWith('='), 'el systemMessage perdió el prefijo "=" (trampa 1)')

const ANCLA = `- Los autos van en lista, uno por renglón, con el mismo formato de siempre.`
assert(sm.includes(ANCLA), 'no encuentro el cierre de "## Recomendación por criterio"')
assert(sm.split(ANCLA).length === 2, 'el ancla aparece más de una vez, no puedo insertar sin ambigüedad')
assert(
  !sm.includes('Nunca digas que "no hay"'),
  'la política ya está en el prompt — ¿el cambio ya se aplicó?',
)

const NUEVO = `${ANCLA}
- Si NINGUNO de los autos que entran en el presupuesto cumple el criterio, igual mostrás los que SÍ lo cumplen aunque estén por encima, diciéndolo con todas las letras y apoyándote en la permuta o la financiación para acercarlos ("con menos de 50.000 km lo que tenemos arranca en $21.800.000; se va de lo que tenías pensado, pero con tu usado y financiación puede acomodarse"). Nunca digas que "no hay" ni que "no tenemos opciones" si en el stock existen autos que cumplen: existen, están más caros, y eso es una conversación de venta, no un cierre. Tampoco vuelvas a ofrecer los que el cliente ya descartó como si cumplieran el criterio nuevo.`

const nuevoSm = sm.replace(ANCLA, NUEVO)
assert(nuevoSm !== sm, 'el reemplazo no cambió nada')
assert(nuevoSm.startsWith('='), 'el systemMessage nuevo perdió el prefijo "="')

// Nada más del prompt debe haberse movido.
const largoDelta = nuevoSm.length - sm.length
assert(largoDelta === NUEVO.length - ANCLA.length, 'el cambio alteró más texto del esperado')

// Las secciones que se ajustaron en sesiones anteriores tienen que seguir intactas:
// tocar esta zona del prompt es justo donde aparece el patrón yo-yo.
for (const marca of [
  '## Recomendación por criterio (tamaño, uso, consumo)',
  'Siempre nombre Y apellido: el asesor necesita identificar al cliente.',
  "No uses signos de apertura: nada de \"¿\" ni \"¡\".",
  "'auto_ids' son los ids de los autos que estás mostrando en esta respuesta",
]) {
  assert(nuevoSm.includes(marca), `se perdió del prompt: ${marca.slice(0, 60)}`)
}

agente.parameters.options.systemMessage = nuevoSm

console.log('✓ todas las aserciones pasan')
console.log(`  systemMessage: +${largoDelta} caracteres (1 bullet nuevo en "Recomendación por criterio")`)

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
  console.log('\n--- AGREGAR AL FINAL DE "## Recomendación por criterio" ---\n')
  console.log(NUEVO.slice(ANCLA.length).trim())
}
