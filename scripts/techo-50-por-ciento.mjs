// v89 -> v90 · el techo del 50%, calculado y dicho
//
// REPORTE DE AGUSTINA: Franco fija la regla de negocio ("financiamos hasta el 50%") y después la
// contradice. Al que quiere financiar $30.000.000 no le dice que el vehículo tiene que valer al
// menos $60.000.000; y cuando ese cliente ofrece $5.000.000 de anticipo, lo da por válido en vez
// de explicarle que con eso el techo es un auto de $10.000.000.
//
// PRUEBA VINCULANTE — ejecución `11621`: `Listar stock` ← `precio_objetivo: 30000000` (el monto A
// FINANCIAR usado como si fuera el techo) → la tool calcula 30M × 2 = 60M y Franco termina
// ofreciendo la Ford Ranger de $57.000.000 a alguien que tiene 5 millones. Se vio otra vez en el
// baseline de `financiacion-no-dumpea-abanico-sin-pedirlo`: *"Teniendo en cuenta $30.000.000 de
// presupuesto, $5.000.000 de anticipo y financiación hasta el 50%"*.
//
// LA REGLA DEL PROYECTO MANDA: la aritmética es determinística, así que va a código, no al prompt.
//   financiado <= 50% del precio   =>   precio >= 2 × financiado
//   con anticipo A y sin usado     =>   financiable = A, techo = 2A
// COINCIDE EXACTO CON LA FÓRMULA QUE YA USA `Listar stock` ((anticipo + usado×0.70) × 2), así que
// lo que Franco DICE concuerda con los autos que la tool DEVUELVE. Eso es lo que hace que la
// respuesta sea coherente y no dos números peleados — que era el corazón del reporte.
//
// LOS DOS MONTOS YA ESTÁN CALCULADOS: `monto_financiar` (v86) y `entrega_plata` (v87). Este cambio
// NO agrega ningún campo nuevo a `Config`: sólo usa los que ya hay.
//
// 1 NODO: `Franco (AI Agent)`. Se EXTIENDEN los dos guiones que ya existen, uno por turno:
//   · el de `# Financiación` (v86), que corre cuando declara cuánto quiere financiar;
//   · el gate de `## Permuta` (v88), que corre cuando declara cuánto entrega de anticipo.
// SE EXTIENDEN, NO SE AGREGAN: meter un tercer guion para el mismo turno es exactamente la trampa
// 6 (dos guiones concretos compitiendo). Un turno, un guion.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v89.json'
const DESTINO = 'workflows/franco-n8n-v90.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage no arranca con "="')

const SIM = '$node["Config"].json.empresa_moneda_simbolo'
const miles = (js) => `String(${js}).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')`
const MONTO = '$node["Config"].json.monto_financiar'
const ENTREGA = '$node["Config"].json.entrega_plata'

// ── (1) `# Financiación`: el techo cuando declara cuánto quiere FINANCIAR ────
const ANCLA_1 = "este turno tiene UN solo objetivo, pedírselo, y el guion es exactamente este: \"dale. Y de anticipo, de cuánto pensás poner más o menos?\"."
if (sm.split(ANCLA_1).length !== 2) throw new Error('no encontré (una sola vez) el guion de v86 en # Financiación')

// El guion de v86 vive dentro del string de la expresión, así que la cuenta se suma cerrando y
// reabriendo el literal (`' + expresión + '`). Los montos los calcula la expresión, no el modelo.
const INSERTO_1 =
  ANCLA_1 +
  " ANTES de esa pregunta va UNA frase con la cuenta, que YA ESTÁ HECHA y NO la recalculás: como financiamos hasta el 50% del valor del vehículo, para financiar ese monto el auto tiene que valer al menos ' + " +
  SIM + ' + ' + miles(`${MONTO} * 2`) +
  " + ', y entre anticipo y usado el cliente tiene que cubrir la otra mitad (al menos ' + " +
  SIM + ' + ' + miles(MONTO) +
  " + '). Decíselo en UNA oración natural, sin recitar la regla como un reglamento, y recién después preguntá el anticipo. Los montos son EXACTAMENTE esos: no los redondees ni los recalcules."

franco.parameters.options.systemMessage = sm.replace(ANCLA_1, () => INSERTO_1)

// ── (2) El gate de `## Permuta` (v88): el techo cuando declara el ANTICIPO ───
const sm2 = franco.parameters.options.systemMessage
const ANCLA_2 = " de anticipo seguimos.\" y después la pregunta que te falte del embudo de financiación (las cuotas, si no las dio)."
if (sm2.split(ANCLA_2).length !== 2) throw new Error('no encontré (una sola vez) el guion del gate de v88')

