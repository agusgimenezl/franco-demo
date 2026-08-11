// v120 -> v121 · LAS FOTOS NO EXIGEN IR AL LOCAL
//
// BUG REPORTADO POR AGUSTINA (2026-08-10, captura). Pide "me pasas fotos del interior del corolla?"
// y Franco contesta que esas fotos "las puede mostrar un asesor CUANDO VENGAS A VERLO EN PERSONA",
// y cierra ofreciendo "coordinar una visita". Se inventa un requisito que no existe: no hace falta
// que el cliente vaya al local, el asesor le facilita las fotos.
//
// LA CAUSA — LA TRAMPA 6 EN SU FORMA INVERSA. No hay NINGÚN guion sobre fotos en las 333 líneas del
// prompt: lo único que se dice es "las URLs salen de la herramienta, no las escribas" (líneas 94,
// 112, 201, 332). En cambio hay CINCO instancias de "un asesor lo ve en persona" (179, 180, 184,
// 298, 308), todas legítimas y todas sobre LA TASACIÓN DEL USADO. Ante un pedido que no puede
// cumplir, Franco tomó prestado el guion más parecido que tenía a mano.
// Por eso el fix es PONER EL GUION QUE FALTA, no agregar una prohibición: el vacío se llena solo,
// y se llena con el vecino equivocado.
//
// LA REDACCIÓN LA DEFINIÓ AGUSTINA Y VA TEXTUAL (2026-08-10):
//   "Las fotos que tenemos del Toyota Corolla 2022 son las que están publicadas en el stock, que
//    incluyen vistas generales y de la carrocería. Fotos específicas del interior las puede
//    facilitar un asesor. Querés que te conecte con uno o te ayudo con algo más?"
// En el prompt va con el modelo como marcador, no con "Toyota Corolla 2022": hardcodear un auto de
// este stock es lo que hizo recitable el guion del piso en v120 (y rompe la configurabilidad).
//
// CIERRA TAMBIÉN EL BUG 3 QUE YA ESTABA PENDIENTE EN STATE: Franco había dicho "acá te dejo las
// fotos por dentro y por fuera" con 3 fotos exteriores. NO HAY METADATO de interior/exterior en la
// base —`fotos` es un array de URLs y nada más—, así que Franco no puede saber qué muestra cada
// foto. El guion nuevo no promete: dice lo que hay, y para lo específico ofrece el asesor.
//
// DÓNDE VA: en "Paso 3 — Interés en un auto puntual", pegado a la línea que ya habla de las fotos
// ("El id de ese auto va en 'auto_ids'. Las fotos se agregan solas: no las escribas."), que es el
// lugar donde el modelo ya está mirando cuando el turno es sobre fotos.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v120.json'
const DESTINO = 'workflows/franco-n8n-v121.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ag = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = ag.parameters.options.systemMessage

const VIEJO = "- El id de ese auto va en 'auto_ids'. Las fotos se agregan solas: no las escribas."

const NUEVO = "- El id de ese auto va en 'auto_ids'. Las fotos se agregan solas: no las escribas.\n"
  + '- SI TE PIDEN FOTOS DE UNA PARTE PUNTUAL (el interior, el baúl, el motor, un detalle): las fotos '
  + 'que salen son las publicadas del auto y NO SABÉS qué muestra cada una — no hay ningún dato que '
  + 'te lo diga. Así que no prometas lo que no podés saber y NO LE PIDAS QUE VAYA AL LOCAL: el asesor '
  + 'se las facilita, sin que el cliente tenga que ir a ver el auto. Guion, TEXTUAL, con el nombre del '
  + 'auto en lugar del marcador: "Las fotos que tenemos del <AUTO> son las que están publicadas en el '
  + 'stock, que incluyen vistas generales y de la carrocería. Fotos específicas del interior las puede '
  + 'facilitar un asesor. Querés que te conecte con uno o te ayudo con algo más?". PROHIBIDO en ese '
  + 'turno: "cuando vengas a verlo en persona", "coordinamos una visita" o cualquier variante que '
  + 'ponga ir al local como CONDICIÓN para tener las fotos — ya pasó y es el bug. Si el cliente '
  + 'después quiere venir, ahí sí se lo coordinás. Y no digas que tenés fotos del interior ni las '
  + 'ofrezcas vos: si las hubiera, ya se las mandaste con el auto.'

ok(smAntes.split(VIEJO).length === 2, `esperaba la línea de fotos 1 vez, hay ${smAntes.split(VIEJO).length - 1}`)
const sm = smAntes.replace(VIEJO, () => NUEVO)
ag.parameters.options.systemMessage = sm

// ── Aserciones ──────────────────────────────────────────────────────────────────────────────
ok(smAntes.startsWith('='), 'TRAMPA 1: el origen ya no arrancaba con "="')
ok(sm.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok((smAntes.match(/\{\{/g) || []).length === (sm.match(/\{\{/g) || []).length,
  'cambió la cantidad de expresiones {{ }} del prompt')
ok(sm.length - smAntes.length === NUEVO.length - VIEJO.length, 'cambió algo más que el reemplazo')

ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Franco (AI Agent)']),
  `esperaba SÓLO Franco (AI Agent); hay: ${JSON.stringify(distintos)}`)

// Las cinco frases de "en persona" que SÍ son legítimas (tasación del usado) no se tocan.
ok((smAntes.match(/en persona/g) || []).length + 1 === (sm.match(/en persona/g) || []).length,
  'se tocó alguna de las frases de "en persona" de la tasación, que son correctas')
for (const frag of ['La tasación final la hace un asesor viéndolo en persona',
                    'para cotizarlo necesito que un asesor lo vea en persona']) {
  ok(sm.includes(frag), `se perdió una frase legítima de tasación: ${frag}`)
}

// ── El texto, contra el fallo medido y contra la redacción de Agustina ──────────────────────
const casos = []
const chk = (n, c) => { casos.push(n); if (!c) fallas.push(`texto · ${n}`) }
chk('trae el guion de Agustina, textual', NUEVO.includes('son las que están publicadas en el stock, que incluyen vistas generales y de la carrocería'))
chk('usa "facilitar", no "mostrar cuando vengas"', /las puede facilitar un asesor/.test(NUEVO))
chk('cierra como ella lo definió', /Querés que te conecte con uno o te ayudo con algo más\?/.test(NUEVO))
chk('prohíbe la visita como condición, con el ejemplo textual del fallo (trampa 6)',
  /cuando vengas a verlo en persona/.test(NUEVO) && /ya pasó y es el bug/.test(NUEVO))
chk('deja abierto que el cliente venga si LO PIDE', /Si el cliente después quiere venir/.test(NUEVO))
chk('dice que no hay metadato de qué muestra cada foto', /NO SABÉS qué muestra cada una/.test(NUEVO))
chk('no promete fotos de interior (BUG 3 de STATE)', /no digas que tenés fotos del interior/.test(NUEVO))
chk('NO hardcodea un auto de este stock (configurabilidad)',
  !/Corolla|Toyota|Onix|Amarok|Hilux|Ranger|T-Cross/.test(NUEVO) && /<AUTO>/.test(NUEVO))

const malas = fallas.filter((f) => f.startsWith('texto ·')).length
console.log(`  las fotos no exigen ir al local: ${casos.length - malas}/${casos.length}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Franco (AI Agent)')
console.log(`  systemMessage: ${smAntes.length} -> ${sm.length} chars`)
