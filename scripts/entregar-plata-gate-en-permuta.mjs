// v87 -> v88 · el hecho de `entrega_plata` va ARRIBA DE `## Permuta`, donde vive el guion
//
// v87 MIDIÓ 0/4 Y EL FIX QUEDÓ PARTIDO EN DOS. Lo que funcionó y lo que no, medido:
//   · EL CRM: 4/4. `Guardar lead` escribe entrega="No mencionado" y descripcion_usado="No
//     mencionado" (ejecuciones 11593, 11601, 11605; una hasta resume "sin usado en parte de
//     pago"). Antes escribía entrega="Sí" + el usado fantasma. **La permuta fantasma ya no se
//     persiste**, que era lo que encerraba a Franco para el resto de la charla.
//   · EL TEXTO DE FRANCO: no. Las 4 toman bien los $5.000.000 como anticipo, pero `11605` abre
//     la permuta entera y pide "marca, modelo y año", y `11593`/`11601` recitan el guion de
//     tasación igual ("la tasación definitiva de tu financiación la hace un asesor", que no
//     significa nada).
//
// POR QUÉ FALLÓ: en v87 el hecho quedó en `# Lo que ya sabés de este cliente`, LEJOS del guion
// que lo contradice. `## Permuta` son 27.573 chars de guiones concretos y trampa 6 dice que el
// ejemplo concreto le gana a la regla abstracta POR MÁS VERDADERA QUE SEA. Misma lección que
// v83: gatear una cosa y dejar el guion en pie no alcanza.
//
// QUÉ CAMBIA ACÁ, Y POR QUÉ NO ES "UNA CONDICIÓN MÁS DE LAS 64": no se agrega una prohibición
// dentro de la sección, se pone un GATE DE ENTRADA arriba de todo que dice que la sección
// ENTERA no corre en este turno, con el guion concreto de qué hacer en su lugar. Las 68 líneas
// de abajo quedan byte a byte intactas (asertado).
//
// POR QUÉ ES SEGURO PARA LAS PERMUTAS REALES: el gate está condicionado a `entrega_plata > 0`,
// que mide 0 en TODOS los mensajes de permuta legítima del corpus (32 etiquetados, 0 FP) — entre
// otras cosas porque una de sus tres condiciones es que `Leer lead (estado)` no tenga ya
// `lead_entrega = "Sí"`. En un flujo de permuta el gate es inerte POR CONSTRUCCIÓN, no por
// suerte. Igual se mide con los controles de permuta.
//
// 1 NODO: sólo `Franco (AI Agent)`. `Config` y el CRM de v87 quedan como están (el CRM ya
// funciona 4/4 y no hay por qué tocarlo).

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v87.json'
const DESTINO = 'workflows/franco-n8n-v88.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))

const FMT = "String($node[\"Config\"].json.entrega_plata).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')"
const SIM = '$node["Config"].json.empresa_moneda_simbolo'

// El gate. Arranca diciendo que la sección no corre, y trae SU PROPIO GUION concreto — que es
// lo único que le gana a un guion concreto (trampa 6).
const GATE =
  '{{ $node["Config"].json.entrega_plata > 0 ? ' +
  "'PARÁ: ESTA SECCIÓN NO CORRE EN ESTE TURNO, Y NO ES OPINABLE. El cliente dijo que puede ENTREGAR ' + " +
  SIM + ' + ' + FMT +
  " + ', y eso está calculado: son PESOS, un anticipo en efectivo. NO nombró ningún auto usado, no tiene ninguno, y no hay nada para tasar. Saltá entera esta sección y volvé al embudo de financiación. Prohibido en este turno, textual: \"recibimos usados como parte de pago\", \"qué auto entregás\", \"marca, modelo y año\", \"con tu usado\", \"la tasación la hace un asesor\", \"si la tasación acompaña\". El guion de este turno es: \"perfecto, con ' + " +
  SIM + ' + ' + FMT +
  " + ' de anticipo seguimos.\" y después la pregunta que te falte del embudo de financiación (las cuotas, si no las dio). Si MÁS ADELANTE el cliente nombra un usado, ahí sí esta sección corre normalmente.' : '' }}"

