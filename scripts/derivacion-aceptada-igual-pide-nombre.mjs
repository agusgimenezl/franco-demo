#!/usr/bin/env node
// DERIVACION ACEPTADA PERO SIN NOMBRE — fix determinístico (regla del proyecto: lo que se puede
// calcular determinísticamente va a código, no al prompt). Sesión 2026-08-01.
//
// PROBLEMA (captura de Agustina, sesión c7339dc4-e293-4136-b111-39c4069ca1e5, ejecuciones
// 9780-9783 leídas del log de n8n):
//   · 9780 — Franco cierra con "Querés que te pase con un asesor para que te arme esa simulación
//     y te guíe con los papeles y pasos a seguir?" (un OFRECIMIENTO).
//   · el cliente contesta "dale si! me interesa la financiacion" — ACEPTA.
//   · 9781 — el CRM lo registra BIEN: `estado: "Requiere asesor"`, `nombre: ""`. No es un bug del
//     CRM: la regla de su prompt ("cuenta como Requiere asesor que el cliente haya aceptado una
//     derivación que le ofreció Franco") se aplicó exactamente como está escrita.
//   · 9782 en adelante — `Config.estado_cliente` empuja "- YA ACEPTO que lo contacte un asesor:
//     la derivacion esta en curso, no se la vuelvas a ofrecer." (verificado en el log del nodo
//     Config de 9782, con `lead_nombre: ""`).
//   · 9783 — Franco la lee como "esto ya está cerrado" y salta al cierre ("le dejo anotado al
//     asesor que la financiación sería con $15 millones de anticipo y 36 cuotas") SIN pedir nunca
//     el nombre. El lead quedó con el teléfono ficticio de nombre (+54 381 555-9193) y la tarjeta
//     del CRM salió anónima.
//
// ROOT CAUSE: esa línea se escribió para que Franco NO RE-OFREZCA el asesor, y de paso apagó el
// name-ask — que es lo único que faltaba para COMPLETAR la derivación. La línea no distingue
// "aceptó y ya tengo su nombre" de "aceptó y todavía no me lo dio", y son dos situaciones con
// próximos pasos opuestos.
//
// FIX: que falte el nombre es DETERMINISTICO — `Leer lead (estado)` ya devuelve `lead_nombre`
// normalizado a '' cuando no hay nombre real (su CASE ya trata el teléfono ficticio '+54%' como
// vacío). Así que la línea se parte en dos según ese dato, en el mismo nodo Config. NO se toca el
// prompt de Franco: el guion del name-ask ("me dejás tu nombre y apellido?") ya existe en
// `# Derivación a un asesor`; lo único que faltaba era no apagarlo.
//
// TRAMPAS:
//   · Trampa 1 (`=` inicial): `estado_cliente` sigue arrancando con `={{`.
//   · Trampa 5 (TPM): cero llamadas nuevas a LLM. Es una rama de JS en una expresión.
//   · Trampa 6 (el ejemplo le gana a la regla): la rama nueva no se queda en la regla abstracta
//     ("falta el nombre"), trae el GUION CONCRETO entre comillas, que es lo que el modelo copia.
//   · Trampa 7: esta línea la inyecta el CÓDIGO (Config), no el prompt — por eso el fix va acá.
//
// UN SOLO NODO, UN SOLO CAMPO. No toca el systemMessage de Franco, ni el del CRM, ni ninguna
// tool, ni ningún nodo Postgres.
// Base: franco-n8n-v74.json (producción vigente). (2026-08-01)
//
//   node scripts/derivacion-aceptada-igual-pide-nombre.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v74.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v75.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const base = JSON.parse(readFileSync(SRC, 'utf8'))

// ---------------------------------------------------------------- Config.estado_cliente
const cfg = wf.nodes.find((n) => n.name === 'Config')
assert(cfg, 'no encontré el nodo Config')
const ec = cfg.parameters.assignments.assignments.find((a) => a.name === 'estado_cliente')
assert(ec, 'no encontré estado_cliente en Config')
let v = ec.value
assert(v.startsWith('={{'), 'estado_cliente no arranca con "={{" (trampa 1)')

const COND = "if (l.lead_estado === 'Requiere asesor' || l.ya_derivado === true || l.ya_derivado === 't' || l.ya_derivado === 'true') "
const OLD_PUSH = COND + "p.push('- YA ACEPTO que lo contacte un asesor: la derivacion esta en curso, no se la vuelvas a ofrecer.');"
assert(cuenta(v, OLD_PUSH) === 1, 'no encontré la línea de derivación de v74 como esperaba (¿base cambió o script ya corrido?)')

// Sin tildes ni signos de apertura, igual que el resto de las líneas de estado_cliente.
// El guion va textual (trampa 6): la regla sola pierde contra el cierre que Franco ya tiene.
const CON_NOMBRE = '- YA ACEPTO que lo contacte un asesor: la derivacion esta en curso, no se la vuelvas a ofrecer.'
const SIN_NOMBRE = '- YA ACEPTO que lo contacte un asesor: no se la vuelvas a ofrecer. PERO TODAVIA NO TE DIO SU NOMBRE, y sin nombre la derivacion NO queda completa: antes de cerrar pediselo, "me dejas tu nombre y apellido?". Es lo unico que falta.'

