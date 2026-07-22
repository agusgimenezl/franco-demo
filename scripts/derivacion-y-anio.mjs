#!/usr/bin/env node
// (A) filtro por año en las tools, (B) Franco deja de re-preguntar por el asesor, y
// (C) tres correcciones de lenguaje de las capturas (2026-07-22).
//
//   node scripts/derivacion-y-anio.mjs            # escribe franco-n8n-v30.json
//   node scripts/derivacion-y-anio.mjs --check    # solo valida
//
// ─────────────────────────────────────────────────────────────────────────────
// (A) "LOS ÚLTIMOS 4 AÑOS" DEVOLVÍA LOS 17 AUTOS  (captura 1)
//
// No es del prompt: las tools NO tienen ningún parámetro de año. Tienen precio_min,
// precio_max, km_max, precio_objetivo y tiene_permuta. Un criterio de año es infiltrable, así
// que Franco devuelve el catálogo entero. Medido: 17 y 14 cards, con autos de 2018 y 2019.
// Es la regla del proyecto: "qué autos cumplen el criterio" es calculable -> va a SQL.
// Se agrega `anio_min` a `Listar stock` y `Buscar auto`, con firma byte-idéntica (trampa 3).
// Y se le inyecta el año actual al prompt, porque sin eso no puede convertir "últimos 4
// años" en un número y lo iba a adivinar.
//
// ─────────────────────────────────────────────────────────────────────────────
// (B) OFRECIÓ EL ASESOR CINCO VECES  (capturas 3, 4 y 5 — la misma conversación)
//
// RAÍZ VERIFICADA: `Leer lead (estado)` no selecciona la columna `estado`, así que
// `estado_cliente` nunca le dice a Franco que el lead ya está en "Requiere asesor". No tenía
// con qué saberlo: no es que ignoraba la regla, es que le faltaba el dato.
//
// PERO EL DATO SOLO NO ALCANZA, y esto se midió: en la corrida previa el lead quedó en
// "En conversacion" incluso después de que el cliente aceptara dos veces. El `estado_cliente`
// se lee ANTES del agente y el CRM escribe DESPUÉS, así que va un turno atrasado, y encima la
// clasificación del CRM es un juicio del modelo, no un hecho.
// Por eso el fix usa DOS canales:
//   1. el dato (`estado` en la query + en `estado_cliente`), que cubre cuando la memoria ya
//      no alcanza para ver el momento en que aceptó;
//   2. la conversación, que Franco SÍ tiene siempre en la ventana de 20 y es el canal
//      confiable: si ya ofreciste un asesor y te dijeron que sí, está aceptado.
//
// ─────────────────────────────────────────────────────────────────────────────
// (C) TRES DE LENGUAJE, todas de las capturas
//   · "querés que TE PASE los datos" -> el agente no manda datos, los PIDE. Dirección
//     invertida, confunde al cliente.
//   · "te recomiendo estos autos usados" -> redundante (captura 2). La regla de v18 existe
//     pero está en el Paso 3 (detalle de UN auto); acá el caso es una recomendación de varios.
//   · ofrecer fotos o "todo el stock" que YA mandó en la misma conversación (capturas 2 y 4).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v29.json')
const OUT = join(ROOT, 'franco-n8n-v30.json')
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

// ══════════════════ (A1) anio_min en las tools
// Firma ÚNICA, byte a byte igual en los dos nodos (trampa 3), y sin acentos, como el resto.
const ANIO =
  "{{ $fromAI('anio_min', 'Anio minimo del auto que acepta el cliente (ej: 2022). Si pide " +
  "los ultimos N anios, restar N-1 al anio actual. Poner 0 si no menciono ninguno.', 'number') }}"

{
  const n = nodo('Listar stock')
  const q = n.parameters.query
  assert(!q.includes('anio_min'), 'Listar stock ya tiene anio_min — ¿ya se aplicó?')
  const ANCLA = "  FROM autos_disponibles\n  WHERE ("
  unaVez(q, ANCLA, 'Listar stock (WHERE del CTE)')
  n.parameters.query = q.replace(
    ANCLA,
    `  FROM autos_disponibles\n  WHERE (${ANIO} = 0 OR (metadata->>'año')::int >= ${ANIO})\n    AND (`,
  )
}
{
  const n = nodo('Buscar auto')
  const q = n.parameters.query
  assert(!q.includes('anio_min'), 'Buscar auto ya tiene anio_min — ¿ya se aplicó?')
  const ANCLA = '\nORDER BY (metadata->>\'precio\')::int DESC;'
  unaVez(q, ANCLA, 'Buscar auto (ORDER BY)')
  n.parameters.query = q.replace(
    ANCLA,
    `\n  AND (${ANIO} = 0 OR (metadata->>'año')::int >= ${ANIO})` + ANCLA,
  )
}

