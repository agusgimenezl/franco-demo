// v137 -> v139 · TERMINAR LO QUE v135 DEJÓ A MEDIAS: LOS 8 $fromAI QUE FALTABAN EN LAS TOOLS DE LECTURA
//
// v135 hizo opcionales 8 filtros (precio_min, precio_max, km_max, anio_min, precio_objetivo, color,
// transmision, traccion) porque el log probó que su ausencia hacía que n8n RECHAZARA la llamada
// entera y el cliente recibiera "Uy, se me trabó el sistema". Quedaron 8 más en las mismas dos
// tools, por acotar el alcance. Siguen rompiendo por el mismo motivo: el fallback apareció en 8 de
// las 9 corridas de los controles medidos hoy.
//
// POR QUÉ ESTE CAMBIO ES SEGURO Y v138 NO LO ERA — la diferencia importa y hoy costó un revert:
// **v138 SACABA un insumo** (los pisos) y por eso podía romper a los 16 casos que lo consumen.
// **Esto AGREGA un valor por defecto**: no cambia lo que la tool hace cuando el modelo manda el
// parámetro, sólo evita que la llamada se rechace cuando no lo manda. La superficie de cambio es
// "lo que antes era un error, ahora es el valor neutro".
//
// LOS DEFAULTS NO SE INVENTARON: 5 de los 8 están escritos en la propia descripción del parámetro
//   tiene_permuta      -> 0    ("0 si no")
//   con_financiacion   -> 0    ("0 si paga al contado o no lo menciono")
//   usado_km           -> 0    ("Poner 0 si no los sabes")
//   marca_o_modelo     -> ''   ("Poner vacio si el cliente no nombro ninguno")
//   usado_anio         -> 0    (neutro; sólo se evalúa si tiene_permuta = 1)
//   usado_marca        -> ''   (ídem)
//   usado_modelo       -> ''   (ídem)
//   usado_categoria    -> ''   (ídem)
//
// GUARDAR LEAD QUEDA AFUERA, Y NO POR PRUDENCIA GENÉRICA: su ON CONFLICT protege campo por campo
// con criterios DISTINTOS. `nombre` conserva el valor viejo si el nuevo es '', pero
// `vehiculo_interes` lo conserva sólo si el nuevo es 'No mencionado'. Un default '' en
// vehiculo_interes **pisaría el dato existente con vacío** y se perdería el auto de interés del
// lead en silencio. Eso es peor que el error que se está arreglando. Va en otra versión, con el
// default correcto campo por campo. `Detalle auto.auto_id` tampoco: sin id no hay ficha que traer.
//
// ⚠️ RIESGO CONOCIDO Y DECLARADO ANTES DE MEDIR: si el modelo manda `tiene_permuta = 1` pero omite
// `usado_marca`, hoy la llamada se rechaza (el cliente pierde el turno entero) y con este cambio
// va a correr con la valuación del usado en 0 (subestimando su capacidad de compra). Se prefiere la
// respuesta degradada al turno perdido, pero **es un cambio de comportamiento real, no una mejora
// pura**. Si aparece un caso de permuta con la valuación en 0, la causa es ésta.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v137.json'
const DESTINO = 'workflows/franco-n8n-v139.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// [nodo, key, texto exacto SIN default, default, ocurrencias esperadas]
const CAMBIOS = [
  ['Listar stock', 'tiene_permuta', "$fromAI('tiene_permuta', 'Poner 1 si el cliente dijo que entrega un auto usado en parte de pago, 0 si no.', 'number')", '0', 9],
  ['Listar stock', 'con_financiacion', "$fromAI('con_financiacion', 'Poner 1 si el cliente va a financiar, dio un anticipo, o pregunto por cuotas/financiacion. 0 si paga al contado o no lo menciono.', 'number')", '0', 8],
  ['Listar stock', 'usado_anio', "$fromAI('usado_anio', 'El anio del auto usado que entrega el cliente (ej: 2015).', 'number')", '0', 3],
  ['Listar stock', 'usado_marca', "$fromAI('usado_marca', 'La marca del auto usado que entrega el cliente (ej: Ford).', 'string')", "''", 1],
  ['Listar stock', 'usado_modelo', "$fromAI('usado_modelo', 'El modelo del auto usado que entrega el cliente (ej: Ka).', 'string')", "''", 1],
  ['Listar stock', 'usado_categoria', "$fromAI('usado_categoria', 'La categoria del usado para el fallback: chico (hatchback), mediano (sedan o SUV chica), grande (SUV grande o pickup).', 'string')", "''", 1],
  ['Listar stock', 'usado_km', "$fromAI('usado_km', 'Los kilometros del auto usado que entrega el cliente (ej: 100000). Poner 0 si no los sabes.', 'number')", '0', 2],
  ['Buscar auto', 'marca_o_modelo', "$fromAI('marca_o_modelo', 'La marca y/o el modelo del auto que busca el cliente, ya corregido de typos (ej: Toyota Corolla, Volkswagen Amarok). Tambien vale una carroceria (pickup, SUV, sedan). Poner vacio si el cliente no nombro ninguno.', 'string')", "''", 8],
]

const conDefault = (t, d) => t.replace(/\)$/, `, ${d})`)

