#!/usr/bin/env node
// v40: CAPACIDAD DE COMPRA con financiación (permuta + anticipo + 50%). (2026-07-23)
//
//   node scripts/capacidad-de-compra.mjs            # escribe franco-n8n-v40.json
//   node scripts/capacidad-de-compra.mjs --check    # solo valida
//
// ─────────────────────────────────────────────────────────────────────────────
// EL BUG (captura Sofía, reproducido en el eval `capacidad-de-compra-financiada`, 0/1):
// con 7M de anticipo + un Ford Ka 2015 + ganas de financiar, Franco mostró SOLO la Fiesta
// 8.2M y el Gol 9.2M —lo más barato— tratando los 7M como el techo total. NI SIQUIERA factoró
// el 50% de financiación. La capacidad real es: efectivo + usado (lo tasa el asesor) + hasta
// 50% financiado, o sea ~15-28M para ese cliente.
//
// RAÍZ: `## Permuta` punto 5 arma "DOS caminos" (categoria "entra" = cubre el efectivo,
// "estirar" = un poco arriba con permuta), ambos anclados al EFECTIVO CRUDO que Franco le pasa
// a `Listar stock` como precio_objetivo. La financiación vive en otro bloque (`# Financiación`)
// y NUNCA entra en el cálculo de qué stock mostrar. Por eso el abanico queda pegado al efectivo.
//
// EL FIX, en dos partes (regla del proyecto: lo calculable va a SQL, lo de lenguaje al prompt):
//   (A) DETERMINÍSTICO — parámetro `financia` en `Listar stock`. Cuando financia=1, la query
//       calcula la CAPACIDAD real (anticipo × 4 con permuta, × 2 sin permuta: el 50% financiado
//       duplica el poder de compra, y el usado ≈ otro anticipo lo vuelve a duplicar) y devuelve
//       un `tramo` por auto: "entrada" (≤60% de la capacidad), "intermedio" (≤80%), "techo"
//       (≤100%), "fuera" (se pasa). Los multiplicadores 4/2 y 0.60/0.80 reproducen el ejemplo
//       de Agustina (7M → techo 28M; entrada Etios/Cronos, intermedio EcoSport/208, techo
//       Corolla/Renegade). SON EL NÚMERO A AJUSTAR si se quiere mover la agresividad comercial.
//   (B) LENGUAJE (trampa 6: se REEMPLAZA el guion) — el punto 5 pasa a tener dos ramas: si el
//       cliente financia, explica la capacidad y muestra 2 autos por tramo (entrada/intermedio/
//       techo), segmentos distintos; si paga al contado, quedan los "dos caminos" de siempre.
//       Así `permuta-mas-efectivo` (contado, financia=0) NO se toca.
//
// ⚠️ PEGA A MANO Agustina y verifica byte a byte contra el vivo por MCP (NO update_workflow).
//    Base: franco-n8n-v39.json (verificación byte-a-byte del vivo vs v39 quedó PENDIENTE por el
//    MCP caído — hacerla antes de dar por cerrado).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v39.json')
const OUT = join(ROOT, 'franco-n8n-v40.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => {
  const x = wf.nodes.find((k) => k.name === n)
  assert(x, `no existe el nodo "${n}"`)
  return x
}

// Firmas $fromAI byte-idénticas a las que ya usa la query (trampa 3).
const OBJ =
  "{{ $fromAI('precio_objetivo', 'El techo de presupuesto real del cliente en pesos, sin estirar. Poner 0 si no dio presupuesto.', 'number') }}"
const PERM =
  "{{ $fromAI('tiene_permuta', 'Poner 1 si el cliente dijo que entrega un auto usado en parte de pago, 0 si no.', 'number') }}"
// OJO: `financia` (string 'Si/No/No mencionado') ya lo usa Guardar lead para el CRM. Reusar el
// nombre con otra firma es la trampa 3. Este parámetro del stock se llama `con_financiacion`.
const FIN =
  "{{ $fromAI('con_financiacion', 'Poner 1 si el cliente va a financiar, dio un anticipo, o pregunto por cuotas/financiacion. 0 si paga al contado o no lo menciono.', 'number') }}"
// capacidad = anticipo * (4 con permuta, 2 sin). Inline porque no se puede referenciar un alias
// hermano en el mismo SELECT (igual que la query ya repite precio_objetivo).
const CAP = `(${OBJ} * (CASE WHEN ${PERM} = 1 THEN 4 ELSE 2 END))`

