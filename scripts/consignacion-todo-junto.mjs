#!/usr/bin/env node
// CONSIGNACIÓN — "todo junto" (sesión 2026-07-30): cuando el cliente da marca+modelo+año (o
// también los km) TODO JUNTO en un solo mensaje, Franco repregunta un dato que ya le dieron
// ("qué modelo y año es?" / "qué año tiene y cuántos km?"). Repro confirmado 3/3 fallando
// contra v70 con el caso de eval nuevo `consignacion-todo-junto` (mensaje real de Agustina:
// "Buenas, quiero vender mi auto. Es un ford ka 2017").
//
// Root cause: '## Permuta' YA tiene un bloque condicional de 3 estados con su propio ejemplo
// concreto ("Cierre de este caso: ... YA TENÉS EL AUTO Y LOS KILÓMETROS -> pedís el nombre"),
// y por eso Permuta SÍ maneja bien el caso "todo junto" (control `permuta-todo-junto`, se
// espera que pase). '# Consignación' (v67) nunca copió ese bloque: solo tiene el ejemplo del
// PRIMER turno cuando no se sabe nada del auto. Sin un bloque condicional propio con su
// ejemplo (trampa 6: el ejemplo concreto le gana a la regla abstracta), el modelo no tiene
// guion para "ya me lo diste todo junto" y cae de nuevo al guion de "preguntá marca/modelo/año".
//
// Fix: UN solo cambio, solo dentro de '# Consignación', solo lenguaje (NLU de texto libre,
// no es determinístico -> no va a SQL/código, va al prompt). Se reemplaza el párrafo de
// "Después derivás, con la MISMA progresión..." por un bloque condicional de 3 estados,
// mismo patrón estructural que '## Permuta' pero con el guion/tono propio de consignación
// (comisión 5%, sigue siendo titular, "asesor coordina la inspección y arma el contrato" —
// NUNCA "tasación", que es lenguaje de permuta). Cubre: falta auto -> falta km -> tiene
// auto y km (pedir nombre), con ejemplo concreto para el caso "todo junto".
//
// NO toca '## Permuta' (ya anda, "un cambio por vez"). NO toca el FAQ, ni CRM, ni ningún
// nodo Postgres. Base: franco-n8n-v70.json. (2026-07-30)
//
//   node scripts/consignacion-todo-junto.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v70.json')
const OUT = join(ROOT, 'franco-n8n-v71.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))

// ---------------------------------------------------------------- systemMessage (Franco)
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(franco, 'no encontré el nodo Franco (AI Agent)')
let sm = franco.parameters.options.systemMessage
assert(sm[0] === '=', 'el systemMessage no arranca con "=" (trampa 1)')
assert(cuenta(sm, '# Consignación (vender tu auto)') === 1, 'esperaba la sección de consignación una vez (¿base cambió?)')

const OLD = 'Después derivás, con la MISMA progresión de una pregunta por turno que en toda derivación: primero QUÉ auto quiere vender (marca, modelo y año), después los KILÓMETROS, y al final el NOMBRE Y APELLIDO. Nunca dos datos juntos. Ejemplo de la primera respuesta: "dale, tu auto lo podemos vender en consignación: lo publicamos y lo vendemos por vos, y cobramos una comisión del 5% cuando se concreta. Vos seguís siendo el titular hasta la venta. Qué auto es, marca, modelo y año?".'

assert(cuenta(sm, OLD) === 1, `esperaba el párrafo viejo de derivación una sola vez, hay ${cuenta(sm, OLD)} (¿ya corrido?)`)

const NEW = [
  'Después derivás siguiendo la MISMA progresión de una pregunta por turno que en toda derivación, y la pregunta del turno la define lo que TE FALTA — aunque te haya dado varios datos JUNTOS en un solo mensaje (por ejemplo "quiero vender mi auto, es un Ford Ka 2017"), nunca le vuelvas a preguntar un dato que ya te dio:',
  '· NO SABÉS QUÉ AUTO QUIERE VENDER -> preguntás eso, y nada más (marca, modelo y año). Ejemplo de la primera respuesta cuando todavía no tenés nada del auto: "dale, tu auto lo podemos vender en consignación: lo publicamos y lo vendemos por vos, y cobramos una comisión del 5% cuando se concreta. Vos seguís siendo el titular hasta la venta. Qué auto es, marca, modelo y año?".',
  '· YA SABÉS MARCA, MODELO Y AÑO (te los haya dado en este mensaje o en uno anterior) PERO NO LOS KILÓMETROS -> preguntás los kilómetros, y nada más: NO repreguntes marca, modelo ni año que ya tenés. Ejemplo del caso "todo junto": si en el primer mensaje te dicen "quiero vender mi auto, es un Ford Ka 2017", ya sabés marca+modelo+año de una — no contestes con "qué modelo y año es?" ni "qué año tiene?" (eso es repreguntar algo que ya te dieron), vas directo a: "dale, un Ford Ka 2017 lo podemos vender en consignación: lo publicamos y lo vendemos por vos, con una comisión del 5% cuando se concreta, y vos seguís siendo el titular hasta la venta. Cuántos kilómetros tiene?".',
  '· YA TENÉS AUTO Y KILÓMETROS (te los haya dado en uno, dos o tres mensajes) -> ya tenés todo del auto. Este turno pide el NOMBRE Y APELLIDO para derivar, y nada más: "con esos datos ya le puedo pasar todo a un asesor para que coordine la inspección y arme el contrato de consignación. Me dejás tu nombre y apellido?". No vuelvas a preguntar por el auto ni por los kilómetros.',
  'Nunca dos datos en el mismo mensaje.',
].join('\n')

sm = sm.replace(OLD, NEW)
franco.parameters.options.systemMessage = sm

// ---------------------------------------------------------------- post
assert(cuenta(sm, OLD) === 0, 'el párrafo viejo debería haber desaparecido')
assert(cuenta(sm, '· NO SABÉS QUÉ AUTO QUIERE VENDER') === 1, 'no quedó el bloque condicional nuevo')
assert(cuenta(sm, '· YA SABÉS MARCA, MODELO Y AÑO') === 1, 'no quedó la rama "falta km"')
assert(cuenta(sm, '· YA TENÉS AUTO Y KILÓMETROS') === 1, 'no quedó la rama "pedir nombre"')
assert(cuenta(sm, '# Consignación (vender tu auto)') === 1, 'la sección de consignación se duplicó o se perdió')
assert(cuenta(sm, '## Permuta (cliente con efectivo + un usado para entregar)') === 1, 'Permuta debe seguir igual (un cambio por vez)')
assert(cuenta(sm, 'tasaci') === cuenta((franco.parameters.options.systemMessage), 'tasaci'), 'sanity')
// El guion nuevo de consignación NO debe usar la palabra "tasación" (es lenguaje de permuta).
const seccionInicio = sm.indexOf('# Consignación (vender tu auto)')
const seccionFin = sm.indexOf('\n\n# Alcance')
assert(seccionInicio > -1 && seccionFin > seccionInicio, 'no pude acotar la sección de consignación')
const seccionTexto = sm.slice(seccionInicio, seccionFin)
assert(cuenta(seccionTexto.toLowerCase(), 'tasaci') === 0, 'la sección de consignación no debe usar "tasación" (lenguaje de permuta, no de consignación)')
assert(cuenta(seccionTexto, 'comisión del 5%') >= 1, 'se perdió el 5% en la sección')
assert(cuenta(seccionTexto, 'inspección') >= 1, 'se perdió "inspección" (lenguaje propio de consignación)')
assert(sm[0] === '=', 'el systemMessage dejó de arrancar con "=" (trampa 1)')

console.log('✓ todas las aserciones pasan')
console.log(`  systemMessage total: ${sm.length} chars`)
console.log(`  delta: +${NEW.length - OLD.length} chars (bloque condicional de 3 estados reemplaza el párrafo único de "# Consignación")`)

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
