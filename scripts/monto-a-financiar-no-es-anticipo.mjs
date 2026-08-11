// v85 -> v86 · "el monto que el cliente quiere FINANCIAR no es su anticipo"
//
// CAPTURA Y LOG: ejecución 11456 (sesión 9f1356e3, 2026-08-05 15:19:05 UTC). Al mensaje
// "Quiero financiar 30.000.000" Franco contesta "...con $30.000.000 de anticipo en la
// financiación, me dejás tu nombre y apellido?" — toma el monto a financiar como si fuera el
// anticipo, y salta al name-ask sin tener anticipo NI cuotas. En la MISMA ejecución
// `Guardar lead` escribe presupuesto="$30.000.000", así que el error se persiste en
// crm_leads y vuelve por Config.estado_cliente como dato confirmado en todos los turnos
// siguientes.
//
// BASELINE MEDIDO (`financiar-monto-no-es-anticipo`, --repeat 4 --delay 25000, ventana
// 15:42:51-15:45:27 con 0 ejecuciones en error): **0/4**. Las 4 corridas fallan de tres
// formas y ninguna interpreta bien el monto: 2 lo llaman "ese anticipo", 1 lo usa de
// presupuesto y LISTA PICKUPS, 1 se saltea el anticipo y pregunta las cuotas.
// Con el embudo de financiación CERRADO el caso medía 4/4 verde: la variable que
// discrimina es que ya haya un casillero pendiente (el anticipo) donde caiga el monto.
//
// RAÍZ: el concepto "monto a financiar" NO EXISTE en ninguna parte del sistema. `# Financiación`
// tiene un solo casillero para plata ("arrancás por el ANTICIPO, que es el dato clave") y el
// CRM define `presupuesto` como "el presupuesto que mencionó". El monto entra y cae en el único
// casillero que existe.
//
// POR QUÉ SE CALCULA Y NO SE LE PREGUNTA AL MODELO: es la lección medida de v83/v84/v85 —
// preguntarle al modelo no funciona, ni en prosa ni como parámetro de tool. Acá el dato
// determinístico es el patrón sobre el texto: un verbo de financiar ADYACENTE a un monto.
// Lo que sí es precedente vivo es INYECTAR un hecho ya calculado (estado_cliente, ya_derivado):
// no se le pide al modelo que juzgue, se le dice el resultado.
//
// VALIDACIÓN OFFLINE (método de v74/v85), 62 mensajes etiquetados a mano — 44 reales de
// capturas y evals: **0 falsos positivos, 0 falsos negativos**.
// La asimetría que fija el criterio: un FP hace que Franco repregunte un anticipo YA DADO
// (que es el abierto #3, ya vivo — amplificarlo es inaceptable); un FN deja el bug como está.
// Por eso FP=0 es requisito y FN se tolera.
//
// UN MECANISMO EN 3 NODOS, repartido por dónde vive cada consumidor del dato (misma forma
// que v85):
//   (A) Config          -> campo nuevo `monto_financiar` (number), el patrón validado.
//   (B) Franco          -> `# Financiación` recibe el hecho + EL GUION DEL TURNO (trampa 6:
//                          se compite con un guion concreto, no con una prohibición suelta).
//   (C) CRM (AI Agent)  -> el mismo hecho por el campo `text`. OJO TRAMPA 1: el systemMessage
//                          del CRM NO arranca con "=" y no tiene ninguna {{ }}, así que una
//                          expresión ahí sería texto literal. `text` SÍ es expresión y ya usa
//                          $('Config'): por ahí va.
//
// LO QUE NO SE TOCA A PROPÓSITO: `## Permuta` (27.573 chars y 64 condiciones — cada cosa que
// se le agrega sale cara) y el name-ask de v78. Asertado byte a byte.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v85.json'
const DESTINO = 'workflows/franco-n8n-v86.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8')) // copia intacta para comparar

const nodo = (n) => {
  const x = wf.nodes.find((y) => y.name === n)
  if (!x) throw new Error(`no encontré el nodo ${n}`)
  return x
}

