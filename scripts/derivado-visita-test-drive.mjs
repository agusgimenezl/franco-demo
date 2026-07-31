#!/usr/bin/env node
// BUG B — re-ofrece el asesor DESPUES de que la derivacion ya se completo, en la variante
// VISITA / TEST DRIVE (captura real Agustina, sesion Pedro Atenor
// 2b363055-1dc3-41eb-839e-0414f1d78e45, 2026-07-31).
// El cliente ya dio el nombre y Franco confirmo que le pasa los datos al asesor. Varios turnos
// despues pregunta "donde estan ubicados? puedo ir a verlo con un mecanico de confianza y
// probarlo?" y Franco cierra con: "Querés que te conecte con un asesor para coordinar la visita
// y el test drive?" — re-ofrece conectar a alguien que YA esta derivado.
//
// Baseline MEDIDO contra v71 (eval `derivacion-completada-no-reofrece-visita`, --repeat 3
// --delay 3000): falla 3/3.
//
// TRAMPA 7 DESCARTADA CON LOG REAL (ejecucion n8n 9327):
//   · el texto ya viene en el output crudo de `Franco (AI Agent)` (2 burbujas, con `auto_ids: []`);
//   · `Armar respuesta` lo pasa tal cual (2 burbujas entran, 2 salen, product_cards: []);
//   · el guard de cierre de `Armar respuesta` solo agrega algo si `autos.length >= 1`, y sus 3
//     strings son literales fijos que no incluyen esta frase (ademas la frase VARIA corrida a
//     corrida = generacion del LLM, no inyeccion de codigo).
//   => lo escribe Franco. El fix va al PROMPT, no al codigo.
//
// POR QUE SE LE ESCAPA A v68 (medido en el mismo log 9327): en ese turno
// `Leer lead (estado)` devolvio `lead_estado: "En conversación"` y `lead_nombre: ""`, y el
// `estado_cliente` que se le arma a Franco NO tenia ninguna marca de derivacion (solo
// presupuesto / vehiculo / financiacion). O sea: la regla de v68 y la de "# Derivación"
// ("si figura que ya aceptó, está aceptado") no tenian sobre que disparar, porque el CRM
// escribe async y el estado llega un turno tarde (deuda ya conocida del proyecto).
// Ademas la variante VISITA/TEST DRIVE no estaba cubierta: v68 ancla en "pregunta la direccion,
// el horario, o te agradece", y coordinar una visita SI involucra al asesor, asi que Franco
// reagarra el guion de "querés que te conecte con un asesor?".
// Por eso el fix hace DOS cosas en la MISMA regla (un solo cambio, misma seccion):
//   (1) cubre la variante visita/test drive/mecanico con su ejemplo concreto (trampa 6), y
//   (2) le dice explicitamente que para saber si ya derivo mire la CONVERSACION RECIENTE y no
//       solo el estado, porque el estado llega un turno tarde. Eso es lo unico que puede
//       funcionar hoy sin tocar arquitectura (ver nota al pie).
//
// NOTA HONESTA (va tambien a STATE.md): el fix determinístico de fondo seria que el hecho
// "ya derivado" le llegue a Franco en el MISMO turno (hoy no llega). Eso es un cambio de
// arquitectura (marcar la derivacion por codigo al detectarla, sin depender del CRM async) y
// NO se hace aca: excede "un cambio por vez" y es decision de Agustina.
//
// Solo lenguaje, solo la seccion "# Derivación a un asesor". NO toca ## Permuta, # Consignación,
// FAQ, CRM ni ningun nodo Postgres. Base: franco-n8n-v72.json (encadena sobre el fix de BUG A).
// (2026-07-31)
//
//   node scripts/derivado-visita-test-drive.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v72.json')
const OUT = join(ROOT, 'franco-n8n-v73.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))

const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no encontré el nodo Franco (AI Agent)')
let sm = franco.parameters.options.systemMessage
assert(sm[0] === '=', 'el systemMessage no arranca con "=" (trampa 1)')

const OLD = 'NUNCA cierres eso con "querés que un asesor te contacte?" (ya lo aceptó), ni con "querés que te pase el teléfono?", ni con "querés que te prepare o te reserve algún auto?".'

assert(cuenta(sm, OLD) === 1, `esperaba el cierre de la regla de v68 UNA vez, hay ${cuenta(sm, OLD)} (¿base cambió o script ya corrido?)`)

const NEW = OLD + ' VISITA, TEST DRIVE O TRAER UN MECÁNICO: si te pregunta si puede ir a verlo, probarlo o traer su mecánico de confianza, la respuesta es que SÍ —puede venir en el horario, traer su mecánico y probar el auto— y la coordinación la enmarcás en el asesor QUE YA LO VA A CONTACTAR, nunca ofreciéndole conectarlo de nuevo. Concreto: a "puedo ir a verlo con un mecánico de confianza y probarlo?" NO le contestes "querés que te conecte con un asesor para coordinar la visita y el test drive?" —ya está derivado, y volver a ofrecérselo le dice que no lo escuchaste—; contestale "sí, podés venir con tu mecánico y probarlo. Cuando el asesor te contacte, coordinás con él la visita y el test drive.". OJO CON CÓMO SABÉS QUE YA DERIVASTE: miralo en la CONVERSACIÓN RECIENTE, no solo en "Lo que ya sabés de este cliente". Si en un mensaje anterior YA le dijiste que le pasás los datos a un asesor, que un asesor lo va a contactar, o que le arman la simulación, entonces ESTÁ DERIVADO —aunque el estado que ves todavía diga "En conversación" y aunque ahí no figure su nombre—: ese dato se actualiza un turno más tarde y no podés esperarlo para dejar de re-ofrecer.'

sm = sm.replace(OLD, NEW)
franco.parameters.options.systemMessage = sm

// ---------------------------------------------------------------- post
assert(cuenta(sm, 'VISITA, TEST DRIVE O TRAER UN MECÁNICO') === 1, 'no quedó la regla nueva')
assert(cuenta(sm, 'OJO CON CÓMO SABÉS QUE YA DERIVASTE') === 1, 'no quedó la regla del estado atrasado')
assert(cuenta(sm, 'Cuando el asesor te contacte, coordinás con él la visita y el test drive.') === 1, 'no quedó el guion correcto (el que reemplaza al del bug)')
assert(cuenta(sm, OLD) === 1, 'la regla de v68 debe seguir presente (la nueva la extiende, no la reemplaza)')
// el fix de BUG A (v72) sigue intacto
assert(cuenta(sm, 'OJO CON EL USADO') === 1, 'se perdió el fix de BUG A (v72)')
assert(cuenta(sm, '## Permuta (cliente con efectivo + un usado para entregar)') === 1, 'Permuta debe seguir intacta')
assert(cuenta(sm, '# Consignación (vender tu auto)') === 1, 'Consignación debe seguir intacta')
assert(sm[0] === '=', 'el systemMessage dejó de arrancar con "=" (trampa 1)')

console.log('✓ todas las aserciones pasan')
console.log(`  systemMessage total: ${sm.length} chars`)
console.log(`  delta: +${NEW.length - OLD.length} chars (extiende la regla post-derivación de # Derivación)`)

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