const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage no arranca con "="')
const ANCLA = '## Permuta (cliente con efectivo + un usado para entregar)\n'
if (sm.split(ANCLA).length !== 2) throw new Error('no encontré (una sola vez) el encabezado de ## Permuta')
// replace con FUNCIÓN: el texto tiene "$" y `$'`/`$&` son patrones especiales de String.replace.
franco.parameters.options.systemMessage = sm.replace(ANCLA, () => ANCLA + GATE + '\n')

// ── Aserciones ───────────────────────────────────────────────────────────────
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }
const smNuevo = franco.parameters.options.systemMessage

ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i]))
  .map((n) => n.name)
ok(JSON.stringify(distintos) === JSON.stringify(['Franco (AI Agent)']),
  `esperaba UN solo nodo con diferencias; hay: ${JSON.stringify(distintos)}`)
ok(smNuevo.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')

// EL CUERPO DE ## Permuta QUEDA BYTE A BYTE: sólo se insertó el gate después del encabezado.
const cuerpoPermuta = (s) => {
  const i = s.indexOf('ANTES QUE NADA, SI TE HICIERON UNA PREGUNTA')
  return s.slice(i, s.indexOf('## Paso 3'))
}
ok(cuerpoPermuta(smNuevo) === cuerpoPermuta(sm),
  'el cuerpo de ## Permuta cambió: sólo se puede insertar el gate arriba, las 68 líneas no se tocan')
ok(smNuevo === sm.replace(ANCLA, () => ANCLA + GATE + '\n'), 'el cambio no es exactamente la inserción del gate')
ok(smNuevo.split(ANCLA).length === 2, '## Permuta quedó duplicada')

// Lo de v86 y v87 intacto
const seccion = (s, a, b) => s.slice(s.indexOf(a), s.indexOf(b))
ok(seccion(smNuevo, '# Financiación', '# Cotización de usados') === seccion(sm, '# Financiación', '# Cotización de usados'),
  '# Financiación cambió: el fix de v86 no se toca')
ok(smNuevo.includes('está hablando de PLATA'), 'se perdió la inyección de v87 en # Lo que ya sabés')
ok(smNuevo.includes('MONTO A FINANCIAR'), 'se perdió la inyección de v86')

// El gate compila y renderiza lo que se quiso escribir, y desaparece con 0.
// OJO: hay DOS expresiones con `entrega_plata > 0` — la de v87 en "# Lo que ya sabés" y este
// gate. Se ancla desde el encabezado de ## Permuta o se verifica la equivocada (me pasó).
const desde = smNuevo.indexOf(ANCLA)
const i = smNuevo.indexOf('entrega_plata > 0', desde)
const ini = smNuevo.lastIndexOf('{{', i)
try {
  const f = new Function('$node', `return (${smNuevo.slice(ini + 2, smNuevo.indexOf('}}', i))})`)
  const con = f({ Config: { json: { entrega_plata: 5000000, empresa_moneda_simbolo: '$' } } })
  const sin = f({ Config: { json: { entrega_plata: 0, empresa_moneda_simbolo: '$' } } })
  ok(con.includes('$5.000.000'), 'el gate no renderiza el monto')
  ok(con.includes('ESTA SECCIÓN NO CORRE'), 'el gate perdió su frase de entrada')
  ok(con.includes('marca, modelo y año'), 'el gate no prohíbe el guion que hay que matar')
  ok(sin === '', 'con entrega_plata = 0 el gate no queda vacío')
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
console.log(`  systemMessage: ${sm.length} -> ${smNuevo.length} chars`)
console.log(`  cuerpo de ## Permuta: byte a byte intacto (68 líneas, 64 condiciones)`)
