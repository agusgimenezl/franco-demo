// v130 -> v131 · RESTAURAR EL NAME-ASK QUE SE PERDIÓ EN v77
//
// ESTO NO ES UN FIX NUEVO. Es volver a poner uno que ya existió, ya se midió y se perdió solo.
//
// EL HALLAZGO (2026-08-11): `derivacion-aceptada-igual-pide-nombre` viene rojo hace tres versiones
// (v128 0/3, v129 1/3, v130 0/3) y se lo estaba tratando como un caso flaky. No lo es: **el fix
// determinístico que lo llevó de 1/7 a 7/8 en v75 desapareció del workflow en v77**, hace 53
// versiones, y nadie lo notó porque el caso pasó a fallar de a poco.
//
//   v75  YA_ACEPT=2  (línea partida según el nombre)   <- el fix
//   v76  YA_ACEPT=2
//   v77  YA_ACEPT=1  <- se perdió acá
//   ...  todas iguales hasta v130
//
// SE PERDIÓ SÓLO ESE CAMPO, no un nodo entero: entre v76 y v77 el único cambio en todo el workflow
// es `Config.estado_cliente`, de 1404 a 1154 chars. Alguien editó esa expresión partiendo de una
// copia vieja. No hay otros fixes perdidos por ese camino (verificado nodo por nodo).
//
// EL BUG QUE VUELVE A TAPAR, tal como lo diagnosticó la sesión del 2026-08-01 leyendo el log
// (sesión c7339dc4, ejecuciones 9780-9783): `Config.estado_cliente` empuja "- YA ACEPTO que lo
// contacte un asesor: la derivacion esta en curso, no se la vuelvas a ofrecer.". Esa línea se
// escribió para que Franco NO RE-OFREZCA el asesor, y de paso **apagó el name-ask**, que es lo
// único que faltaba para COMPLETAR la derivación. No distingue "aceptó y ya tengo su nombre" de
// "aceptó y todavía no me lo dio", y son dos situaciones con próximos pasos opuestos. El lead queda
// con el teléfono ficticio de nombre y la tarjeta del CRM sale anónima.
//
// POR QUÉ VA EN Config Y NO EN EL PROMPT: que falte el nombre es DETERMINÍSTICO — `Leer lead
// (estado)` ya devuelve `lead_nombre` normalizado a '' cuando no hay nombre real (su CASE ya trata
// el teléfono ficticio '+54%' como vacío). Es la regla del proyecto, y es trampa 7: la frase la
// inyecta el CÓDIGO, así que el fix va donde está la frase.
//
// TEXTO IDÉNTICO AL DE v75, a propósito: es el que se midió 7/8. No se "mejora" de paso.
//
// ⚠️ ESTE FIX NO ARREGLA TODO EL CASO. En v130 el caso también falla por RE-OFRECER el asesor
// ("preferís, puedo ponerte en contacto con un asesor"), que es un check distinto. Esto ataca el
// name-ask. Lo otro se mide después y va aparte.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v130.json'
const DESTINO = 'workflows/franco-n8n-v131.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }
const cuenta = (t, a) => t.split(a).length - 1

const cfg = wf.nodes.find((n) => n.name === 'Config')
const ec = cfg.parameters.assignments.assignments.find((a) => a.name === 'estado_cliente')
ok(!!ec, 'no encontré estado_cliente en Config')
ok(ec.value.startsWith('={{'), 'TRAMPA 1: estado_cliente no arranca con "={{"')

const COND = "if (l.lead_estado === 'Requiere asesor' || l.ya_derivado === true || l.ya_derivado === 't' || l.ya_derivado === 'true') "
const OLD_PUSH = COND + "p.push('- YA ACEPTO que lo contacte un asesor: la derivacion esta en curso, no se la vuelvas a ofrecer.');"

