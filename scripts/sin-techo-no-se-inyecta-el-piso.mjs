// v123 -> v124 · SIN TECHO DECLARADO, LA LÍNEA DE LOS PISOS NO SE INYECTA
//
// v120 intentó arreglar esto y NO ALCANZÓ. Lo medido sobre v123 (ventana 23:40:07Z):
// `sin-presupuesto-no-hay-piso` **1/3** — dos de tres siguen contestando "y qué pickups tenés?"
// con "La pickup más accesible que tengo es de $32.000.000. Necesitarías $16.000.000 de anticipo".
//
// Y NO ES QUE EL MECANISMO NO HAYA CORRIDO. Ejecución 15019 (sesión `ecdc0e5b`, una de las que
// falla): `carroceria_pedida: "pickup"`, `entrega_plata: 0`. O sea que la condición `carr && !techo`
// que agregó v120 SE CUMPLIÓ y la rama SÍ SE INYECTÓ: a Franco le llegó, textual, "ESO NO ES UNA
// PREGUNTA DE PLATA, ES UNA PREGUNTA DE STOCK: llamá a la herramienta… PROHIBIDO decir el piso de
// esa carrocería". La ignoró, recitó el piso, y el `metadata` de esa ejecución NO LISTA NINGÚN
// SUBRUN DE HERRAMIENTA: tampoco llamó a `Listar stock`.
//
// LA LECCIÓN: UNA INYECCIÓN DETERMINÍSTICA CON "PROHIBIDO EN ESTE TURNO" NO ALCANZA CONTRA UNA
// SECCIÓN ENTERA DE PROSA QUE EMPUJA PARA EL OTRO LADO. Toda "## Antes de ofrecer una carrocería"
// está construida sobre la premisa de que preguntar por una carrocería es una pregunta de
// presupuesto (la 150: "nunca ofrezcas una carrocería cuyo piso esté por encima del techo"; la 152:
// la plantilla del guion; la 154: "si insiste, la salida es el número"). Un párrafo pierde contra
// esa gravedad.
//
// POR ESO ESTE FIX NO AGREGA PROMPT: LE SACA EL COMBUSTIBLE. Los números que recita salen de UN
// solo lugar —la línea `PISOS DE STOCK`, que hoy se inyecta SIEMPRE y dice "Pickup desde
// $32.000.000 (anticipo mínimo $16.000.000)"—. Si esa línea no está cuando el cliente no declaró
// nada, Franco no tiene de dónde sacar el número y no le queda otra que consultar el stock.
// `pisos_carroceria` se inyecta en UN SOLO PUNTO del prompt (verificado), así que el corte es limpio.
//
// LA CONDICIÓN ES DELIBERADAMENTE CONSERVADORA: la línea desaparece sólo si el cliente NO declaró
// NADA — ni anticipo (en este mensaje, en la respuesta o en el historial), ni monto a financiar, ni
// un presupuesto registrado en el lead. Con cualquiera de esas señales la línea sigue igual que
// hoy. El sesgo es a MOSTRARLA de más, porque el costo de esconderla cuando hace falta (ofrecer una
// carrocería que no entra) es peor que el de mostrarla de más.
//
// CONTROL OBLIGADO: `no-ofrecer-lo-que-no-existe` NECESITA esa línea —ahí el cliente declara
// $5.000.000 de anticipo— y está 3/3. Con esta condición la sigue teniendo en todos sus turnos.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v123.json'
const DESTINO = 'workflows/franco-n8n-v124.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ag = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = ag.parameters.options.systemMessage

const VIEJO = 'PISOS DE STOCK (el más accesible de cada carrocería, ya calculado del stock real; el anticipo mínimo es la mitad del precio porque financiamos hasta el 50%): {{ $node["Config"].json.pisos_carroceria }}\n'
  + 'Esa línea es la verdad del stock y se actualiza sola. Mirala ANTES de ofrecer una carrocería y ANTES de ponerle nombre a una lista. Los números salen de ahí, nunca de tu memoria.'

const NUEVO = `{{ (() => {
  const c = $node["Config"].json;
  // Cualquier señal de plata declarada, en este mensaje o antes. Si hay UNA, la línea va igual que siempre.
  const plata = Number(c.entrega_plata || 0) || Number(c.entrega_plata_hist || 0) || Number(c.entrega_plata_resp || 0)
             || Number(c.monto_financiar || 0) || Number(c.monto_financiar_hist || 0);
  let presu = '';
  try { presu = String($('Leer lead (estado)').item.json.lead_presupuesto || ''); } catch (e) {}
  const tienePresu = presu.trim() !== '' && !/^no mencionado$/i.test(presu.trim());
  // v124 · SIN NINGÚN NÚMERO DEL CLIENTE, ESTA LÍNEA NO VA. Es el combustible del bug: con ella
  // puesta, a "y qué pickups tenés?" Franco recitaba "la más accesible es de $32.000.000,
  // necesitarías $16.000.000" en vez de mostrar las cuatro (ejecución 15019). Sin techo no hay
  // nada que "no entre", así que no hay piso que comparar: la respuesta es consultar el stock.
  if (!plata && !tienePresu) return '';
  return 'PISOS DE STOCK (el más accesible de cada carrocería, ya calculado del stock real; el anticipo mínimo es la mitad del precio porque financiamos hasta el 50%): ' + c.pisos_carroceria + '\\n'
    + 'Esa línea es la verdad del stock y se actualiza sola. Mirala ANTES de ofrecer una carrocería y ANTES de ponerle nombre a una lista. Los números salen de ahí, nunca de tu memoria.';
})() }}`