const INSERTO_2 =
  " de anticipo seguimos.\", seguido de UNA frase con la cuenta, que YA ESTÁ HECHA y NO la recalculás: con ese anticipo y sin usado se puede financiar hasta otro tanto, así que el techo es un auto de ' + " +
  SIM + ' + ' + miles(`${ENTREGA} * 2`) +
  " + '. Si el cliente había dicho que quería financiar MÁS que eso, decíselo derecho —con ese anticipo no le da— y ofrecele las dos salidas: buscar opciones para el anticipo que tiene, o subir el anticipo. Recién después va la pregunta que te falte del embudo de financiación (las cuotas, si no las dio)."

franco.parameters.options.systemMessage = sm2.replace(ANCLA_2, () => INSERTO_2)

// ── Aserciones ──────────────────────────────────────────────────────────────
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }
const smNuevo = franco.parameters.options.systemMessage

ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name)
ok(JSON.stringify(distintos) === JSON.stringify(['Franco (AI Agent)']),
  `esperaba UN solo nodo con diferencias; hay: ${JSON.stringify(distintos)}`)
ok(smNuevo.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok(!antes.nodes.find((n) => n.name === 'Listar stock') ||
   JSON.stringify(wf.nodes.find((n) => n.name === 'Listar stock')) ===
   JSON.stringify(antes.nodes.find((n) => n.name === 'Listar stock')),
   'se tocó Listar stock y no corresponde (el gate de v89 no se toca)')
ok(!smNuevo.includes('$node["Config"].json.techo'), 'no se agregan campos nuevos a Config')

// El CUERPO de ## Permuta (las 68 líneas) sigue byte a byte: sólo cambia el gate de arriba.
const cuerpo = (s) => s.slice(s.indexOf('ANTES QUE NADA, SI TE HICIERON UNA PREGUNTA'), s.indexOf('## Paso 3'))
ok(cuerpo(smNuevo) === cuerpo(sm), 'el cuerpo de ## Permuta cambió y no debe')
// Los fixes previos siguen
for (const frag of [
  'está hablando de PLATA',                    // v87
  'ESTA SECCIÓN NO CORRE EN ESTE TURNO',       // v88
  'MONTO A FINANCIAR',                         // v86
  'El abanico va SOLO después de que el cliente diga que SÍ', // v85
]) ok(smNuevo.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)

// PRUEBA VINCULANTE: las dos expresiones compilan y dan los números EXACTOS.
function render(texto, desde, marca, bind) {
  const d = desde >= 0 ? desde : 0
  const i = texto.indexOf(marca, d)
  const ini = texto.lastIndexOf('{{', i)
  const fin = texto.indexOf('}}', i)
  try {
    const f = new Function('$node', `return (${texto.slice(ini + 2, fin)})`)
    return { con: f(bind.con), sin: f(bind.sin) }
  } catch (e) { return { error: `no compila: ${e.message}` } }
}
const bindF = {
  con: { Config: { json: { monto_financiar: 30000000, entrega_plata: 0, empresa_moneda_simbolo: '$' } } },
  sin: { Config: { json: { monto_financiar: 0, entrega_plata: 0, empresa_moneda_simbolo: '$' } } },
}
const r1 = render(smNuevo, smNuevo.indexOf('# Financiación'), 'monto_financiar > 0', bindF)
ok(!r1.error, `inyección de # Financiación: ${r1.error}`)
if (!r1.error) {
  ok(r1.con.includes('$60.000.000'), `la cuenta de # Financiación no da $60.000.000. Renderiza: ${String(r1.con).slice(-260)}`)
  ok(r1.con.includes('$30.000.000'), 'falta el anticipo mínimo en # Financiación')
  ok(r1.sin === '', 'con monto 0 la inyección de # Financiación no queda vacía')
}
const bindP = {
  con: { Config: { json: { entrega_plata: 5000000, monto_financiar: 0, empresa_moneda_simbolo: '$' } } },
  sin: { Config: { json: { entrega_plata: 0, monto_financiar: 0, empresa_moneda_simbolo: '$' } } },
}
const r2 = render(smNuevo, smNuevo.indexOf('## Permuta'), 'entrega_plata > 0', bindP)
ok(!r2.error, `gate de ## Permuta: ${r2.error}`)
if (!r2.error) {
  ok(r2.con.includes('$10.000.000'), `la cuenta del gate no da $10.000.000. Renderiza: ${String(r2.con).slice(-260)}`)
  ok(r2.con.includes('$5.000.000'), 'el gate perdió el monto del anticipo')
  ok(r2.sin === '', 'con entrega 0 el gate no queda vacío')
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  único nodo con diferencias: Franco (AI Agent)`)
console.log(`  systemMessage: ${sm.length} -> ${smNuevo.length} chars`)
console.log(`  cuentas verificadas: 30.000.000 -> techo 60.000.000 · anticipo 5.000.000 -> techo 10.000.000`)
