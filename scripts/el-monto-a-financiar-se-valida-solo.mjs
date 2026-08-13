// v144 -> v145 · EL MONTO A FINANCIAR SE VALIDA CONTRA EL AUTO ELEGIDO, EN CÓDIGO
//
// EL BUG (captura de Agustina 2026-08-12 11:48, caso `financiar-monto-se-valida-contra-el-auto-
// elegido`, reproducido 0/3): el cliente ya eligió el Etios ($14.500.000) y pregunta "me gustaría
// financiar 5 millones puede ser?". Franco le recita la regla —"para financiar $5.000.000 el auto
// tiene que valer al menos $10.000.000"— y cierra pidiéndole el anticipo.
//
// SON TRES SÍNTOMAS DE UN SOLO HECHO: tiene los dos datos y no los cruza. `Config` ya parsea
// `monto_financiar` y el precio del auto ya viaja en `catalogo_precios`. **La validación es una
// división por dos**, así que va a código: regla del proyecto. Por prompt volvería el yo-yo, porque
// compite contra el guion del embudo que le enseña a pedir el anticipo.
//
// Y EL ANTICIPO DEJA DE SER UNA PREGUNTA: con el auto y el monto fijados, es el precio menos lo que
// financia. Pedirlo es pedir un dato ya deducido.
//
// SE REUSA LA MAQUINARIA DE v134 (`catalogo_precios` + `lead_vehiculo` -> un solo auto con precio),
// que ya está medida. Bloque nuevo e independiente: si no hay monto declarado o el auto no es uno
// solo, devuelve '' y no cambia nada.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v144.json'
const DESTINO = 'workflows/franco-n8n-v145.json'
const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antesWf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const nodo = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
let sm = String(nodo.parameters.options.systemMessage)

const CUERPO = `(() => {
  // v145 · EL MONTO A FINANCIAR, CRUZADO CONTRA EL AUTO QUE EL CLIENTE YA ELIGIÓ.
  // Es una división por dos y los dos datos ya están acá: no se le pide al modelo que la haga, y
  // sobre todo no se le pide al CLIENTE que la haga (que es el bug de la captura del 11:48).
  const cfg = $node["Config"].json;
  let lead = {};
  try { lead = $('Leer lead (estado)').item.json || {}; } catch (e) { return ''; }
  const monto = Number(cfg.monto_financiar || 0) || Number(cfg.monto_financiar_hist || 0);
  if (!monto) return '';
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
  const cat = Array.isArray(lead.catalogo_precios) ? lead.catalogo_precios : [];
  let resto = norm(lead.lead_vehiculo);
  const hall = [];
  for (const a of cat) { const t = norm(a.t); if (t && resto.includes(t)) { hall.push(a); resto = resto.split(t).join(' '); } }
  // Con 0 autos no hay contra qué validar; con 2+ no se sabe cuál eligió. En los dos casos, silencio.
  if (hall.length !== 1) return '';
  const precio = Number(hall[0].p || 0);
  if (!precio) return '';
  const m = (n) => cfg.empresa_moneda_simbolo + String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
  const max = Math.round(precio / 2);
  const auto = String(hall[0].t || 'ese auto');
  if (monto <= max) {
    return 'DATO YA CALCULADO DE ESTA CONVERSACIÓN, ES VERDAD Y NO SE DISCUTE: el cliente eligió el ' + auto + ' (' + m(precio) + ') y quiere financiar ' + m(monto) + '. YA ESTÁ VERIFICADO QUE SE PUEDE: el máximo financiable de ese auto es ' + m(max) + '. PROHIBIDO EN ESTE TURNO, y manda sobre cualquier guion de más abajo: (a) explicarle la regla del 50% o decirle cuánto tendría que valer el auto —la cuenta ya está hecha, hacérsela hacer a él parece que no supieras cuánto vale el auto que vendés—; (b) preguntarle de cuánto pone de anticipo, porque con el auto y el monto ya fijados el anticipo NO es una pregunta: es ' + m(precio - monto) + ', la resta. El guion de este turno es: confirmar que se puede y pedir LAS CUOTAS. Textual: "Sí, se puede financiar ' + m(monto) + ' sin problema. En cuántas cuotas te gustaría financiarlo, 12, 24 o 36? Así le paso tu preferencia a un asesor para que te arme la simulación exacta." Si el cliente YA dio las cuotas, no se las vuelvas a pedir: confirmá y derivá.\\n';
  }
  return 'DATO YA CALCULADO DE ESTA CONVERSACIÓN, ES VERDAD Y NO SE DISCUTE: el cliente eligió el ' + auto + ' (' + m(precio) + ') y quiere financiar ' + m(monto) + ', pero de ese auto el máximo financiable es ' + m(max) + ' (financiamos hasta el 50%). Decíselo derecho y con el número YA CALCULADO, sin recalcular nada: "de ' + auto + ' puedo financiarte hasta ' + m(max) + '". Y ofrecele las dos salidas: bajar el monto a financiar, o mirar autos de más valor donde ' + m(monto) + ' sí entre. NO le pidas el anticipo en este turno.\\n';
})()`

