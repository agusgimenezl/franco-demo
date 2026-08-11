#!/usr/bin/env node
// EL ABANICO SE BLOQUEA EN LA TOOL, NO SE PROHÍBE EN EL PROMPT. v83 -> v84. 2026-08-05.
//
// EL BUG (captura de Agustina): en la progresión de permuta, apenas el cliente contesta los km del
// usado, Franco le lista autos sin que se los hayan pedido.
//
// TRES INTENTOS DE LENGUAJE YA FALLARON, Y ESO ES EL DATO QUE DEFINE ESTE DISEÑO:
//   · Cuatro reglas PREEXISTENTES lo prohibían y se violaron las cuatro en la misma respuesta.
//   · v83 reemplazó el guion del abanico de tramos y **midió 0/4** (baseline v82: 1/3 → v83: 2/4,
//     sin mejora). Falló porque `## Permuta` tiene DOS guiones que listan autos y gateé uno solo:
//     el que Franco recita es el de "dos caminos" (`entra`/`estirar`), que quedó intacto.
//
// POR QUÉ NO SE INTENTA UNA SEXTA REGLA — LOS NÚMEROS DE LA SECCIÓN:
//   `## Permuta` mide **27.573 chars, la mitad del prompt entero**, y tiene **64 condiciones
//   negativas** (NO / SOLO / OJO / NUNCA) en 68 líneas. Casi una por línea. El problema no es que
//   falte una regla: es que hay demasiadas para que el modelo las arbitre, y cada fix agrega otra.
//   Es el yo-yo que el CLAUDE.md documenta.
//
// LA EVIDENCIA QUE CAMBIA EL ENFOQUE — ejecución `11206`, el turno que dumpea:
//   `Listar stock` ← `tiene_permuta: 1, precio_objetivo: 25000000, usado_marca: "Toyota",
//   usado_anio: 2020, usado_km: 110000`  →  **14 filas**. Con 14 filas en la mano, listó.
//   Y el prompt dice textual *"NO llamás a Listar stock para listar opciones"* en ese turno.
//   **La prohibición de LLAMAR falla igual que la de listar.** O sea: la decisión no se toma al
//   redactar, se toma al llamar la herramienta — que es un evento observable y BLOQUEABLE.
//
// EL FIX: parámetro `cliente_pidio_ver` en `Listar stock`. Si `tiene_permuta = 1` y el cliente NO
// pidió ver autos, **la query devuelve CERO filas**. Sin filas no hay nada que listar: el
// enforcement es duro, no depende de que el modelo arbitre 64 condiciones.
//
// PRECEDENTE VIVO EN ESTA MISMA TOOL: ya devuelve 0 filas a propósito cuando `precio_objetivo = 0`
// con permuta/financiación, y el `toolDescription` explica qué significa esa señal para que Franco
// no diga "no hay stock". Este gate es su gemelo y se documenta igual.
//
// DÓNDE VIVE EL CAMBIO — Y ESTO ES DELIBERADO: **enteramente dentro de `Listar stock`** (la query y
// su `toolDescription`). **NO se toca el systemMessage.** La sección de permuta ya tiene 64
// condiciones; meterle una más era exactamente lo que venía fallando. El `toolDescription` es otra
// superficie: es lo que el modelo lee cuando decide LLAMAR la tool, que es donde se toma la
// decisión según el log 11206.
//
// DEBILIDAD, DICHA DERECHO: el valor de `cliente_pidio_ver` **sigue siendo un juicio del modelo**.
// Esto NO es determinístico como `ya_derivado` (que se calcula por SQL sobre el historial). Lo que
// se gana es (a) que el error ya no se puede tapar redactando —sin filas no hay lista— y (b) que
// el error es **visible en el log** como un valor concreto, no como una redacción a interpretar.
// Si al medir se ve que el modelo pone 1 de más, el paso siguiente es calcularlo por SQL con un
// patrón sobre el último mensaje del cliente en `mensajes_demo`, validado offline como se hizo con
// `ya_derivado` en v74 (37 burbujas etiquetadas a mano, 37/37).
//
// ALCANCE (un cambio por vez): el gate aplica SOLO a `tiene_permuta = 1`. La financiación tiene su
// propio embudo que termina en el name-ask (v78), no en una lista, así que no se toca.
//
// TRAMPAS:
//   · Trampa 3: `cliente_pidio_ver` es una key NUEVA; se define UNA vez y se interpola, única
//     forma de garantizar que todas sus ocurrencias sean byte-idénticas. Verificado por aserción
//     sobre el nodo y sobre TODO el workflow.
//   · Trampa 2: no se toca `queryReplacement`.
//   · Trampa 4: `Listar stock` es una tool, NO está en la cadena principal, así que devolver 0
//     filas no corta el flujo ni deja al cliente sin respuesta (a diferencia de un nodo de la
//     cadena). Es el mismo riesgo que el gate de `precio_objetivo=0` que ya está en producción.
//   · Trampa 5: cero LLM nuevo.
//
// Base: franco-n8n-v83.json (el vivo).
//
//   node scripts/permuta-mostrar-solo-si-lo-piden.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v83.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v84.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const base = JSON.parse(readFileSync(SRC, 'utf8'))

