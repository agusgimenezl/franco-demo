// v145 -> v146 · EL GUION DEL MONTO A FINANCIAR NO CORRE SI EL CLIENTE YA ELIGIÓ UN AUTO
//
// POR QUÉ v145 DIO 0/3 AUNQUE EL BLOQUE NUEVO ESTABA BIEN: las dos frases del bug NO las inventa el
// modelo, LAS DICTA EL WORKFLOW. Bajo `# Financiación` hay un bloque que dispara con
// `monto_financiar > 0` y ordena, TEXTUAL, "Tené en cuenta que financiamos hasta el 50%... el auto
// tiene que valer al menos X" y después "dale. Y de anticipo, de cuánto pensás poner más o menos?".
// Mi bloque de v145 quedó ARRIBA y perdió contra un guion textual: trampa 6, y la causa se encontró
// por trampa 7 (grepear la frase contra el WORKFLOW ENTERO, no revisar un nodo).
//
// EL FIX: ese guion es correcto cuando NO se sabe qué auto quiere —ahí el piso es la única cuenta
// posible—, y es incorrecto cuando ya hay UN auto identificado con precio, porque entonces la
// cuenta ya está hecha y el anticipo es una resta. Se acota su condición. No se agrega ninguna
// prohibición arriba: se le saca el turno.
import fs from 'node:fs'
const wf = JSON.parse(fs.readFileSync('workflows/franco-n8n-v145.json', 'utf8'))
const antes = JSON.parse(fs.readFileSync('workflows/franco-n8n-v145.json', 'utf8'))
const fallas = []; const ok = (c, m) => { if (!c) fallas.push(m) }
const nodo = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
let sm = String(nodo.parameters.options.systemMessage)

const AUTO_ELEGIDO = `(() => { try { const l = $('Leer lead (estado)').item.json || {}; const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); const c = Array.isArray(l.catalogo_precios) ? l.catalogo_precios : []; let r = n(l.lead_vehiculo); const h = []; for (const a of c) { const t = n(a.t); if (t && r.includes(t)) { h.push(a); r = r.split(t).join(' '); } } return h.length === 1 && Number(h[0].p || 0) > 0; } catch (e) { return false; } })()`
const VIEJO = '{{ $node["Config"].json.monto_financiar > 0 ? \'DATO YA CALCULADO DE ESTE MENSAJE'
const NUEVO = '{{ ($node["Config"].json.monto_financiar > 0 && !' + AUTO_ELEGIDO + ') ? \'DATO YA CALCULADO DE ESTE MENSAJE'
ok(sm.split(VIEJO).length - 1 === 1, 'no encontré el guion del monto una sola vez')
sm = sm.replace(VIEJO, NUEVO)
nodo.parameters.options.systemMessage = sm
ok(!sm.includes(VIEJO), 'quedó la condición vieja')

// El detector, EJECUTADO con datos reales.
const fn = new Function('$', `return ${AUTO_ELEGIDO};`)
const run = (l) => fn(() => ({ item: { json: l } }))
const cat = [{ t: 'Toyota Etios', p: 14500000 }, { t: 'Chevrolet Onix', p: 21500000 }]
ok(run({ lead_vehiculo: 'Toyota Etios 2021', catalogo_precios: cat }) === true, 'no detecta el auto elegido')
ok(run({ lead_vehiculo: 'No mencionado', catalogo_precios: cat }) === false, 'detecta auto donde no hay')
ok(run({ lead_vehiculo: 'Toyota Etios y Chevrolet Onix', catalogo_precios: cat }) === false, 'con 2 autos tiene que dar false')
ok(run({}) === false, 'sin catálogo tiene que dar false')

ok(sm[0] === '=', 'perdió el "=" (trampa 1)')
ok((sm.match(/\{\{/g) || []).length === (String(antes.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage).match(/\{\{/g) || []).length, 'cambió la cantidad de bloques {{ }}')
ok(sm.includes('YA ESTÁ VERIFICADO QUE SE PUEDE'), 'se perdió el bloque de v145')
ok(sm.includes('La Amarok 2023 no la tengo'), 'se perdió el guion de v140')
const dif = wf.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name)
ok(dif.length === 1 && dif[0] === 'Franco (AI Agent)', `tocó ${dif.join(', ')}`)
ok(wf.nodes.length === 35, 'cambió la cantidad de nodos')
if (fallas.length) { console.error('ASERCIONES FALLIDAS:'); fallas.forEach((f) => console.error('  ✗ ' + f)); process.exit(1) }
fs.writeFileSync('workflows/franco-n8n-v146.json', JSON.stringify(wf, null, 2) + '\n')
console.log('OK: workflows/franco-n8n-v146.json · tocó: ' + dif.join(', '))
