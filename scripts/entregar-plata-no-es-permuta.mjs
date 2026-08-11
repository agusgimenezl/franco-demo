// v86 -> v87 · "entregar $X" es PLATA, no un auto
//
// CAPTURA: el cliente pregunta "Puedo entregar 5.000.000?" (plata, como anticipo) y Franco lo
// lee como entregar un AUTO: "Sí, claro, recibimos usados como parte de pago… Qué auto
// entregás? Marca, modelo, año." El cliente nunca nombró ningún vehículo.
//
// BASELINE MEDIDO (`entregar-plata-no-es-permuta`, --repeat 4 --delay 25000, ventana
// 18:20:28-18:22:57 con 0 ejecuciones en error): **0/4**. Las 4 abren permuta.
//
// EL LOG MUESTRA QUE ES PEOR QUE LA CAPTURA — ejecución `11588`, `Guardar lead`:
//   entrega: "Sí" · descripcion_usado: "Auto usado mencionado, sin detalles"
//   presupuesto: "$5.000.000 + financiación $30.000.000"
// INVENTA UN USADO QUE NO EXISTE Y LO PERSISTE. Desde ese turno `Config.estado_cliente` dice
// "- Entrega un usado en parte de pago, todavía sin datos del auto", y de esa lista el prompt
// dice "Son verdad: usalos, no se los vuelvas a preguntar y no los contradigas". Franco queda
// ENCERRADO en una permuta fantasma para el resto de la charla. Igual que v86: no muere en el turno.
//
// RAÍZ: "entregar" es el disparador léxico de `## Permuta` — la sección se titula literalmente
// "cliente con efectivo + un usado para entregar" y su guion pide "marca, modelo y año".
// Es el MISMO EJE que el abierto #1 pero al revés (ahí "entrego un yaris 2021" dio
// tiene_permuta=0). El modelo falla en las dos direcciones sobre la misma palabra: el eje no lo
// puede separar él, hay que calcularlo.
//
// VALIDACIÓN OFFLINE: 32 mensajes etiquetados (22 reales), **0 FP y 0 FN**.
// LA ASIMETRÍA ES LA INVERSA DE v86, Y POR ESO EL DISEÑO CAMBIA: un FP acá **suprime una permuta
// legítima** —el cliente sí tenía usado y Franco no lo toma: un canal de venta perdido—, así que
// el patrón exige TRES condiciones a la vez y la detección de vehículo es deliberadamente
// GENEROSA (ante la duda, hay auto → no dispara):
//   (a) un verbo de PONER PLATA adyacente a un monto,
//   (b) NINGÚN indicio de vehículo en el mensaje,
//   (c) que `Leer lead (estado)` NO tenga ya `lead_entrega = "Sí"`.
// La (c) es la que casi elimina el riesgo, y es el mismo recurso que usó v85 con
// `franco_ofrecio_mostrar`: parte del criterio vive en el estado del lead, no en el texto.
//
// 3 NODOS, mismo reparto que v86:
//   (A) Config         -> `entrega_plata` (number).
//   (B) Franco         -> el hecho va en `# Lo que ya sabés de este cliente`, que es donde viven
//                         los datos confirmados. **NO se toca `## Permuta`**: 27.573 chars y 64
//                         condiciones, y sumarle una más es el yo-yo documentado.
//   (C) CRM (AI Agent) -> campo `text` (trampa 1: su systemMessage no es expresión), para que
//                         deje de inventar `entrega: "Sí"` y el usado fantasma.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v86.json'
const DESTINO = 'workflows/franco-n8n-v87.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const nodo = (n) => {
  const x = wf.nodes.find((y) => y.name === n)
  if (!x) throw new Error(`no encontré el nodo ${n}`)
  return x
}

