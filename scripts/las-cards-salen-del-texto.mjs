// v111 -> v112 · SI EL TEXTO OFRECE AUTOS Y NO HAY CARDS, LAS CARDS SE RECUPERAN DEL TEXTO
//
// EL SABOR 3, LA MITAD QUE SE PUEDE ARREGLAR SIN RIESGO. `auto_ids: []` y el texto listando autos
// igual: no hay ids que hidratar, v111 no dispara (exige `ids.length > 0`) y el cliente ve una lista
// sin una sola foto. Es hoy el que más rojos genera: `media_si_lista_autos` TIPO B.
//
// Y SON DOS SITUACIONES DISTINTAS, MEDIDAS LAS DOS HOY:
//   (a) EL CLIENTE PIDIÓ VER y Franco lista bien pero se olvida los ids —
//       `stock-general-completo` ("qué autos tenés disponibles?"), turno 1: nombró los 17 autos
//       CORRECTOS y mandó cero cards. Acá el texto está bien: lo que falta son las fotos.
//   (b) EL CLIENTE NO PIDIÓ VER — `charla-real-reapertura-con-usado` turno 10 (ejecución `13797`,
//       mensaje "35mil km"): `auto_ids: []` y seis autos en el texto, dos de ellos la Ranger de
//       $57.000.000 y la Hilux de $38.000.000.
//
// ESTE CAMBIO ATACA SÓLO (a), Y (b) NO SE TOCA A PROPÓSITO. Extender el guion de v111 a (b) parecía
// obvio y ESTÁ MAL: en `13797` el lead trae `ya_derivado: true`, `lead_estado: "Requiere asesor"` y
// `lead_usado: "No mencionado"` —el CRM todavía no había registrado el usado—, así que el guion
// habría salido "Perfecto, ya lo tengo anotado. Querés que te contacte un asesor para avanzar?"
// **a alguien que YA está derivado**, que es un bug que este proyecto ya arregló. Se cambiaría un
// rojo por otro peor. (b) necesita su propia evidencia y su propio cambio.
//
// EL DISCRIMINADOR ES `Config.pidio_ver`, Y NO ES UNA RÉPLICA DE NADA: es EL MISMO campo que ya lee
// el gate de `Listar stock`, calculado una sola vez en `Config`. Probado con la expresión DESPLEGADA
// sobre los mensajes reales: "qué autos tenés disponibles?" → 1 · "35mil km" → 0 ·
// "tiene 100.000 km" → 0 · "dale, mostrame las opciones que me entran" → 1.
//
// EL CAMBIO — 2 NODOS, UN OBJETIVO:
//   (A) `Leer lead (estado)`: `catalogo_precios` pasa a traer también `i` (el id) y `f` (la foto).
//       Verificado contra la base: los 17 autos tienen los dos, y la URL más larga mide 102 chars.
//       NO CUESTA TOKENS DEL MODELO: `catalogo_precios` no está en el System Message ni en ningún
//       campo de `Config` — sólo lo leen `Leer lead (estado)` y `Armar respuesta` (verificado).
//   (B) `Armar respuesta`: si NO quedó ninguna card ni imagen, el cliente PIDIÓ ver, y el texto
//       final nombra 3 o más autos del catálogo, las cards se arman con esos autos, en el orden en
//       que aparecen en el texto.
//
// POR QUÉ ES SEGURO: **nunca reescribe ni borra nada**. Sólo AGREGA cards de autos que el texto ya
// está ofreciendo, y sólo cuando no había ninguna. Si el bloque no dispara, la respuesta es
// exactamente la de hoy.
// Y DE PASO CIERRA EL SABOR 2 EN ESTE CAMINO: si las cards salen del texto, no pueden contradecirlo.
// (El sabor 2 con ids que SÍ hidratan sigue abierto: ahí manda el camino de siempre.)

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v111.json'
const DESTINO = 'workflows/franco-n8n-v112.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// ─────────────────────────────────────────────────────────── (A) SQL
const lead = wf.nodes.find((n) => n.name === 'Leer lead (estado)')
const qAntes = lead.parameters.query

const SQL_VIEJO = `    SELECT jsonb_agg(jsonb_build_object(
      't', metadata->>'marca' || ' ' || (metadata->>'modelo'),
      'a', (metadata->>'año')::int,
      'p', (metadata->>'precio')::bigint
    ) ORDER BY length(metadata->>'marca' || ' ' || (metadata->>'modelo')) DESC)`
