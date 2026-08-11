// v118 -> v119 · LA FIRMA DE LA FICHA TIENE QUE SER ÚNICA (+ la versión deja de viajar de prestado)
//
// BUG REPORTADO POR AGUSTINA (charla real, 2026-08-10, sesión 19:25–19:30Z, 2 capturas).
// Pide la ficha del Onix y de la T-Cross y las recibe completas. Pide "perfecto y el corolla?" y
// le llega UNA SOLA LÍNEA: "El Toyota Corolla 2022 tiene 35.000 km y cuesta $24.800.000." Insiste
// ("es el full?", "que version tiene el auto?") y Franco deriva al asesor diciendo "Ya viste la
// info que te pasé antes" — que es FALSO: nunca dio la ficha del Corolla.
//
// NO ES EL PROMPT Y NO ES ALUCINACIÓN. LO DICE EL LOG, ejecución 14788, salida cruda de
// `Detalle auto` con auto_id=5:
//     descripcion    : ""
//     ficha_completa : "YA LE DISTE LA FICHA COMPLETA DE ESTE AUTO EN ESTA MISMA CONVERSACIÓN…"
// El código le pasó una premisa falsa y Franco la obedeció. Es la trampa 7 en estado puro: antes
// de culpar al prompt, fijate si la frase la inyecta el código.
//
// LA CAUSA — LA FIRMA DE v103 NO ES ÚNICA. El detector "esta ficha ya se dio" busca el consumo
// EXACTO del auto en las últimas 12 burbujas de Franco. El Corolla y la T-Cross comparten
// "7.2 L/100km": la ficha de la T-Cross imprimió ese string y el detector del Corolla lo tomó
// como propio. Tres grupos en colisión, 7 de los 17 autos:
//     7.8 L/100km -> Gol Trend, EcoSport, Duster
//     7.2 L/100km -> Corolla, T-Cross      <- el caso reportado
//     9.5 L/100km -> Renegade, Ranger
// LO INTRODUJO LA MIGRACIÓN A LA FICHA V2, que reescribió 16 consumos. La nota de STATE pedía que
// la firma siguiera siendo "UN solo X.Y L/100km": se cuidó el FORMATO y nunca se verificó la
// UNICIDAD entre autos. Una firma que no es única no es una firma.
//
// FIX 1 — FIRMA DISCRIMINANTE: la burbuja tiene que contener el consumo **Y** el modelo del auto.
// No toca datos. `motor` NO servía de alternativa: Onix y T-Cross son los dos "1.0 Turbo de 116 CV".
//
// FIX 2 — `version` DEJA DE VIAJAR DE PRESTADO. Es la segunda capa, y es la que contesta "si el
// dato existe, por qué no lo dijo": `Detalle auto` NO devolvía `version` como campo. El dato está
// (metadata.version = "XEI 2.0 Dynamic Force") pero sólo llegaba EMBEBIDO dentro de content ->
// ficha_completa, así que cualquier supresión de ese campo se llevaba la versión puesta —incluso
// una supresión LEGÍTIMA: si el cliente ya recibió la ficha y después pregunta "qué versión es?",
// Franco tampoco podía contestar. Ahora `version` es un campo propio y sobrevive a la supresión,
// y el texto de la supresión gana una excepción para el dato puntual, con ejemplo (trampa 6: sin
// ejemplo, la excepción pierde contra el "PROHIBIDO" que quedó arriba).
//
// VAN JUNTOS Y ES LA MISMA EXCEPCIÓN CONSCIENTE QUE v116: son independientes, cada uno tiene su
// assert y su turno de eval, y sus síntomas son distinguibles a simple vista (la ficha que no
// llega / la versión que no se puede decir). Además el fix 1 solo NO cierra el caso de Agustina:
// arreglada la colisión, el turno "qué versión tiene?" sigue muriendo en la supresión legítima.
//
// EL CONTROL ES `no-repite-la-ficha` Y EL TURNO 11 DE `charla-real-reapertura-con-usado`: la
// supresión legítima tiene que seguir funcionando. OJO, al reparar ese control se descubrió que
// apuntaba a "180 HP", "9.8" y equipamiento que la migración borró: estaba VERDE SIN MEDIR NADA.
// Ya quedó apuntando a los strings que la Amarok tiene hoy.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v118.json'
const DESTINO = 'workflows/franco-n8n-v119.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const da = wf.nodes.find((n) => n.name === 'Detalle auto')
const qAntes = da.parameters.query

// ── FIX 1 · la firma suma el modelo ─────────────────────────────────────────────────────────
const COND_VIEJA = `    WHERE NULLIF(metadata->>'consumo', '') IS NOT NULL
      AND (b->>'content') LIKE '%' || (metadata->>'consumo') || '%'`

const COND_NUEVA = `    WHERE NULLIF(metadata->>'consumo', '') IS NOT NULL
      AND (b->>'content') LIKE '%' || (metadata->>'consumo') || '%'
      -- EL MODELO TAMBIÉN, O LA FIRMA NO IDENTIFICA NADA (v119). El consumo NO es único: el
      -- Corolla y la T-Cross comparten "7.2 L/100km", y con sólo el consumo la ficha de una
      -- marcaba como "ya dada" la de la otra (ejecución 14788, bug reportado por Agustina).
      AND (b->>'content') ILIKE '%' || (metadata->>'modelo') || '%'`

ok(qAntes.split(COND_VIEJA).length === 3, `esperaba la condición 2 veces, hay ${qAntes.split(COND_VIEJA).length - 1}`)
let q = qAntes.replaceAll(COND_VIEJA, COND_NUEVA)

