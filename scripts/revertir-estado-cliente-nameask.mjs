#!/usr/bin/env node
// REVERT del fix de name-ask en Config.estado_cliente (v75) — MEDIDO Y DESCARTADO. 2026-08-01.
//
// POR QUÉ SE REVIERTE: el cambio de v75 partía la línea de derivación en dos ramas según
// `lead_nombre`, para que Franco pidiera el nombre cuando la derivación estaba aceptada pero el
// nombre faltaba. **El mecanismo funcionó; la conducta no.**
//   · Ejecución 10208 (corrida limpia, CERO ejecuciones en error en toda la ventana):
//     `Leer lead (estado)` devolvió `lead_estado: "Requiere asesor"`, `lead_nombre: ""` — o sea la
//     precondición EXACTA del fix — y Franco igual NO pidió el nombre.
//   · `derivacion-aceptada-igual-pide-nombre`: **0/4 con el CRM sano**, contra un baseline v74 de
//     1/3. No mejora: si algo, empeora.
// El diagnóstico del bug sigue siendo correcto (la línea de estado apaga el name-ask), pero la
// solución no: meter la instrucción en el ESTADO no alcanza. Es **trampa 6** otra vez — la regla
// abstracta inyectada por código pierde contra el guion de cierre concreto que Franco ya tiene en
// `# Derivación a un asesor` / `## Paso 3`. El próximo intento tiene que REEMPLAZAR ESE GUION, no
// agregar una regla arriba.
//
// QUÉ REVIERTE: sólo `Config.estado_cliente`, a su valor exacto de v74. NO toca el fix de
// `Query leads` (el orden de la pestaña de Leads), que está medido y funcionando: la tarjeta pasó
// de la posición 12/12 a la 1/12. Por eso el revert se hace sobre v76 y no volviendo a v74.
//
// Base: franco-n8n-v76.json (vivo). Salida: v77 = v76 con estado_cliente de v74.
// (2026-08-01)
//
//   node scripts/revertir-estado-cliente-nameask.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v76.json')
const REF = join(ROOT, 'workflows', 'franco-n8n-v74.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v77.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const base = JSON.parse(readFileSync(SRC, 'utf8'))
const v74 = JSON.parse(readFileSync(REF, 'utf8'))

const ec = (w) => w.nodes.find((n) => n.name === 'Config')
  .parameters.assignments.assignments.find((a) => a.name === 'estado_cliente')

const actual = ec(wf)
const bueno = ec(v74)
assert(actual.value.includes('TODAVIA NO TE DIO SU NOMBRE'), 'el vivo no tiene el cambio de v75 (¿ya revertido?)')
assert(bueno.value.startsWith('={{'), 'el valor de v74 no arranca con "={{" (trampa 1)')
assert(!bueno.value.includes('TODAVIA NO TE DIO SU NOMBRE'), 'el valor de v74 ya trae el cambio: base equivocada')

actual.value = bueno.value

// ---------------------------------------------------------------- post
assert(ec(wf).value === ec(v74).value, 'estado_cliente no quedó idéntico al de v74')
assert(ec(wf).value.startsWith('={{'), 'estado_cliente no arranca con "={{" (trampa 1)')
assert(ec(wf).value.split('l.ya_derivado').length - 1 === 3, 'se perdieron las 3 menciones de ya_derivado de v74')

// El fix de Query leads TIENE que sobrevivir: es el que está medido y funcionando.
const ql = (w) => w.nodes.find((n) => n.name === 'Query leads').parameters.query
assert(ql(wf).includes('ORDER BY crm_leads.ultima_actualizacion DESC;'), 'se perdió el fix de orden de Leads')
assert(ql(wf) === ql(base), 'Query leads cambió y NO debía')

// Ningún otro nodo puede cambiar.
for (const n of wf.nodes) {
  const b = base.nodes.find((x) => x.name === n.name)
  assert(b, `nodo nuevo inesperado: ${n.name}`)
  if (n.name === 'Config') continue
  assert(JSON.stringify(n) === JSON.stringify(b), `cambió el nodo ${n.name} y NO debía`)
}
assert(JSON.stringify(wf.connections) === JSON.stringify(base.connections), 'cambiaron las connections')

console.log('✓ todas las aserciones pasan')
console.log(`  Config.estado_cliente: ${base.nodes.find((n) => n.name === 'Config').parameters.assignments.assignments.find((a) => a.name === 'estado_cliente').value.length} -> ${ec(wf).value.length} chars (idéntico a v74)`)
console.log('  Query leads (fix de orden, MEDIDO): INTACTO')
console.log('  systemMessage de Franco / CRM: SIN CAMBIOS')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
