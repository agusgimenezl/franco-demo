#!/usr/bin/env node
// Tres pedidos de Agustina sobre cómo Franco presenta un auto (2026-07-21).
//
//   node scripts/presentacion-auto.mjs            # escribe franco-n8n-v18.json
//   node scripts/presentacion-auto.mjs --check    # solo valida
//
// (A) NO ACLARAR "usado" / "seminuevo" — se entiende por los km y el año, y decirlo suena
//     defensivo. **Va por dato, no por prompt.** El prompt YA lo pedía en el Paso 3 ("No
//     aclares 'está usado' si ya diste los km") y Franco igual contestó "Está en usado
//     bueno" (medido hoy). La razón es que la tool le entregaba `condicion: "Usado"`: no se
//     puede prohibir un dato que le estás dando. Entonces:
//       · sale la columna `condicion` de las 3 tools;
//       · en `Detalle auto`, `ficha_completa` (que es el `content` vectorizado) se limpia
//         con regexp_replace, porque el texto trae "Condición: usado." adentro;
//       · las descripciones curadas ya no usan la palabra (aserción en gen-descripcion-sql).
//     `Hidratar autos`, que arma las cards de la UI, NO usa `condicion`: las cards no cambian.
//
// (B) VIÑETA en las listas. El prompt sólo pedía "cada auto en su propio renglón", así que
//     Franco cumplía con renglones pelados — y el check `cars_in_list_format` exigía viñeta
//     o número. El desacuerdo era entre el check y el prompt, no un bug de Franco. Ahora el
//     prompt pide la viñeta explícitamente y los dos dicen lo mismo.
//
// (C) DETALLE = breve descripción + ficha. Hoy el Paso 3 arranca por el motor. Con
//     `descripcion` ya disponible en la tool (v17), Franco la usa 2 de 3 veces por su
//     cuenta; esto la vuelve consistente y define el orden: primero el porqué, después los
//     datos. `condicionantes` se menciona sólo si le importa a ESE cliente y como criterio
//     de vendedor, nunca como lista de defectos — que es como se espanta una venta.
//
// TRES CAMBIOS JUNTOS, A CONCIENCIA. La regla del proyecto es uno por vez, y esto la estira.
// Se hace igual porque cada uno cae en una sección distinta del prompt y cada uno tiene su
// propio check, así que una regresión es atribuible sin bisectar:
//     (A) -> text_not_matches usado/seminuevo   (B) -> cars_in_list_format
//     (C) -> descripcion-que-aporta
// Si algo se rompe y no es ninguno de esos tres, ahí sí hay que separar y remedir.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v17.json')
const OUT = join(ROOT, 'franco-n8n-v18.json')
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

// ══════════════════════════════ (A) fuera `condicion`

// Listar stock: columna del CTE + proyección final
{
  const n = nodo('Listar stock')
  const q = n.parameters.query
  assert(q.includes('tamano'), 'Listar stock no tiene tamano — ¿partiste de v17?')

  const COL = "    metadata->>'condicion' AS condicion,\n"
  unaVez(q, COL, 'Listar stock (columna del CTE)')

  const PROY = 'SELECT id, titulo, precio, foto_principal, carroceria, color, condicion, anio, km,'
  unaVez(q, PROY, 'Listar stock (proyección)')

  n.parameters.query = q
    .replace(COL, '')
    .replace(PROY, 'SELECT id, titulo, precio, foto_principal, carroceria, color, anio, km,')
}

// Buscar auto
{
  const n = nodo('Buscar auto')
  const COL = "  metadata->>'condicion' AS condicion,\n"
  unaVez(n.parameters.query, COL, 'Buscar auto')
  n.parameters.query = n.parameters.query.replace(COL, '')
}

// Detalle auto: columna + limpieza del content
{
  const n = nodo('Detalle auto')
  const q = n.parameters.query
  const COL = "  metadata->>'condicion'    AS condicion,\n"
  unaVez(q, COL, 'Detalle auto (columna)')

  const FICHA = '  content AS ficha_completa'
  unaVez(q, FICHA, 'Detalle auto (ficha_completa)')

  // El `content` vectorizado trae "Condición: usado. " embebido (lo escribe armar_content()
  // en revectorizar_con_consumo_v2.py). Sin esto, sacar la columna no alcanza.
  // Clase de caracteres [.] en vez de \. para no meter backslashes en el literal SQL.
  const FICHA_LIMPIA =
    "  regexp_replace(content, 'Condición: [^.]*[.] ', '', 'g') AS ficha_completa"

  n.parameters.query = q.replace(COL, '').replace(FICHA, FICHA_LIMPIA)
}

// ══════════════════════════════ prompt

