// v109 -> v110 · EL ENCABEZADO DICE "ANTICIPO Y FINANCIACIÓN", NO "EFECTIVO"
//
// EL BUG, EN UNA LÍNEA: el fallback del encabezado TB-3 compara `lead_financia === 'Si'` SIN TILDE,
// y la base guarda `'Sí'` CON tilde. La rama nunca puede ser verdadera.
// VERIFICADO CONTRA LA BASE (Supabase por MCP, 2026-08-06): `crm_leads.financia` toma exactamente
// tres valores — 'Sí' (495 filas), 'No' (68), 'No mencionado' (1127). 'Si' sin tilde: CERO.
// `Leer lead (estado)` expone esa columna tal cual, así que `financia` vale siempre false.
//
// Y NO ES UN DETALLE DE REDACCIÓN: el fallback CORRE SIEMPRE. La lectura de la tool
// (`$('Listar stock').first().json`) no funciona en este nodo —probado en 13583 y 13522—, así que
// `ls.eco_permuta` queda null y el `if` del fallback entra en todos los turnos.
//
// PRUEBA VINCULANTE, medición de v109 (ventana 19:18:10–19:24:39, corrida 2 del turno 3 de
// `capacidad-de-compra-financiada`): el encabezado salió
//   "Con tu usado como parte de pago y tu efectivo, estas opciones te pueden servir:"
// y esa frase EXACTA sólo la produce la combinación permuta=true, presu=true, financia=false —
// las partes son 'tu usado como parte de pago', (financia ? 'tu anticipo' : 'tu efectivo') y, sólo
// si financia, 'la posibilidad de financiar'. Está unívocamente determinada.
// DAÑO MEDIDO: ese turno trajo el abanico alto CORRECTO (Renegade $25.500.000, Corolla
// $24.800.000, Duster) y fue rojo igual, porque el encabezado se comió las palabras que el check
// pide: `text_matches financ|50 %|anticipo`. O sea que el encabezado determinístico estaba tapando
// un turno que ya funcionaba. Y en la demo en vivo le dice "tu efectivo" a alguien que está
// financiando.
//
// EL CAMBIO — UN NODO, UNA COMPARACIÓN:
//     financia = String(le.lead_financia || '') === 'Si';
//  -> financia = /^s[ií]$/i.test(String(le.lead_financia || '').trim());
// Se normaliza en vez de cambiar 'Si' por 'Sí' a secas: así aguanta que el CRM escriba 'si', 'SI'
// o 'Sí' —lo escribe un modelo— sin volver a romperse. Los otros dos campos del fallback NO se
// tocan: `lead_entrega` ya compara contra 'Sí' CON tilde (es correcto) y tiene su propio OR.
//
// LO QUE ESTE CAMBIO NO ARREGLA, DICHO DERECHO: que leer la salida del tool desde este nodo no
// funcione. Eso deja muertos el centinela de v102 y el bloque de v107, y va aparte, con una
// verificación contra una ejecución real ANTES de escribir código.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v109.json'
const DESTINO = 'workflows/franco-n8n-v110.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ar = wf.nodes.find((n) => n.name === 'Armar respuesta')
const jsAntes = ar.parameters.jsCode

const VIEJO = `          financia = String(le.lead_financia || '') === 'Si';`
const NUEVO = `          // NORMALIZADO A PROPÓSITO (v110): la base guarda 'Sí' CON tilde —verificado: 495 filas
          // 'Sí', 68 'No', 1127 'No mencionado', cero 'Si'— y esta comparación pedía 'Si' sin
          // tilde, así que era SIEMPRE false. Y como la lectura del tool no funciona, este fallback
          // corre en todos los turnos: el encabezado decía "tu efectivo" a quien está financiando.
          // Se normaliza en vez de arreglar la tilde a secas porque el valor lo escribe un modelo.
          financia = /^s[ií]$/i.test(String(le.lead_financia || '').trim());`
ok(jsAntes.split(VIEJO).length === 2, 'no encontré (una sola vez) la comparación de lead_financia')

ar.parameters.jsCode = jsAntes.replace(VIEJO, () => NUEVO)
const jsDespues = ar.parameters.jsCode

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Armar respuesta']),
  `esperaba SÓLO Armar respuesta; hay: ${JSON.stringify(distintos)}`)

// EL TEXTO VIEJO YA NO ESTÁ.
ok(jsDespues.split(VIEJO).length === 1, 'la comparación vieja sigue en el código')
ok(jsDespues.split("/^s[ií]$/i.test(String(le.lead_financia").length === 2, 'la comparación nueva falta o está duplicada')
// Y NO SE TOCÓ NINGUNA OTRA COMPARACIÓN DEL FALLBACK.
ok(jsDespues.includes("permuta = String(le.lead_entrega || '') === 'Sí'"), 'se tocó la comparación de lead_entrega y no debe')
ok(jsDespues.includes("presu = le.lead_presupuesto && le.lead_presupuesto !== 'No mencionado'"), 'se tocó lead_presupuesto y no debe')
ok(jsAntes.length + (NUEVO.length - VIEJO.length) === jsDespues.length,
  'la diferencia de largo no es exactamente la del reemplazo: se coló otro cambio')

