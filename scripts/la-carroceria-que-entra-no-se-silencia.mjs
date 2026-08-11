// v124 -> v125 · LA CARROCERÍA QUE ENTRA TAMPOCO SE SILENCIA
//
// EL GEMELO DEL BUG DEL ETIOS, EN LA DIMENSIÓN CARROCERÍA. Mismo mecanismo que cerró v118 para el
// tamaño: la etiqueta 'economica' (precio < 90% del capital) más la línea 125 del prompt ("las
// economica NO se ofrecen") silencian al auto que el cliente pidió Y que le entra al bolsillo.
//
// MEDIDO ANTES DE TOCAR NADA — caso `hatchback-que-entra-no-se-silencia`, 3 corridas sobre v124
// vivo: **0/3**. Ninguna nombra el Peugeot 208, y una dice textual "no hay hatchback". En otra
// lista el Gol Trend ($9.200.000) a un cliente de $24.000.000 pero saltea el 208 ($21.000.000):
// le baja la gama justo salteando el único que le servía.
//
// VERIFICADO CONTRA LA BASE: con capital $24.000.000 los CUATRO hatchbacks caen en 'economica'
// (208 $21M, Etios $14,5M, Gol Trend $9,2M, Fiesta $8,2M), así que quedan CERO 'entra' y CERO
// 'estirar'. Y no es exclusivo del hatchback: barriendo capitales de $10M a $40M el agujero aparece
// en las cinco carrocerías (Hatchback 25 capitales, Utilitario 20, Sedán 13, SUV 8, Pickup 2).
//
// ES LA MITAD DE v118. El CTE `criterio` quedó diseñado genérico por criterio justamente para esto,
// así que sólo se agrega la parte de PROMOVER: el más caro que cumple la carrocería pedida y entra
// al bolsillo deja de estar silenciado. La parte de REETIQUETAR no va: para la carrocería ya existen
// el check `carroceria_solo_si_hay` y la prosa que prohíbe llamarle pickup a un hatchback.
//
// 🔴 LA TRAMPA QUE HABRÍA ROTO ESTO EN SILENCIO, ENCONTRADA ANTES DE ESCRIBIR EL FIX:
// `metadata.carroceria` guarda **"Sedán"** con tilde, y el detector de `Config` emite **"sedan"**
// sin tilde (su regex es /sed[aá]n/ y devuelve la forma sin acento). Un `lower(carroceria) =
// carroceria_pedida` NUNCA habría matcheado sedán —una de las cinco— y nadie se habría enterado,
// porque las otras cuatro funcionan. Por eso el match va con `translate(..., 'áéíóú', 'aeiou')`,
// y hay un assert que lo exige.
//
// EL ORDEN DEL CASE IMPORTA Y ESTÁ PENSADO: el tamaño manda sobre la carrocería. Si el cliente pidió
// "algo chico" y este auto cumple la carrocería pero NO el tamaño, va igual a 'otro_tamano'. Sin ese
// orden, la promoción por carrocería le pasaría por encima a la regla de tamaño de v118.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v124.json'
const DESTINO = 'workflows/franco-n8n-v125.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ls = wf.nodes.find((n) => n.name === 'Listar stock')
const qAntes = ls.parameters.query

// ── 1) `criterio` suma la carrocería ────────────────────────────────────────────────────────
const CRIT_VIEJO = `criterio AS (
  SELECT lower(trim('{{ $('Config').item.json.tamano_pedido }}')) AS tamano_pedido
),`
const CRIT_NUEVO = `criterio AS (
  SELECT lower(trim('{{ $('Config').item.json.tamano_pedido }}')) AS tamano_pedido,
         -- OJO CON LA TILDE: la base guarda 'Sedán' y el detector de Config emite 'sedan'. Sin
         -- normalizar, el match fallaría SÓLO para sedán y en silencio (v125).
         translate(lower(trim('{{ $('Config').item.json.carroceria_pedida }}')), 'áéíóú', 'aeiou') AS carroceria_pedida
),`
ok(qAntes.split(CRIT_VIEJO).length === 2, 'no encontré (1 vez) el CTE `criterio`')
let q = qAntes.replace(CRIT_VIEJO, () => CRIT_NUEVO)