// ─────────────────────────────────────────────────────────────────────────────
// (A) Config: campo nuevo `monto_financiar`
// ─────────────────────────────────────────────────────────────────────────────
// Una sola línea, como `pidio_ver`. El mensaje ACTUAL sólo está en el webhook: `mensajes_demo`
// todavía no lo tiene porque `Guardar mensajes (historial)` corre DESPUÉS de responder.
const EXPR_MONTO =
  '={{ (() => { ' +
  "const m = String($('Webhook Render').item.json.body.content || '').toLowerCase(); " +
  'if (/\\bsin financiar\\b|\\bno\\b[^.?!]{0,15}\\bfinanci/.test(m)) return 0; ' +
  'if (/d[oó]lar|usd|u\\$s/.test(m)) return 0; ' +
  'const re = new RegExp("financi[\\\\wáéíóúüñ]*(?:\\\\s|de|unos|un|como|aprox\\\\w*|alrededor|cerca|casi|hasta|\\\\$|ar\\\\$)*(\\\\d{1,3}(?:[\\\\.\\\\s]\\\\d{3})+|\\\\d+(?:[,\\\\.]\\\\d+)?)\\\\s*(millones|millon|mill|palos|palo|lucas|luca|m|k)?\\\\b", "i"); ' +
  'const h = m.match(re); if (!h) return 0; ' +
  'const cola = m.slice(h.index + h[0].length, h.index + h[0].length + 14); ' +
  'if (/^\\s*(%|por ciento|cuotas?|meses|mes\\b|a[nñ]os|km|kil[oó]|veces)/.test(cola)) return 0; ' +
  "const crudo = h[1].replace(/\\s/g, ''); const u = (h[2] || '').trim(); " +
  "let n = /^\\d{1,3}([\\.\\s]\\d{3})+$/.test(crudo) ? Number(crudo.replace(/\\./g, '')) : Number(crudo.replace(',', '.')); " +
  'if (!isFinite(n)) return 0; ' +
  'if (/^(millones|millon|mill|palos|palo|m)$/.test(u)) n = n * 1000000; ' +
  'else if (/^(lucas|luca|k)$/.test(u)) n = n * 1000; ' +
  'return n >= 1000000 ? Math.round(n) : 0; })() }}'

const cfg = nodo('Config')
const asigs = cfg.parameters.assignments.assignments
if (asigs.some((a) => a.name === 'monto_financiar')) throw new Error('monto_financiar ya existe')
const iPidio = asigs.findIndex((a) => a.name === 'pidio_ver')
if (iPidio < 0) throw new Error('no encontré pidio_ver: ¿el origen no es v85?')
asigs.push({
  id: 'a7f3c1e2-9b4d-4a6f-8e51-3c2d7b9a4e08',
  name: 'monto_financiar',
  value: EXPR_MONTO,
  type: 'number',
})

// ─────────────────────────────────────────────────────────────────────────────
// (B) Franco: el hecho + el guion, dentro de `# Financiación`
// ─────────────────────────────────────────────────────────────────────────────
// Formateo de miles hecho a mano (nada de toLocaleString: el resultado tiene que ser el
// mismo siempre, no depender del locale del runtime de n8n).
const FMT = "String($node[\"Config\"].json.monto_financiar).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')"
const SIMBOLO = '$node["Config"].json.empresa_moneda_simbolo'

const LINEA_FRANCO =
  '{{ $node["Config"].json.monto_financiar > 0 ? ' +
  "'DATO YA CALCULADO DE ESTE MENSAJE, ES VERDAD Y NO SE DISCUTE: el cliente dijo que quiere FINANCIAR ' + " +
  SIMBOLO +
  ' + ' +
  FMT +
  " + '. Eso es el MONTO A FINANCIAR: NO es su anticipo y NO es su presupuesto. El anticipo todavía NO te lo dio, así que este turno tiene UN solo objetivo, pedírselo, y el guion es exactamente este: \"dale. Y de anticipo, de cuánto pensás poner más o menos?\". Prohibido en este turno: escribir \"ese anticipo\" o \"tu anticipo de ' + " +
  SIMBOLO +
  ' + ' +
  FMT +
  " + '\" (no te dio ninguno), pasar a preguntar las cuotas, pedir el nombre, y llamar a Listar stock con ese número o mostrarle autos (esa plata no la tiene: es lo que quiere que le presten).' : '' }}"

const franco = nodo('Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage de Franco no arranca con "="')
const ANCLA = '\n# Financiación\n'
if (!sm.includes(ANCLA)) throw new Error('no encontré el encabezado # Financiación')
if (sm.split(ANCLA).length !== 2) throw new Error('# Financiación aparece más de una vez')
// OJO: reemplazo con FUNCIÓN, no con string. El texto que se inserta contiene "$" y en un
// string de reemplazo `$'`, `$&` y `$1` son patrones especiales que `replace` interpreta —
// se comió medio texto la primera vez que se corrió esto.
franco.parameters.options.systemMessage = sm.replace(ANCLA, () => ANCLA + LINEA_FRANCO + '\n')

// ─────────────────────────────────────────────────────────────────────────────
// (C) CRM: el mismo hecho, por el campo `text` (trampa 1: el systemMessage no es expresión)
// ─────────────────────────────────────────────────────────────────────────────
const crm = nodo('CRM (AI Agent)')
const txt = crm.parameters.text
if (!txt.startsWith('=')) throw new Error('TRAMPA 1: el `text` del CRM no arranca con "="')
// OJO: en este campo los saltos de línea están guardados como los DOS caracteres "\" y "n",
// no como un newline real. Se respeta esa convención para no romper el formato del prompt.
const ANCLA_CRM = '\\n\\nÚltimas interacciones'
if (!txt.includes(ANCLA_CRM)) throw new Error('no encontré el ancla en el `text` del CRM')

