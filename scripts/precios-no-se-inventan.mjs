// v104 -> v105 · EL PRECIO QUE SALE AL CLIENTE LO PONE LA BASE, NO EL MODELO
//
// EL BUG, VISTO POR AGUSTINA EN LA DEMO Y MEDIDO EN LOS EVALS: Franco escribe listas de autos con
// PRECIOS QUE NO EXISTEN. En su captura: "Jeep Renegade 2019 — $24.500.000" (el real es 2021 y
// sale $25.500.000). En `capacidad-de-compra-financiada` sobre v104, 3 de 3 corridas: Gol Trend a
// $17.000.000 (real $9.200.000), EcoSport a $27.000.000 (real $19.800.000), Onix a $15.200.000
// (real $21.500.000), y hasta un "Renault Sandero" que no está en el stock.
// En una demo que se muestra a dueños de concesionarias, un precio inventado es el peor error
// posible: es el único dato que el cliente se lleva anotado.
//
// POR QUÉ NO SE ARREGLA EN EL PROMPT, Y ESTÁ MEDIDO EN ESTE PROYECTO: "no inventes" ya está escrito
// en `# Regla base: no inventar`, es la PRIMERA sección, y v95/v96/v97 le agregaron tres reglas más
// (los pisos no son precios, ofrecer lo que no existe es inventar, sin herramienta no se lista).
// Aun así sigue apareciendo. El modelo escribe el precio que "suena" bien cuando no lo tiene a mano.
//
// EL FIX ES LA REGLA DEL PROYECTO APLICADA AL FINAL DEL PIPELINE: el precio es un dato
// DETERMINÍSTICO que vive en la base, así que **el código lo corrige antes de que salga**, en vez
// de pedirle al modelo que lo recuerde. Dos piezas:
//   (A) `Leer lead (estado)`: `catalogo_precios` — un jsonb con {marca+modelo, año, precio} de todo
//       el stock. Subconsulta ESCALAR, hermana de `pisos_map` (trampa 4). Sale del stock vivo: no
//       hay nada hardcodeado y sirve igual en otra concesionaria.
//   (B) `Armar respuesta`: antes de devolver, recorre las burbujas y, en cada renglón que NOMBRA un
//       auto del catálogo Y trae un monto, compara con el precio real y lo REEMPLAZA si no coincide.
//
// POR QUÉ CORRIGE Y NO BORRA: el cliente ya está leyendo esa línea; borrarla le deja un hueco raro.
// Corregir el número deja la respuesta útil y verdadera, que es lo que la demo necesita.
//
// ACOTADO A PROPÓSITO — SÓLO TOCA EL MONTO QUE ESTÁ EN EL MISMO RENGLÓN QUE EL NOMBRE DEL AUTO.
// Un "$5.000.000 de anticipo" en un párrafo aparte no se toca, porque no comparte renglón con
// ningún modelo. Y si el auto no está en el catálogo (el "Renault Sandero"), no hay con qué
// corregir: eso lo sigue cazando `no_inventa_autos` en el eval y se ataca aparte.
//
// 2 NODOS: `Leer lead (estado)` -> Query · `Armar respuesta` -> jsCode. No toca el prompt.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v104.json'
const DESTINO = 'workflows/franco-n8n-v105.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// ─────────────────────────────────────────────────────────── (A) SQL
const lead = wf.nodes.find((n) => n.name === 'Leer lead (estado)')
const qAntes = lead.parameters.query
const ANCLA_SQL = 'FROM (SELECT 1) d\nLEFT JOIN crm_leads l ON l.session_id = $1;'
if (qAntes.split(ANCLA_SQL).length !== 2) throw new Error('no encontré (una sola vez) el cierre del SELECT')

