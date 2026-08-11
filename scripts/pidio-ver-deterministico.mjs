#!/usr/bin/env node
// "¿EL CLIENTE PIDIÓ VER AUTOS?" — CALCULADO, NO PREGUNTADO. v84 -> v85. 2026-08-05.
//
// TERCER INTENTO. Los dos anteriores están medidos y descartados:
//   · v83 (prompt): reemplazó el guion del abanico. **0/4.** Falló porque `## Permuta` tiene DOS
//     guiones que listan autos y gateé uno solo.
//   · v84 (parámetro `cliente_pidio_ver` que declara el modelo): **0/4.** Ejecución 11231, con el
//     mensaje del cliente siendo literalmente "110000 km", el modelo mandó `cliente_pidio_ver: 1`.
//     El SQL funcionaba: el modelo nunca pone 0.
// CONCLUSIÓN MEDIDA: **preguntarle al modelo no funciona, ni en prosa ni como parámetro.** El
// modelo no distingue "el cliente me da un dato" de "el cliente me pide opciones". Queda una sola
// vía: calcularlo sin preguntarle. Regla del proyecto, aplicada donde corresponde.
//
// VALIDACIÓN OFFLINE HECHA ANTES DE TOCAR EL WORKFLOW (método de v74):
//   · Corpus: **152 mensajes reales de cliente** de 19 sesiones de `mensajes_demo`, etiquetados a
//     mano. Patrón final: **0 falsos positivos**, 11 falsos negativos, y **15/15** en los mensajes
//     exactos del bug ("110000 km", "Toyota etios 2020", "tengo un usado", montos, km...).
//   · La asimetría que justifica ajustar a 0 FP: un **falso positivo deja pasar el dump** (el bug
//     intacto); un **falso negativo hace que Franco PREGUNTE en vez de mostrar**, que es
//     justamente el default que pidió Agustina. Los errores no cuestan lo mismo.
//   · REGLA DE DOS PARTES, validada aparte sobre **154 pares (burbuja de Franco → mensaje del
//     cliente)**: un "sí" pelado no se puede clasificar solo. De los **6 afirmativos reales del
//     corpus, 5 eran "sí" a un ASESOR y 1 a mostrar opciones**. Tratarlos a todos como "pidió ver"
//     habría abierto el gate 5 veces mal. Con la parte 2 (qué ofreció Franco): **6/6**, y el loop
//     "¿querés ver alternativas?" → "dale si" → sin filas → vuelve a preguntar queda resuelto.
//
// POR QUÉ 3 NODOS Y NO 1 — es UN mecanismo, repartido por dónde vive cada dato:
//   (A) `Leer lead (estado)`: columna nueva `franco_ofrecio_mostrar`, de la ÚLTIMA burbuja de
//       Franco en `mensajes_demo`. Es la parte 2 de la regla. Mismo patrón que `ya_derivado`
//       (v74): subconsulta ESCALAR, no puede cambiar la cantidad de filas (trampa 4).
//   (B) `Config`: campo nuevo `pidio_ver` (0/1). Es el único lugar con el MENSAJE ACTUAL del
//       cliente: `mensajes_demo` todavía NO lo tiene, porque `Guardar mensajes (historial)` corre
//       DESPUÉS de responder. Si el patrón se evaluara contra `mensajes_demo` leería el mensaje
//       del turno ANTERIOR. Éste es el detalle de arquitectura que define el diseño.
//   (C) `Listar stock`: el gate pasa de `$fromAI('cliente_pidio_ver')` (el juicio del modelo, que
//       falló) a `$('Config').item.json.pidio_ver` (el cálculo). El `$fromAI` muerto se elimina.
//
// PRECEDENTE DE QUE (C) FUNCIONA: `Postgres Chat Memory` —también sub-nodo del agente— ya usa
// `={{ $('Config').item.json.session_id }}` en producción. No es un mecanismo nuevo.
//
// TRAMPAS: trampa 4 (la subconsulta de (A) es escalar); trampa 2 (no se agregan parámetros, el
// `queryReplacement` de `Leer lead` sigue en forma array con `$1`); trampa 1 (el campo de Config
// arranca con `=`); trampa 5 (cero LLM nuevo); trampa 3 (se ELIMINA un `$fromAI`, no se agrega).
//
// LO QUE NO SE TOCA: el `systemMessage`. Sigue sin sumarse una condición a las 64 de `## Permuta`.
//
// Base: franco-n8n-v84.json (el vivo).
//
//   node scripts/pidio-ver-deterministico.mjs [--check]

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'workflows', 'franco-n8n-v84.json')
const OUT = join(ROOT, 'workflows', 'franco-n8n-v85.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const cuenta = (txt, aguja) => txt.split(aguja).length - 1

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const base = JSON.parse(readFileSync(SRC, 'utf8'))

// ================================================================ (A) Leer lead (estado)
const leer = wf.nodes.find((n) => n.name === 'Leer lead (estado)')
assert(leer, 'no encontré Leer lead (estado)')
let ql = leer.parameters.query
assert(!ql.includes('franco_ofrecio_mostrar'), 'el fix ya está aplicado (¿script ya corrido?)')
assert(cuenta(ql, 'AS ya_derivado') === 1, 'no encontré ya_derivado: base equivocada')

const OFRECE = "(te muestre|te muestro|mostrarte|te pase (esas|las|otras|mas|más|todas)|pasarte (esas|otras|mas|más)|ver (mas|más|otras) opciones|otras opciones|alternativas|el stock completo|todo el stock)"
const COL_A = `,
  -- franco_ofrecio_mostrar: ¿la ÚLTIMA burbuja de Franco ofrecía MOSTRAR autos? Es la parte 2 de
  -- la regla: un "dale si" del cliente sólo cuenta como "pidió ver" si lo que se le ofreció fue
  -- mostrar, no un asesor. Validado offline: 6/6 sobre los afirmativos reales del corpus.
  -- Subconsulta ESCALAR, igual que ya_derivado: no puede cambiar la cantidad de filas (trampa 4).
  COALESCE((
    SELECT bool_or(b->>'content' ~* '${OFRECE}')
    FROM (
      SELECT contenido
      FROM mensajes_demo
      WHERE session_id = $1 AND rol = 'franco'
      ORDER BY id DESC
      LIMIT 1
    ) r
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.contenido->'messages') = 'array'
           THEN r.contenido->'messages' ELSE '[]'::jsonb END
    ) AS b
  ), false)                                                AS franco_ofrecio_mostrar`

ql = ql.replace('                                               AS ya_derivado', '                                               AS ya_derivado' + COL_A)
leer.parameters.query = ql

assert(cuenta(ql, 'AS franco_ofrecio_mostrar') === 1, 'no quedó la columna nueva')
assert(cuenta(ql, 'AS ya_derivado') === 1, 'se perdió ya_derivado')
assert(cuenta(ql, 'FROM (SELECT 1) d') === 1, 'se perdió el FROM (SELECT 1) d (trampa 4)')
assert(cuenta(ql, '$1') === cuenta(base.nodes.find((n) => n.name === 'Leer lead (estado)').parameters.query, '$1') + 1,
  'la cantidad de $1 no es la esperada')
assert(JSON.stringify(leer.parameters.options) === JSON.stringify(base.nodes.find((n) => n.name === 'Leer lead (estado)').parameters.options),
  'cambió el queryReplacement y NO debía (trampa 2)')
assert(cuenta(ql, '(') === cuenta(ql, ')'), 'paréntesis desbalanceados en Leer lead')
assert(ql.trim().endsWith(';'), 'Leer lead dejó de terminar en ;')

// ================================================================ (B) Config.pidio_ver
const cfg = wf.nodes.find((n) => n.name === 'Config')
const asigs = cfg.parameters.assignments.assignments
assert(!asigs.some((a) => a.name === 'pidio_ver'), 'pidio_ver ya existe')
const iEstado = asigs.findIndex((a) => a.name === 'estado_cliente')
assert(iEstado !== -1, 'no encontré estado_cliente en Config')

// El patrón validado offline. Se escribe en una línea para que el expression de n8n no se rompa.
const AUTO = "(autos?|modelos?|unidad(es)?|stock|opcion(es)?|alternativ\\\\w*|camioneta|pickup|suv|sedan|sedán|hatchback|utilitario|0 ?km|usados|toyota|ford|volkswagen|chevrolet|renault|fiat|peugeot|jeep|corolla|etios|hilux|ranger|amarok|s10|t-cross|vento|renegade|onix|ecosport|duster|kangoo|208|cronos|gol|fiesta)"
const VALOR_B = '={{ (() => {' +
  " const m = String($('Webhook Render').item.json.body.content || '');" +
  " const ofrecio = $('Leer lead (estado)').item.json.franco_ofrecio_mostrar;" +
  ` const noEsPedido = /\\bqu[eé] es\\b|\\bcu[aá]l es la diferencia|\\bdiferencia entre\\b|para vender mi|quiero vender|tengo (un|para vender)/i;` +
  ` const pedir = new RegExp("((mostra|mostrá|mostrar|pasame|pasáme|pasame|decime|decíme|ten[eé]s|tienen|hay|cu[aá]les?|qu[eé]|algun[ao]?|disponible|\\\\bver\\\\b)[^.?!]{0,40}${AUTO}|${AUTO}[^.?!]{0,25}(ten[eé]s|tienen|hay|disponible)|cu[aá]les?\\\\s+(ten[eé]s|tienen|hay|son)|\\\\bbusco\\\\b|buscando|me recomend|cu[aá]l me recomend|quiero (comprar|ver|algo)|me interesan? (los|las|algo|comprar)|algo (m[aá]s |tipo |capaz |chico|econ[oó]mic|nuevo)|stock completo|todo el stock|estoy (buscando|interesad))", "i");` +
  ` const afirmativo = /^\\s*(s[ií]+|sip|dale|ok(ay)?|bueno|listo|perfecto|obvio|claro|de una|por ?favor|porfa|meta)\\b[\\s,!.]*(dale|s[ií]|por ?favor|porfa|gracias|mejor)?[\\s,!.]*$/i;` +
  ' if (noEsPedido.test(m)) return 0;' +
  ' if (pedir.test(m)) return 1;' +
  ' if (afirmativo.test(m) && (ofrecio === true || ofrecio === "t" || ofrecio === "true")) return 1;' +
  ' return 0;' +
  ' })() }}'

asigs.splice(iEstado + 1, 0, { id: 'a24', name: 'pidio_ver', value: VALOR_B, type: 'number' })

assert(asigs.filter((a) => a.name === 'pidio_ver').length === 1, 'no quedó pidio_ver')
assert(VALOR_B.startsWith('='), 'pidio_ver no arranca con "=" (trampa 1)')
assert(asigs.length === base.nodes.find((n) => n.name === 'Config').parameters.assignments.assignments.length + 1,
  'cambió la cantidad de campos de Config de forma inesperada')
assert(asigs.find((a) => a.name === 'estado_cliente').value === base.nodes.find((n) => n.name === 'Config').parameters.assignments.assignments.find((a) => a.name === 'estado_cliente').value,
  'se tocó estado_cliente y NO debía')

// ================================================================ (C) Listar stock
const listar = wf.nodes.find((n) => n.name === 'Listar stock')
let q = listar.parameters.query
const PIDIO_AI = "{{ $fromAI('cliente_pidio_ver', 'Poner 1 SOLO si el cliente pidio explicitamente ver autos u opciones (ej: mostrame, que me entra, ver opciones, alternativas, pasame el stock, si dale). Poner 0 si esta dando datos (su usado, los km, el anticipo, su nombre), preguntando otra cosa, o si todavia no te pidio ver nada.', 'number') }}"
assert(cuenta(q, PIDIO_AI) === 1, 'no encontré el $fromAI(cliente_pidio_ver) de v84')

const PIDIO_CFG = "{{ $('Config').item.json.pidio_ver }}"
q = q.replace(PIDIO_AI, PIDIO_CFG)
listar.parameters.query = q

assert(cuenta(q, PIDIO_AI) === 0, 'quedó el $fromAI muerto (el juicio del modelo, que falló)')
assert(cuenta(q, PIDIO_CFG) === 1, 'no quedó la referencia a Config')
assert(!q.includes('cliente_pidio_ver'), 'quedó alguna mención de la key vieja')
assert(q.includes("AND NOT ({{ $fromAI('tiene_permuta'"), 'se perdió la estructura del gate')
assert(q.includes("* 0.90) THEN 'economica'"), 'se perdió el piso de v79')
assert(q.trim().endsWith(';'), 'la query dejó de terminar en ;')
// El toolDescription ya no debe hablar de un parámetro que no existe.
let td = listar.parameters.toolDescription
const OLD_TD_FRAG = ' MISMO CRITERIO CON cliente_pidio_ver: pasa 1 SOLO si el cliente pidio ver autos u opciones ("mostrame", "que me entra", "alternativas", "si dale"). Si te esta dando datos —su usado, los km, el anticipo— NO te esta pidiendo opciones: ahi va 0. Con permuta y cliente_pidio_ver=0 la query NO devuelve autos A PROPOSITO, y eso TAMPOCO significa "no hay stock": significa que primero le tenes que PREGUNTAR si quiere ver alternativas, y recien cuando diga que si volves a llamar con cliente_pidio_ver=1. Nunca digas que no hay stock por esta razon.'
assert(cuenta(td, OLD_TD_FRAG) === 1, 'no encontré la nota de v84 en el toolDescription')
const NEW_TD_FRAG = ' CON PERMUTA HAY OTRO CASO IGUAL: si el cliente todavia NO pidio ver autos (te esta dando datos de su usado, los km o el anticipo), la query NO devuelve autos A PROPOSITO. Eso TAMPOCO significa "no hay stock": significa que primero le tenes que PREGUNTAR si quiere ver alternativas, y cuando te diga que si, volves a llamarla y ahi si te las devuelve. Nunca digas que no hay stock por esta razon. No hay ningun parametro que controle esto: lo calcula el sistema.'
td = td.replace(OLD_TD_FRAG, NEW_TD_FRAG)
listar.parameters.toolDescription = td
assert(!td.includes('cliente_pidio_ver'), 'el toolDescription sigue nombrando un parámetro que ya no existe')
assert(cuenta(td, 'lo calcula el sistema') === 1, 'no quedó la nota nueva')

// ================================================================ post
// El systemMessage NO se toca. Sigue siendo el punto del diseño.
const fb = base.nodes.find((n) => n.name === 'Franco (AI Agent)')
assert(JSON.stringify(wf.nodes.find((n) => n.name === 'Franco (AI Agent)')) === JSON.stringify(fb),
  'se tocó Franco (AI Agent) y NO debía')
// Sólo 3 nodos cambian.
const cambiados = wf.nodes.filter((n) => JSON.stringify(n) !== JSON.stringify(base.nodes.find((x) => x.name === n.name))).map((n) => n.name)
assert(cambiados.length === 3 && ['Leer lead (estado)', 'Config', 'Listar stock'].every((n) => cambiados.includes(n)),
  `esperaba exactamente 3 nodos cambiados y cambiaron: ${cambiados.join(', ')}`)
assert(JSON.stringify(wf.connections) === JSON.stringify(base.connections), 'cambiaron las connections')
assert(wf.nodes.length === base.nodes.length, 'cambió la cantidad de nodos')

// ---------------------------------------------------------------- prueba vinculante offline
// Se reimplementa en JS la MISMA lógica que quedó en Config y se corre contra los mensajes reales.
const noEsPedido = /\bqu[eé] es\b|\bcu[aá]l es la diferencia|\bdiferencia entre\b|para vender mi|quiero vender|tengo (un|para vender)/i
const A2 = "(autos?|modelos?|unidad(es)?|stock|opcion(es)?|alternativ\\w*|camioneta|pickup|suv|sedan|sedán|hatchback|utilitario|0 ?km|usados|toyota|ford|volkswagen|chevrolet|renault|fiat|peugeot|jeep|corolla|etios|hilux|ranger|amarok|s10|t-cross|vento|renegade|onix|ecosport|duster|kangoo|208|cronos|gol|fiesta)"
const pedir = new RegExp(`((mostra|mostrá|mostrar|pasame|pasáme|decime|decíme|ten[eé]s|tienen|hay|cu[aá]les?|qu[eé]|algun[ao]?|disponible|\\bver\\b)[^.?!]{0,40}${A2}|${A2}[^.?!]{0,25}(ten[eé]s|tienen|hay|disponible)|cu[aá]les?\\s+(ten[eé]s|tienen|hay|son)|\\bbusco\\b|buscando|me recomend|cu[aá]l me recomend|quiero (comprar|ver|algo)|me interesan? (los|las|algo|comprar)|algo (m[aá]s |tipo |capaz |chico|econ[oó]mic|nuevo)|stock completo|todo el stock|estoy (buscando|interesad))`, 'i')
const afirmativo = /^\s*(s[ií]+|sip|dale|ok(ay)?|bueno|listo|perfecto|obvio|claro|de una|por ?favor|porfa|meta)\b[\s,!.]*(dale|s[ií]|por ?favor|porfa|gracias|mejor)?[\s,!.]*$/i
const pidioVer = (m, ofrecio) => {
  if (noEsPedido.test(m)) return 0
  if (pedir.test(m)) return 1
  if (afirmativo.test(m) && ofrecio === true) return 1
  return 0
}
// Los 15 mensajes EXACTOS del bug: todos tienen que dar 0.
const BUG = ['Toyota etios 2020', '110000 km', 'Y tengo 6M aprox', 'tengo un presupuesto de 10 millones y un usado',
  'tengo un usado', 'dale! tambien tengo un auto para entregar', '5.000.000', '101000', 'serian unos 15 millones',
  '87mil km', 'es un ford ka 2013, con 95k km', 'ford ka 2013\n76k km', 'fiat cronos', '2022', '75mil km']
for (const m of BUG) assert(pidioVer(m, false) === 0, `"${m}" debería dar 0 y da 1`)
// Pedidos claros: 1.
for (const m of ['pasame todo el stock', 'que autos tenes?', 'mostrame alternativas', 'busco una pickup', 'algo mas economico'])
  assert(pidioVer(m, false) === 1, `"${m}" debería dar 1 y da 0`)
// La regla de dos partes, en las dos direcciones — el loop que había que evitar.
assert(pidioVer('dale si', true) === 1, 'con Franco ofreciendo MOSTRAR, "dale si" tiene que abrir el gate (si no, loop)')
assert(pidioVer('dale si', false) === 0, 'con Franco ofreciendo ASESOR, "dale si" NO puede abrir el gate')

console.log('✓ todas las aserciones pasan')
console.log('  (A) Leer lead (estado): columna `franco_ofrecio_mostrar` (subconsulta escalar, como ya_derivado)')
console.log('  (B) Config: campo `pidio_ver` calculado del MENSAJE ACTUAL (mensajes_demo todavía no lo tiene)')
console.log('  (C) Listar stock: el gate pasa del $fromAI del modelo al cálculo; $fromAI eliminado')
console.log('  systemMessage de Franco: SIN CAMBIOS')
console.log('\n  Prueba vinculante — los 15 mensajes del bug dan 0, los pedidos claros dan 1,')
console.log('  y "dale si" da 1 sólo si Franco había ofrecido MOSTRAR (6/6 en el corpus real).')

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