const LINEA_CRM =
  "\\n\\n{{ $('Config').item.json.monto_financiar > 0 ? " +
  "'OJO CON EL CAMPO presupuesto: en el ÚLTIMO mensaje el cliente declaró un MONTO A FINANCIAR de $' + " +
  "String($('Config').item.json.monto_financiar).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.') + " +
  "'. Eso NO es su presupuesto ni su anticipo: es lo que quiere que le presten. NO lo pongas en presupuesto (va \"No mencionado\" salvo que haya dicho un presupuesto aparte) ni en entrega. Sí corresponde financia=\"Sí\".' : '' }}"

crm.parameters.text = txt.replace(ANCLA_CRM, () => LINEA_CRM + ANCLA_CRM)

// ─────────────────────────────────────────────────────────────────────────────
// Aserciones
// ─────────────────────────────────────────────────────────────────────────────
const fallas = []
const ok = (cond, msg) => { if (!cond) fallas.push(msg) }

// 1· Estructura
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')

// 2· Exactamente 3 nodos con diferencias, y son los esperados
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i]))
  .map((n) => n.name)
  .sort()
const ESPERADOS = ['CRM (AI Agent)', 'Config', 'Franco (AI Agent)']
ok(
  JSON.stringify(distintos) === JSON.stringify(ESPERADOS),
  `nodos con diferencias: ${JSON.stringify(distintos)} — esperaba ${JSON.stringify(ESPERADOS)}`,
)

// 3· Config: sólo se AGREGÓ un campo; los viejos quedan byte a byte (pidio_ver incluido)
const asigsAntes = antes.nodes.find((n) => n.name === 'Config').parameters.assignments.assignments
ok(asigs.length === asigsAntes.length + 1, 'Config no ganó exactamente un campo')
for (let i = 0; i < asigsAntes.length; i++)
  ok(JSON.stringify(asigs[i]) === JSON.stringify(asigsAntes[i]), `Config: se modificó el campo ${asigsAntes[i].name}`)
ok(asigs[asigs.length - 1].type === 'number', 'monto_financiar no quedó como number')

// 4· TRAMPA 2: ningún queryReplacement tocado
for (const n of wf.nodes) {
  const a = antes.nodes.find((x) => x.name === n.name)
  const qA = JSON.stringify(a?.parameters?.options?.queryReplacement ?? null)
  const qB = JSON.stringify(n?.parameters?.options?.queryReplacement ?? null)
  ok(qA === qB, `TRAMPA 2: cambió el queryReplacement de ${n.name}`)
}

// 5· TRAMPA 3: ninguna key de $fromAI con dos firmas distintas en todo el workflow
const firmas = new Map()
for (const m of JSON.stringify(wf).matchAll(/\$fromAI\(\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*'([^']+)'\s*\)/g)) {
  const [todo, key] = m
  if (firmas.has(key)) ok(firmas.get(key) === todo, `TRAMPA 3: la key ${key} tiene dos firmas distintas`)
  else firmas.set(key, todo)
}

// 6· Franco: sigue siendo expresión, y lo que NO se toca queda intacto
const smNuevo = franco.parameters.options.systemMessage
ok(smNuevo.startsWith('='), 'TRAMPA 1: el systemMessage de Franco dejó de arrancar con "="')
const permutaDe = (s) => s.slice(s.indexOf('## Permuta'), s.indexOf('## Paso 3'))
ok(permutaDe(smNuevo) === permutaDe(sm), '## Permuta cambió y no debería (64 condiciones, no se toca)')
const INTACTOS = [
  'el embudo NO termina en "se lo dejo anotado al asesor" — termina en el NOMBRE', // v78
  'no bajes de gama para llenar la lista', // v79
  'el WhatsApp de', // v81
  'NUNCA metida adentro de', // v82
  'El abanico va SOLO después de que el cliente diga que SÍ', // v85
]
for (const frag of INTACTOS) ok(smNuevo.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)
ok(smNuevo.split('# Financiación').length === 2, '# Financiación quedó duplicada')