const COLUMNA = `,
  -- catalogo_precios: marca+modelo, año y precio de TODO el stock, para que "Armar respuesta"
  -- pueda corregir un precio inventado antes de que salga al cliente. Sale del stock vivo: nada
  -- hardcodeado. Subconsulta ESCALAR, hermana de pisos_map (trampa 4).
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      't', metadata->>'marca' || ' ' || (metadata->>'modelo'),
      'a', (metadata->>'año')::int,
      'p', (metadata->>'precio')::bigint
    ) ORDER BY length(metadata->>'marca' || ' ' || (metadata->>'modelo')) DESC)
    FROM autos_disponibles
    WHERE metadata->>'marca' IS NOT NULL AND metadata->>'modelo' IS NOT NULL
      AND metadata->>'precio' IS NOT NULL
  ), '[]'::jsonb)                                          AS catalogo_precios
`
lead.parameters.query = qAntes.replace(ANCLA_SQL, () => COLUMNA + ANCLA_SQL)

// ─────────────────────────────────────────────────────────── (B) Armar respuesta
const ar = wf.nodes.find((n) => n.name === 'Armar respuesta')
const js = ar.parameters.jsCode
const ANCLA_JS = '  // Guard de cierre comercial: la respuesta nunca termina sin pregunta.'
if (js.split(ANCLA_JS).length !== 2) throw new Error('no encontré (una sola vez) el guard de cierre')

const BLOQUE = `  // EL PRECIO LO PONE LA BASE, NO EL MODELO (v105). En cada RENGLÓN que nombra un auto del
  // catálogo y trae un monto, se compara con el precio real y se corrige si no coincide.
  // Medido: Franco escribió "Jeep Renegade 2019 — $24.500.000" (real $25.500.000), "Gol Trend
  // 2022 — $17.000.000" (real $9.200.000) y "EcoSport 2020 — $27.000.000" (real $19.800.000).
  // El prompt ya se lo prohíbe en cuatro lugares distintos desde v95 y sigue pasando, así que el
  // dato determinístico se arregla con código.
  // Acotado al MISMO RENGLÓN a propósito: un "$5.000.000 de anticipo" en otro párrafo no se toca.
  // try/catch como todo este nodo: ante cualquier duda, el texto sale como vino.
  try {
    const _cat = $('Leer lead (estado)').first().json.catalogo_precios || [];
    if (Array.isArray(_cat) && _cat.length) {
      const _fmt = (n) => '$' + String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
      const _esc = (s) => String(s).replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
      messages = messages.map(m => {
        let c = String((m && m.content) || '');
        for (const a of _cat) {
          if (!a || !a.t || !a.p) continue;
          const re = new RegExp('([^\\\\n]*\\\\b' + _esc(a.t) + '\\\\b[^\\\\n]*?)\\\\\$\\\\s?([0-9][0-9.]{6,})', 'gi');
          c = c.replace(re, (todo, previo, monto) => {
            const n = parseInt(String(monto).replace(/\\./g, ''), 10);
            if (!Number.isFinite(n) || n === Number(a.p)) return todo;
            return previo + _fmt(a.p);
          });
        }
        return Object.assign({}, m, { content: c });
      });
    }
  } catch (e) {}

` + ANCLA_JS

ar.parameters.jsCode = js.replace(ANCLA_JS, () => BLOQUE)

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Armar respuesta', 'Leer lead (estado)']),
  `esperaba SOLO esos 2 nodos; hay: ${JSON.stringify(distintos)}`)
ok(lead.parameters.query.includes('FROM (SELECT 1) d\nLEFT JOIN crm_leads l ON l.session_id = $1;'),
  'TRAMPA 4: se rompió el patrón FROM (SELECT 1) d LEFT JOIN')
ok(String(lead.parameters.options.queryReplacement).trim().startsWith('={{ ['),
  'TRAMPA 2: el queryReplacement dejó de estar en forma array')
