// v106 -> v107 · SI LA TOOL NO DEVOLVIÓ AUTOS Y EL TEXTO IGUAL LOS LISTA, ESCRIBE EL CÓDIGO
//
// EL BUG, MEDIDO. `capacidad-de-compra-financiada` turno 2, ejecución 13306 (sesión
// 91c03467-825f-4fdd-8969-ab7eda736ca1): el cliente contesta los km de su usado y NO pide ver.
// El gate de permuta de v85 hace lo suyo y `Listar stock` devuelve el centinela `[{"success":true}]`.
// v102 vacía las cards por código — y funcionó: `product_cards: []`. Pero el TEXTO listó SEIS autos
// igual, en tres bloques con precios, uno de ellos inexistente: "Chevrolet Cruze 2019 — $22.500.000".
// El cliente ve seis autos que no existen y ninguna foto.
//
// POR QUÉ NO VA AL PROMPT, Y ESTO SE MIDIÓ EN VEZ DE SUPONERSE. La inyección de v102 SÍ cubre este
// camino (`tieneUsado && conUsado` → el guion del usado) y SÍ se renderizó en ese turno: se leyó del
// log. En las otras 2 corridas del mismo `--repeat 3` Franco la dijo casi textual. O sea: la
// inyección adhiere 2 de 3 y el prompt ya prohíbe esto en cuatro lugares distintos. Es la trampa 6,
// y la regla del proyecto dice que lo determinístico va a código: con el centinela arriba, CUALQUIER
// auto listado está inventado por definición, porque la herramienta no le dio ninguno.
//
// POR QUÉ SE REEMPLAZA LA RESPUESTA Y NO SE BORRAN LOS RENGLONES: borrarlos deja el encabezado
// colgado. En el caso medido la burbuja anterior dice "tenés este abanico estimado de opciones:" y
// abajo no quedaría nada. El guion de v102 —el MISMO texto, armado acá con los mismos datos— deja
// una respuesta entera y con salida.
//
// EL CAMBIO — UN NODO (`Armar respuesta`), dos piezas:
//   (A) el bloque del centinela de v102 pasa a dejar la señal en una variable (`centinela`), sin
//       cambiar en nada lo que hace hoy con las cards.
//   (B) un bloque nuevo, después del corrector de precios de v105 y antes del guard de cierre.
// DOS CONDICIONES, las dos necesarias: (a) el centinela, (b) DOS o más renglones de LISTA que
// nombren un auto del catálogo Y traigan un precio — el mismo criterio con el que `no_inventa_autos`
// distingue una oferta de una mención al pasar ("el Etios que viste" no dispara nada).
//
// LO QUE NO SE TOCA: el prompt, el gate de v85, el centinela de v102 y el corrector de v105.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v106.json'
const DESTINO = 'workflows/franco-n8n-v107.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ar = wf.nodes.find((n) => n.name === 'Armar respuesta')
const jsAntes = ar.parameters.jsCode

// ────────────────────────────────────────── (A) la señal del centinela de v102
const CENT_VIEJO = `  try {
    const _ls = $('Listar stock').first().json;
    const _filas = (_ls && Array.isArray(_ls.response)) ? _ls.response : null;
    if (_filas && _filas.length && _filas.every(r => !r || r.id == null)) {
      autos.length = 0;
    }
  } catch (e) {}`
const CENT_NUEVO = `  let centinela = false;
  try {
    const _ls = $('Listar stock').first().json;
    const _filas = (_ls && Array.isArray(_ls.response)) ? _ls.response : null;
    if (_filas && _filas.length && _filas.every(r => !r || r.id == null)) {
      autos.length = 0;
      centinela = true;
    }
  } catch (e) {}`
ok(jsAntes.split(CENT_VIEJO).length === 2, 'no encontré (una sola vez) el bloque del centinela de v102')

// ────────────────────────────────────────── (B) el texto inventado
const ANCLA = '  // Guard de cierre comercial: la respuesta nunca termina sin pregunta.'
ok(jsAntes.split(ANCLA).length === 2, 'no encontré (una sola vez) el guard de cierre comercial')

