#!/usr/bin/env node
// TB-3: el encabezado del abanico de permuta lo compone CÓDIGO (mata el eco de los datos del usado, que el
// prompt no lograba matar del todo). Constraint de Agustina: NO inventar un usado/anticipo/efectivo que el
// cliente no dio — el encabezado se arma SOLO con lo que realmente hay.
// Base: franco-n8n-v62.json. (2026-07-24)
//
//   node scripts/tb3-encabezado-abanico-por-codigo.mjs [--check]
//
// EL BUG: en el encabezado del abanico Franco recita los datos que el cliente acaba de dar ("teniendo en cuenta
//   tu Yaris 2020 con 65.000 km..."). El anti-eco por prompt (v50/v51) llega a ~50-80% (whack-a-mole).
//
// EL FIX (regla del proyecto → determinístico, como el guard de cierre de Armar respuesta / trampa 7):
//   (A) Listar stock echoa 3 flags constantes: eco_permuta (tiene_permuta), eco_financia (con_financiacion),
//       eco_presu (precio_objetivo>0). Así Armar respuesta sabe el contexto sin adivinar.
//   (B) Armar respuesta, cuando hay abanico (autos>=3) Y Listar stock corrió como capacidad/permuta, REEMPLAZA
//       el encabezado (texto antes de la primera viñeta de la lista) por uno fijo compuesto SOLO con lo que hay:
//       - permuta → "tu usado como parte de pago"
//       - presupuesto>0 → "tu anticipo" (financiación) / "tu efectivo" (contado)
//       - financiación → "la posibilidad de financiar"
//       Nunca menciona algo que no esté flageado → no inventa. La lista de autos (de Franco) se conserva.
//       Conservador: solo reemplaza si hay lista con viñetas; si no, no toca (evita mangear el mensaje).
// NO toca: el guion del embudo, el dedup, el resto. Verificación: sim de composición + log post-paste.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v62.json')
const OUT = join(ROOT, 'franco-n8n-v63.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) } }
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const nodo = (n) => { const x = wf.nodes.find((k) => k.name === n); assert(x, `no existe "${n}"`); return x }

const TP = "{{ $fromAI('tiene_permuta', 'Poner 1 si el cliente dijo que entrega un auto usado en parte de pago, 0 si no.', 'number') }}"
const CF = "{{ $fromAI('con_financiacion', 'Poner 1 si el cliente va a financiar, dio un anticipo, o pregunto por cuotas/financiacion. 0 si paga al contado o no lo menciono.', 'number') }}"
const PO = "{{ $fromAI('precio_objetivo', 'El techo de presupuesto real del cliente en pesos, sin estirar. Poner 0 si no dio presupuesto.', 'number') }}"

// ── (A) Listar stock: echo de flags en el SELECT final
{
  const ls = nodo('Listar stock')
  let q = ls.parameters.query
  const OLD = 'combustible, consumo, categoria, tramo, tamano\nFROM ('
  const NEW = `combustible, consumo, categoria, tramo, tamano,\n       ${TP} AS eco_permuta, ${CF} AS eco_financia, (CASE WHEN ${PO} > 0 THEN 1 ELSE 0 END) AS eco_presu\nFROM (`
  unaVez(q, OLD, 'Listar stock (SELECT final)')
  assert(!q.includes('eco_permuta'), 'ya está el echo — ¿ya se aplicó?')
  q = q.replace(OLD, NEW)
  ls.parameters.query = q
}

// ── (B) Armar respuesta: encabezado del abanico por código
{
  const n = nodo('Armar respuesta')
  let code = n.parameters.jsCode
  const ANCHOR = '  const anchor = messages.length - 1;'
  unaVez(code, ANCHOR, 'Armar respuesta (const anchor)')
  const INS = [
    '  // TB-3: encabezado del abanico de permuta por CÓDIGO (mata el eco de los datos del usado). Solo cuando',
    '  // Listar stock corrió como capacidad/permuta (mira sus flags). Compone SOLO con lo que hay: nunca inventa',
    '  // un usado, un anticipo ni un efectivo que el cliente no dio.',
    '  try {',
    '    if (autos.length >= 3) {',
    "      const ls = $('Listar stock').first().json;",
    '      const permuta = Number(ls.eco_permuta) === 1;',
    '      const financia = Number(ls.eco_financia) === 1;',
    '      const presu = Number(ls.eco_presu) === 1;',
    '      if (permuta || financia) {',
    '        const partes = [];',
    "        if (permuta) partes.push('tu usado como parte de pago');",
    "        if (presu) partes.push(financia ? 'tu anticipo' : 'tu efectivo');",
    "        if (financia) partes.push('la posibilidad de financiar');",
    '        if (partes.length) {',
    "          const unir = partes.length === 1 ? partes[0] : partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1];",
    "          const encabezado = 'Con ' + unir + ', estas opciones te pueden servir:';",
    "          const m0 = String(messages[0].content || '');",
    '          const iLista = m0.search(/\\n\\s*[-•]/);',
    '          if (iLista > 0) messages[0] = Object.assign({}, messages[0], { content: encabezado + m0.slice(iLista) });',
    '        }',
    '      }',
    '    }',
    '  } catch (e) {}',
    ANCHOR,
  ].join('\n')
  code = code.replace(ANCHOR, INS)
  n.parameters.jsCode = code
}

// ── post-condiciones
const q = nodo('Listar stock').parameters.query
assert(q.includes(`${TP} AS eco_permuta`) && q.includes(`${CF} AS eco_financia`) && q.includes('AS eco_presu'), 'no quedó el echo de flags')
assert(q.includes('WITH usado_val AS (') && q.includes("THEN 'estirar'"), 'se rompió Listar stock')
assert((q.match(/\(/g) || []).length === (q.match(/\)/g) || []).length, 'parens desbalanceados en Listar stock')
const code = nodo('Armar respuesta').parameters.jsCode
assert(code.includes("$('Listar stock').first().json") && code.includes('eco_permuta'), 'no quedó la lectura de flags')
assert(code.includes("const encabezado = 'Con ' + unir"), 'no quedó la composición del encabezado')
assert(code.includes('cardsMostradas'), 'se perdió el dedup TB-1')
assert(code.includes('Guard de cierre comercial') || code.includes("!texto.includes('?')"), 'se tocó el guard de cierre')
try { new Function(code); } catch (e) { assert(false, 'jsCode con error de sintaxis: ' + e.message) }

// trampa 3
{
  const porKey = new Map()
  for (const nn of wf.nodes) {
    for (const mm of String(nn.parameters?.query ?? '').matchAll(/\$fromAI\('([^']+)',\s*'([^']*)',\s*'([^']+)'\)/g)) {
      const [, key, desc, tipo] = mm
      const firma = `${desc}||${tipo}`
      if (porKey.has(key)) assert(porKey.get(key) === firma, `trampa 3: la key '${key}' tiene firmas distintas`)
      else porKey.set(key, firma)
    }
  }
}

// ── SIM de composición del encabezado (no inventa)
{
  const compo = (permuta, financia, presu) => {
    if (!(permuta || financia)) return null
    const partes = []
    if (permuta) partes.push('tu usado como parte de pago')
    if (presu) partes.push(financia ? 'tu anticipo' : 'tu efectivo')
    if (financia) partes.push('la posibilidad de financiar')
    if (!partes.length) return null
    const unir = partes.length === 1 ? partes[0] : partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1]
    return 'Con ' + unir + ', estas opciones te pueden servir:'
  }
  assert(compo(1, 0, 1) === 'Con tu usado como parte de pago y tu efectivo, estas opciones te pueden servir:', 'sim: contado+permuta')
  assert(compo(1, 1, 1) === 'Con tu usado como parte de pago, tu anticipo y la posibilidad de financiar, estas opciones te pueden servir:', 'sim: financiación+permuta')
  assert(compo(0, 1, 1) === 'Con tu anticipo y la posibilidad de financiar, estas opciones te pueden servir:', 'sim: financiación sin permuta')
  // no inventa: sin presupuesto flageado, no menciona efectivo/anticipo
  assert(compo(1, 0, 0) === 'Con tu usado como parte de pago, estas opciones te pueden servir:', 'sim: permuta sin presupuesto → no inventa efectivo')
  // catálogo general (sin permuta ni financiación) → no compone (deja el header de Franco)
  assert(compo(0, 0, 0) === null, 'sim: catálogo general → no toca el header')
  console.log('  SIM encabezado: contado/financia/sin-permuta OK · NO inventa efectivo sin presupuesto · catálogo general intacto  ✓')
}

console.log('✓ todas las aserciones pasan')
console.log('  (A) Listar stock: echo de eco_permuta/eco_financia/eco_presu')
console.log('  (B) Armar respuesta: encabezado del abanico por código (solo lo que hay, no inventa)')

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