// ══════════════════ (A) financia + tramo en Listar stock
{
  const n = nodo('Listar stock')
  let q = n.parameters.query
  assert(!q.includes("AS tramo"), 'Listar stock ya tiene tramo — ¿ya se aplicó?')
  assert(q.includes('END AS categoria'), 'no encuentro la categoría — ¿base equivocada?')

  // (A1) columna tramo, después de categoria y antes de precio_num.
  const ANCLA_COL = "    END AS categoria,\n    (metadata->>'precio')::int AS precio_num"
  unaVez(q, ANCLA_COL, 'Listar stock (columna categoria/precio_num)')
  const TRAMO_COL =
    "    END AS categoria,\n" +
    "    CASE\n" +
    `      WHEN ${FIN} = 1 AND ${OBJ} > 0 THEN\n` +
    "        CASE\n" +
    `          WHEN (metadata->>'precio')::int <= ${CAP} * 0.60 THEN 'entrada'\n` +
    `          WHEN (metadata->>'precio')::int <= ${CAP} * 0.80 THEN 'intermedio'\n` +
    `          WHEN (metadata->>'precio')::int <= ${CAP}        THEN 'techo'\n` +
    "          ELSE 'fuera'\n" +
    "        END\n" +
    "      ELSE 'n/a'\n" +
    "    END AS tramo,\n" +
    "    (metadata->>'precio')::int AS precio_num"
  q = q.replace(ANCLA_COL, TRAMO_COL)

  // (A2) tramo en la proyección final.
  const ANCLA_SEL = "       combustible, consumo, categoria, tamano\nFROM ("
  unaVez(q, ANCLA_SEL, 'Listar stock (proyección final)')
  q = q.replace(ANCLA_SEL, "       combustible, consumo, categoria, tramo, tamano\nFROM (")

  n.parameters.query = q

  // (A3) toolDescription: avisar del parámetro y del tramo.
  let td = n.parameters.toolDescription
  const ANCLA_TD = 'Los datos vienen listos: usalos tal cual, no los reformatees ni inventes.'
  unaVez(td, ANCLA_TD, 'Listar stock (toolDescription)')
  n.parameters.toolDescription = td.replace(
    ANCLA_TD,
    ANCLA_TD +
      ' Si el cliente va a financiar o dio un anticipo, pasá con_financiacion=1: la query te devuelve un ' +
      '`tramo` por auto (entrada/intermedio/techo/fuera) segun su capacidad de compra real ' +
      '(anticipo + usado + hasta 50% financiado). Mostrá 2 por tramo; los tramo=fuera no se muestran.',
  )
}