const listar = wf.nodes.find((n) => n.name === 'Listar stock')
assert(listar, 'no encontré el nodo Listar stock')
let q = listar.parameters.query
assert(!q.includes('cliente_pidio_ver'), 'el fix ya está aplicado (¿script ya corrido?)')

const PERM = "{{ $fromAI('tiene_permuta', 'Poner 1 si el cliente dijo que entrega un auto usado en parte de pago, 0 si no.', 'number') }}"
assert(cuenta(q, PERM) >= 1, 'no encontré $fromAI(tiene_permuta)')

// TRAMPA 3: se define UNA vez. La descripción es deliberadamente restrictiva — el riesgo del
// cambio es que el modelo ponga 1 de más, así que el default conceptual es 0 y se enumeran los
// casos que SÍ cuentan.
const PIDIO = "{{ $fromAI('cliente_pidio_ver', 'Poner 1 SOLO si el cliente pidio explicitamente ver autos u opciones (ej: mostrame, que me entra, ver opciones, alternativas, pasame el stock, si dale). Poner 0 si esta dando datos (su usado, los km, el anticipo, su nombre), preguntando otra cosa, o si todavia no te pidio ver nada.', 'number') }}"

// El gate va con la misma forma que los tres que ya existen en ese WHERE final.
const OLD_TAIL = "ORDER BY u.precio_num DESC;"
assert(cuenta(q, OLD_TAIL) === 1, 'no encontré el ORDER BY final como esperaba')

const NEW_GATE = `\n  AND NOT (${PERM} = 1 AND ${PIDIO} = 0)\n`
q = q.replace('\n' + OLD_TAIL, NEW_GATE + OLD_TAIL)
listar.parameters.query = q

// ---------------------------------------------------------------- toolDescription
// Sin esto, 0 filas se lee como "no hay stock" y Franco dice una mentira. Es exactamente lo que
// ya se documentó para el gate de precio_objetivo=0.
let td = listar.parameters.toolDescription
const OLD_TD = 'Si es permuta o financiacion pero el cliente NO declaro presupuesto/anticipo (precio_objetivo=0), la query NO devuelve autos a proposito: eso NO significa "no hay stock", es la senal de pedir el presupuesto o derivar al asesor (el embudo).'
assert(cuenta(td, OLD_TD) === 1, 'no encontré la nota del gate de precio_objetivo=0 en el toolDescription')

