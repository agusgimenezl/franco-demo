// v100 -> v101 · SI YA TE DIO EL NOMBRE, NO SE LO VOLVÉS A PEDIR
//
// EL BUG (captura de Agustina 2026-08-06, sesión REAL 00eb34ec-81fa-47c8-b06c-ae6bba3c7827). Ya le
// había dado el nombre y la derivación estaba cerrada. Al pedir "dale que un asesor me prepare la
// simulacion", Franco contesta "Perfecto, me dejás tu nombre y apellido para que un asesor te
// contacte y te prepare la simulación personalizada?".
//
// PRUEBA VINCULANTE, ejecución 12618, nodo `Leer lead (estado)`:
//   lead_nombre: "Agustina Gimenez Lascano" · lead_estado: "Requiere asesor" · ya_derivado: true
// EL DATO LLEGÓ PERFECTO Y FRANCO LO IGNORÓ. No es un problema de datos ni de SQL.
//
// ES LA TRAMPA 6, Y EN SU FORMA MÁS CRUDA. Un barrido sobre el systemMessage da **27 menciones**
// del nombre y **al menos 8 GUIONES TEXTUALES** distintos que dicen "me dejás tu nombre y
// apellido" (## Permuta, # Derivación, # Financiación, # Consignación, # Cotización de usados...).
// La excepción —'Si en "Lo que ya sabés de este cliente" YA figura su nombre, no se lo vuelvas a
// pedir'— existe, pero es UNA regla abstracta contra OCHO ejemplos concretos. El CLAUDE.md ya lo
// dice con tres casos medidos: el ejemplo le gana a la regla, y agregar una prohibición más arriba
// del guion no alcanzó NINGUNA de las tres veces. Lo que funcionó siempre fue REEMPLAZAR EL GUION.
//
// POR ESO EL FIX ES UNA FRASE RENDERIZADA, EN DOS LUGARES (el patrón de v97):
//   (A) una inyección arriba de todo, en `# Rol` —la primera sección, la que manda—, que cuando
//       hay nombre lo dice, PROHÍBE pedirlo, anula explícitamente los guiones de más abajo, y da
//       EL GUION DE REEMPLAZO con el nombre de pila ya puesto. Sin ese guion de reemplazo, la
//       regla nueva perdería contra los 8 ejemplos viejos: es la advertencia textual del CLAUDE.md.
//   (B) la oración débil de `# Financiación` —que es la sección donde ocurrió el bug— pasa a tener
//       su propio ejemplo concreto, en vez de decir sólo "confirmás lo anotado y cerrás".
//
// UN SOLO NODO: `Franco (AI Agent)` -> System Message. No toca SQL, ni Config, ni las tools.
//
// LO QUE YA SE MIDIÓ, Y ACOTA EL ALCANCE: una versión CORTA del caso (interés / financiar /
// anticipo / cuotas / nombre / gracias / pedido de simulación) da **3/3 VERDE sobre v99** — ahí
// Franco contesta "Perfecto Agustina, el asesor ya está al tanto". O sea que el bug NO es que
// ignore el nombre siempre: aparece con DISTANCIA y REAPERTURA del embudo (en la charla real hay 7
// turnos y un embudo nuevo entero en el medio). Por eso el caso de eval es la charla real completa
// (`charla-real-reapertura-con-usado`, 12 turnos) y no una versión corta que no reproduce.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v100.json'
const DESTINO = 'workflows/franco-n8n-v101.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage no arranca con "="')

// ─────────────────────────────────────────────── (A) arriba de todo, en # Rol
const ANCLA_ROL = '\n\n# Regla base: no inventar\n'
if (sm.split(ANCLA_ROL).length !== 2) throw new Error('no encontré (una sola vez) el arranque de # Regla base')

const INYECCION = `{{ (() => {
  const nom = String($('Leer lead (estado)').item.json.lead_nombre || '').trim();
  if (!nom) return '';
  const pila = nom.split(/\\s+/)[0];
  return '\\n# EL NOMBRE YA LO TENÉS\\nDATO YA CALCULADO DE ESTA CONVERSACIÓN, ES VERDAD Y NO SE DISCUTE: este cliente YA TE DIO SU NOMBRE Y APELLIDO, y es ' + nom + '. PROHIBIDO EN ESTE TURNO Y EN TODOS LOS QUE SIGAN, y es la regla que manda sobre cualquier otra y sobre CUALQUIER GUION DE MÁS ABAJO: pedirle el nombre, el apellido, "tus datos" o "cómo te llamás". Ya los tenés y volver a pedirlos le dice al cliente que no lo estuviste escuchando. MÁS ABAJO HAY VARIOS EJEMPLOS QUE LE PIDEN AL CLIENTE SU NOMBRE Y SU APELLIDO: NINGUNO DE ESOS CORRE EN ESTA CONVERSACIÓN, están escritos para un cliente anónimo y este no lo es. Cuando derives, confirmes la derivación o cierres, el guion es ESTE, con su nombre de pila adentro: "Perfecto ' + pila + ', le paso todo a un asesor así te contacta y te arma la simulación." Y al cliente le hablás siempre por el nombre de pila: ' + pila + '.\\n';
})() }}`

