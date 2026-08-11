// v115 -> v116 · DOS COSAS QUE EL CÓDIGO ROMPE Y NO DEBERÍA. Las dos en `Armar respuesta`, las dos
// con reproducción exacta, las dos son QUITARLE daño al código — ninguna agrega comportamiento.
//
// VAN JUNTAS Y ACÁ ESTÁ EL PORQUÉ: son independientes, cada una tiene su assert y su prueba, y sus
// síntomas son distinguibles a simple vista en la salida (el guion con fotos abajo / el año del
// usado cambiado). Si la tanda diera rojo, se sabe cuál fue sin adivinar. La alternativa era dejar
// v115 en producción con el defecto (A) vivo, que es peor.
//
// ── (A) LAS CARDS SE VAN CON EL TEXTO — DE VERDAD ESTA VEZ ────────────────────────────────
// v113 escribió `autos.length = 0` para que, cuando el turno no era de mostrar, no quedara "el
// guion con seis fotos abajo". NO ALCANZA: `product_cards` e `images` se arman ~200 líneas ANTES,
// a partir de `autos`, así que vaciar `autos` después no los toca.
// MEDIDO EN PRODUCCIÓN el 2026-08-10 con v115 (turno 2 de `capacidad-de-compra-financiada`):
//   · sesión 8468b31c -> el guion + **6 cards**
//   · sesión 931148e9 -> el guion + **5 cards**
//   · sesión 4d6c799e -> el guion + 0 cards (acá `autos` ya venía vacío: por eso el defecto estaba
//     tapado — el bloque casi nunca disparaba, y cuando disparaba era sin autos hidratados).
// POR QUÉ NADIE LO VIO: la prueba offline de v113 asserteaba `r1.autos === 0`. **Medía la variable
// equivocada.** Pasó 8/8 sin tocar nunca `product_cards`. Es la lección de v107 en otra forma.
//
// ── (B) EL AÑO DEL AUTO DEL CLIENTE NO SE PISA ────────────────────────────────────────────
// El corrector de año de v109 le impone a cualquier "marca modelo" del catálogo el año que ese auto
// tiene EN STOCK. Cuando el cliente entrega un modelo que también está en stock, le reescribe SU
// auto. PRUEBA VINCULANTE, los dos nodos de la ejecución `14244`:
//   Franco (AI Agent) -> "Listo, ya tengo los datos de tu Toyota Hilux 2014. La tasación final..."
//   Armar respuesta   -> "Listo, ya tengo los datos de tu Toyota Hilux 2021. La tasación final..."
// Difieren: **lo corrompió el código.** El CRM había guardado bien
// (`descripcion_usado = "Toyota Hilux 2014 - 135.000 km"`) y el modelo también lo había escrito bien.
// Es intermitente porque exige la marca: "tu Hilux 2014" (sin "Toyota") no lo tocaba.
//
// DOS GUARDAS, EN OR, Y LAS DOS SÓLO PUEDEN **DEJAR DE CORREGIR** (nunca corregir de más):
//   1. el año que aparece es uno de los que están en `lead_usado` (acá: 2014);
//   2. el nombre viene precedido de un posesivo ("tu Toyota Hilux"), que es CRM-independiente y
//      cubre el turno en que el CRM todavía no escribió — el retraso que ya nos costó v115.
// EL SESGO ES DELIBERADO: si nos pasamos de prudentes, el peor caso es que sobreviva un año
// inventado por el modelo (el bug de v109, que el eval caza). Si nos quedamos cortos, Franco le
// cambia el auto al cliente en la cara. No son comparables.
// LO QUE v109 GANÓ NO SE TOCA: sus casos medidos ("- Volkswagen Gol Trend 2022 —", "- Renault
// Duster 2018 —") son renglones de lista sin posesivo y con años que no son los del usado.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v115.json'
const DESTINO = 'workflows/franco-n8n-v116.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ar = wf.nodes.find((n) => n.name === 'Armar respuesta')
const jsAntes = ar.parameters.jsCode