// 7· PRUEBA VINCULANTE: la expresión REAL del JSON generado compila y da los valores
//    esperados. Un error de sintaxis en Config corta la cadena principal y deja al
//    cliente sin respuesta, así que esto se verifica acá y no en producción.
const exprGenerada = asigs[asigs.length - 1].value
const cuerpo = exprGenerada.replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '')
let evaluar
try {
  evaluar = new Function('$', `return ${cuerpo}`)
} catch (e) {
  fallas.push(`la expresión de monto_financiar NO COMPILA: ${e.message}`)
}
const M = 1_000_000
const CASOS = [
  ['Quiero financiar 30.000.000', 30 * M],
  ['quiero financiar 30 millones', 30 * M],
  ['quiero financiar 30M', 30 * M],
  ['financio 12 millones', 12 * M],
  ['la financiación de 40 millones cómo sería?', 40 * M],
  // los que NO tienen que disparar (un FP repregunta un anticipo ya dado: abierto #3)
  ['hola, tengo un ford ka 2015 para entregar y unos 7 millones de anticipo. me interesa financiar, qué opciones tengo?', 0],
  ['como se podria financiar? tengo 5 millones para poner', 0],
  ['quiero financiar con 5 millones de anticipo', 0],
  ['quiero financiar en 36 cuotas', 0],
  ['financian hasta 50%?', 0],
  ['hola, tengo 10 millones en efectivo y un usado para entregar, sin financiar. qué opciones tengo?', 0],
  ['tengo 15 mil dólares para gastar', 0],
  ['serian unos 15 millones', 0],
  ['110000 km', 0],
  ['tengo 12 millones en efectivo y entrego un yaris 2021 con 85mil km', 0],
]
if (evaluar) {
  for (const [msg, esperado] of CASOS) {
    const fake = () => ({ item: { json: { body: { content: msg } } } })
    let got
    try { got = evaluar(fake) } catch (e) { got = `ERROR: ${e.message}` }
    ok(got === esperado, `monto_financiar(${JSON.stringify(msg)}) = ${got}, esperaba ${esperado}`)
  }
}

// 8· CRM: el `text` sigue siendo expresión y conserva el session_id
ok(crm.parameters.text.startsWith('='), 'TRAMPA 1: el `text` del CRM dejó de arrancar con "="')
ok(crm.parameters.text.includes("$('Config').item.json.session_id"), 'el CRM perdió el session_id')
ok(
  JSON.stringify(crm.parameters.options) ===
    JSON.stringify(antes.nodes.find((n) => n.name === 'CRM (AI Agent)').parameters.options),
  'se tocó el systemMessage del CRM (no corresponde: no es expresión, trampa 1)',
)

// 9· Las DOS expresiones inyectadas compilan y renderizan lo que se quiso escribir.
//    Esta aserción existe porque la primera corrida se comió medio texto del CRM: en un
//    string de reemplazo, `$'` es un patrón especial de String.replace. El bug era
//    invisible mirando el script y evidente renderizando.
function renderInyeccion(texto, marca, bind) {
  const i = texto.indexOf(marca)
  if (i < 0) return { error: `no encontré la marca ${marca}` }
  const ini = texto.lastIndexOf('{{', i)
  const fin = texto.indexOf('}}', i)
  if (ini < 0 || fin < 0) return { error: 'la expresión no está delimitada por {{ }}' }
  const cuerpo = texto.slice(ini + 2, fin)
  try {
    const f = new Function(bind.nombre, `return (${cuerpo})`)
    return { con: f(bind.con), sin: f(bind.sin) }
  } catch (e) {
    return { error: `no compila: ${e.message}` }
  }
}

const rF = renderInyeccion(smNuevo, 'monto_financiar > 0', {
  nombre: '$node',
  con: { Config: { json: { monto_financiar: 30000000, empresa_moneda_simbolo: '$' } } },
  sin: { Config: { json: { monto_financiar: 0, empresa_moneda_simbolo: '$' } } },
})
ok(!rF.error, `inyección de Franco: ${rF.error}`)
if (!rF.error) {
  ok(rF.con.includes('$30.000.000'), 'la inyección de Franco no renderiza el monto formateado')
  ok(rF.con.includes('de anticipo, de cuánto pensás poner'), 'la inyección de Franco perdió el guion del turno')
  ok(rF.sin === '', 'con monto 0 la inyección de Franco no queda vacía')
}

const rC = renderInyeccion(crm.parameters.text, 'monto_financiar > 0', {
  nombre: '$',
  con: () => ({ item: { json: { monto_financiar: 30000000 } } }),
  sin: () => ({ item: { json: { monto_financiar: 0 } } }),
})
ok(!rC.error, `inyección del CRM: ${rC.error}`)
if (!rC.error) {
  ok(rC.con.includes('$30.000.000'), 'la inyección del CRM no renderiza el monto formateado')
  ok(rC.con.includes('NO lo pongas en presupuesto'), 'la inyección del CRM perdió la instrucción del campo')
  ok(rC.sin === '', 'con monto 0 la inyección del CRM no queda vacía')
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
console.log(`  Config: ${asigsAntes.length} -> ${asigs.length} campos (monto_financiar, number)`)
console.log(`  prueba vinculante: ${CASOS.length}/${CASOS.length} — la expresión compila y clasifica bien`)
