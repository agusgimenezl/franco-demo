// v135 -> v136 · EL ANTICIPO SE ENTIENDE AUNQUE EL CLIENTE USE LA PALABRA "ANTICIPO"
//
// EL BUG (captura de Agustina 2026-08-12, charla del Etios): el cliente escribe
// "Puedo dar un anticipo de 10M" y Franco salta al name-ask sin preguntar las cuotas.
// Caso `preperfilado-cuotas-aunque-diga-la-palabra-anticipo`: **0/3 sobre v134**, reproducido.
//
// LA CAUSA, VERIFICADA EJECUTANDO EL PARSER REAL DE `Config`:
//   "Puedo dar un anticipo de 10M"  -> 0            <-- la captura
//   "un anticipo de 10 millones"    -> 0
//   "doy 10M de anticipo"           -> 10.000.000
//   "puedo dar 10 millones"         -> 10.000.000
// NO es "10M": eso el parser lo entiende perfecto. Es que entre el VERBO y el NÚMERO aparece la
// palabra "anticipo", y el grupo de relleno del regex sabe saltar `de|un|unos|como|hasta|aprox…`
// pero NO "anticipo". Sin match, `entrega_plata` da 0, `dioPlata` queda false y **el bloque de
// v113/v134 no dispara**: no sale la rama que pregunta las cuotas ni la que avisa que el anticipo
// no cubre el auto.
//
// POR QUÉ ESTE FIX VALE MÁS QUE EL SÍNTOMA: la guarda del anticipo que entró en v134 —la que le
// dice al cliente que le faltan $1.250.000 para el Etios— **depende de este mismo parser**. Con la
// redacción "un anticipo de X" nunca se enteraba del monto, así que no protegía. Arreglar el parser
// le devuelve el poder a un fix que ya está en producción.
//
// EL CAMBIO ES UNA SOLA COSA: se agregan `anticipo`, `se[ñn]a` e `inicial` al grupo de relleno del
// regex de `entrega_plata`. No se toca ningún verbo, ningún guard, ningún otro campo.
//
// NO SE TOCA `entrega_plata_resp` a propósito: con este arreglo `entrega_plata` ya captura la
// frase, así que `dioPlata` queda en true igual. Menos superficie, menos riesgo.
//
// TAMPOCO SE TOCA la guarda de v100 (el "no tengo" a secas que deja mudas a las tres guardas y
// produjo el "$70.000.000" inventado). Ese bug está diagnosticado pero **todavía no tiene caso de
// eval en rojo**, y la regla del proyecto es que el caso va primero. Va en otra versión.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v135.json'
const DESTINO = 'workflows/franco-n8n-v136.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const cfg = wf.nodes.find((n) => n.name === 'Config')
const campo = cfg.parameters.assignments.assignments.find((a) => a.name === 'entrega_plata')
ok(!!campo, 'no está el campo entrega_plata en Config')

const VIEJO = '(?:\\\\s|de|unos|un|como|aprox\\\\w*|alrededor|cerca|casi|hasta|\\\\$|ar\\\\$)*'
const NUEVO = '(?:\\\\s|de|unos|un|una|como|aprox\\\\w*|alrededor|cerca|casi|hasta|anticipo|se[\\u00f1n]a|inicial|\\\\$|ar\\\\$)*'

const antesValor = String(campo.value)
const veces = antesValor.split(VIEJO).length - 1
ok(veces === 1, `el grupo de relleno tenía que estar 1 vez en entrega_plata; está ${veces}`)

if (veces === 1) {
  campo.value = antesValor.split(VIEJO).join(NUEVO)
  ok(!String(campo.value).includes(VIEJO), 'quedó el grupo de relleno viejo')
  ok(String(campo.value).includes('anticipo|se'), 'no entró la palabra anticipo al relleno')
}

