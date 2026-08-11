// v101 -> v102 · SI LA HERRAMIENTA NO DEVOLVIÓ AUTOS, NO SE LISTAN AUTOS
//
// EL BUG (captura de Agustina 2026-08-06, sesión REAL 00eb34ec). Después de dar los datos de su
// usado ("gol trend 2015" / "35mil km"), Franco le dumpea un abanico de 6 autos en tres bloques
// sin que se lo pidan. Lo que correspondía —lo dijo ella— era preguntarle si quería ir directo con
// un asesor o ver opciones.
//
// PRUEBA VINCULANTE, ejecución 12601 (el turno "35mil km"):
//   Listar stock  <-  tiene_permuta: 1, precio_objetivo: 12000000, con_financiacion: 1
//   Listar stock  ->  [{ "success": true }]      <-- EL CENTINELA: CERO FILAS
// O SEA: EL GATE DE v85 FUNCIONÓ PERFECTO. La herramienta no devolvió ni un auto, y Franco listó
// seis igual. No hay nada que arreglar en el gate.
// Y EL DAÑO ES PEOR QUE "RECOMENDAR DE MÁS": en esa lista escribió "Jeep Renegade 2019 —
// $24.500.000" cuando el Renegade real es 2021 y sale $25.500.000. Sin filas, INVENTÓ.
// Es el patrón que este proyecto ya documentó dos veces (v93 y v95): el modelo llena el vacío.
//
// REPRODUCIDO: `charla-real-reapertura-con-usado` (caso 85, la charla real de 12 turnos) mide
// **0/3 sobre v99**, y el turno 10 falla `cards_empty` con **6 cards** en 2 de 3 corridas.
//
// EL CAMBIO — DOS CAPAS, porque el síntoma tiene dos caras (el texto y las cards):
//   (A) `Armar respuesta` (CÓDIGO, determinístico): si `Listar stock` corrió en este turno y
//       devolvió el centinela, se descartan los autos. Franco puede haber puesto `auto_ids` de
//       memoria —eso fue exactamente lo que pasó—, y `Hidratar autos` los trae de la base igual,
//       así que las cards salen aunque la herramienta no haya devuelto nada. Esta capa mata el
//       material gráfico sí o sí, sin depender del modelo.
//   (B) `Franco (AI Agent)` (la frase renderizada): el turno en que el cliente está COMPLETANDO
//       los datos de su usado y no pidió ver nada tiene un guion, con las dos salidas que pidió
//       Agustina (asesor o ver opciones). Las condiciones son las MISMAS que las del gate de v85,
//       leídas de campos calculados, así que la inyección dispara exactamente cuando el gate
//       bloquea: no puede pedirle listar en un turno donde no va a recibir filas, que es el error
//       de diseño que v95 ya cometió una vez.
//
// 2 NODOS: `Armar respuesta` -> jsCode · `Franco (AI Agent)` -> System Message.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v101.json'
const DESTINO = 'workflows/franco-n8n-v102.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// ─────────────────────────────────────── (A) Armar respuesta: el centinela manda
const ar = wf.nodes.find((n) => n.name === 'Armar respuesta')
const js = ar.parameters.jsCode
const ANCLA_JS = '  const autos = [...new Set(ids)].map(id => porId.get(id)).filter(Boolean);'
if (js.split(ANCLA_JS).length !== 2) throw new Error('no encontré (una sola vez) el cálculo de autos')

const BLOQUE = ANCLA_JS + `

  // CENTINELA DE CERO FILAS (v102). Si "Listar stock" corrió en ESTE turno y devolvió el
  // centinela —una respuesta sin ninguna fila con id—, entonces no hay stock que mostrar y este
  // turno no lleva material gráfico. Hace falta porque Franco puede devolver auto_ids DE MEMORIA
  // aunque la herramienta no le haya dado nada: en la ejecución 12601 el gate de v85 bloqueó bien
  // (0 filas) y aun así listó 6 autos, uno con un precio inventado.
  // Sólo aplica si la herramienta CORRIÓ: en los turnos que muestran un auto vía "Buscar auto" o
  // "Detalle auto", "Listar stock" no aparece en la ejecución y esto no se activa.
  // try/catch como todo el resto de este nodo: ante cualquier duda, el comportamiento de antes.
  try {
    const _ls = $('Listar stock').first().json;
    const _filas = (_ls && Array.isArray(_ls.response)) ? _ls.response : null;
    if (_filas && _filas.length && _filas.every(r => !r || r.id == null)) {
      autos.length = 0;
    }
  } catch (e) {}`

