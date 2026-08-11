// v108 -> v109 · EL AÑO LO PONE LA BASE, Y EL RENGLÓN QUE OFRECE UN AUTO QUE NO EXISTE SE BORRA
//
// POR QUÉ ESTE CAMBIO Y NO OTRO — LA REGLA QUE SALIÓ DE LOS TRES ANTERIORES: se construye SÓLO
// sobre mecanismos VERIFICADOS DISPARANDO EN PRODUCCIÓN. En este nodo hay exactamente uno: el
// corrector de precios de v105, que lee `catalogo_precios` de `Leer lead (estado)` (main chain).
// Prueba vinculante, ejecución 13583, comparando el output de `Franco (AI Agent)` con el de
// `Armar respuesta` del MISMO turno: Etios $10.800.000 -> $12.500.000, Duster $15.000.000 ->
// $22.500.000, Renegade $24.500.000 -> $25.500.000, Amarok $32.900.000 -> $32.000.000.
// Los DOS bloques de este nodo que leen la salida del TOOL (`$('Listar stock').first().json`) NO
// funcionan: el centinela de v102 y el bloque de v107. Probado en 13583 —centinela devuelto por la
// tool, ids reales de memoria, y salieron las 6 product_cards igual— y en 13522, donde el fallback
// de TB-3 corrió aunque la tool había devuelto filas con eco_financia=1. Ese camino queda para otro
// cambio, con verificación contra una ejecución real ANTES de escribir código.
//
// EL BUG QUE SE ATACA, TODO MEDIDO HOY (ventanas 18:43–19:07):
//   AUTOS QUE NO EXISTEN: "Chevrolet Cruze 2019 — $22.500.000", "Renault Sandero 2020/2021/2022",
//   "Nissan Kicks 2019", "Volkswagen Tiguan 2018", "Nissan Versa 2022".
//   AÑOS INVENTADOS sobre autos que SÍ existen: "Gol Trend 2022" (2018), "Renault Duster 2018"
//   (2023), "Jeep Renegade 2019" (2021), "Toyota Etios 2018" (2019).
// Es el peor error posible en una demo: el auto y el año son lo que el cliente se lleva anotado.
// `no_inventa_autos` viene rojo en varios casos y esa es la baseline.
//
// EL CAMBIO — UN NODO (`Armar respuesta`), DOS BLOQUES NUEVOS, los dos hermanos del de v105 y con
// su MISMA fuente de datos. El bloque de v105 NO SE TOCA (hay un assert que lo verifica).
//   (A) EL AÑO: en cada renglón que nombra un auto del catálogo, el primer año que aparece justo
//       después del nombre se reemplaza por el de la base. Acotado a 12 caracteres después del
//       nombre para no pisar un número que esté más adelante en el renglón (los km, el precio).
//   (B) EL AUTO QUE NO EXISTE: un renglón de LISTA que trae PRECIO **y** AÑO es una OFERTA. Si no
//       nombra ningún auto del catálogo, ese auto no existe y el renglón se borra.
//       LAS TRES CONDICIONES JUNTAS SON LO QUE LO HACE SEGURO: "- Sellos, $208.000" no tiene año y
//       no se toca; "el Etios que viste" no es renglón de lista y no se toca.
//       El usado del PROPIO CLIENTE se respeta aunque no esté en el stock (es su auto, no una
//       invención): sale de `lead_usado`, misma fila que ya se lee.
//       Y si el borrado dejara la respuesta VACÍA, no se aplica: mejor el texto de siempre que una
//       burbuja en blanco.
//   Los encabezados de bloque que quedan sin ningún renglón abajo ("Alto:" y nada) también se van.
//
// POR QUÉ BORRAR Y NO CORREGIR, que es al revés que v105: con el precio hay con qué corregir —el
// auto existe—. Acá el auto no existe: no hay número que poner. Es la distinción que ya estaba
// anotada como pendiente 2.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v108.json'
const DESTINO = 'workflows/franco-n8n-v109.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ar = wf.nodes.find((n) => n.name === 'Armar respuesta')
const jsAntes = ar.parameters.jsCode

const ANCLA = '  // EL TEXTO TAMBIÉN, NO SÓLO LAS CARDS (v107).'
ok(jsAntes.split(ANCLA).length === 2, 'no encontré (una sola vez) el bloque de v107 como ancla')