// ── FIX 2 · `version` como campo propio ─────────────────────────────────────────────────────
const TAM_VIEJO = "  metadata->>'tamano' AS tamano,\n"
const TAM_NUEVO = "  metadata->>'tamano' AS tamano,\n"
  + "  -- CAMPO PROPIO A PROPÓSITO (v119): antes la versión sólo viajaba dentro de `content` ->\n"
  + "  -- `ficha_completa`, así que la supresión de la ficha se la llevaba puesta y Franco no podía\n"
  + "  -- contestar \"qué versión es?\" ni siquiera teniendo el dato en la base.\n"
  + "  metadata->>'version' AS version,\n"
ok(qAntes.split(TAM_VIEJO).length === 2, 'no encontré (1 vez) la línea de `tamano` en el SELECT')
q = q.replace(TAM_VIEJO, () => TAM_NUEVO)

// El texto de la supresión gana la excepción del dato puntual, CON ejemplo (trampa 6).
const SUP_VIEJA = 'Confirmá en UNA sola línea de qué auto se trata y su precio, y pasá al próximo paso.'
const SUP_NUEVA = 'Confirmá en UNA sola línea de qué auto se trata y su precio, y pasá al próximo paso. '
  + 'EXCEPCIÓN, Y ES IMPORTANTE: si el cliente pregunta por UN dato puntual de ese auto —la versión, '
  + 'el color, los kilómetros—, contestá ESE dato y nada más. Lo tenés en los campos de esta misma '
  + 'respuesta. A "qué versión tiene?" se responde con la versión, no con "un asesor te lo confirma": '
  + 'derivar por un dato que ya tenés es el bug. Y contestarlo NO te habilita a recitar la ficha entera.'
ok(qAntes.split(SUP_VIEJA).length === 2, 'no encontré (1 vez) el cierre del texto de supresión')
q = q.replace(SUP_VIEJA, () => SUP_NUEVA)

da.parameters.query = q

// La tool tiene que DECLARAR el campo nuevo, o es la historia de la etiqueta `fuera`.
const TD_VIEJA = "Devuelve además 'fotos' (todas las URLs del auto) y 'ficha_completa' (el texto original de la ficha, del que salen motor, transmisión y equipamiento)."
const TD_NUEVA = "Devuelve además 'fotos' (todas las URLs del auto), 'version' (la versión exacta, ej: \"XEI 2.0 Dynamic Force\") y 'ficha_completa' (el texto original de la ficha, del que salen motor, transmisión y equipamiento). 'version' viene SIEMPRE, tambien cuando la ficha esta suprimida porque ya se dio: si te preguntan la version, contestala con ese campo en vez de derivar al asesor."
ok(da.parameters.toolDescription.split(TD_VIEJA).length === 2, 'no encontré (1 vez) la frase de la toolDescription')
da.parameters.toolDescription = da.parameters.toolDescription.replace(TD_VIEJA, () => TD_NUEVA)

// ── Aserciones ──────────────────────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Detalle auto']),
  `esperaba SÓLO Detalle auto; hay: ${JSON.stringify(distintos)}`)

// El texto viejo YA NO ESTÁ.
ok(!q.includes(COND_VIEJA + '\n  )'), 'quedó alguna condición sin el modelo')
ok(q.split("ILIKE '%' || (metadata->>'modelo') || '%'").length === 3, 'la condición del modelo no quedó 2 veces')
ok(q.split("metadata->>'version' AS version,").length === 2, '`version` no quedó exactamente 1 vez en el SELECT')
ok(!q.includes(SUP_VIEJA + "'"), 'el cierre viejo de la supresión sigue ahí')
ok(q.split("$fromAI(").length === qAntes.split("$fromAI(").length, 'TRAMPA 3: cambió la cantidad de $fromAI')

// El nodo sigue devolviendo 1 fila por id (trampa 4 no aplica acá: es un tool, no cadena principal,
// pero si dejara de traer el auto Franco se queda sin ficha igual).
ok(/WHERE \(metadata->>'id'\)::int = /.test(q), 'se rompió el WHERE por id')

// ── Revisión del texto, contra los dos síntomas medidos ─────────────────────────────────────
const casos = []
const chk = (n, c) => { casos.push(n); if (!c) fallas.push(`texto · ${n}`) }
chk('la firma exige el modelo', /ILIKE '%' \|\| \(metadata->>'modelo'\)/.test(q))
chk('deja escrito POR QUÉ (el consumo no es único)', /El consumo NO es único/.test(q))
chk('cita la evidencia, no la intuición', /14788/.test(q))
chk('`version` sale como campo propio', /metadata->>'version' AS version/.test(q))
chk('la supresión ahora tiene excepción para el dato puntual', /EXCEPCIÓN, Y ES IMPORTANTE/.test(q))
chk('la excepción trae EJEMPLO concreto, no sólo regla (trampa 6)', /"qué versión tiene\?"/.test(q))
chk('prohíbe derivar por un dato que ya tiene', /derivar por un dato que ya tenés es el bug/.test(q))
chk('la excepción NO reabre la ficha entera', /NO te habilita a recitar la ficha entera/.test(q))
chk('la supresión legítima sigue existiendo', /YA LE DISTE LA FICHA COMPLETA DE ESTE AUTO/.test(q))
chk('no hardcodea modelos de ESTE stock en la lógica', !/Corolla|T-Cross|Onix/.test(q.split('--').filter((_, i) => i === 0).join('')))

const malas = fallas.filter((f) => f.startsWith('texto ·')).length
console.log(`  firma única + versión propia: ${casos.length - malas}/${casos.length}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Detalle auto')
console.log(`  query:           ${qAntes.length} -> ${q.length} chars`)
console.log(`  toolDescription: ${antes.nodes.find((n) => n.name === 'Detalle auto').parameters.toolDescription.length} -> ${da.parameters.toolDescription.length} chars`)