ar.parameters.jsCode = js.replace(ANCLA_JS, () => BLOQUE)

// ─────────────────────────────────────── (B) el guion del turno que no muestra
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage no arranca con "="')

const ANCLA_SM = '\nCuando pregunten por financiación, cuotas, prenda, gastos o documentación,'
if (sm.split(ANCLA_SM).length !== 2) throw new Error('no encontré (una sola vez) el ancla de # Financiación')

// El regex de "el cliente niega el usado" se EXTRAE del propio prompt (lo puso v100) en vez de
// reescribirse, para que las dos ramas no se desincronicen.
const mNiega = sm.match(/if \(!\/(no tengo \(un \|.+?)\/i\.test\(msg\)\) return '';/)
ok(!!mNiega, 'no pude extraer el regex de negación del usado que puso v100')
const RE_NIEGA = mNiega ? mNiega[1] : 'no-va-a-matchear-nunca'

// ESTA INYECCIÓN TIENE LA PRIORIDAD MÁS BAJA DE LAS CUATRO. Las otras tres traen números
// calculados y ya están medidas; esta es la genérica del turno que no muestra. Las guardas de
// abajo replican sus condiciones, y el assert de "nunca dos juntas" es la red que caza cualquier
// desincronización futura (ya cazó 18 choques al escribir esto).
const INYECCION = `{{ (() => {
  const cfg = $node["Config"].json;
  const lead = $('Leer lead (estado)').item.json;
  if (Number(cfg.pidio_ver || 0) !== 0) return '';
  const dioPlata = Number(cfg.monto_financiar || 0) > 0 || Number(cfg.entrega_plata || 0) > 0 || Number(cfg.entrega_plata_resp || 0) > 0;
  const tieneUsado = String(lead.lead_entrega || '') === 'Sí';
  if (!dioPlata && !tieneUsado) return '';
  const msg = String(cfg.mensaje_usuario || '');
  const antTurno = Number(cfg.entrega_plata || 0) || Number(cfg.entrega_plata_resp || 0);
  const fin = Number(cfg.monto_financiar || 0) || Number(cfg.monto_financiar_hist || 0);
  // manda la de v98/v99 ("todavía te faltan $X")
  if (antTurno && fin && fin - antTurno > 0) return '';
  // manda la de v100 (el techo, cuando acaba de decir que no entrega usado)
  if ((antTurno || Number(cfg.entrega_plata_hist || 0)) && /${RE_NIEGA}/i.test(msg)) return '';
  // manda la de v97 (pidió una carrocería que no existe a ese precio)
  {
    const carr = String(cfg.carroceria_pedida || '');
    const mapa = lead.pisos_map || {};
    const piso = Number(mapa[carr] || 0);
    const techo = Number(cfg.entrega_plata || 0) * 2;
    if (!(!carr || !piso || !techo || piso <= techo)) return '';
  }
  const usado = String(lead.lead_usado || '');
  const conUsado = usado && usado !== 'No mencionado' && usado !== 'Auto usado mencionado, sin detalles';
  const guion = tieneUsado && conUsado
    ? 'Listo, ya tengo los datos de tu ' + usado + '. La tasación final la hace un asesor viéndolo en persona. Querés que te contacte un asesor para coordinarla, o preferís que te muestre opciones que te podrían servir?'
    : 'Perfecto, ya lo tengo anotado. Querés que te contacte un asesor para avanzar, o preferís que te muestre opciones que te podrían servir?';
  return 'DATO YA CALCULADO DE ESTE TURNO, ES VERDAD Y NO SE DISCUTE: el cliente te está DANDO un dato (plata o los datos de su usado) y NO te pidió ver autos. EN ESTE TURNO LA HERRAMIENTA DE STOCK NO TE VA A DEVOLVER NINGÚN AUTO, y eso no es un error ni significa que no haya stock: significa que este turno no es de mostrar. PROHIBIDO EN ESTE TURNO, y es la regla que manda sobre cualquier otra: nombrar un auto, escribir una lista de autos, dar precios o kilómetros, y armar tramos (entrada/intermedio/alto). Si igual escribís autos, los estás inventando: ya pasó, y saliste con un "Jeep Renegade 2019 — $24.500.000" que no existe. Decí TEXTUAL esta frase, que YA ESTÁ ARMADA: "' + guion + '" Los autos van en el turno SIGUIENTE, si te dice que sí.\\n';
})() }}`

franco.parameters.options.systemMessage = sm.replace(ANCLA_SM, () => '\n' + INYECCION + ANCLA_SM)
const smNuevo = franco.parameters.options.systemMessage

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Armar respuesta', 'Franco (AI Agent)']),
  `esperaba SOLO esos 2 nodos; hay: ${JSON.stringify(distintos)}`)