const NEW_TD = OLD_TD + ' MISMO CRITERIO CON cliente_pidio_ver: pasa 1 SOLO si el cliente pidio ' +
  'ver autos u opciones ("mostrame", "que me entra", "alternativas", "si dale"). Si te esta dando ' +
  'datos —su usado, los km, el anticipo— NO te esta pidiendo opciones: ahi va 0. Con permuta y ' +
  'cliente_pidio_ver=0 la query NO devuelve autos A PROPOSITO, y eso TAMPOCO significa "no hay ' +
  'stock": significa que primero le tenes que PREGUNTAR si quiere ver alternativas, y recien ' +
  'cuando diga que si volves a llamar con cliente_pidio_ver=1. Nunca digas que no hay stock por ' +
  'esta razon.'
td = td.replace(OLD_TD, NEW_TD)
listar.parameters.toolDescription = td

// ---------------------------------------------------------------- post
assert(cuenta(q, PIDIO) === 1, `esperaba 1 ocurrencia de $fromAI('cliente_pidio_ver') y hay ${cuenta(q, PIDIO)}`)
assert(q.includes(`AND NOT (${PERM} = 1 AND ${PIDIO} = 0)`), 'no quedó el gate nuevo')
assert(q.trim().endsWith(';'), 'la query dejó de terminar en ;')
assert(cuenta(q, '(') === cuenta(q, ')'), 'paréntesis desbalanceados')
assert(cuenta(q, "'") % 2 === 0, 'comillas simples desbalanceadas')
// Los tres gates que ya existían siguen ahí.
assert(cuenta(q, "u.tramo = 'fuera')") === 1, 'se perdió el gate de tramo=fuera')
assert(cuenta(q, "u.categoria = 'fuera')") === 1, 'se perdió el gate de categoria=fuera')
assert(cuenta(q, 'ORDER BY u.precio_num DESC;') === 1, 'se rompió el ORDER BY final')
// El piso de gama de v79 sigue en su lugar.
assert(q.includes("* 0.90) THEN 'economica'"), 'se perdió el piso de v79')
// El toolDescription explica la señal (si no, Franco dice "no hay stock").
assert(cuenta(td, 'Nunca digas que no hay stock por esta razon') === 1, 'falta la nota de qué significa 0 filas')
assert(cuenta(td, 'cliente_pidio_ver=1') === 1, 'falta decirle cómo volver a llamar tras el sí')

// TRAMPA 3 sobre TODO el workflow: ninguna key con dos firmas distintas.
const firmas = new Map()
for (const n of wf.nodes) {
  const txt = JSON.stringify(n.parameters || {})
  for (const m of txt.matchAll(/\$fromAI\(\\?'([a-z_0-9]+)\\?',\s*\\?'((?:[^'\\]|\\.)*)\\?',\s*\\?'([a-z]+)\\?'/g)) {
    const [, key, desc, tipo] = m
    const firma = `${desc}||${tipo}`
    if (firmas.has(key)) assert(firmas.get(key) === firma, `TRAMPA 3: la key "${key}" tiene dos firmas distintas`)
    else firmas.set(key, firma)
  }
}

// EL systemMessage NO SE TOCA. Es el punto del diseño.
const fb = base.nodes.find((n) => n.name === 'Franco (AI Agent)')
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(JSON.stringify(franco) === JSON.stringify(fb), 'se tocó Franco (AI Agent) y NO debía: el fix va en la tool')

// Ningún otro nodo tocado.
for (const n of wf.nodes) {
  const b = base.nodes.find((x) => x.name === n.name)
  assert(b, `nodo nuevo inesperado: ${n.name}`)
  if (n.name === 'Listar stock') continue
  assert(JSON.stringify(n) === JSON.stringify(b), `cambió el nodo ${n.name} y NO debía`)
}
const lb = base.nodes.find((n) => n.name === 'Listar stock')
for (const k of Object.keys(listar.parameters)) {
  if (k === 'query' || k === 'toolDescription') continue
  assert(JSON.stringify(listar.parameters[k]) === JSON.stringify(lb.parameters[k]), `cambió Listar stock.${k}`)
}
assert(JSON.stringify(wf.connections) === JSON.stringify(base.connections), 'cambiaron las connections')
assert(wf.nodes.length === base.nodes.length, 'cambió la cantidad de nodos')

