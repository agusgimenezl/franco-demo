// v90 -> v91 · sacar la palabra "usado" del guion que YO escribí en v90
//
// REGRESIÓN MÍA, MEDIDA: `entregar-plata-no-es-permuta` bajó de **4/4 (v88) a 2/3 (v90)**.
// Causa: en v90 le agregué al gate la frase *"con ese anticipo **y sin usado** se puede financiar
// hasta otro tanto"*, y Franco la repite: *"Con ese anticipo y sin entregar un usado, podés
// financiar hasta…"*. El check `\busados?\b` la caza, y con razón.
//
// NO es que vuelva el bug original —no abre la permuta ni pide marca/modelo/año—, pero **le mete
// yo la palabra "usado" a un cliente que nunca mencionó ninguno**, que es exactamente lo que v87
// y v88 sacaron. En una demo, nombrar un usado inexistente es el mismo mal olor.
//
// Y LA ACLARACIÓN ES REDUNDANTE: el gate SÓLO dispara cuando `entrega_plata > 0`, y ese cálculo
// ya exige que no haya ningún vehículo en el mensaje Y que `lead_entrega` no sea "Sí". O sea que
// la ausencia de usado está GARANTIZADA por la condición del gate: no hace falta decirla, y el
// factor ×2 sigue siendo correcto.
//
// 1 NODO, 1 FRASE: `Franco (AI Agent)` → System Message.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v90.json'
const DESTINO = 'workflows/franco-n8n-v91.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage no arranca con "="')

const VIEJO = 'con ese anticipo y sin usado se puede financiar hasta otro tanto, así que el techo es un auto de '
const NUEVO = 'con ese anticipo se puede financiar hasta otro tanto, así que el techo es un auto de '
if (sm.split(VIEJO).length !== 2) throw new Error('no encontré (una sola vez) la frase de v90 a corregir')
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
ok(smNuevo.length === sm.length - (VIEJO.length - NUEVO.length),
  'el cambio no es exactamente la frase corregida')

// El gate NO puede nombrar el usado fuera de sus prohibiciones. Se cuenta cuántas veces aparece
// "usado" dentro del gate: las que quedan tienen que ser las de la lista de frases PROHIBIDAS
// y la del cierre ("si más adelante nombra un usado"), no una que Franco pueda copiar.
const iniGate = smNuevo.indexOf('PARÁ: ESTA SECCIÓN NO CORRE')
const finGate = smNuevo.indexOf("' : '' }}", iniGate)
const gate = smNuevo.slice(iniGate, finGate)
ok(iniGate > 0 && finGate > iniGate, 'no pude aislar el gate para verificarlo')
ok(!gate.includes('y sin usado'), 'la frase "y sin usado" sigue en el gate')
ok(!gate.includes('sin entregar un usado'), 'quedó otra variante de "sin usado" en el gate')

// Lo demás intacto
const cuerpo = (s) => s.slice(s.indexOf('ANTES QUE NADA, SI TE HICIERON UNA PREGUNTA'), s.indexOf('## Paso 3'))
ok(cuerpo(smNuevo) === cuerpo(sm), 'el cuerpo de ## Permuta cambió y no debe')
const financ = (s) => s.slice(s.indexOf('# Financiación'), s.indexOf('# Cotización de usados'))
ok(financ(smNuevo) === financ(sm), '# Financiación cambió: la cuenta de v90 no se toca acá')
for (const frag of [
  'ESTA SECCIÓN NO CORRE EN ESTE TURNO',   // v88
  'está hablando de PLATA',                // v87
  'MONTO A FINANCIAR',                     // v86
  'El abanico va SOLO después de que el cliente diga que SÍ', // v85
]) ok(smNuevo.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)
ok(JSON.stringify(wf.nodes.find((n) => n.name === 'Listar stock')) ===
   JSON.stringify(antes.nodes.find((n) => n.name === 'Listar stock')), 'se tocó Listar stock')

// PRUEBA VINCULANTE: el gate sigue compilando, la cuenta sigue dando $10.000.000, y ahora el
// texto renderizado NO contiene "usado" fuera de la lista de frases prohibidas.
const i = smNuevo.indexOf('entrega_plata > 0', smNuevo.indexOf('## Permuta'))
const ini = smNuevo.lastIndexOf('{{', i), fin = smNuevo.indexOf('}}', i)
try {
  const f = new Function('$node', `return (${smNuevo.slice(ini + 2, fin)})`)
  const con = f({ Config: { json: { entrega_plata: 5000000, empresa_moneda_simbolo: '$' } } })
  const vacio = f({ Config: { json: { entrega_plata: 0, empresa_moneda_simbolo: '$' } } })
  ok(con.includes('$10.000.000'), 'la cuenta dejó de dar $10.000.000')
  ok(con.includes('$5.000.000'), 'se perdió el monto del anticipo')
  ok(vacio === '', 'con 0 el gate no queda vacío')
  // Después de la lista de prohibiciones no puede quedar ningún "usado" copiable.
  const trasProhibiciones = con.slice(con.indexOf('"si la tasación acompaña"'))
  const sobrantes = (trasProhibiciones.match(/usado/gi) || []).length
  ok(sobrantes === 1, `quedan ${sobrantes} menciones de "usado" copiables en el guion (esperaba 1, la del cierre)`)
} catch (e) {
  fallas.push(`el gate NO COMPILA: ${e.message}`)
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  único nodo con diferencias: Franco (AI Agent)`)
console.log(`  systemMessage: ${sm.length} -> ${smNuevo.length} chars (−${sm.length - smNuevo.length})`)
