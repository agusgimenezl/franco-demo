// QUÉ CASOS DE EVAL PASAN POR `Listar stock` Y POR CUÁL DE SUS DOS CAMINOS.
//
// POR QUÉ EXISTE: el fix del fallback le pone `defaultValue` a los 5 `usado_*` y a
// `con_financiacion`, y mete la validación perdida en la SQL (una fila centinela cuando hay permuta
// pero faltan marca/modelo/año del usado). Los dos caminos se miden distinto:
//   · CAMINO A — presupuesto SIN usado: hoy revienta con "did not match expected schema". Es el bug.
//   · CAMINO B — permuta: hoy anda porque los `required` FUERZAN al modelo a juntar los datos. Es
//     exactamente lo que v139 rompió al ponerles default sin poner nada en su lugar
//     (`capacidad-de-compra-financiada` cayó a 2/9).
//
// La lección de v138/v139: los controles se ENUMERAN, no se estiman. Medir 3 de 16 costó un revert.
//
// NO reemplaza a medir: reemplaza a adivinar a quién medir.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { cases } = JSON.parse(readFileSync(join(ROOT, 'evals', 'cases.json'), 'utf8'))

// Señales de que el turno declara PLATA (lo que hace que el modelo llame a Listar stock con capital).
const PLATA = /(\d+\s*(millones|millon|m\b|palos|lucas))|(\$\s*\d)|presupuesto|anticipo|financi|cuotas|tengo\s+\d/i
// Señales de que hay un USADO en juego (camino B).
const USADO = /(entrego|entregar|para entregar|permut|parte de pago|mi (auto|coche|camioneta|fiat|ford|toyota|chevrolet|renault|peugeot|volkswagen)|tengo (un|una)\s+\w+\s+\d{4}|usado|lo cambio|cambiar mi)/i
// Señales de que pide VER autos (sin esto los gates de la query devuelven cero filas a propósito).
const PIDE_VER = /(most(ra|rá|rame)|ver(la|lo|las|los)?\b|qué (autos|ten[eé]s|hay)|que ten[eé]s|opciones|disponible|stock|busco|quiero un|quiero comprar)/i

const A = [] // presupuesto sin usado
const B = [] // permuta

for (const c of cases) {
  const turnos = c.turns || []
  let hayUsado = false
  for (let i = 0; i < turnos.length; i++) {
    const say = String(turnos[i].say || '')
    if (USADO.test(say)) hayUsado = true
    if (!PLATA.test(say) && !PIDE_VER.test(say)) continue
    if (!PLATA.test(say)) continue
    const fila = { id: c.id, turno: i + 1, say: say.slice(0, 58) }
    if (hayUsado) { if (!B.some((x) => x.id === c.id)) B.push(fila) }
    else if (!A.some((x) => x.id === c.id)) A.push(fila)
  }
}

console.log(`CAMINO A — plata SIN usado (lo que hoy revienta): ${A.length} casos`)
for (const r of A) console.log(`  T${r.turno} ${r.id.padEnd(46)} «${r.say}»`)
console.log(`\nCAMINO B — permuta (lo que v139 rompió y hay que proteger): ${B.length} casos`)
for (const r of B) console.log(`  T${r.turno} ${r.id.padEnd(46)} «${r.say}»`)
console.log('\nEstos son los que hay que medir ANTES de tocar los required de Listar stock.')
console.log('Los del CAMINO B son los que la fila centinela puede mover: son los NO negociables.')