// ---------------------------------------------------------------- prueba vinculante offline
// Se reimplementa el WHERE final en JS y se corre con los parámetros EXACTOS del log 11206.
const gate = (p) => {
  if (p.con_financiacion === 1 && p.tramo === 'fuera') return false
  if (p.tiene_permuta === 1 && p.categoria === 'fuera') return false
  if (p.precio_objetivo === 0 && (p.tiene_permuta === 1 || p.con_financiacion === 1)) return false
  if (p.tiene_permuta === 1 && p.cliente_pidio_ver === 0) return false   // <-- el gate nuevo
  return true
}
// Los parámetros REALES del turno que dumpeó (log 11206), con el flag nuevo en 0.
const L11206 = { tiene_permuta: 1, precio_objetivo: 25000000, con_financiacion: 0, categoria: 'entra', tramo: 'n/a' }
assert(gate({ ...L11206, cliente_pidio_ver: 0 }) === false,
  'con los parámetros exactos del log 11206 la query SIGUE devolviendo filas: el gate no reproduce el bloqueo')
assert(gate({ ...L11206, cliente_pidio_ver: 1 }) === true,
  'tras el sí del cliente la query tiene que volver a devolver filas')

// Controles: el gate NO puede afectar nada fuera de la permuta.
assert(gate({ tiene_permuta: 0, precio_objetivo: 20000000, con_financiacion: 0, categoria: 'entra', tramo: 'n/a', cliente_pidio_ver: 0 }) === true,
  'SIN permuta el gate no debe bloquear (rompería "quiero un auto de 20 millones")')
assert(gate({ tiene_permuta: 0, precio_objetivo: 0, con_financiacion: 0, categoria: 'entra', tramo: 'n/a', cliente_pidio_ver: 0 }) === true,
  'el stock general sin presupuesto NO debe bloquearse')
assert(gate({ tiene_permuta: 0, precio_objetivo: 25000000, con_financiacion: 1, categoria: 'entra', tramo: 'entrada', cliente_pidio_ver: 0 }) === true,
  'la financiación SIN permuta no se toca en esta versión')
// Los 3 gates viejos siguen funcionando igual.
assert(gate({ tiene_permuta: 1, precio_objetivo: 25000000, con_financiacion: 0, categoria: 'fuera', tramo: 'n/a', cliente_pidio_ver: 1 }) === false,
  'se rompió el gate de categoria=fuera con permuta')
assert(gate({ tiene_permuta: 1, precio_objetivo: 0, con_financiacion: 0, categoria: 'entra', tramo: 'n/a', cliente_pidio_ver: 1 }) === false,
  'se rompió el gate de precio_objetivo=0 con permuta')

console.log('✓ todas las aserciones pasan')
console.log('  Listar stock: gate nuevo `AND NOT (tiene_permuta = 1 AND cliente_pidio_ver = 0)`')
console.log(`  query: ${lb.parameters.query.length} -> ${q.length} chars`)
console.log(`  toolDescription: ${lb.parameters.toolDescription.length} -> ${td.length} chars (explica qué significa 0 filas)`)
console.log('  systemMessage de Franco: SIN CAMBIOS — el fix NO agrega una condición a las 64 de ## Permuta')
console.log('\n  Prueba vinculante — parámetros EXACTOS del log 11206 (el turno que dumpeó):')
console.log(`    cliente_pidio_ver=0  -> devuelve filas: ${gate({ ...L11206, cliente_pidio_ver: 0 })}  (antes: sí, 14 filas)`)
console.log(`    cliente_pidio_ver=1  -> devuelve filas: ${gate({ ...L11206, cliente_pidio_ver: 1 })}  (tras el sí del cliente)`)
console.log('    sin permuta          -> devuelve filas: true  (no toca el flujo de presupuesto)')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