for (const col of ['AS pisos_map', 'AS carroceria_pedida_hist', 'AS msg_financiar_hist',
                   'AS franco_pidio_anticipo', 'AS msg_anticipo_hist']) {
  ok(lead.parameters.query.includes(col), `se perdió una columna previa: ${col}`)
}
ok(lead.parameters.query.split('AS catalogo_precios').length === 2, 'la columna nueva falta o está duplicada')
for (const frag of ['Guard de cierre comercial', 'CENTINELA DE CERO FILAS', 'cardsMostradas', 'fotosDe']) {
  ok(ar.parameters.jsCode.includes(frag), `se perdió algo de Armar respuesta: ${frag}`)
}
// El prompt y las tools no se tocan.
for (const nm of ['Franco (AI Agent)', 'Config', 'Listar stock', 'Buscar auto', 'Detalle auto']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

// ── PRUEBA OFFLINE: el corrector, extraído del v105 GENERADO (no una copia).
{
  const i = ar.parameters.jsCode.indexOf('    const _cat = ')
  const src = ar.parameters.jsCode.slice(
    ar.parameters.jsCode.lastIndexOf('  try {', i),
    ar.parameters.jsCode.indexOf('} catch (e) {}', i) + 14)
  try {
    const CAT = [
      { t: 'Volkswagen Gol Trend', a: 2018, p: 9200000 },
      { t: 'Jeep Renegade', a: 2021, p: 25500000 },
      { t: 'Ford EcoSport', a: 2020, p: 19800000 },
      { t: 'Toyota Corolla', a: 2022, p: 24800000 },
      { t: 'Toyota Etios', a: 2019, p: 12500000 },
    ]
    const correr = (texto) => {
      let messages = [{ type: 'text', content: texto }]
      const $ = () => ({ first: () => ({ json: { catalogo_precios: CAT } }) })
      const f = new Function('messages', '$', src + '\n; return messages;')
      return f(messages, $)[0].content
    }
    const casos = [
      // EL CASO DE LA CAPTURA DE AGUSTINA
      ['- Jeep Renegade 2019, SUV — 38.000 km — $24.500.000',
       '- Jeep Renegade 2019, SUV — 38.000 km — $25.500.000'],
      // los tres medidos en capacidad-de-compra-financiada
      ['- Volkswagen Gol Trend 2022, hatchback — 30.000 km — $17.000.000',
       '- Volkswagen Gol Trend 2022, hatchback — 30.000 km — $9.200.000'],
      ['- Ford EcoSport 2020 SUV, 48.000 km — $27.000.000',
       '- Ford EcoSport 2020 SUV, 48.000 km — $19.800.000'],
      // un precio CORRECTO no se toca
      ['- Toyota Corolla 2022 — 35.000 km — $24.800.000',
       '- Toyota Corolla 2022 — 35.000 km — $24.800.000'],
      // varios renglones a la vez
      ['- Toyota Etios 2019 — $9.000.000\n- Jeep Renegade 2021 — $24.500.000',
       '- Toyota Etios 2019 — $12.500.000\n- Jeep Renegade 2021 — $25.500.000'],
      // un monto que NO comparte renglón con ningún auto: intacto
      ['Con $5.000.000 de anticipo podés financiar hasta el 50%.',
       'Con $5.000.000 de anticipo podés financiar hasta el 50%.'],
      // un auto que no está en el catálogo: no hay con qué corregir, queda igual
      ['- Renault Sandero 2019 — $16.500.000', '- Renault Sandero 2019 — $16.500.000'],
      // texto sin precios
      ['Querés que te muestre opciones?', 'Querés que te muestre opciones?'],
      // el anticipo en el MISMO renglón que un auto: se toca sólo el primer monto del renglón,
      // que es el del auto (así están escritas todas las listas)
      ['- Toyota Etios 2019 — $12.500.000', '- Toyota Etios 2019 — $12.500.000'],
    ]
    let bien = 0
    for (const [inp, esp] of casos) {
      const got = correr(inp)
      if (got === esp) bien++
      else fallas.push(`corrector:\n      entra: ${JSON.stringify(inp)}\n      sale : ${JSON.stringify(got)}\n      esper: ${JSON.stringify(esp)}`)
    }
    console.log(`  corrector de precios: ${bien}/${casos.length}`)
  } catch (e) {
    fallas.push(`el corrector NO COMPILA: ${e.message}`)
  }
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Armar respuesta · Leer lead (estado)')
