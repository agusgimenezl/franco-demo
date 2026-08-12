// v134 -> v135 · LOS FILTROS OPCIONALES DE LAS TOOLS DE BÚSQUEDA DEJAN DE SER OBLIGATORIOS
//
// ATACA EL BUG MÁS FRECUENTE DE FRANCO EN PRODUCCIÓN: la burbuja "Uy, se me trabó el sistema un
// segundo". Medido contra el corpus el 2026-08-12: **400 burbujas de 13.486 (2,97%), en 280 de
// 2.881 sesiones (9,7%)**. Casi 1 de cada 10 conversaciones le muestra un error al cliente.
//
// CAUSA RAÍZ, LEÍDA DEL LOG (ejecución 15996, turno "me interesa la volkswagen amarok"). El nodo
// `Franco (AI Agent)` no devolvió `output` sino:
//     "Received tool input did not match expected schema
//      ✖ Required → at precio_min ✖ Required → at precio_max ✖ Required → at km_max"
// El modelo llamó a la herramienta sin esos tres filtros; n8n RECHAZÓ la llamada entera; el agente
// terminó en error; `Armar respuesta` no encontró `output.messages` y cayó al fallback. Ni el
// Structured Output Parser ni las tools llegaron a correr.
//
// POR QUÉ: en n8n, un `$fromAI` SIN cuarto argumento queda marcado REQUIRED en el schema de la
// tool. En v134 **ninguno de los 31 `$fromAI` del workflow tiene defaultValue**, así que todos son
// obligatorios — incluidos filtros que sólo aplican a veces (km_max no significa nada si el cliente
// nunca habló de kilómetros).
//
// LA PISTA DE QUE ESTO ERA UN DESCUIDO Y NO UNA DECISIÓN: las descripciones YA documentan el valor
// neutro ("Poner 0 si no menciono ninguno", "Poner vacio si no menciono ninguno"). El diseño
// esperaba que el modelo mandara 0; lo que no previó es que a veces simplemente OMITE el campo.
//
// EL FIX: agregar `defaultValue` a los 8 filtros opcionales de `Listar stock` y `Buscar auto`, con
// exactamente el valor neutro que su propia descripción ya declara. No se toca ninguna descripción
// ni ningún tipo, así que la semántica para el modelo no cambia: sólo deja de ser obligatorio.
//
// ALCANCE ACOTADO A PROPÓSITO (un cambio por vez): NO se tocan `Guardar lead` (11 params) ni
// `Detalle auto` (auto_id es genuinamente obligatorio: sin id no hay ficha que traer), ni los flags
// `tiene_permuta`/`con_financiacion`, que van en el flujo principal y el modelo sí manda. Los 3
// parámetros del error medido están todos incluidos.
//
// TRAMPA 3 (la que hace fallar a n8n con "Duplicate key found with different description or type"):
// cada key tiene que quedar BYTE-IDÉNTICA en todas sus ocurrencias. Verificado antes: las 8 keys
// tienen hoy una sola variante de texto. Como el reemplazo es textual sobre el string exacto, las
// N ocurrencias cambian juntas — y hay un assert que lo comprueba después.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v134.json'
const DESTINO = 'workflows/franco-n8n-v135.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// key -> [texto exacto de la llamada SIN default, valor por defecto, ocurrencias esperadas por nodo]
const CAMBIOS = [
  ['Listar stock', 'precio_objetivo', "$fromAI('precio_objetivo', 'El techo de presupuesto real del cliente en pesos, sin estirar. Poner 0 si no dio presupuesto.', 'number')", '0', 1],
  ['Listar stock', 'anio_min', "$fromAI('anio_min', 'Anio minimo del auto que acepta el cliente (ej: 2022). Si pide los ultimos N anios, restar N-1 al anio actual. Poner 0 si no menciono ninguno.', 'number')", '0', 2],
  ['Listar stock', 'km_max', "$fromAI('km_max', 'Kilometraje maximo que acepta el cliente, en kilometros (ej: 50000). Poner 0 si no menciono ninguno.', 'number')", '0', 2],
  ['Listar stock', 'precio_min', "$fromAI('precio_min', 'Precio minimo en pesos. Poner 0 si no hay piso.', 'number')", '0', 2],
  ['Listar stock', 'precio_max', "$fromAI('precio_max', 'Precio maximo en pesos. Poner 0 si no hay techo.', 'number')", '0', 2],
  ['Buscar auto', 'color', "$fromAI('color', 'El color que pidio el cliente (gris, blanco, negro, azul, rojo, verde). Poner vacio si no menciono ninguno.', 'string')", "''", 2],
  ['Buscar auto', 'transmision', "$fromAI('transmision', 'La transmisión que busca el cliente: automatica (incluye CVT) o manual. Vacío si no mencionó ninguna.', 'string')", "''", 2],
  ['Buscar auto', 'traccion', "$fromAI('traccion', 'La traccion que busca el cliente: 4x2 o 4x4. Vacio si no menciono ninguna.', 'string')", "''", 2],
  ['Buscar auto', 'precio_min', "$fromAI('precio_min', 'Precio minimo en pesos. Poner 0 si no hay piso.', 'number')", '0', 2],
  ['Buscar auto', 'precio_max', "$fromAI('precio_max', 'Precio maximo en pesos. Poner 0 si no hay techo.', 'number')", '0', 2],
  ['Buscar auto', 'km_max', "$fromAI('km_max', 'Kilometraje maximo que acepta el cliente, en kilometros (ej: 50000). Poner 0 si no menciono ninguno.', 'number')", '0', 2],
]