const ANCLA = '\n# Financiación\n'
ok(sm.split(ANCLA).length - 1 === 1, 'no encontré "# Financiación" una sola vez')
sm = sm.replace(ANCLA, '\n{{ ' + CUERPO + ' }}\n# Financiación\n')
nodo.parameters.options.systemMessage = sm

// ── EL BLOQUE SE EJECUTA DE VERDAD, con los datos REALES del caso ─────────────────────────────
const fn = new Function('$node', '$', `return ${CUERPO};`)
const cfg = { monto_financiar: 5000000, empresa_moneda_simbolo: '$' }
const lead = { lead_vehiculo: 'Toyota Etios 2021', catalogo_precios: [{ t: 'Toyota Etios', p: 14500000 }] }
const ctx = (c, l) => [ { json: c }, { item: { json: l } } ]
const run = (c, l) => fn({ Config: { json: c } }, () => ({ item: { json: l } }))

const entra = run(cfg, lead)
ok(entra.includes('YA ESTÁ VERIFICADO QUE SE PUEDE'), 'el caso que SÍ entra no confirma')
ok(entra.includes('$7.250.000'), `no calculó el máximo financiable: ${entra.slice(0, 80)}`)
ok(entra.includes('$9.500.000'), 'no calculó el anticipo deducido (14.500.000 - 5.000.000)')
ok(entra.includes('En cuántas cuotas'), 'no quedó el guion textual de las cuotas')

// No entra: quiere financiar 10M de un auto de 14,5M (máximo 7,25M).
const noEntra = run({ ...cfg, monto_financiar: 10000000 }, lead)
ok(noEntra.includes('el máximo financiable es $7.250.000'), 'la rama de "no entra" no da el número')

// Silencio en los casos donde no hay nada que validar: es lo que lo hace seguro.
ok(run({ empresa_moneda_simbolo: '$' }, lead) === '', 'sin monto declarado tiene que devolver vacío')
ok(run(cfg, { lead_vehiculo: 'No mencionado', catalogo_precios: lead.catalogo_precios }) === '', 'sin auto identificado tiene que devolver vacío')
ok(run(cfg, { lead_vehiculo: 'Toyota Etios y Chevrolet Onix', catalogo_precios: [{ t: 'Toyota Etios', p: 14500000 }, { t: 'Chevrolet Onix', p: 21500000 }] }) === '', 'con 2 autos tiene que devolver vacío')
ok(run(cfg, {}) === '', 'sin catálogo tiene que devolver vacío')

// ── El guion nuevo pasa los checks del caso, y la respuesta del bug NO ─────────────────────────
const { cases } = JSON.parse(fs.readFileSync('evals/cases.json', 'utf8'))
const caso = cases.find((c) => c.id === 'financiar-monto-se-valida-contra-el-auto-elegido')
ok(!!caso, 'falta el caso en cases.json')
if (caso) {
  const esperada = 'Sí, se puede financiar $5.000.000 sin problema. En cuántas cuotas te gustaría financiarlo, 12, 24 o 36? Así le paso tu preferencia a un asesor.'
  for (const [tipo, arg] of caso.turns[1].checks) {
    if (tipo !== 'text_matches' && tipo !== 'text_not_matches') continue
    const re = new RegExp(String(arg).replace(/^\(\?i\)/, ''), 'i')
    ok(tipo === 'text_matches' ? re.test(esperada) : !re.test(esperada), `el guion que dicta el bloque NO pasa el check ${tipo}`)
  }
}

// ── Trampas e integridad ──────────────────────────────────────────────────────────────────────
ok(sm[0] === '=', 'el systemMessage perdió el "=" (trampa 1)')
const antesSm = String(antesWf.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage)
ok((sm.match(/\{\{/g) || []).length === (antesSm.match(/\{\{/g) || []).length + 1, 'no quedó exactamente 1 bloque {{ }} nuevo')
ok(!/\{\{|\}\}/.test(CUERPO), 'el cuerpo mete llaves de expresión donde no van')
const distintos = wf.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(antesWf.nodes[i])).map((n) => n.name)
ok(distintos.length === 1 && distintos[0] === 'Franco (AI Agent)', `tocó ${distintos.length} nodos (${distintos.join(', ')})`)
ok(wf.nodes.length === 35, `quedaron ${wf.nodes.length} nodos`)
ok(sm.includes('La Amarok 2023 no la tengo'), 'se perdió el guion de v140')
ok(sm.includes('PISOS DE STOCK'), 'se perdió PISOS DE STOCK')

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}
fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO} · tocó: ${distintos.join(', ')}`)
console.log('  bloque EJECUTADO: entra -> confirma + cuotas · no entra -> da el máximo · 4 escenarios devuelven vacío')