// ══════════════════ (B1) `estado` en Leer lead (estado)
{
  const n = nodo('Leer lead (estado)')
  const q = n.parameters.query
  assert(!q.includes('lead_estado'), 'ya trae el estado — ¿ya se aplicó?')
  const ANCLA = "  COALESCE(l.financia,          'No mencionado')           AS lead_financia\n"
  unaVez(q, ANCLA, 'Leer lead (estado)')
  n.parameters.query = q.replace(
    ANCLA,
    ANCLA.replace('\n', ',\n') +
      "  COALESCE(l.estado,            'Nuevo')                   AS lead_estado\n",
  )
  assert(n.parameters.query.includes('LEFT JOIN crm_leads'), 'se rompió el LEFT JOIN (trampa 4)')
  assert(n.parameters.query.includes('FROM (SELECT 1) d'), 'se rompió el patrón de ≥1 fila (trampa 4)')
}

// ══════════════════ (B2) exponerlo en estado_cliente
{
  const cfg = nodo('Config')
  const asig = cfg.parameters.assignments.assignments.find((a) => a.name === 'estado_cliente')
  assert(asig, 'no existe estado_cliente en el Config')
  assert(!asig.value.includes('lead_estado'), 'estado_cliente ya usa el estado')
  const ANCLA = "return p.length ?"
  unaVez(asig.value, ANCLA, 'estado_cliente')
  asig.value = asig.value.replace(
    ANCLA,
    "if (l.lead_estado === 'Requiere asesor') p.push('- YA ACEPTO que lo contacte un asesor: la derivacion esta en curso, no se la vuelvas a ofrecer.'); " +
      ANCLA,
  )
}