const BLOQUE = `  // EL TEXTO TAMBIÉN, NO SÓLO LAS CARDS (v107). Si la herramienta devolvió el centinela y el texto
  // igual lista autos, esos autos están inventados por definición: no salieron de la base. La
  // respuesta se reemplaza por el guion de v102, armado acá con los mismos datos.
  // MEDIDO (ejecución 13306): el gate de v85 devolvió cero filas, v102 vació las cards, y Franco
  // listó seis autos igual —uno inexistente, "Chevrolet Cruze 2019 — $22.500.000"—. La inyección de
  // v102 estaba renderizada en ese turno y adhirió en 2 de 3 corridas: trampa 6, va a código.
  // Se reemplaza en vez de borrar renglones porque borrarlos deja colgado el encabezado
  // ("tenés este abanico estimado de opciones:" y abajo nada).
  // try/catch como todo este nodo: ante cualquier duda, el texto sale como vino.
  try {
    if (centinela) {
      const _le = $('Leer lead (estado)').first().json;
      const _cat = _le.catalogo_precios || [];
      const _nombres = [];
      for (const a of (Array.isArray(_cat) ? _cat : [])) {
        if (!a || !a.t) continue;
        _nombres.push(String(a.t));
        // "Volkswagen Gol Trend" -> "Gol Trend". El modelo suelto sólo cuenta si tiene letras:
        // "208" a secas matchearía dentro de cualquier monto, así que ese sólo va con la marca.
        const _mod = String(a.t).split(' ').slice(1).join(' ');
        if (/[a-z]/i.test(_mod)) _nombres.push(_mod);
      }
      let _listados = 0;
      for (const m of messages) {
        for (const l of String((m && m.content) || '').split('\\n')) {
          if (!/^\\s*(?:[-•*]|\\d+[.)])\\s+\\S/.test(l)) continue;
          if (!/\\$\\s?\\d{1,3}(?:\\.\\d{3})+/.test(l)) continue;
          if (_nombres.some(n => l.toLowerCase().includes(n.toLowerCase()))) _listados++;
        }
      }
      if (_listados >= 2) {
        const _usado = String(_le.lead_usado || '');
        const _conUsado = String(_le.lead_entrega || '') === 'Sí' && _usado &&
          _usado !== 'No mencionado' && _usado !== 'Auto usado mencionado, sin detalles';
        messages = [{ type: 'text', content: _conUsado
          ? 'Listo, ya tengo los datos de tu ' + _usado + '. La tasación final la hace un asesor viéndolo en persona. Querés que te contacte un asesor para coordinarla, o preferís que te muestre opciones que te podrían servir?'
          : 'Perfecto, ya lo tengo anotado. Querés que te contacte un asesor para avanzar, o preferís que te muestre opciones que te podrían servir?' }];
      }
    }
  } catch (e) {}

`

ar.parameters.jsCode = jsAntes
  .replace(CENT_VIEJO, () => CENT_NUEVO)
  .replace(ANCLA, () => BLOQUE + ANCLA)
const jsDespues = ar.parameters.jsCode

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Armar respuesta']),
  `esperaba SÓLO Armar respuesta; hay: ${JSON.stringify(distintos)}`)

// EL TEXTO VIEJO YA NO ESTÁ (el bloque del centinela sin la señal).
ok(jsDespues.split(CENT_VIEJO).length === 1, 'quedó la versión vieja del bloque del centinela')
ok(jsDespues.split(CENT_NUEVO).length === 2, 'el bloque del centinela nuevo falta o está duplicado')
ok(jsDespues.split('if (_listados >= 2)').length === 2, 'el bloque nuevo falta o está duplicado')
ok(jsDespues.indexOf('if (_listados >= 2)') > jsDespues.indexOf('EL PRECIO LO PONE LA BASE'),
  'el bloque nuevo tiene que ir DESPUÉS del corrector de precios de v105')
ok(jsDespues.indexOf('if (_listados >= 2)') < jsDespues.indexOf('Guard de cierre comercial'),
  'el bloque nuevo tiene que ir ANTES del guard de cierre')

