// v126 -> v127 · EL CORRECTOR DE PRECIOS NO PISA EL ANTICIPO
//
// v126 FUNCIONA. Este bug está AGUAS ABAJO y es la trampa 7 en estado puro: antes de culpar al
// prompt (o al fix nuevo), fijate si la frase la escribe el código.
//
// PRUEBA VINCULANTE — los DOS nodos de la MISMA ejecución `15225` (sesión `b035fc81`):
//   `Detalle auto`      -> anticipo_minimo: "$10.500.000"        (v126 anda)
//   `Franco (AI Agent)` -> "el anticipo mínimo que necesitas es $10.500.000"   (el modelo anda)
//   lo que recibió el cliente (mensajes_demo) -> "... es $21.000.000"           (el código lo pisó)
// Difieren, así que no lo escribió el modelo. Medido 3 de 3 en el caso `anticipo-minimo-es-la-mitad`.
//
// QUIÉN LO PISA: el corrector de precios de v105 en `Armar respuesta`. Busca, en CADA RENGLÓN que
// nombre un auto del catálogo, cualquier monto, y si no coincide con el precio de ese auto lo
// REEMPLAZA por el precio. El renglón "Para el Peugeot 208 2025, el anticipo mínimo que necesitas
// es $10.500.000" tiene el nombre y un monto distinto de $21.000.000 -> lo reescribe.
//
// EL COMENTARIO DEL PROPIO NODO YA ANTICIPABA ESTO Y SE QUEDÓ CORTO: dice "Acotado al MISMO RENGLÓN
// a propósito: un '$5.000.000 de anticipo' en otro párrafo no se toca". Se protegió por PÁRRAFO,
// no por SIGNIFICADO. Cuando el anticipo cae en el mismo renglón que el auto, lo pisa igual.
//
// EL FIX — DOS GUARDAS, LAS DOS SÓLO PUEDEN DEJAR DE CORREGIR, NUNCA CORREGIR DE MÁS:
//   (1) SEMÁNTICA: si justo antes del monto dice anticipo / entrega / seña / cuota / mínimo /
//       financiás, ese monto NO es el precio del auto y no se toca.
//   (2) ARITMÉTICA: si el monto es exactamente la mitad del precio, es el anticipo mínimo por
//       definición. No depende del idioma ni de cómo lo redacte el modelo.
// Van las dos porque cubren cosas distintas: la (2) salva el caso aunque el modelo lo escriba raro,
// y la (1) salva las cuotas y las señas, que no son la mitad de nada.
//
// EL SESGO ES DELIBERADO, igual que en v116: pasarse de prudente deja pasar un precio inventado
// (que el eval caza con `no_inventa_autos`); quedarse corto le miente al cliente sobre cuánta plata
// necesita, que es peor y no lo caza nadie.
//
// LO QUE EL CORRECTOR TIENE QUE SEGUIR HACIENDO, y está asserteado con los casos REALES de v105:
//   "Jeep Renegade 2019 — $24.500.000" (real $25.500.000) -> se corrige
//   "Gol Trend 2022 — $17.000.000"     (real $9.200.000)  -> se corrige
//   "EcoSport 2020 — $27.000.000"      (real $19.800.000) -> se corrige

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v126.json'
const DESTINO = 'workflows/franco-n8n-v127.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ar = wf.nodes.find((n) => n.name === 'Armar respuesta')
const jsAntes = ar.parameters.jsCode

const VIEJO = `          const re = new RegExp('([^\\\\n]*\\\\b' + _esc(a.t) + '\\\\b[^\\\\n]*?)\\\\$\\\\s?([0-9][0-9.]{6,})', 'gi');
          c = c.replace(re, (todo, previo, monto) => {
            const n = parseInt(String(monto).replace(/\\./g, ''), 10);
            if (!Number.isFinite(n) || n === Number(a.p)) return todo;
            return previo + _fmt(a.p);
          });`

const NUEVO = `          const re = new RegExp('([^\\\\n]*\\\\b' + _esc(a.t) + '\\\\b[^\\\\n]*?)\\\\$\\\\s?([0-9][0-9.]{6,})', 'gi');
          c = c.replace(re, (todo, previo, monto) => {
            const n = parseInt(String(monto).replace(/\\./g, ''), 10);
            if (!Number.isFinite(n) || n === Number(a.p)) return todo;
            // v127 · NO TODO MONTO EN EL RENGLÓN ES EL PRECIO DEL AUTO. El corrector pisaba el
            // anticipo mínimo: en la ejecución 15225 el modelo escribió "el anticipo mínimo que
            // necesitas es $10.500.000" y al cliente le llegó "$21.000.000". Los dos guards sólo
            // pueden DEJAR de corregir, nunca corregir de más.
            // (1) SEMÁNTICA: lo que viene justo antes dice que ese monto no es el precio.
            if (/(anticipo|entrega|se[ñn]a|cuota|m[íi]nimo|financi\\w*|aportar|poner)[^$]{0,40}$/i.test(previo)) return todo;
            // (2) ARITMÉTICA: la mitad exacta del precio ES el anticipo mínimo, por definición.
            if (n === Math.floor(Number(a.p) / 2)) return todo;
            return previo + _fmt(a.p);
          });`