// ══════════════════ prompt
const franco = nodo('Franco (AI Agent)')
let m = franco.parameters.options.systemMessage
const mAntes = m
assert(m.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(m.includes('la pregunta de ese turno es el NOMBRE'), 'falta la regla de v29 — ¿partiste de v29?')
const EXPR_ANTES = (m.match(/\{\{/g) || []).length
assert(EXPR_ANTES === 19, `esperaba 19 expresiones {{ }}, hay ${EXPR_ANTES}`)

// (A2) el año actual + cómo usar anio_min
{
  const ANCLA = 'Parámetros (0 si no aplica):'
  unaVez(m, ANCLA, 'prompt (parámetros de Listar stock)')
  m = m.replace(
    ANCLA,
    'Estamos en el año {{ $now.year }}. Si el cliente pide "los últimos N años", eso es ' +
      'anio_min = {{ $now.year }} - N + 1, y el año en curso no cuenta como uno de esos N. ' +
      'Si pide "de 2020 en adelante", anio_min = 2020. NUNCA le devuelvas el catálogo entero ' +
      'cuando pidió un recorte: si el criterio no lo podés filtrar, decíselo.\n' +
      ANCLA,
  )
}

// (B3) la regla de la derivación aceptada, con el guion concreto (trampa 6)
{
  const ANCLA = '- LA DERIVACIÓN MANDA.'
  unaVez(m, ANCLA, 'prompt (regla de v23)')
  m = m.replace(
    ANCLA,
    '- UNA VEZ QUE ACEPTÓ, NO SE PREGUNTA MÁS. Si en esta conversación ya ofreciste un asesor ' +
      'y el cliente dijo que sí — "sí", "dale", "si porfa", "sí pero antes contame X" —, la ' +
      'derivación está ACEPTADA y no se vuelve a preguntar NUNCA. Da igual cuántos turnos ' +
      'pasen o cuántas preguntas intercale en el medio: seguís contestando lo que te pregunte ' +
      'y, cuando termine, avanzás pidiendo lo que falte ("perfecto, para que te contacte, me ' +
      'dejás tu nombre y apellido?"). Volver a preguntarle si quiere un asesor a alguien que ' +
      'ya dijo que sí es lo que más rápido hace que abandone. Fijate también en "Lo que ya ' +
      'sabés de este cliente": si dice que ya aceptó, está aceptado.\n' +
      '- VOS NO MANDÁS DATOS, LOS PEDÍS. Nunca digas "querés que te pase los datos": el que ' +
      'pasa el nombre y apellido es el cliente, y vos se los pedís a él.\n' +
      ANCLA,
  )
}

// (C) redundancias: "autos usados" al recomendar, y ofrecer lo ya mandado
{
  const ANCLA = '# Formato de salida'
  unaVez(m, ANCLA, 'prompt (formato de salida)')
  m = m.replace(
    ANCLA,
    '# No repitas lo que ya hiciste\n' +
      'Mirá la conversación antes de ofrecer algo: si ya mandaste las fotos de un auto, no ' +
      'ofrezcas "pasarte las fotos"; si ya mostraste el stock completo, no ofrezcas ' +
      '"mostrarte todo el stock". Ofrecer de nuevo algo que el cliente ya tiene arriba en el ' +
      'chat te hace ver desatento.\n' +
      'Y no digas "estos autos usados" ni "los usados que tenemos": son "estos autos", a ' +
      'secas. Ya se entiende por el año y los km, y aclararlo suena defensivo.\n\n' +
      ANCLA,
  )
}

// ══════════════════ post-condiciones

assert(m !== mAntes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial (trampa 1)')
assert((m.match(/\{\{/g) || []).length === EXPR_ANTES + 2, 'se esperaban 2 expresiones nuevas ($now.year x2)')
assert((m.match(/NO SE PREGUNTA MÁS/g) || []).length === 1, 'la regla de derivación quedó duplicada')
assert((m.match(/VOS NO MANDÁS DATOS/g) || []).length === 1, 'la regla de datos quedó duplicada')
assert((m.match(/# No repitas lo que ya hiciste/g) || []).length === 1, 'la sección quedó duplicada')

for (const [marca, versión] of [
  ['TRATO:', 'v15'], ['SIN PRESUPUESTO DECLARADO', 'v16'], ['(se pasa del presupuesto', 'v19'],
  ['SUENE A CONSEJO ÚTIL', 'v20/v23'], ['nunca "está blanco"', 'v22'], ['LA DERIVACIÓN MANDA', 'v23'],
  ['OJO CON EL FORMATO AL REDIRIGIR', 'v24'], ['UNA PREGUNTA POR TURNO', 'v25'],
  ['CONTESTALA PRIMERO', 'v26'], ['No llames a ninguna herramienta de stock', 'v27'],
  ['la pregunta de ese turno es el NOMBRE', 'v29'],
]) {
  const c = (m.match(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  assert(c === 1, `problema con la regla de ${versión}: "${marca}" aparece ${c} veces`)
}
franco.parameters.options.systemMessage = m

// Trampa 3 sobre TODO el workflow: anio_min tiene que tener una sola firma.
const porKey = new Map()
for (const n of wf.nodes) {
  for (const mm of String(n.parameters?.query ?? '').matchAll(/\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g)) {
    const [, key, desc, tipo] = mm
    const firma = `${desc}||${tipo}`
    if (porKey.has(key)) assert(porKey.get(key) === firma, `trampa 3: la key '${key}' tiene firmas distintas`)
    else porKey.set(key, firma)
  }
}
assert(porKey.has('anio_min'), 'anio_min no quedó registrada')

// Las queries siguen siendo coherentes.
assert(nodo('Listar stock').parameters.query.includes('END AS categoria'), 'se perdió la categoría')
assert(nodo('Listar stock').parameters.query.includes('NOT EXISTS (SELECT 1 FROM en_presupuesto)'), 'se perdió el fallback de v14')
assert(nodo('Buscar auto').parameters.query.includes("metadata->>'color' ILIKE"), 'se perdió el filtro de color')
assert(!/AND\s+AND/.test(nodo('Listar stock').parameters.query + nodo('Buscar auto').parameters.query), 'quedó un AND duplicado')

console.log('✓ todas las aserciones pasan')
console.log(`  (A) anio_min en Listar stock y Buscar auto + el año actual en el prompt`)
console.log(`  (B) estado en Leer lead + estado_cliente, y la regla de "ya aceptó" con guion`)
console.log(`  (C) no re-ofrecer lo ya mandado, y sin "autos usados"`)
console.log(`  prompt: ${mAntes.length} -> ${m.length} chars · expresiones ${EXPR_ANTES} -> ${(m.match(/\{\{/g) || []).length}`)
console.log(`  trampa 3: ${porKey.size} keys $fromAI, todas con firma única`)

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
