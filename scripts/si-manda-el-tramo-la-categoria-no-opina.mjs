// v107 -> v108 · SI MANDA EL `tramo`, LA `categoria` NO OPINA
//
// EL BUG, Y ES LA MITAD QUE LE FALTÓ A v106. v106 sacó el filtro que cortaba el abanico financiado
// y funcionó DONDE APUNTABA: en la ejecución 13522 (turno 3 del caso, ya sobre v107) `Listar stock`
// devolvió los ONCE autos previstos, con sus tramos entrada/intermedio/alto y ninguna pickup.
// PERO EL CLIENTE SIGUIÓ VIENDO TRES. Texto completo de esa misma ejecución:
//   "Con tu usado como parte de pago y tu efectivo, estas opciones te pueden servir:
//    - Toyota Etios 2019 ... - Volkswagen Gol Trend 2018 ... - Ford Fiesta 2017 ...
//    Y si querés algo de más categoría, entregando tu usado podrías llegar a estas otras,
//    dependiendo de cuánto te lo tomen: - Renault Kangoo 2021 ... - Fiat Cronos 2023 ..."
// El corte cae EXACTAMENTE en la frontera de `categoria`: los 3 que vienen 'estirar' como bloque
// principal, y de los 8 que vienen 'fuera' sólo asoman los dos más baratos, como apéndice.
//
// O SEA QUE FRANCO NO DESOBEDECIÓ NADA: hizo al pie de la letra lo que el SM enseña sobre 'fuera'
// ("se pasa del presupuesto... los mostrás, y decís con todas las letras que se van del presupuesto,
// después ofrecés los caminos: permuta, financiación, o que un asesor tase el usado"). El abanico
// por tramos nunca se dispara porque la etiqueta lo manda a otro guion — y de paso sale el
// "entregando tu usado podrías llegar", que es el lenguaje que el SM prohíbe dos párrafos más abajo.
//
// LA CAUSA REAL, QUE v106 NO TOCÓ: con financiación las dos clasificaciones miden techos distintos.
// `categoria` mide contra $13.182.000 (capital + usado x 0,70) y `tramo` contra $26.365.000 (eso x2).
// v106 sacó el FILTRO pero dejó la ETIQUETA mintiendo. El error de diseño es mío y lo cazó el log.
//
// EL CAMBIO — UN NODO, UNA RAMA DE CASE. Cuando la financiación está activa y hay capital —o sea,
// exactamente cuando `tramo` deja de valer 'n/a' y pasa a decidir—, `categoria` devuelve 'entra':
//     WHEN con_financiacion = 1 AND capital > 0 THEN 'entra'
// Y 'entra' es LA VERDAD, no un parche: la query ya excluyó por `tramo` todo lo que se pasa del
// techo financiado, así que cada fila que sale de acá está dentro de lo que el cliente puede comprar.
// Al contado no cambia nada: ahí `tramo` vale 'n/a' y `categoria` sigue siendo el único techo.
//
// POR QUÉ NO SE REVIERTE v106, aunque con esto su filtro ya no llegue a dispararse en la rama
// financiada: los dos dicen el mismo principio en los dos lugares donde vive. Si mañana alguien
// toca el CASE, el filtro sigue protegiendo; si toca el filtro, el CASE sigue diciendo la verdad.
// Dejar sólo uno de los dos convierte esa coincidencia en un acoplamiento implícito.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v107.json'
const DESTINO = 'workflows/franco-n8n-v108.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ls = wf.nodes.find((n) => n.name === 'Listar stock')
const qAntes = ls.parameters.query

const bloques = (clave) => {
  const re = new RegExp(`\\{\\{ \\$fromAI\\('${clave}'[^}]*\\}\\}`, 'g')
  return qAntes.match(re) || []
}
const bFinancia = bloques('con_financiacion')
ok(bFinancia.length > 0 && new Set(bFinancia).size === 1, 'los bloques de con_financiacion no son idénticos entre sí (trampa 3)')

// El arranque del CASE de `categoria`, textual.
const VIEJO = `    CASE
      WHEN (SELECT capital FROM cap) = 0 THEN 'entra'`