const SQL_NUEVO = `    SELECT jsonb_agg(jsonb_build_object(
      't', metadata->>'marca' || ' ' || (metadata->>'modelo'),
      'a', (metadata->>'año')::int,
      'p', (metadata->>'precio')::bigint,
      -- v112: el id y la foto, para poder RECONSTRUIR las product_cards desde el texto cuando el
      -- modelo no devolvió auto_ids. No cuesta tokens: catalogo_precios no entra al prompt.
      'i', (metadata->>'id')::int,
      'f', metadata->>'foto_principal'
    ) ORDER BY length(metadata->>'marca' || ' ' || (metadata->>'modelo')) DESC)`
ok(qAntes.split(SQL_VIEJO).length === 2, 'no encontré (una sola vez) el jsonb_build_object de catalogo_precios')
lead.parameters.query = qAntes.replace(SQL_VIEJO, () => SQL_NUEVO)

// ─────────────────────────────────────────────────────────── (B) Armar respuesta
const ar = wf.nodes.find((n) => n.name === 'Armar respuesta')
const jsAntes = ar.parameters.jsCode

const ANCLA = '  // Guard de cierre comercial: la respuesta nunca termina sin pregunta.'
ok(jsAntes.split(ANCLA).length === 2, 'no encontré (una sola vez) el guard de cierre como ancla')

const BLOQUE = `  // LAS CARDS SE RECUPERAN DEL TEXTO (v112). Si el modelo devolvió \`auto_ids: []\` pero el texto
  // igual ofrece autos, el cliente ve una lista sin una sola foto. Medido en
  // \`stock-general-completo\`: nombró los 17 autos CORRECTOS y mandó cero cards.
  // SOLO CUANDO EL CLIENTE PIDIÓ VER (\`Config.pidio_ver\`, el MISMO campo que lee el gate de
  // \`Listar stock\` — no es una réplica de la regla, es el mismo dato). Si no lo pidió, este turno
  // no era de mostrar y agregarle fotos lo empeoraría: ese caso va aparte.
  // NUNCA REESCRIBE NI BORRA NADA: sólo agrega cards de autos que el texto YA está ofreciendo, y
  // sólo si no había ninguna. Si no dispara, la respuesta es exactamente la de antes.
  // try/catch como todo este nodo: ante cualquier duda, lo de siempre.
  try {
    if (product_cards.length === 0 && images.length === 0 && Number(cfg.pidio_ver || 0) === 1) {
      const _cat = $('Leer lead (estado)').first().json.catalogo_precios || [];
      if (Array.isArray(_cat) && _cat.length) {
        const _t = messages.map(m => String((m && m.content) || '')).join('\\n').toLowerCase();
        const _vistos = new Set();
        const _cards = [];
        for (const a of _cat) {
          if (!a || !a.t || !a.i || !a.f) continue;
          const _pos = _t.indexOf(String(a.t).toLowerCase());
          if (_pos < 0) continue;
          if (_vistos.has(Number(a.i))) continue;
          _vistos.add(Number(a.i));
          _cards.push({
            _pos,
            id: Number(a.i),
            titulo: String(a.t) + ' ' + String(a.a),
            precio: '$' + String(a.p).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.'),
            foto_principal: String(a.f),
          });
        }
        // En el orden en que el cliente los lee, no en el del catálogo.
        _cards.sort((x, y) => x._pos - y._pos);
        // El mismo umbral que el camino de siempre: con menos de 3 van fotos, no cards, y las
        // fotos no se pueden reconstruir desde acá (necesitan el array \`fotos\` de la fila).
        // Y el mismo dedup: si TODOS ya se mandaron como card hace poco, no se repite el mazo.
        if (_cards.length >= 3 && _cards.some(c => !cardsMostradas.has(c.id))) {
          product_cards = _cards.map(c => ({
            id: c.id, titulo: c.titulo, precio: c.precio, foto_principal: c.foto_principal,
          }));
        }
      }
    }
  } catch (e) {}

`

ar.parameters.jsCode = jsAntes.replace(ANCLA, () => BLOQUE + ANCLA)
const jsDespues = ar.parameters.jsCode

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Armar respuesta', 'Leer lead (estado)']),
  `esperaba SÓLO esos 2 nodos; hay: ${JSON.stringify(distintos)}`)

// EL TEXTO VIEJO YA NO ESTÁ.
ok(lead.parameters.query.split(SQL_VIEJO).length === 1, 'el jsonb_build_object viejo sigue en la query')
ok(lead.parameters.query.split("'i', (metadata->>'id')::int").length === 2, 'el campo i falta o está duplicado')
ok(lead.parameters.query.split("'f', metadata->>'foto_principal'").length === 2, 'el campo f falta o está duplicado')
ok(jsDespues.split('LAS CARDS SE RECUPERAN DEL TEXTO (v112)').length === 2, 'el bloque nuevo falta o está duplicado')