const conDefault = (texto, def) => texto.replace(/\)$/, `, ${def})`)

for (const [nodo, key, viejo, def, esperadas] of CAMBIOS) {
  const n = wf.nodes.find((x) => x.name === nodo)
  ok(!!n, `no está el nodo "${nodo}"`)
  if (!n) continue
  let s = JSON.stringify(n.parameters)
  const veces = s.split(viejo).length - 1
  ok(veces === esperadas, `${nodo}.${key}: esperaba ${esperadas} ocurrencia(s), hay ${veces}`)
  if (veces !== esperadas) continue
  s = s.split(viejo).join(conDefault(viejo, def))
  // El texto viejo YA NO PUEDE ESTAR (aserción que pide el proyecto). Se compara contra la forma
  // sin default seguida de un carácter que no sea coma, para no confundirla con la nueva.
  ok(!s.includes(viejo.slice(0, -1) + ')'), `${nodo}.${key}: quedó una ocurrencia sin default`)
  n.parameters = JSON.parse(s)
}

// ── TRAMPA 3: ninguna key puede quedar con dos textos distintos ───────────────────────────────
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
      if (q) {
        if (c === '\\') i++
        else if (c === q) q = null
      } else if (c === "'" || c === '"') q = c
      else if (c === '(') prof++
      else if (c === ')') prof--
      i++
    }
    out.push(s.slice(m.index, i))
  }
  return out
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
for (const [k, variantes] of porKey) {
  ok(variantes.size === 1, `TRAMPA 3: la key "${k}" quedó con ${variantes.size} textos distintos — n8n va a rechazar el workflow`)
}

// ── Los 8 filtros quedaron opcionales y NADA MÁS cambió de obligatoriedad ────────────────────
const sinDefault = (l) => {
  // 3 args = key, description, type. Un 4º arg = defaultValue.
  const cuerpo = l.slice(l.indexOf('(') + 1, l.lastIndexOf(')'))
  let prof = 0
  let q = null
  let comas = 0
  for (let i = 0; i < cuerpo.length; i++) {
    const c = cuerpo[i]
    if (q) {
      if (c === '\\') i++
      else if (c === q) q = null
    } else if (c === "'" || c === '"') q = c
    else if (c === '(' || c === '[') prof++
    else if (c === ')' || c === ']') prof--
    else if (c === ',' && prof === 0) comas++
  }
  return comas < 3
}

const opcionales = new Set()
for (const [k, variantes] of porKey) if (!sinDefault([...variantes][0])) opcionales.add(k)
const ESPERADAS = new Set(['precio_objetivo', 'anio_min', 'km_max', 'precio_min', 'precio_max', 'color', 'transmision', 'traccion'])
ok(
  opcionales.size === ESPERADAS.size && [...ESPERADAS].every((k) => opcionales.has(k)),
  `las keys opcionales quedaron [${[...opcionales].sort()}] y se esperaban [${[...ESPERADAS].sort()}]`,
)
// Las 3 del error medido, explícitas: son la razón de ser de esta versión.
for (const k of ['precio_min', 'precio_max', 'km_max']) ok(opcionales.has(k), `"${k}" —del error medido— quedó obligatorio`)
// Y lo que NO se toca sigue obligatorio.
for (const k of ['auto_id', 'session_id', 'tiene_permuta', 'con_financiacion']) {
  ok(!opcionales.has(k), `"${k}" se volvió opcional y este cambio no lo incluye`)
}

// ── Nada más del workflow se movió ───────────────────────────────────────────────────────────
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const distintos = wf.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name)
ok(
  distintos.length === 2 && distintos.includes('Listar stock') && distintos.includes('Buscar auto'),
  `tocó ${distintos.length} nodos (${distintos.join(', ')}), tenía que tocar sólo "Listar stock" y "Buscar auto"`,
)
ok(wf.nodes.length === 35, `quedaron ${wf.nodes.length} nodos, tenían que ser 35`)
// El SQL de las tools no se toca: si cambió una query, algo se rompió de más.
// La comparación es EXACTA: se reconstruye la query esperada aplicando a la original los mismos
// reemplazos que hizo este script, y tiene que dar idéntica. (Una normalización floja del tipo
// "sacar todo `, 0)`" NO sirve: el SQL está lleno de COALESCE(x, 0) legítimos y daba falso rojo.)
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

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  nodos: ${wf.nodes.length} · con diferencias: ${distintos.join(', ')}`)
console.log(`  filtros que pasan a opcionales: ${[...opcionales].sort().join(', ')}`)
console.log('  trampa 3 verificada: ninguna key con dos textos distintos')
