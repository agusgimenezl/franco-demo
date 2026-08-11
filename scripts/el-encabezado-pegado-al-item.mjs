// v113 -> v114 · EL ENCABEZADO Y EL ÍTEM EN LA MISMA LÍNEA TAMBIÉN SON UNA OFERTA
//
// EL HUECO QUE ESTABA ANOTADO EN STATE DESDE v110, AHORA CON SU CASO REAL. Franco escribió, y
// salió a producción (`mensajes_demo` 11684, sesión 4ced81c1):
//
//   Alto: - Volkswagen Polo 2021 — 25.000 km — $15.000.000 (hatchback)
//
// NO HAY NINGÚN POLO EN EL STOCK (17 autos, verificado contra `autos_disponibles` por MCP): es una
// invención, el peor error del proyecto, y el que el eval declara "fatal delante de un dueño".
// Los otros cuatro renglones de ese turno eran correctos, así que no fue un turno roto: fue ESE
// renglón, colado por el formato.
//
// LO QUE LO DEJÓ PASAR ES LO MISMO DE LOS DOS LADOS: el borrado de v109 y el check
// `no_inventa_autos` exigen la viñeta al PRINCIPIO del renglón (`/^\s*(?:[-•*]|\d+[.)])\s+\S/`), y
// acá la viñeta viene detrás del encabezado de bloque. Verificado antes de tocar nada, sobre el
// texto real: v109 borra CERO renglones y el check devuelve null. El MISMO texto con la viñeta en
// su propia línea lo cazan los dos. Por eso se arregla en los dos a la vez: arreglar uno solo deja
// el formato pasando entero.
//
// CUÁNTO PASA, MEDIDO Y NO ESTIMADO — sobre las 5.992 respuestas de `mensajes_demo`, de las que
// 2.306 traen algún renglón con precio y año:
//   · 8.157 renglones de oferta que el check SÍ ve (1.454 turnos);
//   · 1.171 que no ve y hace bien: es prosa ("La Ford Ranger 2024 es la pickup más nueva…");
//   ·     3 con esta forma — encabezado + viñeta — en 1 turno: el 11684, el del Polo;
//   ·     3 con OTRA forma que tampoco ve nadie (queda abierta, ver abajo).
// O sea: raro, pero cuando pasa se cuela justo lo que el proyecto más cuida.
//
// EL CAMBIO — UN NODO, UN PATRÓN COMPARTIDO. `_esOferta` y `_esItem` pasan a usar `_ITEM`, que
// acepta un encabezado corto pegado adelante. Lo que decide si el renglón se borra NO SE TOCA:
// sigue siendo "no nombra ningún auto del catálogo", así que un renglón que mezcle un auto real y
// uno inventado se sigue respetando entero (y el usado del propio cliente, también).
//
// LO QUE NO TOCA, A PROPÓSITO Y CON ASSERT QUE LO FIJA:
//   · El contador `_listados` de v111/v113 usa el MISMO patrón viejo y SE DEJA COMO ESTÁ. Ampliarlo
//     haría disparar el guion de v113 en turnos donde hoy no dispara, que es justo el riesgo
//     residual que STATE le anotó a v113. Un cambio por vez: queda anotado, no arreglado.
//   · La OTRA forma que nadie ve: "Intermedio: Renault Duster 2023, SUV mediana, 31.000 km,
//     $22.500.000; Chevrolet Onix 2024, …" — encabezado y autos encadenados con punto y coma, sin
//     una sola viñeta (`mensajes_demo` 7914). En ESE turno los 8 autos eran reales y los precios
//     correctos, así que no hay daño medido; se deja anotada con su evidencia. Cubrirla exige
//     razonar por auto y no por renglón, que es otro diseño, no un regex más ancho.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v113.json'
const DESTINO = 'workflows/franco-n8n-v114.json'
const EVAL = 'evals/run.mjs'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ar = wf.nodes.find((n) => n.name === 'Armar respuesta')
const jsAntes = ar.parameters.jsCode