for (const frag of ['EL PRECIO LO PONE LA BASE, NO EL MODELO (v105)', 'EL AÑO TAMBIÉN LO PONE LA BASE (v109)',
                    'SE BORRA (v109)', 'CENTINELA DE CERO FILAS (v102)', 'Guard de cierre comercial',
                    'if (_listados >= 2)']) {
  ok(jsDespues.includes(frag), `se perdió algo de Armar respuesta: ${frag}`)
}
for (const nm of ['Config', 'Leer lead (estado)', 'Franco (AI Agent)', 'Listar stock', 'Detalle auto']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

// ── PRUEBA OFFLINE sobre el bloque TB-3 ENTERO del v110 GENERADO.
// El stub de `Leer lead (estado)` usa la forma EXACTA leída del log (ejecución 13306). Para
// `Listar stock` se prueban LAS DOS formas posibles en producción —que tire, y que devuelva el
// input en vez de la salida— porque no está establecido cuál de las dos ocurre: las dos tienen que
// llevar al fallback, y con las dos el resultado tiene que ser el mismo.
{
  const desde = jsDespues.indexOf('  // TB-3: encabezado del abanico')
  const hasta = jsDespues.indexOf('  const anchor = messages.length - 1;')
  const src = jsDespues.slice(desde, hasta)
  const srcViejo = jsAntes.slice(
    jsAntes.indexOf('  // TB-3: encabezado del abanico'),
    jsAntes.indexOf('  const anchor = messages.length - 1;'))
  try {
    // Las dos formas posibles de lo que devuelve el tool en producción.
    const TOOL_TIRA = () => { throw new Error('el nodo tool no expone salida main') }
    const TOOL_DEVUELVE_INPUT = () => ({ precio_objetivo: 7000000, tiene_permuta: 1, con_financiacion: 1 })
    // Y la forma que el código ORIGINAL esperaba, para probar que ese camino sigue igual.
    const TOOL_OK = () => ({ response: [{ eco_permuta: 1, eco_financia: 1, eco_presu: 1 }] })

    const correr = (fuente, tool, lead, msgs) => {
      const $ = (n) => ({
        first: () => ({ json: n === 'Listar stock' ? tool() : lead }),
      })
      const messages = msgs.map((m) => Object.assign({}, m))
      const autos = [{ id: 1 }, { id: 2 }, { id: 3 }]
      new Function('messages', 'autos', '$', fuente)(messages, autos, $)
      return messages
    }

    // El lead REAL de la ejecución 13306, tal cual salió del log.
    const LEAD = {
      lead_entrega: 'Sí', lead_usado: 'Ford Ka 2015',
      lead_presupuesto: '$7.000.000 de anticipo', lead_financia: 'Sí',
    }
    const MSGS = [
      { type: 'text', content: 'Teniendo en cuenta tu anticipo de $7.000.000 y tu Ford Ka 2015 con 100.000 km, tenés este abanico:' },
      { type: 'text', content: '- Jeep Renegade 2021, SUV, $25.500.000\n- Toyota Corolla 2022, sedán, $24.800.000\n- Renault Duster 2023, SUV, $22.500.000' },
    ]
    const casos = []
    const chk = (nombre, cond, extra) => { casos.push(nombre); if (!cond) fallas.push(`offline · ${nombre}${extra ? ' :: ' + extra : ''}`) }

    const ESPERADO = 'Con tu usado como parte de pago, tu anticipo y la posibilidad de financiar, estas opciones te pueden servir:'

    for (const [nombre, tool] of [['tool tira', TOOL_TIRA], ['tool devuelve el input', TOOL_DEVUELVE_INPUT]]) {
      // ANTES: el bug.
      const viejo = correr(srcViejo, tool, LEAD, MSGS)[0].content
      chk(`${nombre} · v109 decía "tu efectivo" (el bug)`, viejo.includes('tu efectivo'), viejo)
      chk(`${nombre} · v109 NO decía "anticipo"`, !viejo.includes('anticipo'), viejo)
      // DESPUÉS: el fix.
      const nuevo = correr(src, tool, LEAD, MSGS)[0].content
      chk(`${nombre} · v110 dice el encabezado completo`, nuevo === ESPERADO, nuevo)
      chk(`${nombre} · v110 matchea el check del caso`, /financ|50\s?%|anticipo/i.test(nuevo), nuevo)
    }

    // Si el tool SÍ se pudiera leer, el camino de siempre queda igual.
    chk('con el tool legible, el encabezado no cambia',
      correr(src, TOOL_OK, LEAD, MSGS)[0].content === correr(srcViejo, TOOL_OK, LEAD, MSGS)[0].content)

    // Las variantes que puede escribir el CRM, todas tienen que dar lo mismo.
    for (const v of ['Sí', 'sí', 'Si', 'si', 'SI', ' Sí ']) {
      chk(`lead_financia=${JSON.stringify(v)} cuenta como que financia`,
        correr(src, TOOL_TIRA, Object.assign({}, LEAD, { lead_financia: v }), MSGS)[0].content === ESPERADO)
    }
    // Y las que NO deben contar.
    for (const v of ['No', 'No mencionado', '', 'Sin datos']) {
      const r = correr(src, TOOL_TIRA, Object.assign({}, LEAD, { lead_financia: v }), MSGS)[0].content
      chk(`lead_financia=${JSON.stringify(v)} NO cuenta como que financia`,
        r.includes('tu efectivo') && !r.includes('la posibilidad de financiar'), r)
    }

    const malas = fallas.filter((f) => f.startsWith('offline ·')).length
    console.log(`  encabezado TB-3: ${casos.length - malas}/${casos.length}`)
    console.log(`  antes: "${correr(srcViejo, TOOL_TIRA, LEAD, MSGS)[0].content}"`)
    console.log(`  ahora: "${correr(src, TOOL_TIRA, LEAD, MSGS)[0].content}"`)
  } catch (e) {
    fallas.push(`el bloque TB-3 NO COMPILA: ${e.message}`)
  }
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Armar respuesta')
console.log(`  jsCode: ${jsAntes.length} -> ${jsDespues.length} chars`)