// ── 2) `marcado` suma cumple_carr y su ranking ──────────────────────────────────────────────
const MARC_VIEJO = `    ) AS rk_tam
  FROM base b
),`
const MARC_NUEVO = `    ) AS rk_tam,
    ((SELECT carroceria_pedida FROM criterio) <> '' AND translate(lower(COALESCE(b.carroceria, '')), 'áéíóú', 'aeiou') = (SELECT carroceria_pedida FROM criterio)) AS cumple_carr,
    -- El MÁS CARO que cumple la carrocería pedida y entra en el presupuesto. Uno solo, igual que
    -- con el tamaño: promover todos los 'economica' le pondría un auto de 9 millones adelante a un
    -- cliente de 24, que es lo que la etiqueta existe para evitar.
    row_number() OVER (
      PARTITION BY ((SELECT carroceria_pedida FROM criterio) <> '' AND translate(lower(COALESCE(b.carroceria, '')), 'áéíóú', 'aeiou') = (SELECT carroceria_pedida FROM criterio) AND b.categoria_base = 'economica')
      ORDER BY b.precio_num DESC
    ) AS rk_carr
  FROM base b
),`
ok(qAntes.split(MARC_VIEJO).length === 2, 'no encontré (1 vez) el cierre de `marcado`')
q = q.replace(MARC_VIEJO, () => MARC_NUEVO)

// ── 3) el CASE, reordenado para que el tamaño siga mandando ─────────────────────────────────
const CASE_VIEJO = `      WHEN categoria_base = 'fuera' THEN 'fuera'
      WHEN (SELECT tamano_pedido FROM criterio) = '' THEN categoria_base
      WHEN NOT cumple_tam THEN 'otro_tamano'
      WHEN categoria_base = 'economica' AND rk_tam = 1 THEN 'entra'
      ELSE categoria_base`
const CASE_NUEVO = `      WHEN categoria_base = 'fuera' THEN 'fuera'
      -- (v118) El tamaño manda sobre la carrocería: si pidió un tamaño y este auto no lo cumple,
      -- va al grupo aparte AUNQUE cumpla la carrocería. Este orden es deliberado.
      WHEN (SELECT tamano_pedido FROM criterio) <> '' AND NOT cumple_tam THEN 'otro_tamano'
      -- (v118) el más caro que cumple el TAMAÑO y entra al bolsillo deja de estar silenciado
      WHEN cumple_tam AND categoria_base = 'economica' AND rk_tam = 1 THEN 'entra'
      -- (v125) lo mismo para la CARROCERÍA pedida
      WHEN cumple_carr AND categoria_base = 'economica' AND rk_carr = 1 THEN 'entra'
      ELSE categoria_base`
ok(qAntes.split(CASE_VIEJO).length === 2, 'no encontré (1 vez) el CASE de categoria')
q = q.replace(CASE_VIEJO, () => CASE_NUEVO)
ls.parameters.query = q

// ── Aserciones ──────────────────────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Listar stock']),
  `esperaba SÓLO Listar stock; hay: ${JSON.stringify(distintos)}`)