// El patrón viejo (viñeta al principio) y el nuevo (encabezado corto opcional adelante).
const RE_VIEJO = String.raw`/^\s*(?:[-•*]|\d+[.)])\s+\S/`
const RE_NUEVO = String.raw`/^\s*(?:[^\n:]{1,25}:\s*)?(?:[-•*]|\d+[.)])\s+\S/`

const VIEJO = `      const _esOferta = (l) =>
        ${RE_VIEJO}.test(l) &&
        /\\$\\s?\\d{1,3}(?:\\.\\d{3})+/.test(l) &&
        /\\b(?:19|20)\\d{2}\\b/.test(l);
      const _esEncabezado = (l) => /^\\s*[^\\n:]{1,25}:\\s*$/.test(l);
      const _esItem = (l) => ${RE_VIEJO}.test(l);`

const NUEVO = `      // EL ENCABEZADO PEGADO AL ÍTEM TAMBIÉN ES UN RENGLÓN DE OFERTA (v114). MEDIDO, no supuesto:
      // "Alto: - Volkswagen Polo 2021 — 25.000 km — $15.000.000 (hatchback)" salió a producción
      // (mensajes_demo 11684) y NO HAY NINGÚN POLO EN EL STOCK. El borrado de acá abajo no lo veía
      // porque exigía la viñeta al PRINCIPIO del renglón, y el check \`no_inventa_autos\` del eval
      // tenía EL MISMO hueco: ese formato pasaba por los dos lados. Se arregla en los dos a la vez.
      // El patrón es el MISMO TEXTO que \`ES_ITEM\` en evals/run.mjs y hay un assert que lo fija:
      // si divergen, el formato vuelve a pasar entero por algún lado.
      const _ITEM = ${RE_NUEVO};
      const _esOferta = (l) =>
        _ITEM.test(l) &&
        /\\$\\s?\\d{1,3}(?:\\.\\d{3})+/.test(l) &&
        /\\b(?:19|20)\\d{2}\\b/.test(l);
      const _esEncabezado = (l) => /^\\s*[^\\n:]{1,25}:\\s*$/.test(l);
      const _esItem = (l) => _ITEM.test(l);`

ok(jsAntes.split(VIEJO).length === 2, 'no encontré (una sola vez) las definiciones de _esOferta/_esItem de v109')

ar.parameters.jsCode = jsAntes.replace(VIEJO, () => NUEVO)
const jsDespues = ar.parameters.jsCode

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Armar respuesta']),
  `esperaba SÓLO Armar respuesta; hay: ${JSON.stringify(distintos)}`)
ok(jsDespues.split(VIEJO).length === 1, 'las definiciones viejas siguen en el código')
ok(jsDespues.length - jsAntes.length === NUEVO.length - VIEJO.length, 'cambió algo más que el reemplazo')

// EL PATRÓN VIEJO SIGUE EXACTAMENTE UNA VEZ, Y ES A PROPÓSITO: el contador `_listados` de
// v111/v113. Ampliarlo haría disparar el guion de v113 en turnos donde hoy no dispara.
ok(jsAntes.split(RE_VIEJO).length === 4, `esperaba 3 usos del patrón viejo en v113, hay ${jsAntes.split(RE_VIEJO).length - 1}`)
ok(jsDespues.split(RE_VIEJO).length === 2, `el patrón viejo tiene que quedar SÓLO en _listados; quedan ${jsDespues.split(RE_VIEJO).length - 1}`)
ok(jsDespues.slice(jsDespues.indexOf(RE_VIEJO)).includes('_listados'), 'el uso que queda del patrón viejo no es el de _listados')
// `(?<![A-Z])` para no contar el `ES_ITEM` que el comentario nombra del otro lado.
ok((jsDespues.match(/(?<![A-Z])_ITEM\b/g) || []).length === 3,
  `_ITEM tiene que aparecer 3 veces (declarar y dos usos), aparece ${(jsDespues.match(/(?<![A-Z])_ITEM\b/g) || []).length}`)