const CON_NOMBRE = '- YA ACEPTO que lo contacte un asesor: la derivacion esta en curso, no se la vuelvas a ofrecer.'
const SIN_NOMBRE = '- YA ACEPTO que lo contacte un asesor: no se la vuelvas a ofrecer. PERO TODAVIA NO TE DIO SU NOMBRE, y sin nombre la derivacion NO queda completa: antes de cerrar pediselo, "me dejas tu nombre y apellido?". Es lo unico que falta.'
const NEW_PUSH = COND + "p.push(l.lead_nombre ? '" + CON_NOMBRE + "' : '" + SIN_NOMBRE + "');"

ok(cuenta(ec.value, OLD_PUSH) === 1, `no encontré (1 vez) la línea sin partir; hay ${cuenta(ec.value, OLD_PUSH)}`)
ec.value = ec.value.replace(OLD_PUSH, () => NEW_PUSH)

// ── Aserciones ──────────────────────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Config']), `esperaba SÓLO Config; hay: ${JSON.stringify(distintos)}`)
ok(!ec.value.includes(OLD_PUSH), 'el texto viejo sigue estando')
ok(cuenta(ec.value, 'l.lead_nombre ?') === 1, 'no quedó la rama por lead_nombre')
ok(cuenta(ec.value, CON_NOMBRE) === 1, 'no quedó la rama "ya tengo el nombre"')
ok(cuenta(ec.value, SIN_NOMBRE) === 1, 'no quedó la rama "falta el nombre"')
ok(cuenta(ec.value, 'me dejas tu nombre y apellido?') === 1, 'no quedó el GUION concreto (trampa 6)')
ok(cuenta(ec.value, 'l.ya_derivado') === 3, 'se perdió alguna condición de ya_derivado')
ok(ec.value.startsWith('={{'), 'TRAMPA 1: estado_cliente dejó de arrancar con "={{"')
ok(!/[¿¡]/.test(SIN_NOMBRE), 'la línea nueva usa signos de apertura y el resto de estado_cliente no')
// El systemMessage no se toca: el guion del name-ask ya vive en "# Derivación a un asesor".
const sm = wf.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage
ok(sm === antes.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage,
  'se tocó el systemMessage y este fix NO debe tocarlo')

// ── La expresión tiene que seguir siendo JS válido Y ramificar bien ─────────────────────────
// Se evalúa el cuerpo del {{ }} en seco, con las dos formas del lead. Es la lección de v122
// aplicada a una expresión de n8n: no alcanza con que el string esté, tiene que EJECUTAR.
const cuerpo = ec.value.slice(4, -3)
const probar = (lead) => {
  const fn = new Function('$', `const l0 = ${JSON.stringify(lead)}; const $$ = () => ({ item: { json: l0 } }); return (${cuerpo.replace(/\$\('Leer lead \(estado\)'\)/g, '$$$$()')})`)
  return fn(() => ({ item: { json: lead } }))
}
try {
  const derivadoSinNombre = probar({ lead_estado: 'Requiere asesor', lead_nombre: '' })
  const derivadoConNombre = probar({ lead_estado: 'Requiere asesor', lead_nombre: 'Julieta Miguez' })
  const sinDerivar = probar({ lead_estado: 'Nuevo', lead_nombre: '' })
  ok(derivadoSinNombre.includes('me dejas tu nombre y apellido?'),
    'derivado SIN nombre: no pide el nombre')
  ok(!derivadoConNombre.includes('me dejas tu nombre y apellido?'),
    'derivado CON nombre: le pide el nombre igual, y no debería')
  ok(derivadoConNombre.includes('Se llama Julieta Miguez'), 'derivado CON nombre: perdió el nombre')
  ok(!sinDerivar.includes('YA ACEPTO'), 'sin derivar: dice que aceptó y no aceptó')
  console.log('  ramas evaluadas de verdad: 4/4')
} catch (e) {
  fallas.push(`la expresión no evalúa: ${e.message}`)
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log('  nodos con diferencias: Config (sólo estado_cliente)')