// ─────────────────────────────────────────────────────────────────────────────
// (A) Config: `entrega_plata`
// ─────────────────────────────────────────────────────────────────────────────
const EXPR_ENTREGA =
  '={{ (() => { ' +
  "const m = String($('Webhook Render').item.json.body.content || '').toLowerCase(); " +
  "if ($('Leer lead (estado)').item.json.lead_entrega === 'Sí') return 0; " +
  'if (/\\bauto\\b|\\bautito\\b|\\bcoche\\b|veh[ií]culo|\\busad[oa]s?\\b|camioneta|pickup|chata|\\bunidad\\b|\\bmoto\\b|4x[24]|\\bkm\\b|kil[oó]metr|\\bmodelo\\b|patente|c[eé]dula|\\b(19|20)\\d{2}\\b|permuta|parte de pago|toyota|ford|volkswagen|vw|chevrolet|renault|fiat|peugeot|jeep|corolla|etios|yaris|hilux|ranger|amarok|s10|t-?cross|vento|renegade|onix|ecosport|duster|kangoo|cronos|\\bgol\\b|fiesta|\\bka\\b|\\b208\\b|mobi|corsa|clio|partner|saveiro|strada|toro|frontier|\\bmi (auto|coche|camioneta|chata)\\b/.test(m)) return 0; ' +
  'const re = new RegExp("(entrego|entregar|entregarte|entregarles|entrega|doy|dar|darte|pongo|poner|adelanto|adelantar|aporto|aportar)(?:\\\\s|de|unos|un|como|aprox\\\\w*|alrededor|cerca|casi|hasta|\\\\$|ar\\\\$)*(\\\\d{1,3}(?:[\\\\.\\\\s]\\\\d{3})+|\\\\d+(?:[,\\\\.]\\\\d+)?)\\\\s*(millones|millon|mill|palos|palo|lucas|luca|m|k)?\\\\b", "i"); ' +
  'const h = m.match(re); if (!h) return 0; ' +
  'const cola = m.slice(h.index + h[0].length, h.index + h[0].length + 14); ' +
  'if (/^\\s*(%|por ciento|cuotas?|meses|mes\\b|a[nñ]os|km|kil[oó]|veces)/.test(cola)) return 0; ' +
  "const crudo = h[2].replace(/\\s/g, ''); const u = (h[3] || '').trim(); " +
  "let n = /^\\d{1,3}([\\.\\s]\\d{3})+$/.test(crudo) ? Number(crudo.replace(/\\./g, '')) : Number(crudo.replace(',', '.')); " +
  'if (!isFinite(n)) return 0; ' +
  'if (/^(millones|millon|mill|palos|palo|m)$/.test(u)) n = n * 1000000; ' +
  'else if (/^(lucas|luca|k)$/.test(u)) n = n * 1000; ' +
  'return n >= 1000000 ? Math.round(n) : 0; })() }}'

const cfg = nodo('Config')
const asigs = cfg.parameters.assignments.assignments
if (asigs.some((a) => a.name === 'entrega_plata')) throw new Error('entrega_plata ya existe')
if (!asigs.some((a) => a.name === 'monto_financiar')) throw new Error('no encontré monto_financiar: ¿el origen no es v86?')
asigs.push({
  id: 'd4b81f60-2e75-4c93-9a1f-7e6b05c3a812',
  name: 'entrega_plata',
  value: EXPR_ENTREGA,
  type: 'number',
})

// ─────────────────────────────────────────────────────────────────────────────
// (B) Franco: el hecho, en `# Lo que ya sabés de este cliente`
// ─────────────────────────────────────────────────────────────────────────────
const FMT = "String($node[\"Config\"].json.entrega_plata).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')"
const SIM = '$node["Config"].json.empresa_moneda_simbolo'

const LINEA_FRANCO =
  '{{ $node["Config"].json.entrega_plata > 0 ? ' +
  "'DATO YA CALCULADO DE ESTE MENSAJE, ES VERDAD Y NO SE DISCUTE: cuando el cliente dice que puede ENTREGAR ' + " +
  SIM + ' + ' + FMT +
  " + ', está hablando de PLATA —un anticipo en efectivo—, NO de un auto usado. En este mensaje no nombró ningún vehículo y no figura ninguno en la lista de arriba. Así que ESE TURNO NO ES DE PERMUTA: no digas \"recibimos usados como parte de pago\", no nombres la permuta, no le preguntes qué auto entrega ni marca, modelo o año, y no des por hecho que tiene un usado — no tiene ninguno. Tomá los ' + " +
  SIM + ' + ' + FMT +
  " + ' como su anticipo y seguí con el embudo de financiación donde estabas. Si más adelante ÉL nombra un usado, ahí sí corre la permuta normalmente.' : '' }}"