franco.parameters.options.systemMessage = sm.replace(ANCLA_ROL, () => '\n\n' + INYECCION + ANCLA_ROL)

// ─────────────────────────── (B) la oración débil de # Financiación, con ejemplo
const VIEJO_FIN = 'Si en "Lo que ya sabés de este cliente" YA figura su nombre, no se lo vuelvas a pedir: confirmás lo anotado y cerrás.'
const NUEVO_FIN = 'Si en "Lo que ya sabés de este cliente" YA figura su nombre, EL GUION DE ARRIBA NO CORRE: no le pidas el nombre ni el apellido, confirmás lo anotado usando su nombre de pila y cerrás. Guion para ese caso: "perfecto Martín, le dejo anotado al asesor la simulación con tu anticipo y las cuotas, y te contacta por acá. Necesitás algo más mientras tanto?".'

let smx = franco.parameters.options.systemMessage
if (smx.split(VIEJO_FIN).length !== 2) throw new Error('no encontré (una sola vez) la oración de # Financiación')
franco.parameters.options.systemMessage = smx.replace(VIEJO_FIN, () => NUEVO_FIN)

const smNuevo = franco.parameters.options.systemMessage

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Franco (AI Agent)']),
  `esperaba SOLO Franco (AI Agent); hay: ${JSON.stringify(distintos)}`)

ok(smNuevo.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
const fromAI = (o) => (JSON.stringify(o).match(/fromAI\(/g) || []).length
ok(fromAI(wf) === fromAI(antes), `cambió la cantidad de $fromAI: ${fromAI(antes)} -> ${fromAI(wf)}`)
ok(!smNuevo.includes(VIEJO_FIN), 'el texto viejo de # Financiación sigue ahí')
ok(smNuevo.split('# EL NOMBRE YA LO TENÉS').length === 2, 'la inyección nueva falta o está duplicada')
// La inyección tiene que ir ANTES de todos los guiones que anula.
ok(smNuevo.indexOf('# EL NOMBRE YA LO TENÉS') < smNuevo.indexOf('me dejás tu nombre y apellido'),
  'la inyección quedó DESPUÉS del primer guion de name-ask: no lo anula')
for (const frag of [
  'LOS MONTOS DE "PISOS DE STOCK" NO SON EL PRECIO DE NINGÚN AUTO',   // v96
  'OFRECER ALGO QUE NO EXISTE TAMBIÉN ES INVENTAR',                    // v97
  'TODAVÍA LE FALTAN',                                                 // v98/v99
  'acaba de decir que NO entrega ningún usado',                        // v100
]) ok(smNuevo.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)
// Los guiones de name-ask NO se borran: siguen siendo correctos para un cliente anónimo.
ok((smNuevo.match(/me dejás tu nombre y apellido/gi) || []).length ===
   (sm.match(/me dejás tu nombre y apellido/gi) || []).length,
  'se borró algún guion de name-ask: para un cliente SIN nombre siguen siendo los correctos')

// ── PRUEBA OFFLINE: la inyección compila, dispara sólo con nombre, y arma el guion.
{
  const i = smNuevo.indexOf('# EL NOMBRE YA LO TENÉS')
  const src = smNuevo.slice(smNuevo.lastIndexOf('{{', i) + 2, smNuevo.indexOf('})() }}', i) + 5)
  try {
    const f = new Function('$', `return (${src})`)
    const run = (lead_nombre) => f(() => ({ item: { json: { lead_nombre } } }))
    const con = run('Agustina Gimenez Lascano')
    ok(con.includes('Agustina Gimenez Lascano'), 'no trae el nombre completo')
    ok(/"Perfecto Agustina, le paso todo a un asesor así te contacta y te arma la simulación\."/.test(con),
      'el guion de reemplazo no quedó armado con el nombre de pila')
    ok(con.includes('NINGUNO DE ESOS CORRE EN ESTA CONVERSACIÓN'), 'no anula los guiones de abajo')
    ok(run('') === '', 'dispara sin nombre (un cliente anónimo SÍ tiene que dar el nombre)')
    ok(run('   ') === '', 'dispara con un nombre en blanco')
    ok(run(null) === '', 'dispara con nombre null')
    // un solo nombre de pila, sin apellido
    ok(run('Martín').includes('"Perfecto Martín,'), 'no arma el guion con un nombre de una sola palabra')
    console.log('  inyección: ' + con.split('\\n').find((l) => l.includes('Perfecto Agustina')).slice(0, 0) +
      con.slice(con.indexOf('"Perfecto Agustina'), con.indexOf('simulación."') + 12))
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
console.log('  nodos con diferencias: Franco (AI Agent)')
console.log(`  systemMessage: ${sm.length} -> ${smNuevo.length} chars`)