const franco = nodo('Franco (AI Agent)')
const antes = franco.parameters.options.systemMessage
assert(antes.startsWith('='), 'el systemMessage no arranca con "=" (trampa 1)')
assert(antes.includes('TRATO:'), 'falta la regla TRATO de v15 — ¿partiste de v17?')
assert(antes.includes('SIN PRESUPUESTO DECLARADO'), 'falta el gate de v16')
const EXPR = (antes.match(/\{\{/g) || []).length
assert(EXPR === 19, `esperaba 19 expresiones {{ }}, hay ${EXPR}`)

let m = antes

// (A-bis) la enumeración de campos de la tool queda al día: si nombra `condicion`, Franco
// va a buscar un campo que ya no existe.
{
  const VIEJO = '(id, titulo, precio formateado, carroceria, condicion, anio, km, combustible, consumo)'
  unaVez(m, VIEJO, 'prompt (campos de Listar stock)')
  m = m.replace(VIEJO, '(id, titulo, precio formateado, carroceria, tamano, anio, km, combustible, consumo)')
}

// (B) viñeta
{
  const VIEJO = '- Cada auto en su propio renglón, con salto de línea'
  unaVez(m, VIEJO, 'prompt (formato de lista)')
  const linea = m.slice(m.indexOf(VIEJO)).split('\n')[0]
  m = m.replace(
    linea,
    linea.replace(/\.?\s*$/, '.') +
      ' Cada renglón arranca con una viñeta "- ": la lista tiene que verse como lista, no como renglones sueltos.',
  )
}

// (C) detalle: primero el porqué, después la ficha
{
  const VIEJO =
    '- Una burbuja con los datos de la ficha: precio, año, km, motor, transmisión, combustible, ' +
    'consumo aproximado, equipamiento relevante y una línea de estado ("en excelente estado, ' +
    'listo para transferir"). No aclares "está usado" si ya diste los km (es redundante). ' +
    'Solo datos de la ficha.'
  unaVez(m, VIEJO, 'prompt (Paso 3, burbuja de ficha)')

  const NUEVO =
    '- Una burbuja que ARRANCA por el porqué, no por el motor: una frase corta sacada del ' +
    'campo `descripcion` de la ficha, quedándote con lo que le sirve a ESTE cliente (no la ' +
    'copies entera ni la pegues textual). Recién después van los datos relevantes de la ' +
    'ficha: precio, año, km, motor, transmisión, combustible, consumo aproximado y ' +
    'equipamiento relevante. Solo datos de la ficha.\n' +
    '- Si el campo `condicionantes` trae algo que le importa a ESTE cliente, lo decís en UNA ' +
    'frase y como criterio honesto de vendedor ("tené en cuenta que la potencia es justa ' +
    'para el tamaño"). Nunca los enumeres todos ni los presentes como lista de defectos: eso ' +
    'espanta la venta. Si no viene al caso, no lo menciones.'

  m = m.replace(VIEJO, NUEVO)
}

// ══════════════════════════════ post-condiciones

// Ojo: `condicionantes` CONTIENE el substring "condicion". Hay que buscar la columna, no la
// palabra, o la aserción da falso positivo contra la columna nueva de v17.
for (const n of ['Listar stock', 'Buscar auto', 'Detalle auto']) {
  const q = nodo(n).parameters.query
  assert(!/metadata->>'condicion'/.test(q), `${n}: todavía trae la columna condicion`)
  assert(!/\bAS condicion\s*[,\n]/.test(q), `${n}: quedó un alias "AS condicion"`)
}
assert(nodo('Detalle auto').parameters.query.includes('regexp_replace(content'), 'no quedó la limpieza del content')
assert(nodo('Detalle auto').parameters.query.includes('jsonb_typeof'), 'se perdió el fallback de fotos')
assert(nodo('Hidratar autos').parameters.query === JSON.parse(readFileSync(SRC, 'utf8')).nodes.find((k) => k.name === 'Hidratar autos').parameters.query, 'no se debe tocar Hidratar autos (arma las cards)')
for (const [n, c] of [['Listar stock', 'tamano'], ['Buscar auto', 'descripcion'], ['Detalle auto', 'condicionantes']]) {
  assert(nodo(n).parameters.query.includes(`AS ${c}`), `${n}: se perdió la columna ${c} de v17`)
}
{
  const q = nodo('Listar stock').parameters.query
  const proy = q.slice(q.indexOf('SELECT id, titulo'), q.indexOf('FROM (\n'))
  assert(!proy.includes('precio_num'), 'precio_num se filtró a la proyección')
  assert(proy.includes('tamano'), 'se perdió tamano de la proyección')
  assert(q.includes('END AS categoria'), 'se perdió la categoría')
  assert(q.includes('NOT EXISTS (SELECT 1 FROM en_presupuesto)'), 'se perdió el fallback de v14')
}

assert(m !== antes, 'el prompt no cambió')
assert(m.startsWith('='), 'se perdió el "=" inicial')
assert((m.match(/\{\{/g) || []).length === EXPR, 'se perdió alguna expresión {{ }}')
assert((m.match(/TRATO:/g) || []).length === 1, 'se tocó la regla TRATO de v15')
assert((m.match(/SIN PRESUPUESTO DECLARADO/g) || []).length === 1, 'se tocó el gate de v16')
assert(m.includes('viñeta "- "'), 'no quedó la regla de viñeta')
assert(m.includes('ARRANCA por el porqué'), 'no quedó la regla del detalle')
assert(!m.includes('carroceria, condicion, anio'), 'quedó condicion en la enumeración de campos')

franco.parameters.options.systemMessage = m

console.log('✓ todas las aserciones pasan')
console.log('  (A) fuera `condicion` de las 3 tools + limpieza del content en Detalle auto')
console.log('  (B) viñeta obligatoria en las listas')
console.log(`  (C) Paso 3: primero descripcion, después ficha  (prompt ${antes.length} -> ${m.length})`)

if (checkOnly) {
  console.log('\n(--check: no se escribió nada)')
} else {
  writeFileSync(OUT, JSON.stringify(wf, null, 2))
  console.log(`\n escrito -> ${OUT}`)
}