const franco = nodo('Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage de Franco no arranca con "="')
const ANCLA = '{{ $node["Config"].json.estado_cliente }}\n'
if (sm.split(ANCLA).length !== 2) throw new Error('no encontré (una sola vez) el ancla de estado_cliente')
// replace con FUNCIÓN: el texto tiene "$" y `$\'`/`$&` son patrones especiales de String.replace.
franco.parameters.options.systemMessage = sm.replace(ANCLA, () => ANCLA + LINEA_FRANCO + '\n')

// ─────────────────────────────────────────────────────────────────────────────
// (C) CRM: que no invente el usado
// ─────────────────────────────────────────────────────────────────────────────
const crm = nodo('CRM (AI Agent)')
const txt = crm.parameters.text
if (!txt.startsWith('=')) throw new Error('TRAMPA 1: el `text` del CRM no arranca con "="')
const ANCLA_CRM = '\\n\\nÚltimas interacciones'
if (!txt.includes(ANCLA_CRM)) throw new Error('no encontré el ancla en el `text` del CRM')

const LINEA_CRM =
  "\\n\\n{{ $('Config').item.json.entrega_plata > 0 ? " +
  "'OJO CON entrega Y descripcion_usado: en el ÚLTIMO mensaje el cliente dijo que puede ENTREGAR $' + " +
  "String($('Config').item.json.entrega_plata).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.') + " +
  "'. Eso es PLATA (un anticipo), NO un auto usado: no nombró ningún vehículo. NO pongas entrega=\"Sí\" ni inventes descripcion_usado por esto (van \"No mencionado\" salvo que haya hablado de un usado aparte). El monto sí es su anticipo.' : '' }}"

crm.parameters.text = txt.replace(ANCLA_CRM, () => LINEA_CRM + ANCLA_CRM)

// ─────────────────────────────────────────────────────────────────────────────
// Aserciones
// ─────────────────────────────────────────────────────────────────────────────
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')

const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i]))
  .map((n) => n.name).sort()
ok(
  JSON.stringify(distintos) === JSON.stringify(['CRM (AI Agent)', 'Config', 'Franco (AI Agent)']),
  `nodos con diferencias: ${JSON.stringify(distintos)}`,
)

const asigsAntes = antes.nodes.find((n) => n.name === 'Config').parameters.assignments.assignments
ok(asigs.length === asigsAntes.length + 1, 'Config no ganó exactamente un campo')
for (let i = 0; i < asigsAntes.length; i++)
  ok(JSON.stringify(asigs[i]) === JSON.stringify(asigsAntes[i]), `Config: se modificó ${asigsAntes[i].name}`)
ok(asigs.at(-1).type === 'number', 'entrega_plata no quedó como number')

for (const n of wf.nodes) {
  const a = antes.nodes.find((x) => x.name === n.name)
  ok(
    JSON.stringify(a?.parameters?.options?.queryReplacement ?? null) ===
      JSON.stringify(n?.parameters?.options?.queryReplacement ?? null),
    `TRAMPA 2: cambió el queryReplacement de ${n.name}`,
  )
}
const firmas = new Map()
for (const mm of JSON.stringify(wf).matchAll(/\$fromAI\(\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*'([^']+)'\s*\)/g)) {
  const [todo, key] = mm
  if (firmas.has(key)) ok(firmas.get(key) === todo, `TRAMPA 3: la key ${key} tiene dos firmas distintas`)
  else firmas.set(key, todo)
}