// ── (A) ─────────────────────────────────────────────────────────────────────
const A_VIEJO = `        // Las cards se van con el texto (v113): si el turno no era de mostrar, tampoco van las
        // fotos. Sin esto quedaría el guion con seis autos abajo, que es peor que el bug.
        autos.length = 0;`
const A_NUEVO = `        // Las cards se van con el texto (v113) — ARREGLADO DE VERDAD EN v116.
        // v113 vaciaba SÓLO \`autos\`, y no alcanza: \`product_cards\` e \`images\` ya se armaron
        // ~200 líneas más arriba A PARTIR de \`autos\`, así que vaciarlo acá no los toca y el guion
        // salía igual con las fotos abajo. MEDIDO en producción el 2026-08-10 sobre v115: el guion
        // con 6 cards (sesión 8468b31c) y con 5 (sesión 931148e9).
        // Estuvo tapado desde v113 porque el bloque casi nunca disparaba y, cuando disparaba,
        // \`autos\` ya venía vacío. La prueba offline de v113 asserteaba \`autos.length === 0\`:
        // medía la variable equivocada.
        autos.length = 0;
        product_cards = [];
        images = [];`
ok(jsAntes.split(A_VIEJO).length === 2, '(A) no encontré (una sola vez) el vaciado de v113')

// ── (B) ─────────────────────────────────────────────────────────────────────
// El bloque se ANCLA POR POSICIÓN y se transforma con reemplazos puntuales sobre su propio texto:
// retipear estas expresiones a mano es cómo se cuelan los errores de escapado, y además la línea
// `const _cat = $('Leer lead (estado)')...` aparece DOS veces en el nodo (v105 usa la misma).
const Y_INI = '  // EL AÑO TAMBIÉN LO PONE LA BASE (v109).'
const Y_FIN = '  // EL RENGLÓN QUE OFRECE UN AUTO QUE NO EXISTE SE BORRA (v109).'
ok(jsAntes.split(Y_INI).length === 2 && jsAntes.split(Y_FIN).length === 2,
  '(B) no encontré (una sola vez) los límites del corrector de año')
const B_VIEJO = jsAntes.slice(jsAntes.indexOf(Y_INI), jsAntes.indexOf(Y_FIN))

const CAT_VIEJA = `    const _cat = $('Leer lead (estado)').first().json.catalogo_precios || [];`
const CAT_NUEVA = `    const _le0 = $('Leer lead (estado)').first().json;
    const _cat = _le0.catalogo_precios || [];`
const ESC_LINEA = B_VIEJO.slice(B_VIEJO.indexOf('      const _esc = '),
  B_VIEJO.indexOf('\n', B_VIEJO.indexOf('      const _esc = ')) + 1)
const ANIOS = `      // EL AÑO DEL AUTO DEL CLIENTE NO SE PISA (v116). Si el cliente entrega un modelo que TAMBIÉN
      // está en stock, este corrector le imponía a SU auto el año que ese modelo tiene en el stock.
      // PRUEBA VINCULANTE, los dos nodos de la ejecución 14244: el modelo escribió "tu Toyota Hilux
      // 2014" y al cliente le llegó "tu Toyota Hilux 2021". El CRM había guardado bien
      // ("Toyota Hilux 2014 - 135.000 km"): lo rompió este bloque.
      // Dos guardas en OR, y las dos sólo pueden DEJAR DE CORREGIR, nunca corregir de más:
      //   (1) el año es uno de los que trae lead_usado;
      //   (2) el nombre viene con un posesivo delante ("tu Toyota Hilux") — ésta NO depende del CRM
      //       y por eso cubre el turno en que el CRM todavía no escribió, que es el retraso que ya
      //       nos costó v115.
      // EL SESGO ES DELIBERADO: pasarse de prudente deja vivo un año inventado (bug de v109, que el
      // eval caza); quedarse corto le cambia el auto al cliente en la cara. No son comparables.
      const _aniosUsado = new Set(String(_le0.lead_usado || '').match(/\\b(?:19|20)\\d{2}\\b/g) || []);
`
const RE_VIEJA = String.raw`{0,12})\\b(?:19|20)\\d{2}\\b'`
const RE_NUEVA = String.raw`{0,12})\\b((?:19|20)\\d{2})\\b'`
const CB_VIEJA = `          c = c.replace(re, (todo, previo) => previo + String(a.a));`
const CB_NUEVA = `          const _rePos = new RegExp('` + String.raw`\\b(?:tu|su|mi|tus|sus|mis)\\s+` + `' + _esc(a.t) + '` + String.raw`\\b` + `', 'i');
          c = c.replace(re, (todo, previo, anio) => {
            if (_aniosUsado.has(anio)) return todo;
            if (_rePos.test(todo)) return todo;
            return previo + String(a.a);
          });`

