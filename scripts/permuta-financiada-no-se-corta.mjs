// v105 -> v106 · CON PERMUTA + FINANCIACIÓN, EL ABANICO SE CORTA A LA MITAD DEL TECHO
//
// EL BUG. `Listar stock` decide con DOS clasificaciones y después las AND-ea:
//   · `categoria` mide la capacidad SIN financiar: capital, capital x 1,40, o capital + usado x 0,70.
//   · `tramo`     mide la capacidad FINANCIADA:    (capital + usado x 0,70) x 2, o sea el 50%.
// Los dos filtros del WHERE final se aplican juntos, así que con permuta manda el más chico y la
// financiación deja de existir. Con el caso medido —anticipo $7.000.000, Ford Ka 2015 de 100.000 km
// tasado en $8.832.460— el techo financiado es $26.365.000 y el de `categoria` $13.182.000:
// Onix, 208, EcoSport, Duster, Corolla y Renegade quedan `categoria='fuera'` aunque `tramo` los
// acepte, y el cliente ve TRES hatchbacks en vez de once autos.
//
// VERIFICADO CONTRA LA BASE ANTES DE ESCRIBIR ESTO (Supabase por MCP, 2026-08-06), con los
// parámetros EXACTOS del `inputOverride` de la ejecución 13306:
//   con el filtro de categoria:  Etios $12.500.000, Gol Trend $9.200.000, Fiesta $8.200.000.
//   sólo con el de tramo:        esos tres + Cronos, Kangoo, EcoSport, 208, Onix, Duster, Corolla
//                                y Renegade = 11 autos, y NINGUNA pickup (todas por encima de
//                                $26.365.000, o sea tramo='fuera').
// Los 11 son exactamente lo que piden los checks de `capacidad-de-compra-financiada`.
//
// REPRODUCIDO ANTES DE TOCAR NADA: el caso reescrito mide el abanico en el turno 3 (el cliente
// PIDE ver, así que el gate de permuta de v85 no aplica y v102 no se toca). Sobre v105, ventana
// 18:27:49-18:31:05, 0 ejecuciones en error: el turno 3 falla `text_matches onix|208|ecosport|
// duster|corolla|renegade` **3 de 3**, y las tres respuestas arrancan listando el Etios.
//
// EL CAMBIO — UN NODO, UNA CONDICIÓN. El filtro de `categoria` deja de aplicarse cuando el cliente
// financia, porque ahí el techo ya lo pone `tramo`:
//     NOT (tiene_permuta = 1 AND u.categoria = 'fuera')
//  -> NOT (tiene_permuta = 1 AND con_financiacion <> 1 AND u.categoria = 'fuera')
// Al contado (con_financiacion <> 1) queda todo igual que hoy: ahí `tramo` vale 'n/a' y no filtra
// nada, así que el de `categoria` es el único techo y tiene que seguir estando.
//
// LO QUE NO SE TOCA, A PROPÓSITO:
//   · el gate de permuta de v85 (`tiene_permuta = 1 AND pidio_ver = 0`): es v102, es lo que Agustina
//     pidió, y sigue devolviendo el centinela en el turno en que el cliente DA datos sin pedir ver.
//   · el CTE `cap` de v100, que ya se abstiene de acotar cuando hay permuta.
//   · el filtro de `tramo='fuera'`, que es el techo real y el que saca las pickups.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v105.json'
const DESTINO = 'workflows/franco-n8n-v106.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// ─────────────────────────────────────────────────────────── el cambio
const ls = wf.nodes.find((n) => n.name === 'Listar stock')
const qAntes = ls.parameters.query

const bloques = (clave) => {
  const re = new RegExp(`\\{\\{ \\$fromAI\\('${clave}'[^}]*\\}\\}`, 'g')
  return qAntes.match(re) || []
}
const bPermuta = bloques('tiene_permuta')
const bFinancia = bloques('con_financiacion')
ok(bPermuta.length > 0 && new Set(bPermuta).size === 1, 'los bloques de tiene_permuta no son idénticos entre sí (trampa 3)')
ok(bFinancia.length > 0 && new Set(bFinancia).size === 1, 'los bloques de con_financiacion no son idénticos entre sí (trampa 3)')

// El bloque de con_financiacion va TEXTUAL, tal cual está hoy: la trampa 3 exige descripción y
// tipo byte-idénticos en todas las ocurrencias de una misma key.
const VIEJO = `AND NOT (${bPermuta[0]} = 1 AND u.categoria = 'fuera')`
const NUEVO = `AND NOT (${bPermuta[0]} = 1 AND ${bFinancia[0]} <> 1 AND u.categoria = 'fuera')`
ok(qAntes.split(VIEJO).length === 2, 'no encontré (una sola vez) el filtro de categoria del WHERE final')

ls.parameters.query = qAntes.replace(VIEJO, () => NUEVO)
const qDespues = ls.parameters.query

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Listar stock']),
  `esperaba SÓLO Listar stock; hay: ${JSON.stringify(distintos)}`)

// EL TEXTO VIEJO YA NO ESTÁ.
ok(qDespues.split(VIEJO).length === 1, 'el filtro viejo sigue en la query')
ok(qDespues.split(NUEVO).length === 2, 'el filtro nuevo falta o está duplicado')