const smNuevo = franco.parameters.options.systemMessage
ok(smNuevo.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
const permuta = (s) => s.slice(s.indexOf('## Permuta'), s.indexOf('## Paso 3'))
ok(permuta(smNuevo) === permuta(sm), '## Permuta cambió y NO debe cambiar (64 condiciones)')
const financ = (s) => s.slice(s.indexOf('# Financiación'), s.indexOf('# Cotización de usados'))
ok(financ(smNuevo) === financ(sm), '# Financiación cambió: el fix de v86 no se toca acá')
for (const frag of [
  'el embudo NO termina en "se lo dejo anotado al asesor" — termina en el NOMBRE',
  'El abanico va SOLO después de que el cliente diga que SÍ',
  'MONTO A FINANCIAR',
]) ok(smNuevo.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)

// PRUEBA VINCULANTE: la expresión real compila y clasifica bien.
const cuerpo = asigs.at(-1).value.replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '')
let ev
try { ev = new Function('$', `return ${cuerpo}`) } catch (e) { fallas.push(`entrega_plata NO COMPILA: ${e.message}`) }
const M = 1_000_000
const CASOS = [
  ['Puedo entregar 5.000.000?', 'No mencionado', 5 * M],
  ['puedo dar 5.000.000', 'No mencionado', 5 * M],
  ['pongo 10 millones', 'No mencionado', 10 * M],
  ['adelanto 6 palos', 'No mencionado', 6 * M],
  // permutas legítimas: jamás se suprimen
  ['tengo 12 millones en efectivo y entrego un yaris 2021 con 85mil km', 'No mencionado', 0],
  ['hola, tengo un ford ka 2015 para entregar y unos 7 millones de anticipo. me interesa financiar, qué opciones tengo?', 'No mencionado', 0],
  ['Quiero entregar mi auto como parte de pago, tengo un gol trend 2015, tiene 87 mil km', 'No mencionado', 0],
  ['hola, tengo 10 millones y un usado para entregar como parte de pago', 'No mencionado', 0],
  ['Puedo entregar 5.000.000?', 'Sí', 0],
  ['puedo entregar 5.000.000 y mi 208?', 'No mencionado', 0],
  // inertes
  ['5.000.000', 'No mencionado', 0],
  ['Quiero financiar 30.000.000', 'No mencionado', 0],
  ['dar 24 cuotas', 'No mencionado', 0],
  ['110000 km', 'No mencionado', 0],
]
if (ev) for (const [msg, lead, esp] of CASOS) {
  const fake = (n) => n === 'Leer lead (estado)'
    ? { item: { json: { lead_entrega: lead } } }
    : { item: { json: { body: { content: msg } } } }
  let got
  try { got = ev(fake) } catch (e) { got = `ERROR: ${e.message}` }
  ok(got === esp, `entrega_plata(${JSON.stringify(msg)}, lead_entrega=${lead}) = ${got}, esperaba ${esp}`)
}

// Las dos inyecciones compilan y renderizan lo que se quiso escribir.
function render(texto, marca, bind) {
  const i = texto.indexOf(marca)
  if (i < 0) return { error: `no encontré ${marca}` }
  const ini = texto.lastIndexOf('{{', i), fin = texto.indexOf('}}', i)
  try {
    const f = new Function(bind.nombre, `return (${texto.slice(ini + 2, fin)})`)
    return { con: f(bind.con), sin: f(bind.sin) }
  } catch (e) { return { error: `no compila: ${e.message}` } }
}
const rF = render(smNuevo, 'entrega_plata > 0', {
  nombre: '$node',
  con: { Config: { json: { entrega_plata: 5000000, empresa_moneda_simbolo: '$' } } },
  sin: { Config: { json: { entrega_plata: 0, empresa_moneda_simbolo: '$' } } },
})
ok(!rF.error, `inyección de Franco: ${rF.error}`)
if (!rF.error) {
  ok(rF.con.includes('$5.000.000'), 'la inyección de Franco no renderiza el monto')
  ok(rF.con.includes('NO de un auto usado'), 'la inyección de Franco perdió el hecho')
  ok(rF.sin === '', 'con 0 la inyección de Franco no queda vacía')
}
const rC = render(crm.parameters.text, 'entrega_plata > 0', {
  nombre: '$',
  con: () => ({ item: { json: { entrega_plata: 5000000 } } }),
  sin: () => ({ item: { json: { entrega_plata: 0 } } }),
})
ok(!rC.error, `inyección del CRM: ${rC.error}`)
if (!rC.error) {
  ok(rC.con.includes('$5.000.000'), 'la inyección del CRM no renderiza el monto')
  ok(rC.con.includes('NO pongas entrega="Sí"'), 'la inyección del CRM perdió la instrucción')
  ok(rC.sin === '', 'con 0 la inyección del CRM no queda vacía')
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  nodos con diferencias: ${distintos.join(', ')}`)
console.log(`  systemMessage de Franco: ${sm.length} -> ${smNuevo.length} chars`)
console.log(`  Config: ${asigsAntes.length} -> ${asigs.length} campos (entrega_plata, number)`)
console.log(`  prueba vinculante: ${CASOS.length}/${CASOS.length}`)