// ══════════════════ (B) prompt: reemplazar el guion de "dos caminos" (trampa 6)
const franco = nodo('Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(m.includes('ASESOR EN MARCHA'), 'falta el marker de v38 — ¿partiste de v39?')
assert(m.includes('SIN PRESUPUESTO DECLARADO'), 'falta el gate de v16')
const EXPR_ANTES = (m.match(/\{\{/g) || []).length

const OLD5 =
  '5. Presentá DOS caminos claros, usando las etiquetas de la herramienta (pasás tiene_permuta=1):\n' +
  '   · Opciones que cubre su efectivo (categoria "entra"): "con tu presupuesto, tu efectivo cubre el total de estas, y el valor de tu usado te queda a favor" — enmarcá que el usado es un extra a su favor, no algo que necesita para llegar. Esta frase vale SOLO si declaró presupuesto: si no lo declaró, no existe "su efectivo" y la frase queda prohibida.\n' +
  '   · Opciones de gama superior alcanzables con la permuta (categoria "estirar"): "y si querés algo de más categoría, entregando tu usado podrías llegar a estas otras, dependiendo de cuánto te lo tomen". SOLO mostrás las que la herramienta trae como "estirar" (que ya son las alcanzables con el margen de la permuta). No inventes opciones más caras "para que vaya viendo": todo lo que mostrás tiene que ser realmente alcanzable, para no generar falsas expectativas.'

const NEW5 =
  '5. Presentá su CAPACIDAD DE COMPRA REAL, que se arma con TRES cosas y NO es solo el efectivo: (a) el anticipo en efectivo, (b) el valor de su usado —que tasa el asesor—, y (c) la financiación de hasta el 50% del auto. Por eso el efectivo NO es el techo: mostrarle un solo auto o arrancar por el más barato del stock es el error que hace perder la venta.\n' +
  '   · SI VA A FINANCIAR (habló de anticipo, de cuotas, de financiar, o preguntó por eso): pasás con_financiacion=1 y tiene_permuta=1. La herramienta te devuelve cada auto con un "tramo": "entrada", "intermedio" o "techo". Armás la respuesta con un encabezado que explica la capacidad ("teniendo en cuenta tu anticipo, el valor de tu usado que tasamos en la agencia y la posibilidad de financiar hasta el 50%, tenés un abanico amplio") y después DOS autos por cada tramo, de marcas o segmentos distintos (no dos iguales): entrada (se paga casi solo con tu efectivo y tu usado), intermedio (con una financiación moderada) y techo (aprovechando hasta el 50% financiado). Los "tramo"="fuera" NO se muestran: se van de su alcance. Cerrás invitando a elegir un camino y a que un asesor haga la tasación oficial y arme el plan a medida.\n' +
  '   · SI PAGA AL CONTADO (no menciona financiar ni cuotas): con_financiacion=0 y presentás DOS caminos con las etiquetas de la herramienta: las que cubre su efectivo (categoria "entra": "tu efectivo cubre el total de estas, y el valor de tu usado te queda a favor") y las de gama superior entregando el usado (categoria "estirar": "y si querés algo de más categoría, entregando tu usado podrías llegar a estas otras, dependiendo de cuánto te lo tomen"). SOLO mostrás las que la herramienta trae; no inventes opciones más caras para "que vaya viendo".'

unaVez(m, OLD5, 'prompt (punto 5 de ## Permuta)')
m = m.replace(OLD5, NEW5)
franco.parameters.options.systemMessage = m

// ══════════════════ post-condiciones
assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES, `cambió el número de expresiones {{ }} (${EXPR_ANTES} -> ${(m.match(/\{\{/g) || []).length})`)
assert(!m.includes('Presentá DOS caminos claros, usando las etiquetas'), 'quedó el guion viejo de dos caminos')
assert((m.match(/CAPACIDAD DE COMPRA REAL/g) || []).length === 1, 'el guion nuevo quedó duplicado o ausente')
assert((m.match(/SI VA A FINANCIAR/g) || []).length === 1, 'la rama de financiación quedó duplicada o ausente')
assert(m.includes('SI PAGA AL CONTADO'), 'se perdió la rama de contado (rompería permuta-mas-efectivo)')

// Sobreviven los fixes previos (mismo criterio que el molde).
for (const [marca, versión] of [
  ['TRATO:', 'v15'], ['SIN PRESUPUESTO DECLARADO', 'v16'], ['(se pasa del presupuesto', 'v19'],
  ['SUENE A CONSEJO ÚTIL', 'v20/v23'], ['LA DERIVACIÓN MANDA', 'v23'],
  ['UNA PREGUNTA POR TURNO', 'v25'], ['CONTESTALA PRIMERO', 'v26'],
  ['No llames a ninguna herramienta de stock', 'v27'], ['ASESOR EN MARCHA', 'v38'],
]) {
  const c = (m.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  assert(c === 1, `problema con la regla de ${versión}: "${marca}" aparece ${c} veces`)
}

// SQL coherente + trampa 3 sobre todo el workflow (una firma por key).
const ls = nodo('Listar stock').parameters.query
assert(ls.includes('END AS tramo'), 'no quedó la columna tramo')
assert(ls.includes('categoria, tramo, tamano'), 'tramo no quedó en la proyección final')
assert(ls.includes('END AS categoria'), 'se perdió la categoría')
assert(ls.includes('NOT EXISTS (SELECT 1 FROM en_presupuesto)'), 'se perdió el fallback de v14')
assert(!/AND\s+AND/.test(ls), 'quedó un AND duplicado')

const porKey = new Map()
for (const n of wf.nodes) {
  for (const mm of String(n.parameters?.query ?? '').matchAll(/\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g)) {
    const [, key, desc, tipo] = mm
    const firma = `${desc}||${tipo}`
    if (porKey.has(key)) assert(porKey.get(key) === firma, `trampa 3: la key '${key}' tiene firmas distintas`)
    else porKey.set(key, firma)
  }
}
assert(porKey.has('con_financiacion'), 'con_financiacion no quedó registrada')

console.log('✓ todas las aserciones pasan')
console.log('  (A) financia + tramo (entrada/intermedio/techo/fuera) en Listar stock')
console.log('  (B) punto 5 de ## Permuta: dos ramas (financia vs contado), guion viejo reemplazado')
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars · expresiones ${EXPR_ANTES} (sin cambio)`)
console.log(`  trampa 3: ${porKey.size} keys $fromAI, todas con firma única`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