// Nada previo se perdió.
for (const frag of ['Guard de cierre comercial', 'cardsMostradas', 'yaMostrados', 'fotosDe',
                    'EL PRECIO LO PONE LA BASE', 'CENTINELA DE CERO FILAS (v102)',
                    'TB-3: encabezado del abanico']) {
  ok(jsDespues.includes(frag), `se perdió algo de Armar respuesta: ${frag}`)
}
for (const nm of ['Config', 'Leer lead (estado)', 'Franco (AI Agent)', 'Listar stock', 'Detalle auto']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

// ── PRUEBA OFFLINE 1: el centinela de v102 sigue haciendo LO MISMO con las cards.
{
  const src = jsDespues.slice(
    jsDespues.indexOf('  let centinela = false;'),
    jsDespues.indexOf('} catch (e) {}', jsDespues.indexOf('const _ls')) + 14)
  try {
    const correr = (respuesta, autosIniciales) => {
      const autos = autosIniciales.slice()
      const $ = () => ({ first: () => ({ json: respuesta === undefined ? (() => { throw new Error('no corrió') })() : respuesta }) })
      const f = new Function('autos', '$', src + '\nreturn centinela;')
      const centinela = f(autos, $)   // primero corre, después se mide: `autos` lo muta el bloque
      return { autos: autos.length, centinela }
    }
    const TRES = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const casos = [
      [{ response: [{ success: true }] }, 0, true, 'el centinela no vació los autos / no marcó la señal'],
      [{ response: [{ id: 4, titulo: 'Etios' }] }, 3, false, 'vació los autos habiendo filas reales'],
      [undefined, 3, false, 'se activó sin que Listar stock hubiera corrido'],
      [{ response: [] }, 3, false, 'se activó con response vacío'],
      [{}, 3, false, 'se activó sin response'],
    ]
    let bien = 0
    for (const [resp, espAutos, espCent, msg] of casos) {
      const r = correr(resp, TRES)
      if (r.autos === espAutos && r.centinela === espCent) bien++
      else fallas.push(`${msg} (autos=${r.autos}, centinela=${r.centinela})`)
    }
    console.log(`  centinela de v102 (conducta intacta + señal): ${bien}/${casos.length}`)
  } catch (e) {
    fallas.push(`el bloque del centinela NO COMPILA: ${e.message}`)
  }
}

// ── PRUEBA OFFLINE 2: el bloque nuevo, sobre el TEXTO REAL del bug.
{
  const src = jsDespues.slice(
    jsDespues.indexOf('  try {\n    if (centinela) {'),
    jsDespues.indexOf('} catch (e) {}', jsDespues.indexOf('if (_listados >= 2)')) + 14)
  try {
    // El texto EXACTO de la ejecución 13306, traído de mensajes_demo.
    const REAL = [
      { type: 'text', content: 'Teniendo en cuenta tu anticipo de $7.000.000, el Ford Ka 2015 que entregás y la posibilidad de financiar hasta el 50%, tenés este abanico estimado de opciones:' },
      { type: 'text', content: 'Entrada:\n- Volkswagen Gol Trend 2022, hatchback, mismo porte que tu auto, $9.200.000\n- Toyota Etios 2018, sedán, cuatro años más nuevo, $12.500.000\n\nIntermedio:\n- Ford Ecosport 2020, SUV, consumo 6,3 L/100km, $19.800.000\n- Chevrolet Cruze 2019, sedán, consumo 6,4 L/100km, $22.500.000\n\nAlto:\n- Jeep Renegade 2019, SUV, consumo 7,5 L/100km, $25.500.000\n- Toyota Corolla 2019, sedán, consumo 6,8 L/100km, $24.800.000' },
      { type: 'text', content: 'Para avanzar con la financiación te paso a un asesor para que te haga la simulación exacta según tu perfil y el monto que podés financiar. Me dejás tu nombre y apellido para que te contacten?' },
    ]
    const CAT = [
      { a: 2018, p: 9200000, t: 'Volkswagen Gol Trend' }, { a: 2022, p: 24800000, t: 'Toyota Corolla' },
      { a: 2024, p: 21500000, t: 'Chevrolet Onix' }, { a: 2020, p: 19800000, t: 'Ford EcoSport' },
      { a: 2021, p: 25500000, t: 'Jeep Renegade' }, { a: 2019, p: 12500000, t: 'Toyota Etios' },
      { a: 2025, p: 21000000, t: 'Peugeot 208' }, { a: 2022, p: 39500000, t: 'Chevrolet S10' },
    ]
    const correr = (centinela, messages, lead) => {
      const $ = () => ({ first: () => ({ json: Object.assign({ catalogo_precios: CAT }, lead) }) })
      const f = new Function('centinela', 'messages', '$', src + '\nreturn messages;')
      return f(centinela, messages.map((m) => Object.assign({}, m)), $)
    }
    const LEAD = { lead_entrega: 'Sí', lead_usado: 'Ford Ka 2015' }
    const GUION = 'Listo, ya tengo los datos de tu Ford Ka 2015. La tasación final la hace un asesor viéndolo en persona. Querés que te contacte un asesor para coordinarla, o preferís que te muestre opciones que te podrían servir?'

    const casos = []
    const chk = (nombre, cond) => { casos.push(nombre); if (!cond) fallas.push(`prueba offline 2 · ${nombre}`) }

    // EL CASO MEDIDO: se reemplaza por el guion, en UNA burbuja.
    const r1 = correr(true, REAL, LEAD)
    chk('el caso real se reemplaza por el guion', r1.length === 1 && r1[0].content === GUION)
    chk('no queda ningún auto nombrado',
      !/gol trend|etios|ecosport|cruze|renegade|corolla/i.test(JSON.stringify(r1)))

    // Sin centinela (la tool SÍ devolvió autos): el abanico legítimo no se toca.
    chk('sin centinela no toca nada', JSON.stringify(correr(false, REAL, LEAD)) === JSON.stringify(REAL))

    // Centinela pero SIN lista de autos: el guion de v102 que Franco sí dijo, intacto.
    const OBEDECE = [{ type: 'text', content: 'Listo, ya tengo los datos de tu Ford Ka 2015. Querés que te contacte un asesor?' }]
    chk('centinela sin lista no toca nada', JSON.stringify(correr(true, OBEDECE, LEAD)) === JSON.stringify(OBEDECE))

    // Centinela + UNA sola línea: por debajo del umbral, no se mete.
    const UNA = [{ type: 'text', content: 'Algo así:\n- Toyota Etios 2019, $12.500.000' }]
    chk('una sola línea no alcanza', JSON.stringify(correr(true, UNA, LEAD)) === JSON.stringify(UNA))

    // Centinela + menciones en PROSA (sin viñeta ni precio): no se mete.
    const PROSA = [{ type: 'text', content: 'El Etios y la EcoSport que viste siguen disponibles, querés que te cuente?' }]
    chk('las menciones en prosa no disparan', JSON.stringify(correr(true, PROSA, LEAD)) === JSON.stringify(PROSA))

    // Centinela + renglones SIN precio: tampoco.
    const SINPRECIO = [{ type: 'text', content: 'Tengo:\n- Toyota Etios\n- Ford EcoSport' }]
    chk('los renglones sin precio no disparan', JSON.stringify(correr(true, SINPRECIO, LEAD)) === JSON.stringify(SINPRECIO))

    // Centinela + lista, pero SIN usado declarado: el otro guion.
    const r2 = correr(true, REAL, { lead_entrega: 'No mencionado', lead_usado: 'No mencionado' })
    chk('sin usado sale el guion genérico',
      r2.length === 1 && r2[0].content.startsWith('Perfecto, ya lo tengo anotado.'))

    // "208" a secas dentro de un monto NO cuenta como auto listado.
    const FALSO208 = [{ type: 'text', content: 'Gastos:\n- Sellos, $208.000\n- Gestoría, $150.000' }]
    chk('un monto con 208 adentro no cuenta como auto', JSON.stringify(correr(true, FALSO208, LEAD)) === JSON.stringify(FALSO208))

    // Sin catálogo (columna vacía): no se mete.
    const $sinCat = () => ({ first: () => ({ json: { catalogo_precios: [] } }) })
    const rSin = new Function('centinela', 'messages', '$', src + '\nreturn messages;')(true, REAL.map((m) => Object.assign({}, m)), $sinCat)
    chk('sin catálogo no toca nada', JSON.stringify(rSin) === JSON.stringify(REAL))

    console.log(`  texto inventado con centinela: ${casos.length - fallas.filter((f) => f.startsWith('prueba offline 2')).length}/${casos.length}`)
    console.log(`  guion renderizado: "${r1[0] && r1[0].content}"`)
  } catch (e) {
    fallas.push(`el bloque nuevo NO COMPILA: ${e.message}`)
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