const NEW_PUSH = COND + "p.push(l.lead_nombre ? '" + CON_NOMBRE + "' : '" + SIN_NOMBRE + "');"

v = v.replace(OLD_PUSH, NEW_PUSH)
ec.value = v

// ---------------------------------------------------------------- post
assert(cuenta(ec.value, 'l.ya_derivado') === 3, 'se perdió la condición de ya_derivado (v74)')
assert(cuenta(ec.value, 'l.lead_nombre ?') === 1, 'no quedó la rama nueva por lead_nombre')
assert(cuenta(ec.value, CON_NOMBRE) === 1, 'no quedó la línea original (caso: ya tengo el nombre)')
assert(cuenta(ec.value, SIN_NOMBRE) === 1, 'no quedó la línea nueva (caso: falta el nombre)')
assert(cuenta(ec.value, 'me dejas tu nombre y apellido?') === 1, 'no quedó el guion concreto (trampa 6)')
assert(ec.value.startsWith('={{'), 'estado_cliente dejó de arrancar con "={{" (trampa 1)')
assert(!/[¿¡]/.test(SIN_NOMBRE), 'la línea nueva tiene signos de apertura y el resto de estado_cliente no los usa')

// La expresión tiene que seguir siendo JS válido: se evalúa el cuerpo del {{ }} en seco.
const cuerpo = ec.value.slice(4, -3) // saca "={{ " y " }}"
const probar = (lead) => {
  // eslint-disable-next-line no-new-func
  const fn = new Function('$', `const l0 = ${JSON.stringify(lead)}; const $$ = () => ({ item: { json: l0 } }); return (${cuerpo.replace(/\$\('Leer lead \(estado\)'\)/g, '$$$$()')})`)
  return fn(null)
}
const LEAD_BASE = { lead_nombre: '', lead_vehiculo: 'Toyota Corolla 2022', lead_entrega: 'No', lead_usado: 'No', lead_presupuesto: '$15.000.000', lead_financia: 'Sí', lead_estado: 'Requiere asesor', ya_derivado: false }

const sinNombre = probar(LEAD_BASE)
const conNombre = probar({ ...LEAD_BASE, lead_nombre: 'Pedro Atenor' })
const noDerivado = probar({ ...LEAD_BASE, lead_estado: 'En conversación' })
const porFlag = probar({ ...LEAD_BASE, lead_estado: 'En conversación', ya_derivado: true })

assert(sinNombre.includes('TODAVIA NO TE DIO SU NOMBRE'), 'CASO DEL BUG: derivado sin nombre no pide el nombre')
assert(!conNombre.includes('TODAVIA NO TE DIO SU NOMBRE'), 'FALSO POSITIVO: con nombre no debe pedirlo de nuevo')
assert(conNombre.includes('la derivacion esta en curso'), 'con nombre se perdió la línea original')
assert(conNombre.includes('- Se llama Pedro Atenor.'), 'se rompió la línea del nombre')
assert(!noDerivado.includes('YA ACEPTO'), 'FALSO POSITIVO: sin derivación no debe aparecer ninguna línea de derivación')
assert(porFlag.includes('TODAVIA NO TE DIO SU NOMBRE'), 'el camino de ya_derivado (v74) dejó de funcionar')

// Ningún otro nodo puede cambiar.
for (const n of wf.nodes) {
  const b = base.nodes.find((x) => x.name === n.name)
  assert(b, `nodo nuevo inesperado: ${n.name}`)
  if (n.name === 'Config') continue
  assert(JSON.stringify(n) === JSON.stringify(b), `cambió el nodo ${n.name} y NO debía`)
}
assert(wf.nodes.length === base.nodes.length, 'cambió la cantidad de nodos')
const cfgBase = base.nodes.find((n) => n.name === 'Config')
for (const a of cfg.parameters.assignments.assignments) {
  if (a.name === 'estado_cliente') continue
  const ab = cfgBase.parameters.assignments.assignments.find((x) => x.name === a.name)
  assert(JSON.stringify(a) === JSON.stringify(ab), `cambió Config.${a.name} y NO debía`)
}
assert(JSON.stringify(wf.connections) === JSON.stringify(base.connections), 'cambiaron las connections')

console.log('✓ todas las aserciones pasan')
console.log(`  Config.estado_cliente: ${cfgBase.parameters.assignments.assignments.find((a) => a.name === 'estado_cliente').value.length} -> ${ec.value.length} chars`)
console.log('  systemMessage de Franco: SIN CAMBIOS · nodos Postgres: SIN CAMBIOS')
console.log('\n  simulación con los datos REALES del log 9783 (lead_nombre: "", estado: "Requiere asesor"):')
console.log(sinNombre.split('\n').map((l) => '    ' + l).join('\n'))

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
