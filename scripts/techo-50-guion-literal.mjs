// v91 -> v92 · el "50%" pasa de DESCRIPCIÓN a GUION LITERAL
//
// MEDIDO: `financiacion-techo-50-por-ciento` da **3/4 en v90 y 1/3 en v91**, y en las 3 rojas
// falla **SÓLO el check del "50%"** — el de los **$60.000.000 pasa siempre**. O sea: el número
// sale bien y estable; lo que se cae es el PORQUÉ. (v91 es inerte en ese turno: sólo tocó el gate
// de `## Permuta`, y `# Financiación` quedó byte a byte. Lo que el 1/3 mide es inestabilidad, no
// una regresión.)
//
// CAUSA, Y ES MÍA: en v90 escribí una DESCRIPCIÓN de lo que Franco tiene que decir
// (*"decíselo en UNA oración natural, sin recitar la regla como un reglamento"*) en vez de darle
// la FRASE. Trampa 6 al derecho: lo que adhiere es el guion textual. Encima le pedí explícitamente
// que no sonara a reglamento, que es una invitación a podar justo la parte que se estaba podando.
//
// EL CAMBIO: la descripción se reemplaza por la frase entre comillas, con el "50%" adentro y los
// montos ya calculados. El guion del anticipo (v86, que mide 3/3–4/4) NO se toca: queda como la
// segunda mitad del mismo turno, en ese orden.
//
// 1 NODO, 1 CAMPO: `Franco (AI Agent)` → System Message.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v91.json'
const DESTINO = 'workflows/franco-n8n-v92.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage no arranca con "="')

const SIM = '$node["Config"].json.empresa_moneda_simbolo'
const miles = (js) => `String(${js}).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')`
const MONTO = '$node["Config"].json.monto_financiar'

const VIEJO =
  "ANTES de esa pregunta va UNA frase con la cuenta, que YA ESTÁ HECHA y NO la recalculás: como financiamos hasta el 50% del valor del vehículo, para financiar ese monto el auto tiene que valer al menos ' + " +
  SIM + ' + ' + miles(`${MONTO} * 2`) +
  " + ', y entre anticipo y usado el cliente tiene que cubrir la otra mitad (al menos ' + " +
  SIM + ' + ' + miles(MONTO) +
  " + '). Decíselo en UNA oración natural, sin recitar la regla como un reglamento, y recién después preguntá el anticipo. Los montos son EXACTAMENTE esos: no los redondees ni los recalcules."

if (sm.split(VIEJO).length !== 2) throw new Error('no encontré (una sola vez) la descripción de v90 a reemplazar')

// La frase, TEXTUAL. El "50%" va adentro del guion, no en una instrucción sobre el guion.
const NUEVO =
  'ANTES de esa pregunta va, TEXTUAL, esta frase —ya está calculada: no la recalcules, no la resumas y no le saques el porcentaje—: "Tené en cuenta que financiamos hasta el 50% del valor del vehículo, así que para financiar ' +
  "' + " + SIM + ' + ' + miles(MONTO) +
  " + ' el auto tiene que valer al menos ' + " + SIM + ' + ' + miles(`${MONTO} * 2`) +
  " + ', y la otra mitad la cubrís vos entre anticipo y usado.\". Primero esa frase, después la pregunta del anticipo, en ese orden y nada más en el medio."

franco.parameters.options.systemMessage = sm.replace(VIEJO, () => NUEVO)
const smNuevo = franco.parameters.options.systemMessage

// ── Aserciones ──────────────────────────────────────────────────────────────
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name)
ok(JSON.stringify(distintos) === JSON.stringify(['Franco (AI Agent)']),
  `esperaba UN solo nodo con diferencias; hay: ${JSON.stringify(distintos)}`)
ok(smNuevo.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')

// Lo que NO se toca
const cuerpo = (s) => s.slice(s.indexOf('ANTES QUE NADA, SI TE HICIERON UNA PREGUNTA'), s.indexOf('## Paso 3'))
ok(cuerpo(smNuevo) === cuerpo(sm), 'el cuerpo de ## Permuta cambió y no debe')
ok(JSON.stringify(wf.nodes.find((n) => n.name === 'Listar stock')) ===
   JSON.stringify(antes.nodes.find((n) => n.name === 'Listar stock')), 'se tocó Listar stock')
// El guion del anticipo (v86) sigue textual e intacto.
ok(smNuevo.includes('el guion es exactamente este: "dale. Y de anticipo, de cuánto pensás poner más o menos?"'),
  'se perdió el guion del anticipo de v86')
for (const frag of [
  'ESTA SECCIÓN NO CORRE EN ESTE TURNO',   // v88
  'está hablando de PLATA',                // v87
  'MONTO A FINANCIAR',                     // v86
  'El abanico va SOLO después de que el cliente diga que SÍ', // v85
]) ok(smNuevo.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)
// Ya no queda la instrucción que invitaba a podar el porcentaje.
ok(!smNuevo.includes('sin recitar la regla como un reglamento'),
  'quedó la instrucción vieja que invitaba a resumir la frase')

// PRUEBA VINCULANTE: la expresión compila y la frase renderizada tiene el "50%" Y los dos montos.
const i = smNuevo.indexOf('monto_financiar > 0', smNuevo.indexOf('# Financiación'))
const ini = smNuevo.lastIndexOf('{{', i), fin = smNuevo.indexOf('}}', i)
try {
  const f = new Function('$node', `return (${smNuevo.slice(ini + 2, fin)})`)
  const con = f({ Config: { json: { monto_financiar: 30000000, empresa_moneda_simbolo: '$' } } })
  const vacio = f({ Config: { json: { monto_financiar: 0, empresa_moneda_simbolo: '$' } } })
  ok(con.includes('50%'), 'la frase renderizada no contiene el 50%')
  ok(con.includes('$30.000.000'), 'la frase no contiene el monto a financiar')
  ok(con.includes('$60.000.000'), 'la frase no contiene el techo')
  // El "50%" tiene que estar DENTRO de la frase entrecomillada, no en una instrucción suelta.
  const desde = con.indexOf('"Tené en cuenta que')
  const hasta = con.indexOf('entre anticipo y usado.\"', desde)
  ok(desde > 0 && hasta > desde, 'no pude aislar la frase entrecomillada')
  ok(con.slice(desde, hasta).includes('50%'), 'el 50% quedó FUERA del guion entrecomillado')
  ok(vacio === '', 'con monto 0 la inyección no queda vacía')
  console.log('\n  frase que le queda a Franco:')
  console.log('  ' + con.slice(desde, hasta + 24))
} catch (e) {
  fallas.push(`la inyección NO COMPILA: ${e.message}`)
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log(`  único nodo con diferencias: Franco (AI Agent)`)
console.log(`  systemMessage: ${sm.length} -> ${smNuevo.length} chars`)