ok(smNuevo.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
const fromAI = (o) => (JSON.stringify(o).match(/fromAI\(/g) || []).length
ok(fromAI(wf) === fromAI(antes), `cambió la cantidad de $fromAI: ${fromAI(antes)} -> ${fromAI(wf)}`)
for (const frag of [
  'OFRECER ALGO QUE NO EXISTE TAMBIÉN ES INVENTAR',   // v97
  'TODAVÍA LE FALTAN',                                 // v98/v99
  'acaba de decir que NO entrega ningún usado',        // v100
  '# EL NOMBRE YA LO TENÉS',                           // v101
]) ok(smNuevo.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)
ok(smNuevo.split('EN ESTE TURNO LA HERRAMIENTA DE STOCK NO TE VA A DEVOLVER').length === 2,
  'la inyección nueva falta o está duplicada')
ok(smNuevo.split('!carr || !piso || !techo || piso <= techo').length === 5,
  'la guarda compartida con v97 tiene que aparecer 4 veces (v97 + v98 + v100 + v102)')
// El guard de cierre y el dedup de cards siguen intactos.
for (const frag of ['Guard de cierre comercial', 'cardsMostradas', 'yaMostrados', 'fotosDe']) {
  ok(ar.parameters.jsCode.includes(frag), `se perdió algo de Armar respuesta: ${frag}`)
}

// ── PRUEBA OFFLINE 1: el bloque del centinela, extraído del v102 GENERADO.
{
  const src = ar.parameters.jsCode.slice(
    ar.parameters.jsCode.indexOf('  try {\n    const _ls'),
    ar.parameters.jsCode.indexOf('} catch (e) {}', ar.parameters.jsCode.indexOf('const _ls')) + 14)
  try {
    const correr = (respuesta, autosIniciales) => {
      const autos = autosIniciales.slice()
      const $ = () => ({ first: () => ({ json: respuesta === undefined ? (() => { throw new Error('no corrió') })() : respuesta }) })
      new Function('autos', '$', src)(autos, $)
      return autos.length
    }
    const TRES = [{ id: 1 }, { id: 2 }, { id: 3 }]
    // EL CASO MEDIDO (12601): la tool devolvió el centinela y Franco puso ids igual.
    ok(correr({ response: [{ success: true }] }, TRES) === 0, 'el centinela no vació los autos')
    // Con filas de verdad NO toca nada.
    ok(correr({ response: [{ id: 4, titulo: 'Etios' }] }, TRES) === 3, 'vació los autos habiendo filas reales')
    // Si Listar stock no corrió en este turno (Buscar auto / Detalle auto), no se mete.
    ok(correr(undefined, TRES) === 3, 'se activó sin que Listar stock hubiera corrido')
    // Respuesta vacía o rara: no se mete.
    ok(correr({ response: [] }, TRES) === 3, 'se activó con response vacío')
    ok(correr({}, TRES) === 3, 'se activó sin response')
    console.log('  centinela de cero filas: 5/5')
  } catch (e) {
    fallas.push(`el bloque del centinela NO COMPILA: ${e.message}`)
  }
}

// ── PRUEBA OFFLINE 2: la inyección, y que no se pise con las otras.
{
  const extraer = (marca) => {
    const i = smNuevo.indexOf(marca)
    return smNuevo.slice(smNuevo.lastIndexOf('{{', i) + 2, smNuevo.indexOf('})() }}', i) + 5)
  }
  try {
    const MAPA = { suv: 19800000, sedan: 16800000, pickup: 32000000, hatchback: 8200000, utilitario: 18500000 }
    const baseCfg = { empresa_moneda_simbolo: '$', carroceria_pedida: '', mensaje_usuario: '', pidio_ver: 0, monto_financiar: 0, monto_financiar_hist: 0, entrega_plata: 0, entrega_plata_resp: 0, entrega_plata_hist: 0 }
    const baseLead = { pisos_map: MAPA, lead_entrega: 'No mencionado', lead_usado: 'No mencionado', lead_nombre: '' }
    const mk = (f) => (c, l) => f(
      { Config: { json: Object.assign({}, baseCfg, c) } },
      () => ({ item: { json: Object.assign({}, baseLead, l) } }),
    )
    const fNueva = mk(new Function('$node', '$', `return (${extraer('EN ESTE TURNO LA HERRAMIENTA DE STOCK NO TE VA A DEVOLVER')})`))

    // EL CASO MEDIDO: usado ya declarado, con datos, y no pidió ver.
    const con = fNueva({}, { lead_entrega: 'Sí', lead_usado: 'Volkswagen Gol Trend 2015 - 35.000 km' })
    ok(con.includes('Volkswagen Gol Trend 2015'), 'el guion no nombra el usado del cliente')
    ok(/"Listo, ya tengo los datos de tu Volkswagen Gol Trend 2015 - 35\.000 km\. La tasación final la hace un asesor viéndolo en persona\. Querés que te contacte un asesor para coordinarla, o preferís que te muestre opciones que te podrían servir\?"/.test(con),
      'el guion con las dos salidas no quedó textual')
    // La rama sin datos del usado.
    ok(fNueva({ entrega_plata: 5000000 }, {}).includes('Perfecto, ya lo tengo anotado'), 'no cae en la rama sin usado')
    // NO dispara si el cliente PIDIÓ ver: ahí sí tiene que mostrar.
    ok(fNueva({ pidio_ver: 1 }, { lead_entrega: 'Sí', lead_usado: 'Gol Trend 2015' }) === '',
      'dispara cuando el cliente SÍ pidió ver: le estaría prohibiendo mostrar')
    // NO dispara si no dio plata ni tiene usado.
    ok(fNueva({}, {}) === '', 'dispara en un turno cualquiera')
    // Nunca junto con las otras tres inyecciones.
    const fFalta = mk(new Function('$node', '$', `return (${extraer('TODAVÍA LE FALTAN')})`))
    const fV97 = mk(new Function('$node', '$', `return (${extraer('NO HAY NINGUNA ')})`))
    const fTecho = mk(new Function('$node', '$', `return (${extraer('acaba de decir que NO entrega ningún usado')})`))
    for (const msg of ['', 'no tengo usado', '7 millones']) {
      for (const pv of [0, 1]) for (const ep of [0, 5000000]) for (const eh of [0, 7000000]) {
        for (const fi of [0, 30000000]) for (const ent of ['No mencionado', 'Sí']) {
          const c = { mensaje_usuario: msg, pidio_ver: pv, entrega_plata: ep, entrega_plata_hist: eh, monto_financiar_hist: fi }
          const l = { lead_entrega: ent, lead_usado: 'Gol Trend 2015' }
          const n = [fNueva(c, l), fFalta(c, l), fV97(c, l), fTecho(c, l)].filter(Boolean).length
          ok(n <= 1, `disparan ${n} inyecciones juntas: ${JSON.stringify(c)} ${ent}`)
        }
      }
    }
    console.log('  guion del turno que no muestra: ' + con.slice(con.indexOf('"Listo,'), con.indexOf('servir?"') + 8))
  } catch (e) {
    fallas.push(`la inyección NO COMPILA: ${e.message}`)
  }
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Armar respuesta · Franco (AI Agent)')
console.log(`  systemMessage: ${sm.length} -> ${smNuevo.length} chars`)