for (const [frag, nombre] of [[CAT_VIEJA, 'la línea de _cat'], [ESC_LINEA, 'la línea de _esc'],
                              [RE_VIEJA, 'el regex del año'], [CB_VIEJA, 'el callback del replace']]) {
  ok(B_VIEJO.split(frag).length === 2, `(B) no encontré (una sola vez) ${nombre} dentro del bloque`)
}
ok(ESC_LINEA.includes('_esc') && ESC_LINEA.endsWith('\n'), '(B) no aislé la línea de _esc')

const B_NUEVO = B_VIEJO
  .replace(CAT_VIEJA, () => CAT_NUEVA)
  .replace(ESC_LINEA, () => ESC_LINEA + ANIOS)
  .replace(RE_VIEJA, () => RE_NUEVA)
  .replace(CB_VIEJA, () => CB_NUEVA)

ar.parameters.jsCode = jsAntes.replace(A_VIEJO, () => A_NUEVO).replace(B_VIEJO, () => B_NUEVO)
const jsDespues = ar.parameters.jsCode

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Armar respuesta']),
  `esperaba SÓLO Armar respuesta; hay: ${JSON.stringify(distintos)}`)
ok(jsDespues.split(A_VIEJO).length === 1 && jsDespues.split(B_VIEJO).length === 1,
  'quedó texto viejo en el código')
