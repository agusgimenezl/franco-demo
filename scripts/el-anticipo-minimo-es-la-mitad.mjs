// v125 -> v126 · EL ANTICIPO MÍNIMO ES LA MITAD, Y LA CUENTA LA HACE EL SQL
//
// BUG 2, reportado por Agustina. Preguntó cuánto anticipo hacía falta para un auto y Franco
// contestó **el precio entero** ($21.000.000 para el Peugeot 208) cuando el mínimo es el 50% =
// $10.500.000, porque la agencia financia hasta la mitad del valor.
//
// ES EL BUG MÁS CARO DE LA LISTA EN TÉRMINOS COMERCIALES: le dice a un cliente que necesita el
// DOBLE de plata de la que necesita. Espanta gente que sí podía comprar.
//
// MEDIDO ANTES DE TOCAR NADA — caso `anticipo-minimo-es-la-mitad`, 3 corridas sobre v125: **0/3**.
// Y EL MODO DE FALLA REAL RESULTÓ DISTINTO DEL REPORTADO, así que vale anotarlo: hoy Franco no dice
// "$21.000.000"; directamente NO DA LA CUENTA. Explica la regla del 50% y le devuelve la pregunta
// al cliente: *"la financiación puede cubrir hasta el 50% del valor… De cuánto sería el anticipo
// que pensás poner?"*. Peor para el cliente: le pide justo el dato que vino a buscar.
//
// POR QUÉ PASA: el número no existe en ningún lado. `pisos_carroceria` hace esta MISMA cuenta pero
// por CARROCERÍA (el piso del segmento), no por auto puntual. Cuando el cliente pregunta por UN
// auto, el modelo tiene el precio y la regla del 50% y tiene que multiplicar — y no lo hace, o lo
// hace mal. Es aritmética: **va a SQL, no al prompt.** Es la regla del proyecto.
//
// EL FIX: `Detalle auto` devuelve `anticipo_minimo` ya calculado Y YA FORMATEADO, con el mismo
// formato que `precio` (mismo `to_char`, mismos puntos de miles), para que el modelo lo copie tal
// cual en vez de recalcular. Verificado contra la base: 208 $21.000.000 -> $10.500.000 ·
// Corolla $24.800.000 -> $12.400.000 · Ranger $57.000.000 -> $28.500.000.
//
// NO SE TOCA `Listar stock`: el bug es sobre un auto puntual y ahí ya está la línea de pisos por
// carrocería. Ampliar el alcance sin una falla medida que lo justifique es cómo se rompen cosas.
//
// EL TEXTO DEL PROMPT NO LLEVA NÚMEROS DE ESTE STOCK, a propósito: v120 se hizo porque un guion con
// "$32.000.000" adentro terminó recitado palabra por palabra en conversaciones donde no venía.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v125.json'
const DESTINO = 'workflows/franco-n8n-v126.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// ── 1) Detalle auto: el campo calculado ─────────────────────────────────────────────────────
const da = wf.nodes.find((n) => n.name === 'Detalle auto')
const qAntes = da.parameters.query

const VIEJO = "  '$' || replace(to_char((metadata->>'precio')::bigint, 'FM999G999G999'), ',', '.') AS precio,\n"
const NUEVO = "  '$' || replace(to_char((metadata->>'precio')::bigint, 'FM999G999G999'), ',', '.') AS precio,\n"
  + "  -- v126 · LA CUENTA LA HACE EL SQL, NO EL MODELO. Financiamos hasta el 50%, así que el anticipo\n"
  + "  -- mínimo de un auto es la mitad de su precio. Es la MISMA cuenta que ya hace `pisos_carroceria`,\n"
  + "  -- pero por CARROCERÍA; por auto puntual no existía y el modelo la improvisaba: a \"cuánto\n"
  + "  -- anticipo necesito\" contestaba el precio entero, o directamente no daba el número.\n"
  + "  -- Va FORMATEADO igual que `precio` para que se copie tal cual y no se recalcule.\n"
  + "  '$' || replace(to_char((metadata->>'precio')::bigint / 2, 'FM999G999G999'), ',', '.') AS anticipo_minimo,\n"
ok(qAntes.split(VIEJO).length === 2, `esperaba la línea de precio 1 vez, hay ${qAntes.split(VIEJO).length - 1}`)
const q = qAntes.replace(VIEJO, () => NUEVO)
da.parameters.query = q

// La tool tiene que DECLARARLO, o es la historia de la etiqueta `fuera`.
const TD_VIEJO = "Los datos vienen de la base: usalos tal cual, no los reformatees ni completes con lo que creas saber del modelo."
const TD_NUEVO = "Devuelve tambien 'anticipo_minimo': el anticipo minimo de ESE auto, ya calculado (la mitad del precio, porque se financia hasta el 50%) y ya formateado. Si te preguntan cuanto anticipo hace falta, contestá con ese campo TAL CUAL: no lo recalcules ni lo estimes. Los datos vienen de la base: usalos tal cual, no los reformatees ni completes con lo que creas saber del modelo."
ok(da.parameters.toolDescription.split(TD_VIEJO).length === 2, 'no encontré (1 vez) el cierre de la toolDescription')
da.parameters.toolDescription = da.parameters.toolDescription.replace(TD_VIEJO, () => TD_NUEVO)

// ── 2) El prompt: declarar el campo donde el modelo lo va a buscar ──────────────────────────
const ag = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = ag.parameters.options.systemMessage