// LOS DOS LADOS, EL MISMO TEXTO. Es el assert que impide que vuelvan a divergir.
const evalSrc = fs.readFileSync(EVAL, 'utf8')
ok(evalSrc.includes(`const ES_ITEM = ${RE_NUEVO}`), `${EVAL} no tiene el patrón nuevo — el fix no sirve de a uno`)
ok(evalSrc.split(RE_VIEJO).length === 1, `${EVAL} todavía tiene el patrón viejo copiado en algún check`)
ok(evalSrc.split('esItem').length === 5, `${EVAL} tiene que usar el helper en los 3 checks (declaración + const + 3 usos)`)

for (const frag of ['EL PRECIO LO PONE LA BASE, NO EL MODELO (v105)', 'EL AÑO TAMBIÉN LO PONE LA BASE (v109)',
                    'SE BORRA (v109)', 'LAS CARDS SE RECUPERAN DEL TEXTO (v112)', 'Guard de cierre comercial',
                    '_noEraDeMostrar', 'CENTINELA DE CERO FILAS (v102)']) {
  ok(jsDespues.includes(frag), `se perdió algo de Armar respuesta: ${frag}`)
}
try { new Function(jsDespues) } catch (e) { fallas.push(`el NODO ENTERO no compila: ${e.message}`) }