// ── EL PARSER, EJECUTADO DE VERDAD ───────────────────────────────────────────────────────────
// No alcanza con que el string cambie: hay que correr la expresión. Se evalúa el valor nuevo tal
// como lo haría n8n, con el mismo shape de datos.
const evaluar = (expr, msg, leadEntrega = 'No mencionado') => {
  const cuerpo = String(expr).replace(/^=\{\{/, '').replace(/\}\}\s*$/, '')
  const $ = (n) => ({
    item: { json: n === 'Webhook Render' ? { body: { content: msg } } : { lead_entrega: leadEntrega } },
  })
  return new Function('$', `return (${cuerpo})`)($)
}

// LAS QUE FALLABAN Y TIENEN QUE PASAR A ANDAR
const ARREGLA = [
  ['Puedo dar un anticipo de 10M', 10000000],
  ['puedo dar un anticipo de 5.000.000', 5000000],
  ['doy una seña de 3 millones', 3000000],
  ['pongo de anticipo 8 millones', 8000000],
]
// LAS QUE YA ANDABAN Y NO SE PUEDEN MOVER (regresión)
const NO_SE_MUEVE = [
  ['doy 10M de anticipo', 10000000],
  ['puedo dar 10 millones', 10000000],
  ['entrego 7.000.000', 7000000],
  ['pongo 5 millones', 5000000],
]
// LAS QUE TIENEN QUE SEGUIR EN CERO (no son plata del cliente)
const SIGUE_EN_CERO = [
  ['quiero financiar 30.000.000', 0],
  ['tiene 135.000 km?', 0],
  ['me interesa la amarok 2018', 0],
  ['cuánto sale el etios?', 0],
  // LIMITACIÓN CONOCIDA, DEJADA A PROPÓSITO: sin verbo, no se captura. Soportar la forma pelada
  // ("un anticipo de 10 millones") obligaría a disparar con la sola palabra "anticipo" cerca de un
  // número, y eso capturaría al cliente que REPITE un número que le dijo Franco ("el anticipo
  // mínimo es 7.250.000?") tomándolo como su propio anticipo. Se prefiere no capturar a capturar
  // mal: cuando falta el monto, Franco lo vuelve a pedir; cuando lo toma mal, calcula todo mal.
  ['un anticipo de 10 millones', 0],
  ['el anticipo mínimo es 7.250.000?', 0],
]

if (!fallas.length) {
  for (const [msg, esperado] of [...ARREGLA, ...NO_SE_MUEVE, ...SIGUE_EN_CERO]) {
    let dio
    try {
      dio = evaluar(campo.value, msg)
    } catch (e) {
      dio = `ERROR: ${e.message}`
    }
    ok(dio === esperado, `"${msg}" -> dio ${dio}, esperaba ${esperado}`)
  }
  // El guard de "ya entrega usado" sigue mandando: si el lead dice que entrega, no es plata.
  ok(evaluar(campo.value, 'puedo dar un anticipo de 10M', 'Sí') === 0, 'se perdió el guard de lead_entrega')
}

// ── Nada más se movió ────────────────────────────────────────────────────────────────────────
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const distintos = wf.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name)
ok(distintos.length === 1 && distintos[0] === 'Config', `tocó ${distintos.length} nodos (${distintos.join(', ')}), tenía que tocar sólo "Config"`)
ok(wf.nodes.length === 35, `quedaron ${wf.nodes.length} nodos, tenían que ser 35`)

// Y dentro de Config, un solo campo.
const camposDistintos = cfg.parameters.assignments.assignments
  .filter((a, i) => JSON.stringify(a) !== JSON.stringify(antes.nodes.find((n) => n.name === 'Config').parameters.assignments.assignments[i]))
  .map((a) => a.name)
ok(
  camposDistintos.length === 1 && camposDistintos[0] === 'entrega_plata',
  `cambiaron los campos [${camposDistintos.join(', ')}] y tenía que cambiar sólo entrega_plata`,
)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  nodos: ${wf.nodes.length} · con diferencias: ${distintos.join(', ')} (campo: ${camposDistintos.join(', ')})`)
console.log(`  parser ejecutado: ${ARREGLA.length} frases que arregla · ${NO_SE_MUEVE.length} que no se mueven · ${SIGUE_EN_CERO.length} que siguen en 0`)