// TRAMPA 3: cada key de $fromAI, byte-idéntica en todas sus ocurrencias, y el MISMO conjunto de
// keys que antes (si cambiara, cambiaría la firma de la tool).
{
  const porClave = {}
  for (const b of qDespues.match(/\{\{[^{}]*\$fromAI\('([a-z_]+)'[^}]*\}\}/g) || []) {
    const k = b.match(/\$fromAI\('([a-z_]+)'/)[1]
    ;(porClave[k] = porClave[k] || []).push(b.match(/\$fromAI\('[a-z_]+',[^)]*\)/)[0])
  }
  for (const [k, v] of Object.entries(porClave)) {
    ok(new Set(v).size === 1, `TRAMPA 3: la key ${k} tiene ${new Set(v).size} formas distintas de $fromAI`)
  }
  const claves = (q) => [...new Set(q.match(/\$fromAI\('([a-z_]+)'/g) || [])].sort()
  ok(JSON.stringify(claves(qAntes)) === JSON.stringify(claves(qDespues)),
    'cambió el CONJUNTO de keys de $fromAI: la tool cambiaría de firma')
}

// Los gates que viven en Listar stock siguen ahí, ENTEROS. El de v85/v102 es el que no se toca.
ok(qDespues.includes(`AND NOT (${bPermuta[0]} = 1 AND ${"{{ $('Config').item.json.pidio_ver }}"} = 0)`),
  'se perdió el gate de permuta de v85 (el que sostiene v102)')
for (const frag of [
  "$('Config').item.json.pidio_ver",
  "$('Config').item.json.monto_financiar",
  "$('Config').item.json.entrega_plata",
  'WITH cap AS (',                                  // v100
  "u.tramo = 'fuera'",                              // el techo real
]) ok(qDespues.includes(frag), `se perdió algo previo de Listar stock: ${frag}`)

// Ningún otro nodo se toca.
for (const nm of ['Config', 'Leer lead (estado)', 'Franco (AI Agent)', 'Detalle auto', 'Buscar auto',
                  'Armar respuesta', 'Guardar lead']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

// ── PRUEBA OFFLINE: renderizar la query GENERADA a SQL puro, para probarla contra la base.
// No se transcribe a mano: se evalúa cada bloque {{ }} del v106 generado con los valores EXACTOS
// del `inputOverride` de la ejecución 13306. Lo que sale de acá es lo que se corre en Supabase.
const render = (query, ai, cfg) => {
  let out = ''
  let i = 0
  let n = 0
  while (true) {
    const a = query.indexOf('{{', i)
    if (a === -1) { out += query.slice(i); break }
    const b = query.indexOf('}}', a)
    if (b === -1) throw new Error('un bloque {{ quedó sin cerrar')
    out += query.slice(i, a)
    const src = query.slice(a + 2, b)
    const f = new Function('$fromAI', '$', '$node', `return (${src})`)
    out += String(f((k) => ai[k], () => ({ item: { json: cfg } }), { Config: { json: cfg } }))
    i = b + 2
    n++
  }
  ok(n === (query.match(/\{\{/g) || []).length, 'el renderizador no cubrió todos los bloques {{ }}')
  return out
}

const AI = {
  precio_objetivo: 7000000, tiene_permuta: 1, con_financiacion: 1,
  usado_anio: 2015, usado_marca: 'Ford', usado_modelo: 'Ka', usado_categoria: 'chico',
  usado_km: 100000, anio_min: 0, km_max: 0, precio_min: 0, precio_max: 0,
}
const CFG = { pidio_ver: 1, monto_financiar: 0, entrega_plata: 0, entrega_plata_resp: 0, entrega_plata_hist: 0 }

const escenarios = {
  // (1) EL CASO: turno 3, pidió ver, permuta + financiación. Tiene que devolver los 11.
  'turno3-pidio-ver': [AI, CFG],
  // (2) CONTROL v102: turno 2, mismo cliente, NO pidió ver. Tiene que devolver CERO filas.
  'turno2-no-pidio-ver': [AI, { ...CFG, pidio_ver: 0 }],
  // (3) CONTROL contado: permuta SIN financiación. Tiene que quedar como hoy (el filtro de
  //     categoria sigue siendo el único techo).
  'contado-sin-financiacion': [{ ...AI, con_financiacion: 0 }, CFG],
  // (4) CONTROL km alto (`capacidad-km-alto-achica`): 250.000 km bajan la tasación, así que
  //     Corolla y Renegade tienen que seguir AFUERA por tramo.
  'km-alto-250k': [{ ...AI, usado_km: 250000 }, CFG],
}

const dir = process.env.SQL_OUT || '.'
for (const [nombre, [ai, cfg]] of Object.entries(escenarios)) {
  try {
    fs.writeFileSync(`${dir}/v106-${nombre}.sql`, render(qDespues, ai, cfg))
  } catch (e) {
    fallas.push(`no pude renderizar el escenario ${nombre}: ${e.message}`)
  }
}
// Y el MISMO escenario (1) sobre la query VIEJA, para tener el antes y el después medibles.
try {
  fs.writeFileSync(`${dir}/v105-turno3-pidio-ver.sql`, render(qAntes, AI, CFG))
} catch (e) {
  fallas.push(`no pude renderizar el escenario de v105: ${e.message}`)
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Listar stock')
console.log(`  Listar stock query: ${qAntes.length} -> ${qDespues.length} chars`)
console.log(`  SQL renderizado para probar contra la base en ${dir}/ (4 escenarios + el de v105)`)
