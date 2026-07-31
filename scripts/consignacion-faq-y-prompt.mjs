#!/usr/bin/env node
// Consignación (Fase 1): que Franco reconozca al cliente que viene a VENDER su auto (no a comprar),
// le explique cómo funciona la consignación con datos del FAQ (comisión 5%, sigue siendo titular,
// el asesor arma el contrato) y derive con la MISMA progresión de una pregunta por turno que ya usa
// la derivación (auto -> km -> nombre). Sin tool, sin SQL: es un flujo de derivación.
//
// Dos cambios, ambos determinísticos según la regla del proyecto (dato -> FAQ, lenguaje -> prompt):
//   (A) Config.empresa_faq: se APPENDEA el bloque de consignación (los datos que Franco SÍ afirma).
//   (B) Franco systemMessage: sección nueva "# Consignación (vender tu auto)" entre Cotización y Alcance.
//       Con ejemplo concreto de la primera respuesta (trampa 6: el ejemplo le gana a la regla).
//
// NO toca el CRM ni ningún nodo Postgres (esa es la Fase 2). Base: franco-n8n-v66.json. (2026-07-24)
//
//   node scripts/consignacion-faq-y-prompt.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v66.json')
const OUT = join(ROOT, 'franco-n8n-v67.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))

// ---------------------------------------------------------------- (A) FAQ
const cfg = wf.nodes.find((n) => n.name === 'Config')
assert(cfg, 'no encontré el nodo Config')
const faqAssign = cfg.parameters.assignments.assignments.find((a) => a.name === 'empresa_faq')
assert(faqAssign, 'no encontré empresa_faq en Config')
let faq = faqAssign.value

assert(faq.startsWith('FINANCIACIÓN:'), 'el FAQ no empieza como esperaba (base cambió)')
assert(cuenta(faq, 'CONSIGNACIÓN') === 0, 'el FAQ ya tiene consignación (script ya corrido?)')
assert(faq.trimEnd().endsWith('en la simulación.'), 'el FAQ no termina donde esperaba (base cambió)')

const FAQ_CONSIGNACION = [
  'CONSIGNACIÓN (VENDEMOS TU AUTO POR VOS): Además de tomarlo en permuta, podemos vender tu auto en consignación: lo exhibimos y publicamos por vos, atendemos a los interesados, coordinamos los test drives y hacemos toda la gestión de la transferencia cuando se vende. Vos seguís siendo el titular hasta que se concreta la venta.',
  'CÓMO FUNCIONA LA CONSIGNACIÓN: Se firma un contrato de consignación donde autorizás la venta y se pacta el precio de publicación. Cobramos una comisión del 5% sobre el precio de venta. El precio de publicación lo definís junto al asesor, buscando un valor realista para venderlo en un plazo razonable.',
  'REQUISITOS PARA CONSIGNAR: Documentación al día (título, cédula verde, libre de deuda de patentes e infracciones) y el auto en condiciones de exhibición. Antes de publicarlo le hacemos una revisión.',
  'PLAZOS Y COBRO DE LA CONSIGNACIÓN: No garantizamos una fecha exacta de venta: depende del precio y de la demanda del modelo. Recibís el dinero una vez concretada y transferida la operación. Para dejar tu auto en consignación, un asesor coordina una inspección en el local y arma el contrato.',
].join('\n')

faq = faq.trimEnd() + '\n\n' + FAQ_CONSIGNACION
faqAssign.value = faq

// ---------------------------------------------------------------- (B) systemMessage
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no encontré el nodo Franco (AI Agent)')
let sm = franco.parameters.options.systemMessage
assert(sm[0] === '=', 'el systemMessage no arranca con "=" (trampa 1)')
assert(cuenta(sm, '# Consignación (vender tu auto)') === 0, 'el prompt ya tiene la sección de consignación')

const ANCLA = '\n\n# Alcance\n'
assert(cuenta(sm, ANCLA) === 1, `esperaba "# Alcance" una sola vez, hay ${cuenta(sm, ANCLA)}`)

const SECCION = [
  '# Consignación (vender tu auto)',
  'Algunos clientes no vienen a comprar sino a VENDER su auto: quieren que la agencia se los venda. Eso es consignación y NO es permuta. Permuta = entrega su usado como parte de pago de un auto NUESTRO (está comprando). Consignación = quiere que le vendamos SU auto, y no necesariamente compra otro. Señales de consignación: "quiero vender mi auto", "me lo venden?", "lo dejo para que lo vendan", "toman autos en consignación?".',
  'Ante esas señales NO abras la narrativa de permuta ni la de compra: no le preguntes presupuesto, anticipo ni qué auto busca, y NO le muestres stock ni cards (no vino a comprar). Ese turno va con auto_ids VACÍO.',
  'Qué hacés: explicás en tono charlado cómo funciona, con lo que está en el FAQ —lo publicamos y vendemos por vos, cobramos una comisión del 5% sobre el precio de venta, seguís siendo el titular hasta que se vende, y un asesor coordina la inspección y arma el contrato—. No cotizás vos cuánto vale ni en cuánto se vende: el precio de publicación lo pacta el asesor al ver el auto.',
  'Después derivás, con la MISMA progresión de una pregunta por turno que en toda derivación: primero QUÉ auto quiere vender (marca, modelo y año), después los KILÓMETROS, y al final el NOMBRE Y APELLIDO. Nunca dos datos juntos. Ejemplo de la primera respuesta: "dale, tu auto lo podemos vender en consignación: lo publicamos y lo vendemos por vos, y cobramos una comisión del 5% cuando se concreta. Vos seguís siendo el titular hasta la venta. Qué auto es, marca, modelo y año?".',
  'Cuando ya tenés auto + km + nombre, confirmás que un asesor lo contacta para coordinar la inspección y armar el contrato, y cerrás preguntando si necesita algo más mientras tanto.',
].join('\n')

sm = sm.replace(ANCLA, '\n\n' + SECCION + ANCLA)
franco.parameters.options.systemMessage = sm

// ---------------------------------------------------------------- post
assert(cuenta(faqAssign.value, 'CONSIGNACIÓN (VENDEMOS TU AUTO POR VOS)') === 1, 'FAQ: no quedó el bloque una vez')
assert(cuenta(sm, '# Consignación (vender tu auto)') === 1, 'prompt: no quedó la sección una vez')
assert(cuenta(sm, '# Alcance') === 1, 'prompt: se duplicó # Alcance')
assert(sm.indexOf('# Consignación') < sm.indexOf('# Alcance'), 'la sección quedó después de # Alcance')
assert(sm[0] === '=', 'el systemMessage dejó de arrancar con "=" (trampa 1)')
assert(cuenta(sm, 'comisión del 5%') >= 1, 'se perdió el 5% en el prompt')

console.log('✓ todas las aserciones pasan')
console.log(`  FAQ: +${FAQ_CONSIGNACION.length} chars (bloque consignación, comisión 5%, sin compra directa)`)
console.log(`  systemMessage: +${sm.length - franco.parameters.options.systemMessage.length + (SECCION.length + 2)} chars aprox (sección # Consignación entre Cotización y Alcance)`)
console.log(`  systemMessage total: ${sm.length} chars`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