const ESC = "(s) => String(s).replace(/[.*+?^\\${}()|[\\]\\\\]/g, '\\\\$&')"

const BLOQUES = `  // EL AÑO TAMBIÉN LO PONE LA BASE (v109). Hermano del corrector de precios de v105, con la MISMA
  // fuente (\`catalogo_precios\` de \`Leer lead (estado)\`, main chain) — el único mecanismo de este
  // nodo verificado disparando en producción (ejecución 13583: corrigió cuatro precios).
  // MEDIDO HOY: "Volkswagen Gol Trend 2022" (es 2018), "Renault Duster 2018" (es 2023),
  // "Jeep Renegade 2019" (es 2021), "Toyota Etios 2018" (es 2019).
  // Acotado a los 12 caracteres que siguen al nombre del auto, y sin dígitos en el medio, para no
  // pisar un número más adelante del renglón (los km, el precio).
  try {
    const _cat = $('Leer lead (estado)').first().json.catalogo_precios || [];
    if (Array.isArray(_cat) && _cat.length) {
      const _esc = ${ESC};
      messages = messages.map(m => {
        let c = String((m && m.content) || '');
        for (const a of _cat) {
          if (!a || !a.t || !a.a) continue;
          const re = new RegExp('([^\\\\n]*\\\\b' + _esc(a.t) + '\\\\b[^0-9\\\\n]{0,12})\\\\b(?:19|20)\\\\d{2}\\\\b', 'gi');
          c = c.replace(re, (todo, previo) => previo + String(a.a));
        }
        return Object.assign({}, m, { content: c });
      });
    }
  } catch (e) {}

  // EL RENGLÓN QUE OFRECE UN AUTO QUE NO EXISTE SE BORRA (v109). Distinto del precio de v105: ahí
  // el auto existe y hay con qué corregir; acá no existe y no hay número que poner.
  // MEDIDO HOY: "Chevrolet Cruze 2019 — $22.500.000", "Renault Sandero 2020/2021/2022",
  // "Nissan Kicks 2019", "Volkswagen Tiguan 2018", "Nissan Versa 2022".
  // UNA OFERTA SON LAS TRES COSAS JUNTAS: renglón de lista + precio + año. Con las tres, un
  // "- Sellos, $208.000" (sin año) y un "el Etios que viste" (sin viñeta) quedan afuera solos.
  // El usado del PROPIO cliente se respeta: es su auto, no una invención.
  try {
    const _le = $('Leer lead (estado)').first().json;
    const _cat = _le.catalogo_precios || [];
    if (Array.isArray(_cat) && _cat.length) {
      const _nombres = [];
      for (const a of _cat) {
        if (!a || !a.t) continue;
        _nombres.push(String(a.t).toLowerCase());
        // "Volkswagen Gol Trend" -> "gol trend". El modelo suelto sólo cuenta si tiene letras:
        // "208" a secas matchearía adentro de cualquier monto, así que ese va sólo con la marca.
        const _mod = String(a.t).split(' ').slice(1).join(' ');
        if (/[a-z]/i.test(_mod)) _nombres.push(_mod.toLowerCase());
      }
      const _usado = String(_le.lead_usado || '').toLowerCase();
      const _esOferta = (l) =>
        /^\\s*(?:[-•*]|\\d+[.)])\\s+\\S/.test(l) &&
        /\\$\\s?\\d{1,3}(?:\\.\\d{3})+/.test(l) &&
        /\\b(?:19|20)\\d{2}\\b/.test(l);
      const _esEncabezado = (l) => /^\\s*[^\\n:]{1,25}:\\s*$/.test(l);
      const _esItem = (l) => /^\\s*(?:[-•*]|\\d+[.)])\\s+\\S/.test(l);
      const nuevos = messages.map(m => {
        const c = String((m && m.content) || '');
        if (!c) return m;
        const lineas = c.split('\\n');
        const quedan = lineas.filter(l => {
          if (!_esOferta(l)) return true;
          const low = l.toLowerCase();
          if (_nombres.some(n => low.includes(n))) return true;
          if (_usado.length > 3 && low.includes(_usado)) return true;
          return false;
        });
        if (quedan.length === lineas.length) return m;
        // Encabezados de bloque que quedaron sin ningún renglón abajo ("Alto:" y nada más).
        const limpio = quedan.filter((l, i) => {
          if (!_esEncabezado(l)) return true;
          for (let k = i + 1; k < quedan.length; k++) {
            if (/^\\s*$/.test(quedan[k])) continue;
            return _esItem(quedan[k]);
          }
          return false;
        });
        return Object.assign({}, m, { content: limpio.join('\\n').replace(/\\n{3,}/g, '\\n\\n').trim() });
      }).filter(m => String((m && m.content) || '').trim());
      // Si borrar dejara la respuesta vacía, no se aplica: mejor el texto de siempre que una
      // burbuja en blanco.
      if (nuevos.length) messages = nuevos;
    }
  } catch (e) {}

`