// TRAMPAS.
ok(String(lead.parameters.options.queryReplacement).trim().startsWith('={{ ['),
  'TRAMPA 2: el queryReplacement dejó de estar en forma array')
ok(lead.parameters.query.includes('FROM (SELECT 1) d\nLEFT JOIN crm_leads l ON l.session_id = $1;'),
  'TRAMPA 4: se rompió el patrón FROM (SELECT 1) d LEFT JOIN')
for (const col of ['AS pisos_carroceria', 'AS pisos_map', 'AS carroceria_pedida_hist', 'AS msg_financiar_hist',
                   'AS franco_pidio_anticipo', 'AS msg_anticipo_hist', 'AS ya_derivado', 'AS catalogo_precios',
                   'AS franco_ofrecio_mostrar']) {
  ok(lead.parameters.query.includes(col), `se perdió una columna previa: ${col}`)
}
// El bloque nuevo va DESPUÉS de todo lo que toca messages y product_cards.
for (const frag of ['EL PRECIO LO PONE LA BASE, NO EL MODELO (v105)', 'EL AÑO TAMBIÉN LO PONE LA BASE (v109)',
                    'SE BORRA (v109)', 'ids.length > 0 && autos.length === 0']) {
  ok(jsDespues.indexOf(frag) < jsDespues.indexOf('LAS CARDS SE RECUPERAN DEL TEXTO (v112)'),
     `el bloque de v112 tiene que ir DESPUÉS de: ${frag}`)
}
ok(jsDespues.indexOf('LAS CARDS SE RECUPERAN DEL TEXTO (v112)') < jsDespues.indexOf('Guard de cierre comercial'),
  'el bloque de v112 va ANTES del guard de cierre')
