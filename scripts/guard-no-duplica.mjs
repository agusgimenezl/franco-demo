#!/usr/bin/env node
// El guard de cierre deja de duplicar preguntas y de ofrecer un asesor ya aceptado
// (2026-07-22). Sólo toca `Armar respuesta`: cero cambios de prompt.
//
//   node scripts/guard-no-duplica.mjs            # escribe franco-n8n-v31.json
//   node scripts/guard-no-duplica.mjs --check    # solo valida
//
// ─────────────────────────────────────────────────────────────────────────────
// (A) EL PREDICADO: "contiene ?" en vez de "termina en ?"
//
// Medido en v30, `no-repreguntar-asesor` t2 — dos preguntas de asesor en el mismo turno:
//     | Te interesa que te prepare un asesor una simulación...? Así podés verlo más claro.
//     | Querés que un asesor te prepare una cotización, o preferís...?   <- ESTA la pone el guard
// La burbuja de Franco YA preguntaba, pero terminaba en "." (una frase de cortesía después
// del "?"), así que `endsWith('?')` daba false y el guard pegó otra encima.
//
// REPLAY OFFLINE sobre 6 corridas guardadas (baseline-v15/v18/v23 + v26/v28/v30), sin gastar
// cuota — 15 disparos del guard en total:
//     · seguiría disparando:  12   (la última burbuja no tiene ningún "?")
//     · dejaría de disparar:   3   y en LOS TRES Franco ya había preguntado
// O sea: el piso que el guard garantiza (una lista de autos nunca queda sin próximo paso) se
// conserva entero, y sólo desaparece la duplicación.
//
// OJO — ESTE ES EL SEGUNDO INTENTO. En v27 probé "ALGUNA burbuja tiene ?" y hubo que
// revertirlo: el saludo ("Hola! Soy Franco... Cómo estás?") tiene un "?", así que el
// predicado daba true en casi todo primer turno y desactivaba el guard. El replay lo cazó
// antes de medir en vivo. Por eso acá se mira SÓLO la última burbuja.
//
// ─────────────────────────────────────────────────────────────────────────────
// (B) NO OFRECER UN ASESOR YA ACEPTADO
//
// La variante del guard para 1-2 autos es "Querés que un asesor te prepare una cotización...".
// Si el lead ya está en "Requiere asesor", eso es volver a preguntar algo que el cliente ya
// contestó — el bug de las capturas 3-5. `Armar respuesta` corre después de
// `Leer lead (estado)` en la misma ejecución, así que puede consultarlo.
// Va con try/catch: si algo falla al leerlo, se usa el texto de siempre. Este nodo es el que
// arma la respuesta al usuario y no puede romperse por un guard.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'franco-n8n-v30.json')
const OUT = join(ROOT, 'franco-n8n-v31.json')
const checkOnly = process.argv.includes('--check')

const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASERCIÓN FALLIDA: ${msg}`); process.exit(1) }
}
const unaVez = (txt, aguja, dónde) => {
  const n = txt.split(aguja).length - 1
  assert(n === 1, `${dónde}: el ancla aparece ${n} veces, esperaba 1`)
}

const wf = JSON.parse(readFileSync(SRC, 'utf8'))
const armar = wf.nodes.find((n) => n.name === 'Armar respuesta')
assert(armar, 'no existe "Armar respuesta"')

let js = armar.parameters.jsCode
const antes = js
assert(!js.includes('hayPregunta'), 'quedó el predicado de v27, que fue revertido')
assert(!js.includes('yaDerivado'), '¿ya se aplicó este cambio?')

// ── (A) el predicado
const VIEJO_COND = `if (autos.length >= 1 && !texto.endsWith('?')) {`
unaVez(js, VIEJO_COND, 'condición del guard')
js = js.replace(
  VIEJO_COND,
  `// Alcanza con que la última burbuja CONTENGA una pregunta: Franco a veces cierra con una\n` +
    `  // frase de cortesía después del "?", y con endsWith() el guard le pegaba otra encima.\n` +
    `  // Verificado por replay sobre 15 disparos guardados: 12 siguen disparando, y los 3 que\n` +
    `  // no, ya tenían pregunta propia. NO usar "alguna burbuja": el saludo tiene "?" y\n` +
    `  // desactivaría el guard casi siempre (se probó en v27 y se revirtió).\n` +
    `  if (autos.length >= 1 && !texto.includes('?')) {`,
)

