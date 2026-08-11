// v116 -> v117 · EL TAMAÑO LO DICE LA FICHA, NO LA CARROCERÍA
//
// BUG 1 de la charla de Valentina Uria (2026-08-10). DOS SÍNTOMAS, UN AGUJERO:
//   (1) pide "uno chico, modelo mayor a 2020" y Franco NO nombra el Chevrolet Onix 2024;
//   (2) pide "qué opción chica" con techo de $20.000.000 y le sale una RENAULT KANGOO, utilitario.
//
// REPRODUCIDO ANTES DE TOCAR NADA — caso `chico-no-es-utilitario`, 3 corridas sobre v116 vivo
// (15:48:35–15:50:44): **0/3**, sin Onix en 2 de 3 y con Kangoo en **3 de 3**.
//
// LA CAUSA NO ES QUE FALTE EL DATO: `autos_disponibles.metadata` TIENE `tamano` (chico/mediano/
// grande) y el modelo LO VE — la línea 68 del prompt lista `tamano` entre los campos que devuelve
// la herramienta. Lo que pasa es que la línea 154 le manda EXPLÍCITAMENTE a ignorarlo:
//   "Para el tamaño guiate por la carroceria de la ficha... hatchback es el más chico, sedán es
//    más largo... Si quiere mantener el tamaño de un auto chico, los hatchback cumplen y los
//    sedán no."
// Esa frase hace las dos cosas: excluye al Onix por ser sedán, y deja al Kangoo sin regla porque
// "utilitario" ni figura en la lista. **Es la trampa 6 y "un dato que el modelo lee como
// instrucción es una instrucción" al mismo tiempo:** mientras esa línea exista, le gana a cualquier
// filtro que le pongamos abajo.
//
// EL DATO YA SE CORRIGIÓ APARTE (decisión de Agustina, 2026-08-10): el Onix pasó a `tamano: chico`
// en la base — 1 fila, verificado que `content` NO menciona el tamaño en ningún auto, así que no
// contradice el texto vectorizado y no hay que re-embeber nada.
//
// LO QUE NO HACE ESTE CAMBIO, Y ES DELIBERADO: no agrega el gate de tamaño en el SQL de
// `Listar stock`. La regla del proyecto dice que lo determinístico va a SQL y estoy de acuerdo,
// pero un gate nuevo ahí es donde vive la trampa 4 (cero filas = Franco no contesta) y merece su
// propia medición. Esta línea hay que arreglarla igual: con ella puesta, el filtro perdería.
// Si después de medir Franco sigue mezclando tamaños, el gate en SQL es el v118.
//
// LA CONDUCTA QUE AGUSTINA PIDIÓ ("mostrar los chicos y ofrecer UN mediano como alternativa") YA
// ESTÁ ESCRITA en la línea 156 ("lo que NO cumple el criterio va en un grupo APARTE y lo decís con
// todas las letras"). No hay que inventarla: hay que dejar de romperla. Por eso el reemplazo apunta
// a esa línea en vez de escribir una regla nueva que competiría con ella.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v116.json'
const DESTINO = 'workflows/franco-n8n-v117.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ag = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = ag.parameters.options.systemMessage

const VIEJO = '- Para el tamaño guiate por la carroceria de la ficha, no por tu memoria: hatchback es el más chico, sedán es más largo, SUV y pickup son claramente más grandes. Si quiere mantener el tamaño de un auto chico, los hatchback cumplen y los sedán no.'

const NUEVO = '- Para el tamaño guiate por el campo `tamano` de la ficha (chico / mediano / grande), NO por la carrocería ni por tu memoria: ese campo viene calculado del stock y es la única fuente. La carrocería no decide el tamaño: un sedán puede ser `tamano: chico` y un utilitario puede ser `tamano: mediano`.\n'
  + '- Si la ficha dice `tamano: mediano` o `tamano: grande`, ese auto NO es una respuesta a "algo chico". Va en el grupo aparte de acá abajo, después de los que sí cumplen, y dicho con todas las letras. AUNQUE SEA LO ÚNICO QUE ENTRE EN EL PRESUPUESTO, no lo ofrezcas como si fuera chico: ya pasó y es el bug. A "qué opción chica tenés" con un techo de $20.000.000 saliste con un utilitario porque era lo único que entraba. Lo correcto ahí es el número, igual que con la carrocería: cuál es el chico más accesible y cuánto sale.'