for (const nm of ['Config', 'Franco (AI Agent)', 'Listar stock', 'Detalle auto', 'Buscar auto']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

// ── PRUEBA OFFLINE del bloque, sobre el v112 GENERADO.
{
  const desde = jsDespues.indexOf('  // LAS CARDS SE RECUPERAN DEL TEXTO (v112)')
  const src = jsDespues.slice(desde, jsDespues.indexOf(ANCLA))
  // El catálogo con la forma NUEVA (i y f), con los valores reales de la base.
  const CAT = [
    { t: 'Volkswagen Gol Trend', a: 2018, p: 9200000, i: 2, f: 'https://x/foto-2-1.webp' },
    { t: 'Toyota Corolla', a: 2022, p: 24800000, i: 5, f: 'https://x/foto-5-1.webp' },
    { t: 'Chevrolet Onix', a: 2024, p: 21500000, i: 7, f: 'https://x/foto-7-1.webp' },
    { t: 'Ford EcoSport', a: 2020, p: 19800000, i: 9, f: 'https://x/foto-9-1.webp' },
    { t: 'Jeep Renegade', a: 2021, p: 25500000, i: 12, f: 'https://x/foto-12-1.webp' },
    { t: 'Toyota Etios', a: 2019, p: 12500000, i: 4, f: 'https://x/foto-4-1.webp' },
    { t: 'Ford Fiesta', a: 2017, p: 8200000, i: 3, f: 'https://x/foto-3-1.webp' },
  ]
  try {
    const correr = ({ cards = [], imgs = [], pidioVer = 1, messages, cat = CAT, mostradas = new Set() }) => {
      const $ = () => ({ first: () => ({ json: { catalogo_precios: cat } }) })
      const f = new Function('product_cards', 'images', 'cfg', 'messages', 'cardsMostradas', '$',
        'let _pc = product_cards;\n' + src.replace(/product_cards = _cards/g, '_pc = _cards') + '\nreturn _pc;')
      return f(cards, imgs, { pidio_ver: pidioVer }, messages, mostradas, $)
    }
    const casos = []
    const chk = (nombre, cond, extra) => { casos.push(nombre); if (!cond) fallas.push(`offline · ${nombre}${extra ? ' :: ' + extra : ''}`) }

    // (1) EL CASO REAL de `stock-general-completo`: lista con autos, cero cards, pidió ver.
    const STOCK = [{ type: 'text', content: 'Mirá todo lo que tenemos ahora:\n- Jeep Renegade 2021 — 42.000 km — $25.500.000\n- Toyota Corolla 2022 — 35.000 km — $24.800.000\n- Chevrolet Onix 2024 — 12.000 km — $21.500.000\n- Ford EcoSport 2020 — 55.000 km — $19.800.000\n- Toyota Etios 2019 — 45.000 km — $12.500.000\n- Volkswagen Gol Trend 2018 — 110.000 km — $9.200.000\n- Ford Fiesta 2017 — 105.000 km — $8.200.000' }]
    const r1 = correr({ messages: STOCK })
    chk('stock · recupera las 7 cards', r1.length === 7, JSON.stringify(r1.map(c => c.titulo)))
    chk('stock · en el orden del texto', r1[0].titulo === 'Jeep Renegade 2021' && r1[6].titulo === 'Ford Fiesta 2017',
      JSON.stringify(r1.map(c => c.titulo)))
    chk('stock · el precio sale de la base, formateado', r1[0].precio === '$25.500.000', r1[0].precio)
    chk('stock · trae id y foto', r1[0].id === 12 && r1[0].foto_principal === 'https://x/foto-12-1.webp')

    // (2) LO QUE NO DEBE DISPARAR.
    chk('si NO pidió ver, no agrega nada (el caso de charla-real t10)',
      correr({ messages: STOCK, pidioVer: 0 }).length === 0)
    chk('si YA hay cards, no las toca',
      JSON.stringify(correr({ messages: STOCK, cards: [{ id: 1, titulo: 'X' }] })) === JSON.stringify([{ id: 1, titulo: 'X' }]))
    chk('si hay imágenes (camino de 1 auto), no se mete',
      correr({ messages: STOCK, imgs: [{ url: 'u' }] }).length === 0)
    const GUION = [{ type: 'text', content: 'Perfecto, ya lo tengo anotado. Querés que te contacte un asesor para avanzar, o preferís que te muestre opciones que te podrían servir?' }]
    chk('sobre el guion de v111 no arma nada', correr({ messages: GUION }).length === 0)
    const DOS = [{ type: 'text', content: '- Toyota Etios 2019 — $12.500.000\n- Ford Fiesta 2017 — $8.200.000' }]
    chk('con 2 autos no llega al umbral', correr({ messages: DOS }).length === 0)
    chk('sin catálogo no hace nada', correr({ messages: STOCK, cat: [] }).length === 0)
    chk('catálogo sin id/foto (forma vieja): no rompe y no arma nada',
      correr({ messages: STOCK, cat: CAT.map(({ t, a, p }) => ({ t, a, p })) }).length === 0)
    chk('dedup: si TODOS ya se mostraron hace poco, no repite el mazo',
      correr({ messages: STOCK, mostradas: new Set([2, 5, 7, 9, 12, 4, 3]) }).length === 0)
    chk('dedup: si hay al menos uno nuevo, va el mazo completo',
      correr({ messages: STOCK, mostradas: new Set([2, 5, 7]) }).length === 7)

    // (3) UN AUTO NOMBRADO EN PROSA TAMBIÉN CUENTA (el texto lo está ofreciendo igual).
    const PROSA = [{ type: 'text', content: 'Te puedo ofrecer el Toyota Corolla, la Ford EcoSport o el Chevrolet Onix, todos dentro de tu presupuesto.' }]
    chk('prosa con 3 autos: arma las 3 cards', correr({ messages: PROSA }).length === 3)

    const malas = fallas.filter((f) => f.startsWith('offline ·')).length
    console.log(`  cards desde el texto: ${casos.length - malas}/${casos.length}`)
    console.log('  stock-general recuperaría: ' + r1.map(c => c.titulo).join(' · '))
  } catch (e) {
    fallas.push(`el bloque NO COMPILA: ${e.message}`)
  }
}

// ── El SQL de catalogo_precios, aislado, para correrlo contra la base.
{
  const i = lead.parameters.query.indexOf('  COALESCE((\n    SELECT jsonb_agg(jsonb_build_object(')
  const j = lead.parameters.query.indexOf("), '[]'::jsonb)", i)
  const sub = lead.parameters.query.slice(i, j).replace(/^\s*COALESCE\(\(/, '')
  const dir = process.env.SQL_OUT || '.'
  fs.writeFileSync(`${dir}/v112-catalogo.sql`, sub.trim() + ';\n')
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Leer lead (estado) · Armar respuesta')
console.log(`  query: ${qAntes.length} -> ${lead.parameters.query.length} chars`)
console.log(`  jsCode: ${jsAntes.length} -> ${jsDespues.length} chars`)