// ── (B) no ofrecer un asesor ya aceptado
const VIEJO_CIERRE =
  `    const cierre = product_cards.length >= 3\n` +
  `      ? 'Buscás algo puntual o querés que te ayude a encontrar el ideal según lo que necesitás?'\n` +
  `      : 'Querés que un asesor te prepare una cotización, o preferís que te muestre algo parecido?';`
unaVez(js, VIEJO_CIERRE, 'textos de cierre del guard')

const NUEVO_CIERRE =
  `    // Si el lead ya pidió que lo contacte un asesor, ofrecérselo otra vez es el bug de las\n` +
  `    // capturas 3-5. Se lee el estado que ya trae "Leer lead (estado)" en esta ejecución.\n` +
  `    // try/catch a propósito: este nodo arma la respuesta al usuario y no puede romperse\n` +
  `    // por el guard; ante cualquier duda, el texto de siempre.\n` +
  `    let yaDerivado = false;\n` +
  `    try { yaDerivado = $('Leer lead (estado)').first().json.lead_estado === 'Requiere asesor'; } catch (e) {}\n` +
  `    const cierre = product_cards.length >= 3\n` +
  `      ? 'Buscás algo puntual o querés que te ayude a encontrar el ideal según lo que necesitás?'\n` +
  `      : yaDerivado\n` +
  `        ? 'Cuál te llama la atención?'\n` +
  `        : 'Querés que un asesor te prepare una cotización, o preferís que te muestre algo parecido?';`

js = js.replace(VIEJO_CIERRE, NUEVO_CIERRE)

// ── post-condiciones
assert(js !== antes, 'no se aplicó ningún cambio')
assert(js.includes("!texto.includes('?')"), 'no quedó el predicado nuevo')
assert(!js.includes("!texto.endsWith('?')"), 'quedó la condición vieja')
assert((js.match(/yaDerivado/g) || []).length === 3, 'yaDerivado debe declararse, asignarse y usarse')
assert(js.includes("try {") && js.includes("catch (e) {}"), 'falta el try/catch defensivo')
assert(js.includes("$('Leer lead (estado)')"), 'no se lee el estado del lead')
// Lo que el guard tiene que seguir haciendo, intacto.
assert(js.includes("product_cards.length >= 3"), 'se perdió la variante por cantidad de cards')
assert(js.includes("Buscás algo puntual"), 'se perdió el cierre de 3+ cards')
assert(js.includes("replace(/[¿¡]/g, '')"), 'se perdió el strip de signos de apertura')
assert(js.includes('yaMostrados'), 'se perdió el filtro de fotos ya mostradas')
assert(js.includes('const texto ='), 'se perdió la variable texto')
// Ningún otro nodo cambia.
const orig = JSON.parse(readFileSync(SRC, 'utf8'))
for (const n of wf.nodes) {
  if (n.name === 'Armar respuesta') continue
  const o = orig.nodes.find((k) => k.name === n.name)
  assert(JSON.stringify(n.parameters) === JSON.stringify(o.parameters), `se tocó ${n.name} sin querer`)
}

armar.parameters.jsCode = js

console.log('✓ todas las aserciones pasan')
console.log('  (A) el guard mira si la última burbuja CONTIENE "?" — replay: 12/15 siguen disparando')
console.log('  (B) si el lead ya está en "Requiere asesor", no vuelve a ofrecerlo')
console.log('  sólo cambia "Armar respuesta"; el prompt no se toca')

if (checkOnly) console.log('\n(--check: no se escribió nada)')
else { writeFileSync(OUT, JSON.stringify(wf, null, 2)); console.log(`\n escrito -> ${OUT}`) }
