// v103 -> v104 · ARREGLA UN ERROR MÍO: `entrega_plata_hist` tiraba TypeError en runtime
//
// QUÉ PASÓ. v100 compuso `entrega_plata_hist` con los dos parsers que ya existían (el de
// `entrega_plata`, con verbo, y el de `entrega_plata_resp`, pelado). La función que extrae el
// cuerpo de una expresión n8n quita `={{ ` y ` }}`, y lo que queda YA INCLUYE la invocación:
//     (() => { ... })()
// y yo escribí `(${A})()`, o sea una invocación de más:
//     (() => { ... })()()
// El campo terminaba en `})())(); })() }}` y tiraba
//     TypeError: (intermediate value)(...) is not a function
// así que `entrega_plata_hist` NUNCA devolvió un número. Sin anticipo del historial, ni la frase
// del techo (v100) dispara ni el acotamiento del capital en `Listar stock` se activa: los dos leen
// ese campo. Por eso `financiacion-techo-por-anticipo` siguió 0/3 después de desplegar v103.
//
// EL SQL ESTABA BIEN, Y ESO YA SE VERIFICÓ CONTRA LA BASE: sobre la sesión real
// 2653c307-60b2-49db-bc96-bf4a749ab128, reproduciendo el estado exacto del turno 3,
// `msg_anticipo_hist` devuelve "7 millones". El error estaba UNA CAPA DESPUÉS, en Config.
//
// POR QUÉ SE ME PASÓ, PARA NO REPETIRLO: v98 y v99 tenían prueba offline del parser derivado
// (8/8 y 14/14). En v100 probé el techo de `Listar stock` y la frase renderizada, pero NO probé el
// campo de Config. **Todo campo nuevo de Config va con prueba offline, sin excepción**: es barato
// y es la única capa que no se ve en el SQL ni en el prompt.
//
// UN SOLO NODO, UN SOLO CAMPO: `Config` -> `entrega_plata_hist`.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v103.json'
const DESTINO = 'workflows/franco-n8n-v104.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const cfg = wf.nodes.find((n) => n.name === 'Config')
const asg = cfg.parameters.assignments.assignments
const eph = asg.find((a) => a.name === 'entrega_plata_hist')
ok(!!eph, 'no está el campo entrega_plata_hist de v100')

// Se REGENERA desde los dos parsers vivos, igual que v100 pero sin la invocación de más.
const cuerpo = (v) => String(v).replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '')
const FUENTE_VIEJA = "String($('Webhook Render').item.json.body.content || '')"
const FUENTE_HIST = "String($('Leer lead (estado)').item.json.msg_anticipo_hist || '')"
const GUARDA_RESP = "if (!$('Leer lead (estado)').item.json.franco_pidio_anticipo) return 0;\n  "

const ep = asg.find((a) => a.name === 'entrega_plata')
const er = asg.find((a) => a.name === 'entrega_plata_resp')
ok(!!ep && !!er, 'faltan entrega_plata o entrega_plata_resp')
ok(String(ep.value).split(FUENTE_VIEJA).length === 2, 'entrega_plata cambió de forma')
ok(String(er.value).split(GUARDA_RESP).length === 2, 'entrega_plata_resp cambió de forma')

const A = cuerpo(ep.value).replace(FUENTE_VIEJA, () => FUENTE_HIST)
const B = cuerpo(er.value).replace(GUARDA_RESP, () => '').replace(FUENTE_VIEJA, () => FUENTE_HIST)
// A y B YA vienen invocados: `(() => {...})()`. No se les agrega `()`.
const NUEVO = `={{ (() => { const a = ${A}; return a || ${B}; })() }}`

ok(String(eph.value) !== NUEVO, 'el campo ya estaba corregido')
eph.value = NUEVO

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Config']), `esperaba SOLO Config; hay: ${JSON.stringify(distintos)}`)
// El error exacto que se está arreglando no puede volver.
ok(!NUEVO.includes(')()()'), 'quedó una invocación de más')
ok(!/\}\)\(\)\)\(\)/.test(NUEVO), 'quedó el patrón })())() que causaba el TypeError')
// Los campos de los que depende, intactos.
const antesCfg = antes.nodes.find((n) => n.name === 'Config').parameters.assignments.assignments
for (const nm of ['entrega_plata', 'entrega_plata_resp', 'monto_financiar', 'monto_financiar_hist']) {
  ok(JSON.stringify(asg.find((a) => a.name === nm)) === JSON.stringify(antesCfg.find((a) => a.name === nm)),
    `se tocó ${nm} y no debe`)
}

// ── LA PRUEBA QUE FALTÓ EN v100 ─────────────────────────────────────────────
{
  const src = cuerpo(NUEVO)
  try {
    const f = new Function('$', `return (${src})`)
    const run = (msg_anticipo_hist, lead_entrega = 'No mencionado') =>
      f(() => ({ item: { json: { msg_anticipo_hist, lead_entrega, franco_pidio_anticipo: true } } }))
    const casos = [
      ['7 millones', 'No mencionado', 7000000],        // EL CASO MEDIDO (sesión 2653c307)
      ['6 millones', 'No mencionado', 6000000],
      ['12 millones', 'No mencionado', 12000000],
      ['$5.000.000', 'No mencionado', 5000000],
      ['Puedo entregar 5.000.000?', 'No mencionado', 5000000],  // rama con VERBO
      ['entrego 6 millones', 'No mencionado', 6000000],
      ['unos 7 millones', 'No mencionado', 7000000],
      ['', 'No mencionado', 0],
      ['36 cuotas', 'No mencionado', 0],
      ['100.000 km', 'No mencionado', 0],
      ['tengo un gol trend 2015', 'No mencionado', 0],
      ['7 millones', 'Sí', 7000000],   // con usado declarado, la rama pelada igual lo lee
    ]
    let bien = 0
    for (const [txt, ent, esp] of casos) {
      let got
      try { got = run(txt, ent) } catch (e) { got = `TypeError: ${e.message.slice(0, 40)}` }
      if (got === esp) bien++
      else fallas.push(`entrega_plata_hist: ${JSON.stringify(txt)} (lead_entrega=${ent}) -> ${got}, esperaba ${esp}`)
    }
    console.log(`  entrega_plata_hist: ${bien}/${casos.length}`)
  } catch (e) {
    fallas.push(`entrega_plata_hist NO COMPILA: ${e.message}`)
  }
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Config (sólo el campo entrega_plata_hist)')