const sm = wf.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage
ok(sm.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok((qAntes.match(/\$fromAI\(/g) || []).length === (q.match(/\$fromAI\(/g) || []).length,
  'TRAMPA 3: cambió la cantidad de $fromAI')

// La tilde: si alguien saca el translate, esto lo caza.
ok((q.match(/translate\(lower/g) || []).length === 3,
  'esperaba 3 usos de translate(lower(...)) — uno en criterio y dos en marcado')
ok(!/lower\(COALESCE\(b\.carroceria/.test(q.replace(/translate\(lower\(COALESCE\(b\.carroceria[^)]*\)[^)]*\)/g, '')),
  'quedó una comparación de carrocería SIN normalizar la tilde')

// EL ASSERT DE v123: toda columna que el SELECT final le pide a `u` tiene que existir en
// `con_categoria`. Es el que habría cazado el defecto de v122 y ahora corre en cada cambio del CTE.
const listaCon = q.slice(q.indexOf('con_categoria AS ('), q.indexOf('en_presupuesto AS ('))
const colsCon = new Set()
for (const linea of listaCon.split('\n')) {
  const m = linea.match(/^\s*SELECT (.+),\s*$/)
  if (m) for (const c of m[1].split(',')) colsCon.add(c.trim())
  const alias = linea.match(/\bAS (\w+),?\s*$/)
  if (alias) colsCon.add(alias[1])
  const sueltas = linea.match(/^\s*(tramo, precio_num)\s*$/)
  if (sueltas) for (const c of sueltas[1].split(',')) colsCon.add(c.trim())
}
const finalSel = q.slice(q.lastIndexOf('SELECT id, titulo, precio, foto_principal'))
const pedidas = (finalSel.slice(0, finalSel.indexOf('FROM (')).match(/\b(id|titulo|precio|foto_principal|carroceria|color|anio|km|combustible|consumo|categoria|tramo|tamano|traccion|precio_num)\b/g) || [])
const faltantes = [...new Set(pedidas)].filter((c) => !colsCon.has(c))
ok(faltantes.length === 0, `el SELECT final pide columnas que con_categoria no produce: ${JSON.stringify(faltantes)}`)

// El texto viejo ya no está.
ok(!q.includes(CASE_VIEJO), 'el CASE viejo sigue ahí')
ok(q.split('AS cumple_carr').length === 2, '`cumple_carr` no quedó 1 vez')
ok(q.split('AS rk_carr').length === 2, '`rk_carr` no quedó 1 vez')

// ── La lógica del CASE, como función pura, contra la tabla de verdad ────────────────────────
const cat = (base, { tamPed = '', carrPed = '', cumpleTam = false, cumpleCarr = false, rkTam = 9, rkCarr = 9 }) => {
  if (base === 'fuera') return 'fuera'
  if (tamPed !== '' && !cumpleTam) return 'otro_tamano'
  if (cumpleTam && base === 'economica' && rkTam === 1) return 'entra'
  if (cumpleCarr && base === 'economica' && rkCarr === 1) return 'entra'
  return base
}
const casos = [
  // v125: lo nuevo
  ['el 208 con 24M pidiendo hatchback', cat('economica', { carrPed: 'hatchback', cumpleCarr: true, rkCarr: 1 }), 'entra'],
  ['el Gol Trend (2do hatchback) sigue silenciado', cat('economica', { carrPed: 'hatchback', cumpleCarr: true, rkCarr: 2 }), 'economica'],
  ['un sedán cuando pidió hatchback no se promueve', cat('economica', { carrPed: 'hatchback', cumpleCarr: false }), 'economica'],
  // v118: no se puede haber roto
  ['sin criterio ninguno, todo igual que antes', cat('economica', {}), 'economica'],
  ['sin criterio, entra sigue entra', cat('entra', {}), 'entra'],
  ['el Etios con 20M pidiendo chico', cat('economica', { tamPed: 'chico', cumpleTam: true, rkTam: 1 }), 'entra'],
  ['un mediano cuando pidió chico', cat('entra', { tamPed: 'chico', cumpleTam: false }), 'otro_tamano'],
  ['fuera nunca se toca', cat('fuera', { tamPed: 'chico', carrPed: 'hatchback', cumpleTam: true, cumpleCarr: true, rkTam: 1, rkCarr: 1 }), 'fuera'],
  // el orden: el tamaño manda sobre la carrocería
  ['cumple carrocería pero NO el tamaño pedido -> otro_tamano, no entra',
    cat('economica', { tamPed: 'chico', carrPed: 'suv', cumpleTam: false, cumpleCarr: true, rkCarr: 1 }), 'otro_tamano'],
  ['cumple las dos -> entra', cat('economica', { tamPed: 'chico', carrPed: 'hatchback', cumpleTam: true, cumpleCarr: true, rkTam: 1, rkCarr: 1 }), 'entra'],
]
let malos = 0
for (const [n, got, esp] of casos) if (got !== esp) { malos++; fallas.push(`CASE · ${n}: dio "${got}", esperaba "${esp}"`) }
console.log(`  la tabla de verdad del CASE: ${casos.length - malos}/${casos.length}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Listar stock')
console.log(`  query: ${qAntes.length} -> ${q.length} chars`)
console.log('\n  FALTA: correr la query RENDEREADA contra la base (la lección de v122).')