ok(jsAntes.split(VIEJO).length === 2, `no encontré (1 vez) el corrector de precios; hay ${jsAntes.split(VIEJO).length - 1}`)
const js = jsAntes.replace(VIEJO, () => NUEVO)
ar.parameters.jsCode = js

// ── Aserciones ──────────────────────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Armar respuesta']),
  `esperaba SÓLO Armar respuesta; hay: ${JSON.stringify(distintos)}`)
const sm = wf.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage
ok(sm.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok(js.split('v127 · NO TODO MONTO').length === 2, 'el guard no quedó exactamente 1 vez')
// El corrector de AÑO (v109) es hermano de éste y NO se toca.
ok(js.includes('EL AÑO TAMBIÉN LO PONE LA BASE (v109)'), 'se perdió el corrector de año')

// ── El corrector, ejecutado de verdad sobre textos reales ───────────────────────────────────
// Se reconstruye la misma lógica que quedó en el nodo y se prueba en las dos direcciones.
const _cat = [
  { t: 'Peugeot 208', p: 21000000 }, { t: 'Jeep Renegade', p: 25500000 },
  { t: 'Gol Trend', p: 9200000 }, { t: 'EcoSport', p: 19800000 },
  { t: 'Toyota Corolla', p: 24800000 },
]
const _fmt = (n) => '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const corregir = (texto) => {
  let c = texto
  for (const a of _cat) {
    const re = new RegExp('([^\\n]*\\b' + _esc(a.t) + '\\b[^\\n]*?)\\$\\s?([0-9][0-9.]{6,})', 'gi')
    c = c.replace(re, (todo, previo, monto) => {
      const n = parseInt(String(monto).replace(/\./g, ''), 10)
      if (!Number.isFinite(n) || n === Number(a.p)) return todo
      if (/(anticipo|entrega|se[ñn]a|cuota|m[íi]nimo|financi\w*|aportar|poner)[^$]{0,40}$/i.test(previo)) return todo
      if (n === Math.floor(Number(a.p) / 2)) return todo
      return previo + _fmt(a.p)
    })
  }
  return c
}

const casos = [
  // LO QUE ESTE FIX ARREGLA — texto REAL de la ejecución 15225
  ['el anticipo mínimo no se pisa (texto real de 15225)',
    'Para el Peugeot 208 2025, el anticipo mínimo que necesitas es $10.500.000. Esto porque se puede financiar hasta el 50%.',
    'Para el Peugeot 208 2025, el anticipo mínimo que necesitas es $10.500.000. Esto porque se puede financiar hasta el 50%.'],
  ['la otra redacción medida tampoco se pisa',
    'Para el Peugeot 208 2025 necesitás un anticipo mínimo de $10.500.000, que es la mitad del precio.',
    'Para el Peugeot 208 2025 necesitás un anticipo mínimo de $10.500.000, que es la mitad del precio.'],
  ['una cuota en el mismo renglón tampoco se pisa',
    'El Toyota Corolla te quedaría en cuotas de $1.200.000 por mes.',
    'El Toyota Corolla te quedaría en cuotas de $1.200.000 por mes.'],
  ['una seña tampoco',
    'Podés reservar el Jeep Renegade con una seña de $1.000.000.',
    'Podés reservar el Jeep Renegade con una seña de $1.000.000.'],
  // LO QUE TIENE QUE SEGUIR CORRIGIENDO — los tres casos REALES que motivaron v105
  ['sigue corrigiendo el Renegade inventado (caso real de v105)',
    '- Jeep Renegade 2019 — 42.000 km — $24.500.000',
    '- Jeep Renegade 2019 — 42.000 km — $25.500.000'],
  ['sigue corrigiendo el Gol Trend inventado (caso real de v105)',
    '- Gol Trend 2022 — 30.000 km — $17.000.000',
    '- Gol Trend 2022 — 30.000 km — $9.200.000'],
  ['sigue corrigiendo la EcoSport inventada (caso real de v105)',
    '- EcoSport 2020 — 55.000 km — $27.000.000',
    '- EcoSport 2020 — 55.000 km — $19.800.000'],
  ['un precio correcto se deja igual',
    '- Peugeot 208 2025 — 8.000 km — $21.000.000',
    '- Peugeot 208 2025 — 8.000 km — $21.000.000'],
  ['un monto en OTRO renglón sigue sin tocarse',
    '- Peugeot 208 2025 — $21.000.000\nCon $5.000.000 de anticipo te entra.',
    '- Peugeot 208 2025 — $21.000.000\nCon $5.000.000 de anticipo te entra.'],
  // el borde de la guarda aritmética
  ['la mitad exacta se respeta aunque no diga "anticipo"',
    'El Peugeot 208 2025 con $10.500.000 ya te lo llevás financiando el resto.',
    'El Peugeot 208 2025 con $10.500.000 ya te lo llevás financiando el resto.'],
]
let malos = 0
for (const [n, entra, esp] of casos) {
  const got = corregir(entra)
  if (got !== esp) { malos++; fallas.push(`corrector · ${n}\n        dio:      ${got}\n        esperaba: ${esp}`) }
}
console.log(`  el corrector de precios: ${casos.length - malos}/${casos.length}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Armar respuesta')
console.log(`  jsCode: ${jsAntes.length} -> ${js.length} chars`)