ok(smAntes.split(VIEJO).length === 2, 'no encontré (una sola vez) la línea 154 del prompt')
ag.parameters.options.systemMessage = smAntes.replace(VIEJO, () => NUEVO)
const smDespues = ag.parameters.options.systemMessage

// ── Aserciones ──────────────────────────────────────────────────────────────
// TRAMPA 1, LA PRIMERA DE TODAS: si el systemMessage deja de arrancar con '=', sus 18 expresiones
// {{ }} pasan a ser texto literal y Franco se queda sin datos de empresa ni FAQ. Costó meses.
ok(smDespues.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok(smAntes.startsWith('='), 'TRAMPA 1: el origen ya no arrancaba con "=" (algo está muy mal)')
ok((smAntes.match(/\{\{/g) || []).length === (smDespues.match(/\{\{/g) || []).length,
  'cambió la cantidad de expresiones {{ }} del prompt')

ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Franco (AI Agent)']),
  `esperaba SÓLO Franco (AI Agent); hay: ${JSON.stringify(distintos)}`)
ok(smDespues.split(VIEJO).length === 1, 'la línea vieja sigue en el prompt')
ok(smDespues.length - smAntes.length === NUEVO.length - VIEJO.length, 'cambió algo más que el reemplazo')
ok(smDespues.split('guiate por la carroceria').length === 1,
  'quedó otra frase que manda a la carrocería para el tamaño')

// EL VECINDARIO NO SE TOCA: la línea 153 (los que cumplen van primero) y la 156 (el grupo aparte)
// son las que hacen que "mostrar los chicos y ofrecer un mediano" funcione.
for (const frag of ['- Primero van los que CUMPLEN el criterio.',
                    'Lo que NO cumple el criterio va en un grupo APARTE y lo decís con todas las letras',
                    '## Recomendación por criterio (tamaño, uso, consumo)',
                    'LOS MONTOS DE "PISOS DE STOCK" NO SON EL PRECIO DE NINGÚN AUTO']) {
  ok(smDespues.includes(frag), `se perdió una línea vecina del prompt: ${frag}`)
}
// El campo tiene que estar declarado como algo que la herramienta devuelve, o la regla apunta a nada.
ok(/id, titulo, precio formateado, carroceria, tamano/.test(smDespues),
  'el prompt ya no declara que la herramienta devuelve `tamano`')
for (const nm of ['Config', 'Leer lead (estado)', 'Armar respuesta', 'Listar stock', 'Detalle auto']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

// ── El texto nuevo, revisado contra los dos síntomas medidos ────────────────
const casos = []
const chk = (n, c) => { casos.push(n); if (!c) fallas.push(`texto · ${n}`) }
chk('nombra el campo tamano', /`tamano`/.test(NUEVO))
chk('dice explícitamente que la carrocería NO decide', /La carrocería no decide el tamaño/.test(NUEVO))
chk('cubre el síntoma del sedán (Onix)', /un sedán puede ser `tamano: chico`/.test(NUEVO))
chk('cubre el síntoma del utilitario (Kangoo)', /un utilitario puede ser `tamano: mediano`/.test(NUEVO))
chk('tiene el EJEMPLO CONCRETO del fallo, no sólo la regla (trampa 6)',
  /ya pasó y es el bug/.test(NUEVO) && /qué opción chica tenés/.test(NUEVO))
chk('cubre el caso "es lo único que entra"', /AUNQUE SEA LO ÚNICO QUE ENTRE EN EL PRESUPUESTO/.test(NUEVO))
chk('manda al grupo aparte que ya existe, no inventa una regla nueva', /grupo aparte de acá abajo/.test(NUEVO))
chk('no hardcodea modelos de ESTE stock (configurabilidad)',
  !/(Onix|Kangoo|Cronos|Peugeot|Chevrolet|Renault)/.test(NUEVO))

const malas = fallas.filter((f) => f.startsWith('texto ·')).length
console.log(`  el tamaño lo dice la ficha: ${casos.length - malas}/${casos.length}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Franco (AI Agent)')
console.log(`  systemMessage: ${smAntes.length} -> ${smDespues.length} chars`)