ok(smAntes.split(VIEJO).length === 2, `esperaba el bloque de PISOS DE STOCK 1 vez, hay ${smAntes.split(VIEJO).length - 1}`)
const sm = smAntes.replace(VIEJO, () => NUEVO)
ag.parameters.options.systemMessage = sm

// ── Aserciones ──────────────────────────────────────────────────────────────────────────────
ok(smAntes.startsWith('='), 'TRAMPA 1: el origen ya no arrancaba con "="')
ok(sm.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
// El bloque tenía 1 expresión y la sigue teniendo: la de adentro dejó de ser {{ }} propia.
ok((smAntes.match(/\{\{/g) || []).length === (sm.match(/\{\{/g) || []).length,
  `cambió la cantidad de expresiones {{ }}: ${(smAntes.match(/\{\{/g) || []).length} -> ${(sm.match(/\{\{/g) || []).length}`)

ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Franco (AI Agent)']),
  `esperaba SÓLO Franco (AI Agent); hay: ${JSON.stringify(distintos)}`)

// `pisos_carroceria` sigue teniendo UN solo punto de inyección, y ahora está adentro del guard.
ok((sm.match(/pisos_carroceria/g) || []).length === 1, '`pisos_carroceria` dejó de tener 1 sola referencia')
ok(/if \(!plata && !tienePresu\) return '';[\s\S]{0,200}pisos_carroceria/.test(sm),
  'la referencia a pisos_carroceria no quedó DESPUÉS del guard')
// El texto viejo suelto ya no está.
ok(!sm.includes('50%): {{ $node["Config"].json.pisos_carroceria }}'),
  'quedó la inyección vieja sin condicionar')

// Las otras menciones a "PISOS DE STOCK" (que la referencian) siguen: son inofensivas si la línea
// no está, pero si desaparecieran sería que se rompió otra cosa.
ok((sm.match(/PISOS DE STOCK/g) || []).length === (smAntes.match(/PISOS DE STOCK/g) || []).length,
  'cambió la cantidad de menciones a PISOS DE STOCK')

// ── La condición, probada como función pura ─────────────────────────────────────────────────
const decide = (c, presu) => {
  const plata = Number(c.entrega_plata || 0) || Number(c.entrega_plata_hist || 0) || Number(c.entrega_plata_resp || 0)
             || Number(c.monto_financiar || 0) || Number(c.monto_financiar_hist || 0)
  const p = String(presu || '')
  const tienePresu = p.trim() !== '' && !/^no mencionado$/i.test(p.trim())
  return (!plata && !tienePresu) ? 'OCULTA' : 'MUESTRA'
}
const vacio = { entrega_plata: 0, entrega_plata_hist: 0, entrega_plata_resp: 0, monto_financiar: 0, monto_financiar_hist: 0 }
const casos = [
  ['el bug: nada declarado', decide(vacio, 'No mencionado'), 'OCULTA'],
  ['anticipo en este mensaje', decide({ ...vacio, entrega_plata: 5000000 }, 'No mencionado'), 'MUESTRA'],
  ['anticipo en un turno anterior', decide({ ...vacio, entrega_plata_hist: 5000000 }, 'No mencionado'), 'MUESTRA'],
  ['anticipo detectado en la respuesta', decide({ ...vacio, entrega_plata_resp: 5000000 }, 'No mencionado'), 'MUESTRA'],
  ['dijo cuánto quiere financiar', decide({ ...vacio, monto_financiar: 12000000 }, 'No mencionado'), 'MUESTRA'],
  ['financiar, en el historial', decide({ ...vacio, monto_financiar_hist: 12000000 }, 'No mencionado'), 'MUESTRA'],
  ['presupuesto registrado en el lead', decide(vacio, '$20.000.000'), 'MUESTRA'],
  ['lead_presupuesto vacío', decide(vacio, ''), 'OCULTA'],
  ['lead_presupuesto en minúsculas', decide(vacio, 'no mencionado'), 'OCULTA'],
]
let malos = 0
for (const [n, got, esp] of casos) {
  if (got !== esp) { malos++; fallas.push(`condición · ${n}: dio ${got}, esperaba ${esp}`) }
}
console.log(`  la condición del piso: ${casos.length - malos}/${casos.length}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Franco (AI Agent)')
console.log(`  systemMessage: ${smAntes.length} -> ${sm.length} chars`)