ar.parameters.jsCode = jsAntes.replace(ANCLA, () => BLOQUES + ANCLA)
const jsDespues = ar.parameters.jsCode

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Armar respuesta']),
  `esperaba SÓLO Armar respuesta; hay: ${JSON.stringify(distintos)}`)

ok(jsDespues.split('EL AÑO TAMBIÉN LO PONE LA BASE (v109)').length === 2, 'el bloque del año falta o está duplicado')
ok(jsDespues.split('EL RENGLÓN QUE OFRECE UN AUTO QUE NO EXISTE SE BORRA (v109)').length === 2, 'el bloque del borrado falta o está duplicado')
ok(jsDespues.indexOf('EL AÑO TAMBIÉN LO PONE LA BASE') > jsDespues.indexOf('EL PRECIO LO PONE LA BASE'),
  'el bloque del año tiene que ir DESPUÉS del corrector de precios de v105')
ok(jsDespues.indexOf('SE BORRA (v109)') < jsDespues.indexOf('EL TEXTO TAMBIÉN, NO SÓLO LAS CARDS'),
  'los bloques nuevos van ANTES del de v107')

// EL BLOQUE DE v105 NO SE TOCA: es el único mecanismo verificado y no se arriesga.
{
  const corte = (js) => {
    const i = js.indexOf('  // EL PRECIO LO PONE LA BASE')
    return js.slice(i, js.indexOf('} catch (e) {}', i) + 14)
  }
  ok(corte(jsAntes) === corte(jsDespues), 'se tocó el corrector de precios de v105 y no debe')
}
for (const frag of ['Guard de cierre comercial', 'cardsMostradas', 'yaMostrados', 'fotosDe',
                    'CENTINELA DE CERO FILAS (v102)', 'TB-3: encabezado del abanico',
                    'if (_listados >= 2)']) {
  ok(jsDespues.includes(frag), `se perdió algo de Armar respuesta: ${frag}`)
}
for (const nm of ['Config', 'Leer lead (estado)', 'Franco (AI Agent)', 'Listar stock', 'Detalle auto']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

// ── PRUEBA OFFLINE, sobre los TEXTOS REALES capturados hoy del log.
// El stub de `$` reproduce la forma EXACTA que `Leer lead (estado)` devolvió en la ejecución 13583
// (leída del log, no inventada): por ahí pasa el mecanismo que ya sabemos que funciona.
const CAT = [
  { a: 2018, p: 9200000, t: 'Volkswagen Gol Trend' }, { a: 2025, p: 34000000, t: 'Volkswagen T-Cross' },
  { a: 2018, p: 32000000, t: 'Volkswagen Amarok' }, { a: 2023, p: 31000000, t: 'Volkswagen Vento' },
  { a: 2022, p: 24800000, t: 'Toyota Corolla' }, { a: 2024, p: 21500000, t: 'Chevrolet Onix' },
  { a: 2023, p: 22500000, t: 'Renault Duster' }, { a: 2021, p: 18500000, t: 'Renault Kangoo' },
  { a: 2022, p: 39500000, t: 'Chevrolet S10' }, { a: 2020, p: 19800000, t: 'Ford EcoSport' },
  { a: 2021, p: 25500000, t: 'Jeep Renegade' }, { a: 2021, p: 38000000, t: 'Toyota Hilux' },
  { a: 2019, p: 12500000, t: 'Toyota Etios' }, { a: 2024, p: 57000000, t: 'Ford Ranger' },
  { a: 2025, p: 21000000, t: 'Peugeot 208' }, { a: 2017, p: 8200000, t: 'Ford Fiesta' },
  { a: 2023, p: 16800000, t: 'Fiat Cronos' },
]

{
  const desde = jsDespues.indexOf('  // EL AÑO TAMBIÉN LO PONE LA BASE (v109)')
  const hasta = jsDespues.indexOf(ANCLA)
  const src = jsDespues.slice(desde, hasta)
  try {
    const correr = (messages, lead) => {
      const $ = () => ({ first: () => ({ json: Object.assign({ catalogo_precios: CAT }, lead) }) })
      const f = new Function('messages', '$', src + '\nreturn messages;')
      return f(messages.map((m) => Object.assign({}, m)), $)
    }
    const LEAD = { lead_usado: 'Ford Ka 2015' }
    const casos = []
    const chk = (nombre, cond, extra) => { casos.push(nombre); if (!cond) fallas.push(`offline · ${nombre}${extra ? ' :: ' + extra : ''}`) }

    // ── (1) EL TEXTO REAL DE 13583 (Armar respuesta, con los precios ya corregidos por v105).
    const REAL_13583 = [{ type: 'text', content: 'Teniendo en cuenta tu anticipo, el valor estimado de tu usado y la financiación hasta el 50%, te puedo mostrar un abanico de opciones en tres niveles de entrada:\n\nEntrada:\n- Volkswagen Gol Trend 2022, hatchback — 30.000 km — $9.200.000\n- Toyota Etios 2019, hatchback — 36.000 km — $12.500.000\n\nIntermedio:\n- Renault Duster 2018, SUV — 46.000 km — $22.500.000\n- Fiat Cronos 2022, sedán — 15.000 km — $16.800.000\n\nAlto:\n- Jeep Renegade 2019, SUV — 38.000 km — $25.500.000\n- Volkswagen Amarok 2018, pickup — 71.000 km — $32.000.000\n\nEstas opciones mezclan diferentes carrocerías y precios según tu capacidad.' }]
    const r1 = correr(REAL_13583, LEAD)[0].content
    chk('13583 · Gol Trend 2022 -> 2018', r1.includes('Volkswagen Gol Trend 2018'), r1.match(/Gol Trend \d{4}/))
    chk('13583 · Duster 2018 -> 2023', r1.includes('Renault Duster 2023'), r1.match(/Duster \d{4}/))
    chk('13583 · Cronos 2022 -> 2023', r1.includes('Fiat Cronos 2023'), r1.match(/Cronos \d{4}/))
    chk('13583 · Renegade 2019 -> 2021', r1.includes('Jeep Renegade 2021'), r1.match(/Renegade \d{4}/))
    chk('13583 · Etios 2019 se deja como está', r1.includes('Toyota Etios 2019'))
    chk('13583 · Amarok 2018 se deja como está', r1.includes('Volkswagen Amarok 2018'))
    chk('13583 · los km NO se tocan', r1.includes('30.000 km') && r1.includes('71.000 km'))
    chk('13583 · los precios NO se tocan', r1.includes('$9.200.000') && r1.includes('$32.000.000'))
    chk('13583 · no se borró ningún renglón (todos existen)', (r1.match(/\n- /g) || []).length === 6)

    // ── (2) EL TEXTO REAL DE 13306: trae un auto que NO EXISTE (Chevrolet Cruze).
    const REAL_13306 = [
      { type: 'text', content: 'Teniendo en cuenta tu anticipo de $7.000.000, el Ford Ka 2015 que entregás y la posibilidad de financiar hasta el 50%, tenés este abanico estimado de opciones:' },
      { type: 'text', content: 'Entrada:\n- Volkswagen Gol Trend 2022, hatchback, mismo porte que tu auto, $9.200.000\n- Toyota Etios 2018, sedán, cuatro años más nuevo, $12.500.000\n\nIntermedio:\n- Ford Ecosport 2020, SUV, consumo 6,3 L/100km, $19.800.000\n- Chevrolet Cruze 2019, sedán, consumo 6,4 L/100km, $22.500.000\n\nAlto:\n- Jeep Renegade 2019, SUV, consumo 7,5 L/100km, $25.500.000\n- Toyota Corolla 2019, sedán, consumo 6,8 L/100km, $24.800.000' },
    ]
    const r2 = correr(REAL_13306, LEAD)
    const t2 = r2.map((m) => m.content).join('\n')
    chk('13306 · el Cruze (no existe) se borró', !/cruze/i.test(t2), t2)
    chk('13306 · quedan los otros 5 renglones', (t2.match(/\n- /g) || []).length === 5)
    chk('13306 · el encabezado "Intermedio:" sobrevive (le queda la EcoSport)', /Intermedio:/.test(t2))
    chk('13306 · Etios 2018 -> 2019', /Toyota Etios 2019/.test(t2))
    chk('13306 · Corolla 2019 -> 2022', /Toyota Corolla 2022/.test(t2))
    chk('13306 · el Ford Ka 2015 del cliente NO se toca', /Ford Ka 2015/.test(t2))

    // ── (3) DOS INVENTADOS SEGUIDOS: el encabezado del bloque se va con ellos.
    const DOS = [{ type: 'text', content: 'Opciones:\n\nEntrada:\n- Toyota Etios 2019, hatchback, $12.500.000\n\nIntermedio:\n- Renault Sandero 2022, hatchback, $12.000.000\n- Nissan Kicks 2019, SUV, $18.350.000' }]
    const r3 = correr(DOS, LEAD)[0].content
    chk('dos inventados seguidos se borran', !/sandero|kicks/i.test(r3), r3)
    chk('el encabezado "Intermedio:" huérfano se va', !/Intermedio:/.test(r3), r3)
    chk('el encabezado "Entrada:" sobrevive', /Entrada:/.test(r3))

    // ── (4) LO QUE NO SE DEBE TOCAR.
    const GASTOS = [{ type: 'text', content: 'Los gastos aproximados:\n- Sellos, $208.000\n- Gestoría, $150.000' }]
    chk('una lista de gastos (sin año) queda intacta',
      correr(GASTOS, LEAD)[0].content === GASTOS[0].content, correr(GASTOS, LEAD)[0].content)
    const PROSA = [{ type: 'text', content: 'El Etios que viste y una Chevrolet Cruze 2019 que me preguntaste, te cuento por privado.' }]
    chk('una mención en prosa no se borra', /Cruze/.test(correr(PROSA, LEAD)[0].content))
    const SINCAT = (() => {
      const $ = () => ({ first: () => ({ json: { catalogo_precios: [] } }) })
      return new Function('messages', '$', src + '\nreturn messages;')(REAL_13306.map((m) => Object.assign({}, m)), $)
    })()
    chk('sin catálogo no se toca nada', JSON.stringify(SINCAT) === JSON.stringify(REAL_13306))

    // ── (5) EL BORRADO NUNCA DEJA LA RESPUESTA VACÍA.
    const TODO_FALSO = [{ type: 'text', content: '- Renault Sandero 2022, hatchback, $12.000.000\n- Nissan Kicks 2019, SUV, $18.350.000' }]
    const r5 = correr(TODO_FALSO, LEAD)
    chk('si borrar dejaría todo vacío, no se aplica', r5.length >= 1 && String(r5[0].content).trim().length > 0,
      JSON.stringify(r5))

    // ── (6) EL AÑO NO SE PISA CON UN NÚMERO POSTERIOR DEL RENGLÓN.
    const LEJOS = [{ type: 'text', content: '- Toyota Corolla 2019 con service hecho en 2024, 35.000 km, $24.800.000' }]
    const r6 = correr(LEJOS, LEAD)[0].content
    chk('corrige el año del auto', /Toyota Corolla 2022/.test(r6), r6)
    chk('no toca el "2024" del service', /en 2024/.test(r6), r6)

    const malas = fallas.filter((f) => f.startsWith('offline ·')).length
    console.log(`  año + borrado, sobre los textos REALES del log: ${casos.length - malas}/${casos.length}`)
    console.log('  13306 después del cambio:\n    ' + r2.map((m) => m.content).join('\n').split('\n').join('\n    '))
  } catch (e) {
    fallas.push(`los bloques nuevos NO COMPILAN: ${e.message}`)
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