// ── PRUEBA OFFLINE sobre el turno REAL 11684, contra los dos códigos ────────
{
  const DESDE = '  // EL RENGLÓN QUE OFRECE UN AUTO QUE NO EXISTE SE BORRA (v109).'
  const HASTA = '  // EL TEXTO TAMBIÉN, NO SÓLO LAS CARDS (v107).'
  const bloque = (js) => js.slice(js.indexOf(DESDE), js.indexOf(HASTA))
  const srcViejo = bloque(jsAntes)
  const srcNuevo = bloque(jsDespues)
  ok(srcViejo.includes('_esOferta') && srcNuevo.includes('_ITEM'), 'no extraje el bloque de v109')

  // Los 17 del stock, como los entrega `catalogo_precios` de `Leer lead (estado)`.
  const CAT = [
    { t: 'Ford Fiesta', a: 2017, p: 8200000 }, { t: 'Volkswagen Gol Trend', a: 2018, p: 9200000 },
    { t: 'Toyota Etios', a: 2019, p: 12500000 }, { t: 'Fiat Cronos', a: 2023, p: 16800000 },
    { t: 'Renault Kangoo', a: 2021, p: 18500000 }, { t: 'Ford EcoSport', a: 2020, p: 19800000 },
    { t: 'Peugeot 208', a: 2025, p: 21000000 }, { t: 'Chevrolet Onix', a: 2024, p: 21500000 },
    { t: 'Renault Duster', a: 2023, p: 22500000 }, { t: 'Toyota Corolla', a: 2022, p: 24800000 },
    { t: 'Jeep Renegade', a: 2021, p: 25500000 }, { t: 'Volkswagen Vento', a: 2023, p: 31000000 },
    { t: 'Volkswagen Amarok', a: 2018, p: 32000000 }, { t: 'Volkswagen T-Cross', a: 2025, p: 34000000 },
    { t: 'Toyota Hilux', a: 2021, p: 38000000 }, { t: 'Chevrolet S10', a: 2022, p: 39500000 },
    { t: 'Ford Ranger', a: 2024, p: 57000000 },
  ]
  const correr = (src, messages, lead = {}) => {
    const $ = () => ({ first: () => ({ json: Object.assign({ catalogo_precios: CAT }, lead) }) })
    const f = new Function('messages', '$', src + '\nreturn messages;')
    return f(messages.map((m) => Object.assign({}, m)), $).map((m) => m.content).join('\n')
  }

  const casos = []
  const chk = (n, c, extra) => { casos.push(n); if (!c) fallas.push(`offline · ${n}${extra ? ' :: ' + extra : ''}`) }

  // EL TURNO REAL 11684, sus 5 burbujas tal como salieron, con su lead real (usado: Ford Ka 2015).
  const T = [
    { type: 'text', content: 'Teniendo en cuenta tu anticipo y tu Ford Ka 2015 con 250.000 km como parte de pago, y la financiación de hasta el 50%, tenés este abanico de opciones para financiar:' },
    { type: 'text', content: 'Entrada: - Volkswagen Gol Trend 2018 — 30.000 km — $9.200.000 (hatchback)' },
    { type: 'text', content: 'Intermedio: - Toyota Etios 2019 — 40.000 km — $12.500.000 (hatchback)\n- Chevrolet Onix 2024 — 35.000 km — $21.500.000 (hatchback)' },
    { type: 'text', content: 'Alto: - Volkswagen Polo 2021 — 25.000 km — $15.000.000 (hatchback)\n- Fiat Cronos 2023 — 10.000 km — $16.800.000 (sedán)' },
    { type: 'text', content: 'Cuál de estas opciones te interesa que te cuente más detalles o te pase contacto con un asesor?' },
  ]
  const LEAD = { lead_usado: 'Ford Ka 2015' }

  // (1) EL BUG, sobre el código DESPLEGADO: el Polo sobrevive y no se borra ni un renglón.
  const viejo = correr(srcViejo, T, LEAD)
  chk('v113 (hoy) · el Polo inventado SOBREVIVE — el bug', /Polo 2021/.test(viejo))
  chk('v113 (hoy) · no borra ni un renglón', viejo.split('\n').length === T.map((m) => m.content).join('\n').split('\n').length)

  // (2) EL FIX: se va el Polo y NADA MÁS.
  const nuevo = correr(srcNuevo, T, LEAD)
  chk('v114 · el renglón del Polo se fue', !/Polo/.test(nuevo), nuevo)
  for (const real of ['Gol Trend 2018 — 30.000 km — $9.200.000', 'Toyota Etios 2019', 'Chevrolet Onix 2024', 'Fiat Cronos 2023']) {
    chk(`v114 · sigue el renglón real "${real.slice(0, 22)}"`, nuevo.includes(real), nuevo)
  }
  chk('v114 · la primera burbuja intacta', nuevo.includes('tenés este abanico de opciones para financiar:'))
  chk('v114 · la pregunta de cierre intacta', nuevo.includes('te pase contacto con un asesor?'))
  chk('v114 · el encabezado "Intermedio:" no se lleva puesto nada', nuevo.includes('Intermedio: - Toyota Etios 2019'))

  // (3) LO QUE v109 YA HACÍA SIGUE IGUAL: el caso medido de 13306, con la viñeta al principio.
  const CRUZE = [{ type: 'text', content: 'tenés este abanico estimado de opciones:\n- Chevrolet Cruze 2019 — 60.000 km — $22.500.000\n- Toyota Corolla 2022 — 35.000 km — $24.800.000' }]
  chk('v114 · el Cruze de siempre se sigue borrando', !/Cruze/.test(correr(srcNuevo, CRUZE)))
  chk('v114 · el Corolla real se queda', /Corolla 2022/.test(correr(srcNuevo, CRUZE)))

  // (4) NO SE PASA DE LARGO. Un renglón con encabezado y un auto REAL no se toca.
  const REAL = [{ type: 'text', content: 'Entrada: - Toyota Etios 2019 — 40.000 km — $12.500.000' }]
  chk('v114 · encabezado + auto REAL: no se toca', correr(srcNuevo, REAL) === REAL[0].content)

  // (5) EL USADO DEL PROPIO CLIENTE se respeta aunque venga con encabezado: es su auto.
  const USADO = [{ type: 'text', content: 'Tu usado: - Ford Ka 2015 — 250.000 km — $3.000.000 estimado' }]
  chk('v114 · el usado del cliente se respeta', correr(srcNuevo, USADO, LEAD) === USADO[0].content)

  // (6) PROSA con dos puntos, precio y año: no es un renglón de lista y no se toca.
  const PROSA = [{ type: 'text', content: 'Te cuento: la Ford Ranger 2024 sale $57.000.000 y es la más nueva que tenemos.' }]
  chk('v114 · la prosa con dos puntos no se toca', correr(srcNuevo, PROSA) === PROSA[0].content)

  // (7) LA FORMA QUE QUEDA ABIERTA (mensajes_demo 7914): ni v113 ni v114 la tocan. Se deja
  // documentada con su evidencia, no arreglada de prepo.
  const B = [{ type: 'text', content: 'Intermedio: Renault Duster 2023, SUV mediana, 31.000 km, $22.500.000; Chevrolet Onix 2024, sedán mediano, 12.000 km, $21.500.000.' }]
  chk('7914 · la forma sin viñetas sigue abierta en los dos', correr(srcViejo, B) === B[0].content && correr(srcNuevo, B) === B[0].content)

  // ── Y EL OTRO LADO: el check `no_inventa_autos`, con el patrón leído de evals/run.mjs ──
  const PRECIOS = Object.fromEntries(CAT.map((a) => [a.t, a.p]))
  const check = (re) => (texto) => {
    const malas = []
    for (const linea of texto.split('\n').filter((l) => re.test(l) && /\$\s?\d{1,3}(?:\.\d{3})+/.test(l))) {
      const modelos = Object.keys(PRECIOS).filter((m) => linea.toLowerCase().includes(m.toLowerCase()))
      if (modelos.length === 0) { malas.push(`${linea.trim().slice(0, 40)} → no es del catálogo`); continue }
      const precios = [...linea.matchAll(/\$\s?(\d{1,3}(?:\.\d{3})+)/g)].map((m) => Number(m[1].replace(/\./g, '')))
      if (precios.length && !precios.some((p) => modelos.some((m) => PRECIOS[m] === p))) malas.push(`${linea.trim().slice(0, 40)} → precio inventado`)
    }
    return malas.length === 0 ? null : malas.join(' | ')
  }
  const TXT = T.map((m) => m.content).join('\n')
  const RE_EVAL_VIEJO = new RegExp(RE_VIEJO.slice(1, -1))
  const RE_EVAL_NUEVO = new RegExp(RE_NUEVO.slice(1, -1))
  chk('eval (hoy) · el check NO VE el Polo — el hueco', check(RE_EVAL_VIEJO)(TXT) === null)
  chk('eval (v114) · el check caza el Polo', /Polo/.test(check(RE_EVAL_NUEVO)(TXT) || ''), String(check(RE_EVAL_NUEVO)(TXT)))
  chk('eval (v114) · no da rojo por los renglones reales', (check(RE_EVAL_NUEVO)(TXT) || '').split('|').length === 1)
  chk('eval (v114) · un turno entero correcto sigue en verde',
    check(RE_EVAL_NUEVO)('Entrada: - Toyota Etios 2019 — $12.500.000\n- Fiat Cronos 2023 — $16.800.000') === null)

  const malas = fallas.filter((f) => f.startsWith('offline ·')).length
  console.log(`  encabezado pegado al ítem: ${casos.length - malas}/${casos.length}`)
  console.log(`  11684 con v113: ${/Polo/.test(viejo) ? 'el Polo sale al cliente' : '-'}`)
  console.log(`  11684 con v114: ${/Polo/.test(nuevo) ? 'el Polo sale al cliente' : 'el Polo no sale; los 4 renglones reales quedan'}`)
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