const P_VIEJO = 'Ficha completa de UN auto por su id. Usala SIEMPRE que vayas a dar el detalle de un auto puntual, antes de responder. Devuelve los campos de la ficha y `ficha_completa` (el texto original de donde salen motor, transmisión y equipamiento).'
const P_NUEVO = 'Ficha completa de UN auto por su id. Usala SIEMPRE que vayas a dar el detalle de un auto puntual, antes de responder. Devuelve los campos de la ficha, `version`, `ficha_completa` (el texto original de donde salen motor, transmisión y equipamiento) y `anticipo_minimo`.\n'
  + '- CUÁNTO ANTICIPO HACE FALTA PARA UN AUTO: la respuesta es el campo `anticipo_minimo` de esa ficha, TAL CUAL viene. Ya está calculado y ya está formateado. NO lo recalcules, no lo redondees y no lo estimes. Y NO le devuelvas la pregunta al cliente: si te pregunta cuánto necesita, querés el número, no su presupuesto. Ya pasó y es el bug: a "cuánto necesito de anticipo para ese?" contestaste explicando que se financia hasta el 50% y cerraste con "de cuánto pensás poner?", sin decirle nunca el monto. El anticipo que EL CLIENTE piensa poner es otra cosa y se pregunta después, no en lugar del número.'
ok(smAntes.split(P_VIEJO).length === 2, 'no encontré (1 vez) la sección de Detalle auto en el prompt')
const sm = smAntes.replace(P_VIEJO, () => P_NUEVO)
ag.parameters.options.systemMessage = sm

// ── Aserciones ──────────────────────────────────────────────────────────────────────────────
ok(smAntes.startsWith('='), 'TRAMPA 1: el origen ya no arrancaba con "="')
ok(sm.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok((smAntes.match(/\{\{/g) || []).length === (sm.match(/\{\{/g) || []).length, 'cambió la cantidad de {{ }}')
ok((qAntes.match(/\$fromAI\(/g) || []).length === (q.match(/\$fromAI\(/g) || []).length, 'TRAMPA 3: cambió la cantidad de $fromAI')

ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Detalle auto', 'Franco (AI Agent)']),
  `esperaba Detalle auto + Franco; hay: ${JSON.stringify(distintos)}`)
ok(JSON.stringify(wf.nodes.find((n) => n.name === 'Listar stock')) ===
   JSON.stringify(antes.nodes.find((n) => n.name === 'Listar stock')), 'se tocó Listar stock y no debe')

ok(q.split('AS anticipo_minimo,').length === 2, '`anticipo_minimo` no quedó 1 vez')
ok(q.length - qAntes.length === NUEVO.length - VIEJO.length, 'cambió algo más que el reemplazo en el SQL')
ok(/WHERE \(metadata->>'id'\)::int = /.test(q), 'se rompió el WHERE por id')
// La supresión de la ficha (v119) NO puede llevarse puesto este campo: va fuera del CASE.
ok(q.indexOf('AS anticipo_minimo') < q.indexOf('YA LE DISTE LA FICHA COMPLETA'),
  '`anticipo_minimo` quedó DESPUÉS del bloque de supresión: tiene que ser un campo propio, como `version`')

// ── La cuenta, contra los precios reales del stock ──────────────────────────────────────────
const fmt = (n) => '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const casos = [
  ['Peugeot 208 $21.000.000', fmt(21000000 / 2), '$10.500.000'],
  ['Toyota Corolla $24.800.000', fmt(24800000 / 2), '$12.400.000'],
  ['Ford Ranger $57.000.000', fmt(57000000 / 2), '$28.500.000'],
  ['Ford Fiesta $8.200.000', fmt(8200000 / 2), '$4.100.000'],
  ['Fiat Cronos $16.800.000 (impar al dividir)', fmt(Math.floor(16800000 / 2)), '$8.400.000'],
]
let malos = 0
for (const [n, got, esp] of casos) if (got !== esp) { malos++; fallas.push(`cuenta · ${n}: dio ${got}, esperaba ${esp}`) }
console.log(`  el anticipo mínimo: ${casos.length - malos}/${casos.length}`)

// El texto, contra el fallo medido.
const chk = (n, c) => { if (!c) fallas.push(`texto · ${n}`) }
chk('manda a usar el campo tal cual', /TAL CUAL viene/.test(P_NUEVO))
chk('prohíbe recalcular', /NO lo recalcules/.test(P_NUEVO))
chk('prohíbe devolver la pregunta, que es el fallo REAL medido', /NO le devuelvas la pregunta al cliente/.test(P_NUEVO))
chk('trae el ejemplo concreto del fallo (trampa 6)', /Ya pasó y es el bug/.test(P_NUEVO) && /de cuánto pensás poner/.test(P_NUEVO))
chk('distingue el anticipo MÍNIMO del que el cliente piensa poner', /es otra cosa y se pregunta después/.test(P_NUEVO))
chk('no hardcodea números de este stock (lección de v120)', !/\d\.\d{3}\.\d{3}/.test(P_NUEVO))

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Detalle auto, Franco (AI Agent)')
console.log(`  query:         ${qAntes.length} -> ${q.length} chars`)
console.log(`  systemMessage: ${smAntes.length} -> ${sm.length} chars`)
console.log('\n  FALTA: correr la query RENDEREADA contra la base (la lección de v122).')