// Con indentación: la otra ocurrencia de cada uno es su `let` de declaración, arriba de todo.
ok(jsDespues.split('\n        product_cards = [];').length === 2, 'el vaciado de product_cards falta o está duplicado')
ok(jsDespues.split('\n        images = [];').length === 2, 'el vaciado de images falta o está duplicado')
ok(jsAntes.split('\n        product_cards = [];').length === 1, 'v115 ya vaciaba product_cards: el bug (A) no reproduce')
ok(jsDespues.split('_aniosUsado').length === 3, '_aniosUsado tiene que declararse y usarse una vez')
ok(jsDespues.split('_le2.tiene_usado_hist').length === 2, 'se perdió la señal de v115')
for (const frag of ['SE BORRA (v109)', 'EL ENCABEZADO PEGADO AL ÍTEM', 'LAS CARDS SE RECUPERAN DEL TEXTO (v112)',
                    '_noEraDeMostrar', 'Guard de cierre comercial', 'CENTINELA DE CERO FILAS (v102)',
                    'EL PRECIO LO PONE LA BASE, NO EL MODELO (v105)']) {
  ok(jsDespues.includes(frag), `se perdió algo de Armar respuesta: ${frag}`)
}
try { new Function(jsDespues) } catch (e) { fallas.push(`el NODO ENTERO no compila: ${e.message}`) }
for (const nm of ['Config', 'Leer lead (estado)', 'Franco (AI Agent)', 'Listar stock', 'Detalle auto']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

const CAT = [
  { t: 'Toyota Hilux', a: 2021, p: 38000000, i: 13, f: 'u' }, { t: 'Toyota Corolla', a: 2022, p: 24800000, i: 5, f: 'u' },
  { t: 'Volkswagen Gol Trend', a: 2018, p: 9200000, i: 2, f: 'u' }, { t: 'Renault Duster', a: 2023, p: 22500000, i: 11, f: 'u' },
  { t: 'Toyota Etios', a: 2019, p: 12500000, i: 4, f: 'u' }, { t: 'Fiat Cronos', a: 2023, p: 16800000, i: 1, f: 'u' },
]
const casos = []
const chk = (n, c, extra) => { casos.push(n); if (!c) fallas.push(`offline · ${n}${extra ? ' :: ' + extra : ''}`) }

// ── PRUEBA (B): el corrector de año, antes y después, sobre el texto REAL de 14244 ───────
{
  const D = '  // EL AÑO TAMBIÉN LO PONE LA BASE (v109).'
  const H = '  // EL RENGLÓN QUE OFRECE UN AUTO QUE NO EXISTE SE BORRA (v109).'
  const corr = (js, texto, lead) => {
    const $ = () => ({ first: () => ({ json: { catalogo_precios: CAT, ...lead } }) })
    return new Function('messages', '$', js.slice(js.indexOf(D), js.indexOf(H)) + '\nreturn messages;')(
      [{ type: 'text', content: texto }], $)[0].content
  }
  const T14244 = 'Listo, ya tengo los datos de tu Toyota Hilux 2014. La tasación final la hace un asesor viéndolo en persona.'
  const LEAD = { lead_usado: 'Toyota Hilux 2014 - 135.000 km', lead_entrega: 'Sí' }

  chk('14244 · v115 le cambia el año al auto del cliente — el bug',
    /Hilux 2021/.test(corr(jsAntes, T14244, LEAD)), corr(jsAntes, T14244, LEAD))
  chk('14244 · v116 lo respeta', corr(jsDespues, T14244, LEAD) === T14244, corr(jsDespues, T14244, LEAD))
  // Sin CRM todavía (el retraso): la guarda del posesivo sola tiene que alcanzar.
  chk('14244 · sin lead_usado (CRM tarde) igual lo respeta',
    corr(jsDespues, T14244, { lead_usado: 'No mencionado' }) === T14244,
    corr(jsDespues, T14244, { lead_usado: 'No mencionado' }))
  chk('el usado en otra frase también se respeta',
    corr(jsDespues, 'Con tu Toyota Hilux 2014 como parte de pago, estas opciones te pueden servir:', LEAD)
      .includes('Hilux 2014'))
  // LO QUE v109 GANÓ SIGUE FUNCIONANDO: años inventados en renglones de lista se siguen corrigiendo.
  for (const [mal, bien] of [['- Volkswagen Gol Trend 2022 — 30.000 km — $9.200.000', 'Gol Trend 2018'],
                             ['- Renault Duster 2018 — 31.000 km — $22.500.000', 'Duster 2023'],
                             ['- Toyota Etios 2018 — 45.000 km — $12.500.000', 'Etios 2019']]) {
    chk(`v109 intacto · ${bien}`, corr(jsDespues, mal, LEAD).includes(bien), corr(jsDespues, mal, LEAD))
  }
  // Y el auto de STOCK del mismo modelo que el usado se sigue corrigiendo si el año no es el del usado.
  chk('v109 intacto · la Hilux DE STOCK con año mal se corrige igual',
    corr(jsDespues, '- Toyota Hilux 2019 — 95.000 km — $38.000.000', LEAD).includes('Hilux 2021'),
    corr(jsDespues, '- Toyota Hilux 2019 — 95.000 km — $38.000.000', LEAD))
}

// ── PRUEBA (A): las cards se van con el texto. Se corre desde que se ARMAN las cards ─────
{
  const D = '  let images = [];'
  const H = '  // LAS CARDS SE RECUPERAN DEL TEXTO (v112).'
  const correr = (js, { autos, ids, cfg, lead, messages }) => {
    const $ = (n) => ({ first: () => ({ json: n === 'Config' ? cfg : { catalogo_precios: CAT, ...lead } }) })
    const src = js.slice(js.indexOf(D), js.indexOf(H))
    const f = new Function('autos', 'ids', 'centinela', 'cfg', 'messages', 'cardsMostradas', 'yaMostrados',
      'fotosDe', 'anchor', '$', src + '\nreturn { cards: product_cards.length, imgs: images.length, texto: messages.map(m=>m.content).join("\\n") };')
    return f(autos.slice(), ids, false, cfg, messages.map((m) => ({ ...m })),
      new Set(), new Set(), (a) => [String(a.id)], 0, $)
  }
  const SEIS = [2, 4, 1, 5, 11, 13].map((id) => ({ id, titulo: 'x ' + id, precio: '$1.000.000', foto_principal: 'u' }))
  const T2 = [{ type: 'text', content: 'Con tu usado como parte de pago, estas opciones te pueden servir:\n- Volkswagen Gol Trend 2018 — 110.000 km — $9.200.000\n- Toyota Etios 2019 — 45.000 km — $12.500.000\n- Fiat Cronos 2023 — 28.000 km — $16.800.000' }]
  const CFG = { pidio_ver: 0, monto_financiar: 0, entrega_plata: 0, entrega_plata_resp: 0 }
  const LEAD = { lead_entrega: 'Sí', lead_usado: 'Ford Ka 2015', lead_estado: 'En conversación', ya_derivado: false, tiene_usado_hist: true }

  const v115 = correr(jsAntes, { autos: SEIS, ids: [2, 4, 1, 5, 11, 13], cfg: CFG, lead: LEAD, messages: T2 })
  const v116 = correr(jsDespues, { autos: SEIS, ids: [2, 4, 1, 5, 11, 13], cfg: CFG, lead: LEAD, messages: T2 })
  chk('8468b31c · v115 deja el guion CON las cards — el bug', v115.cards === 6 && /asesor/.test(v115.texto),
    `cards=${v115.cards}`)
  chk('8468b31c · v116 se lleva las cards', v116.cards === 0, `cards=${v116.cards}`)
  chk('8468b31c · y el guion sigue saliendo', /ya lo tengo anotado|ya tengo los datos/.test(v116.texto), v116.texto)

  // Con 1-2 autos salen IMÁGENES, no cards: también se tienen que ir.
  const DOS = SEIS.slice(0, 2)
  const i115 = correr(jsAntes, { autos: DOS, ids: [2, 4], cfg: CFG, lead: LEAD, messages: T2 })
  const i116 = correr(jsDespues, { autos: DOS, ids: [2, 4], cfg: CFG, lead: LEAD, messages: T2 })
  chk('con 2 autos · v115 deja las fotos', i115.imgs > 0, `imgs=${i115.imgs}`)
  chk('con 2 autos · v116 se las lleva', i116.imgs === 0, `imgs=${i116.imgs}`)

  // NO SE METE DONDE NO DEBE: si el cliente pidió ver, las cards quedan intactas.
  const ver = correr(jsDespues, { autos: SEIS, ids: [2, 4, 1, 5, 11, 13], cfg: { ...CFG, pidio_ver: 1 }, lead: LEAD, messages: T2 })
  chk('pidió ver · las cards NO se tocan', ver.cards === 6, `cards=${ver.cards}`)
  // Y sin señal de "no era de mostrar", tampoco.
  const normal = correr(jsDespues, {
    autos: SEIS, ids: [2, 4, 1, 5, 11, 13], cfg: CFG, messages: T2,
    lead: { lead_entrega: 'No mencionado', lead_usado: 'No mencionado', lead_estado: 'Nuevo', ya_derivado: false, tiene_usado_hist: false },
  })
  chk('turno normal · las cards NO se tocan', normal.cards === 6, `cards=${normal.cards}`)
}

const malas = fallas.filter((f) => f.startsWith('offline ·')).length
console.log(`  ni las cards ni el auto del cliente: ${casos.length - malas}/${casos.length}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Armar respuesta')
console.log(`  jsCode: ${jsAntes.length} -> ${jsDespues.length} chars`)