const NUEVO = `    CASE
      -- SI MANDA EL TRAMO, LA CATEGORIA NO OPINA (v108). Con financiación y capital, el techo del
      -- cliente es (capital + usado x 0,70) x 2 y lo aplica \`tramo\`; \`categoria\` mide contra la
      -- mitad de eso, así que etiquetaría como 'fuera' autos que el cliente SÍ puede comprar. Y esa
      -- etiqueta no es cosmética: el SM manda a Franco a otro guion cuando la ve ("se pasa del
      -- presupuesto"), y por eso en la ejecución 13522 listó 3 de los 11 autos que la tool le dio.
      -- 'entra' acá es la verdad: la query ya sacó por \`tramo\` todo lo que se pasa del techo.
      WHEN ${bFinancia[0]} = 1 AND (SELECT capital FROM cap) > 0 THEN 'entra'
      WHEN (SELECT capital FROM cap) = 0 THEN 'entra'`
ok(qAntes.split(VIEJO).length === 2, 'no encontré (una sola vez) el arranque del CASE de categoria')

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
ok(qDespues.split(VIEJO).length === 1, 'el arranque viejo del CASE sigue en la query')
ok(qDespues.split('SI MANDA EL TRAMO, LA CATEGORIA NO OPINA').length === 2, 'la rama nueva falta o está duplicada')

// TRAMPA 3 y firma de la tool.
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

// Los gates y lo previo, enteros.
for (const frag of [
  "$('Config').item.json.pidio_ver",
  "$('Config').item.json.monto_financiar",
  "$('Config').item.json.entrega_plata",
  'WITH cap AS (',                                     // v100
  "u.tramo = 'fuera'",                                 // el techo real
  "<> 1 AND u.categoria = 'fuera'",                    // v106
]) ok(qDespues.includes(frag), `se perdió algo previo de Listar stock: ${frag}`)
for (const nm of ['Config', 'Leer lead (estado)', 'Franco (AI Agent)', 'Armar respuesta', 'Detalle auto']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

// ── PRUEBA OFFLINE: el SQL renderizado desde el v108 GENERADO, para correr contra la base.
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

// Los valores EXACTOS del `inputOverride` de la ejecución 13522.
const AI = {
  precio_objetivo: 7000000, tiene_permuta: 1, con_financiacion: 1,
  usado_anio: 2015, usado_marca: 'Ford', usado_modelo: 'Ka', usado_categoria: 'chico',
  usado_km: 100000, anio_min: 0, km_max: 0, precio_min: 0, precio_max: 0,
}
const CFG = { pidio_ver: 1, monto_financiar: 0, entrega_plata: 0, entrega_plata_resp: 0, entrega_plata_hist: 0 }

const escenarios = {
  // (1) EL CASO: los 11 tienen que salir TODOS con categoria='entra'.
  'turno3-pidio-ver': [AI, CFG],
  // (2) CONTROL v102: sigue devolviendo el centinela.
  'turno2-no-pidio-ver': [AI, { ...CFG, pidio_ver: 0 }],
  // (3) CONTROL contado: sin financiación, `categoria` sigue siendo el único techo y NO cambia.
  'contado-sin-financiacion': [{ ...AI, con_financiacion: 0 }, CFG],
  // (4) CONTROL `financiacion-techo-por-anticipo`: financia SIN permuta, capital $7.000.000,
  //     techo por tramo $14.000.000. Es el caso que hoy mide 3/3 y el más expuesto a este cambio.
  'financia-sin-permuta': [{ ...AI, tiene_permuta: 0, usado_anio: 0, usado_km: 0 }, CFG],
}

const dir = process.env.SQL_OUT || '.'
for (const [nombre, [ai, cfg]] of Object.entries(escenarios)) {
  try {
    fs.writeFileSync(`${dir}/v108-${nombre}.sql`, render(qDespues, ai, cfg))
  } catch (e) {
    fallas.push(`no pude renderizar el escenario ${nombre}: ${e.message}`)
  }
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
console.log(`  SQL renderizado en ${dir}/ (4 escenarios)`)