for (const [nodo, key, viejo, def, esperadas] of CAMBIOS) {
  const n = wf.nodes.find((x) => x.name === nodo)
  ok(!!n, `no está el nodo "${nodo}"`)
  if (!n) continue
  let s = JSON.stringify(n.parameters)
  const veces = s.split(viejo).length - 1
  ok(veces === esperadas, `${nodo}.${key}: esperaba ${esperadas} ocurrencia(s), hay ${veces}`)
  if (veces !== esperadas) continue
  s = s.split(viejo).join(conDefault(viejo, def))
  ok(!s.includes(viejo.slice(0, -1) + ')'), `${nodo}.${key}: quedó una ocurrencia sin default`)
  n.parameters = JSON.parse(s)
}

// ── TRAMPA 3: ninguna key con dos textos distintos, en TODO el workflow ──────────────────────
const llamadas = (s) => {
  const out = []
  const RE = /\$fromAI\(/g
  let m
  while ((m = RE.exec(s))) {
    let i = m.index + m[0].length
    let prof = 1
    let q = null
    while (i < s.length && prof > 0) {
      const c = s[i]
      if (q) { if (c === '\\') i++; else if (c === q) q = null }
      else if (c === "'" || c === '"') q = c
      else if (c === '(') prof++
      else if (c === ')') prof--
      i++
    }
    out.push(s.slice(m.index, i))
  }
  return out
}

const argCount = (l) => {
  const cuerpo = l.slice(l.indexOf('(') + 1, l.lastIndexOf(')'))
  let prof = 0, q = null, comas = 0
  for (let i = 0; i < cuerpo.length; i++) {
    const c = cuerpo[i]
    if (q) { if (c === '\\') i++; else if (c === q) q = null }
    else if (c === "'" || c === '"') q = c
    else if (c === '(' || c === '[') prof++
    else if (c === ')' || c === ']') prof--
    else if (c === ',' && prof === 0) comas++
  }
  return comas + 1
}

const porKey = new Map()
for (const n of wf.nodes) {
  for (const l of llamadas(JSON.stringify(n.parameters || {}))) {
    const k = l.match(/\$fromAI\(\s*'([a-zA-Z_]+)'/)?.[1]
    if (!k) continue
    if (!porKey.has(k)) porKey.set(k, new Set())
    porKey.get(k).add(l)
  }
}
for (const [k, v] of porKey) ok(v.size === 1, `TRAMPA 3: la key "${k}" quedó con ${v.size} textos distintos`)

// ── QUÉ QUEDÓ OPCIONAL Y QUÉ SIGUE OBLIGATORIO ───────────────────────────────────────────────
const opcionales = new Set()
const obligatorias = new Set()
for (const [k, v] of porKey) (argCount([...v][0]) >= 4 ? opcionales : obligatorias).add(k)

const ESPERADAS_OPC = new Set([
  // las de v135
  'precio_objetivo', 'anio_min', 'km_max', 'precio_min', 'precio_max', 'color', 'transmision', 'traccion',
  // las de v139
  'tiene_permuta', 'con_financiacion', 'usado_anio', 'usado_marca', 'usado_modelo', 'usado_categoria', 'usado_km', 'marca_o_modelo',
])
for (const k of ESPERADAS_OPC) ok(opcionales.has(k), `"${k}" tenía que quedar opcional y quedó obligatoria`)
for (const k of opcionales) ok(ESPERADAS_OPC.has(k), `"${k}" quedó opcional y NO estaba en el plan`)

// Lo que NO se toca sigue obligatorio: Guardar lead entero + auto_id.
const INTOCABLES = ['auto_id', 'session_id', 'nombre', 'vehiculo_interes', 'entrega', 'descripcion_usado', 'presupuesto', 'financia', 'temperatura', 'estado', 'resumen', 'info_nueva']
for (const k of INTOCABLES) ok(obligatorias.has(k), `"${k}" se volvió opcional y este cambio NO lo incluye`)

// ── El SQL no se movió: comparación EXACTA reconstruyendo la query esperada ──────────────────
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
for (const nodo of ['Listar stock', 'Buscar auto']) {
  const a = String(antes.nodes.find((x) => x.name === nodo).parameters.query)
  const b = String(wf.nodes.find((x) => x.name === nodo).parameters.query)
  let esperada = a
  for (const [n2, , viejo, def] of CAMBIOS) {
    if (n2 !== nodo) continue
    esperada = esperada.split(viejo).join(conDefault(viejo, def))
  }
  ok(b === esperada, `${nodo}: la query cambió en algo más que los defaults`)
}

// Guardar lead y Detalle auto tienen que quedar BYTE-IDÉNTICOS.
for (const nodo of ['Guardar lead', 'Detalle auto']) {
  const a = JSON.stringify(antes.nodes.find((x) => x.name === nodo))
  const b = JSON.stringify(wf.nodes.find((x) => x.name === nodo))
  ok(a === b, `${nodo} cambió y tenía que quedar intacto`)
}

const distintos = wf.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name)
ok(distintos.length === 2 && distintos.includes('Listar stock') && distintos.includes('Buscar auto'), `tocó ${distintos.length} nodos (${distintos.join(', ')})`)
ok(wf.nodes.length === 35, `quedaron ${wf.nodes.length} nodos, tenían que ser 35`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  nodos: ${wf.nodes.length} · con diferencias: ${distintos.join(', ')}`)
console.log(`  opcionales ahora: ${opcionales.size} (eran 8) · siguen obligatorias: ${obligatorias.size}`)
console.log(`  ${[...obligatorias].sort().join(', ')}`)
console.log('  Guardar lead y Detalle auto: byte-idénticos')
