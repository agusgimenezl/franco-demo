// RENDERIZA LA QUERY DE `Listar stock` A SQL EJECUTABLE, PARA PODER CORRERLA CONTRA LA BASE.
//
// POR QUÉ EXISTE: la regla del proyecto dice que antes de desplegar una SQL o una expresión hay que
// RENDERIZARLA Y EJECUTARLA, y que los escenarios salgan de los CASOS REALES. Sin esto, "la query
// está bien" es una lectura, no una medición — y las dos veces que se dio por buena una lectura
// (v138, v139) terminaron en revert.
//
// CÓMO: evalúa cada bloque {{ }} igual que n8n, con un `$fromAI` y un `$('Config')` de mentira que
// devuelven los valores del escenario. De paso valida que el JS de adentro compile: si un bloque
// tiene un error de sintaxis, revienta acá y no en producción.
//
// USO:
//   node scripts/render-listar-stock.mjs <workflow.json> <escenario>
//   node scripts/render-listar-stock.mjs workflows/franco-n8n-v141.json bug-presupuesto-sin-usado
//   node scripts/render-listar-stock.mjs workflows/franco-n8n-v141.json --lista

import fs from 'node:fs'

// ── LOS ESCENARIOS SALEN DE CASOS REALES DE LA SUITE, NO DE MI IMAGINACIÓN ────────────────────
export const ESCENARIOS = {
  // `presupuesto-sin-usado-no-se-traba` T1 — el bug de Agustina. El modelo manda tiene_permuta=0 y
  // omite los usado_*: en v137/v140 eso es un rechazo de schema; acá tiene que devolver autos.
  'bug-presupuesto-sin-usado': {
    params: { precio_objetivo: 20000000, tiene_permuta: 0 },
    config: { entrega_plata: 0, entrega_plata_resp: 0, entrega_plata_hist: 0, monto_financiar: 0, pidio_ver: 1, tamano_pedido: '', carroceria_pedida: '' },
    espera: 'autos, sin centinela',
  },
  // `capacidad-de-compra-financiada` T3 — EL CASO QUE ROMPIÓ v138 Y v139. Permuta completa.
  'permuta-completa': {
    params: { precio_objetivo: 7000000, tiene_permuta: 1, con_financiacion: 1, usado_marca: 'Ford', usado_modelo: 'Ka', usado_anio: 2015, usado_km: 100000, usado_categoria: 'chico' },
    config: { entrega_plata: 7000000, entrega_plata_resp: 0, entrega_plata_hist: 0, monto_financiar: 0, pidio_ver: 1, tamano_pedido: '', carroceria_pedida: '' },
    espera: 'autos con tramo, SIN centinela',
  },
  // El mismo caso pero con el usado incompleto: es el modo de falla SILENCIOSO de v139.
  'permuta-sin-datos-del-usado': {
    params: { precio_objetivo: 7000000, tiene_permuta: 1, con_financiacion: 1 },
    config: { entrega_plata: 7000000, entrega_plata_resp: 0, entrega_plata_hist: 0, monto_financiar: 0, pidio_ver: 1, tamano_pedido: '', carroceria_pedida: '' },
    espera: 'EXACTAMENTE 1 fila: la centinela, con id NULL',
  },
  // Permuta con marca/modelo/año pero SIN km: el km tiene neutro declarado ("Poner 0 si no los
  // sabes"), así que NO tiene que disparar la centinela.
  'permuta-sin-km': {
    params: { precio_objetivo: 7000000, tiene_permuta: 1, con_financiacion: 1, usado_marca: 'Ford', usado_modelo: 'Ka', usado_anio: 2015, usado_km: 0, usado_categoria: 'chico' },
    config: { entrega_plata: 7000000, entrega_plata_resp: 0, entrega_plata_hist: 0, monto_financiar: 0, pidio_ver: 1, tamano_pedido: '', carroceria_pedida: '' },
    espera: 'autos, SIN centinela (el km no es parte de la guarda)',
  },
  // `stock-general` — el camino más transitado de todos: ver todo, sin plata ni usado.
  'stock-general': {
    params: { precio_objetivo: 0, tiene_permuta: 0 },
    config: { entrega_plata: 0, entrega_plata_resp: 0, entrega_plata_hist: 0, monto_financiar: 0, pidio_ver: 1, tamano_pedido: '', carroceria_pedida: '' },
    espera: 'los 17 autos, sin centinela',
  },
  // `hatchback-que-entra-no-se-silencia` T1 — presupuesto + carrocería pedida, sin usado.
  'hatchback-24m': {
    params: { precio_objetivo: 24000000, tiene_permuta: 0 },
    config: { entrega_plata: 0, entrega_plata_resp: 0, entrega_plata_hist: 0, monto_financiar: 0, pidio_ver: 1, tamano_pedido: '', carroceria_pedida: 'hatchback' },
    espera: 'autos con el hatchback más caro promovido a entra',
  },
}

export function render(query, params, config) {
  return query.replace(/\{\{([\s\S]*?)\}\}/g, (m, code) => {
    const $fromAI = (key, desc, tipo, def) => {
      const v = Object.prototype.hasOwnProperty.call(params, key) ? params[key] : def
      if (v === undefined) throw new Error(`el escenario no define "${key}" y el parámetro NO tiene default (es required)`)
      return v
    }
    const ctx = { item: { json: config }, first: () => ({ json: config }) }
    const $ = () => ctx
    const $node = new Proxy({}, { get: () => ({ json: config }) })
    try {
      return String(new Function('$fromAI', '$', '$node', `return (${code})`)($fromAI, $, $node))
    } catch (e) {
      throw new Error(`bloque {{ }} inválido: ${e.message}\n---\n${code.trim().slice(0, 200)}`)
    }
  })
}

if (process.argv[1] && process.argv[1].endsWith('render-listar-stock.mjs')) {
  const [, , archivo, nombre] = process.argv
  if (!archivo || !nombre) {
    console.error('uso: node scripts/render-listar-stock.mjs <workflow.json> <escenario|--lista>')
    process.exit(1)
  }
  if (nombre === '--lista') {
    for (const [k, v] of Object.entries(ESCENARIOS)) console.log(`${k.padEnd(30)} ${v.espera}`)
    process.exit(0)
  }
  const esc = ESCENARIOS[nombre]
  if (!esc) { console.error(`escenario desconocido: ${nombre}`); process.exit(1) }
  const wf = JSON.parse(fs.readFileSync(archivo, 'utf8'))
  const q = wf.nodes.find((n) => n.name === 'Listar stock').parameters.query
  console.log(render(q, esc.params, esc.config))
}
