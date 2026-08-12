// Fusiona la corrida de los 3 casos nuevos del anticipo DENTRO de `evals/baseline-v133.json`.
//
// POR QUÉ, Y ES UN AGUJERO DE MÉTODO QUE ESTE EPISODIO DEJÓ A LA VISTA: la compuerta de pre-deploy
// exige que exista `evals/baseline-<produccion>.json` con al menos 2 casos, pero NO puede saber si
// esos casos son los que el candidato toca. `baseline-v133.json` tenía los 4 casos de derivación:
// habría aprobado v134 —que no toca ninguno de esos cuatro— con una línea de base que no contiene
// ni uno de los tres casos que v134 arregla. Exactamente lo que la compuerta existe para impedir.
//
// FUSIONAR ES LEGÍTIMO Y NO ES INVENTAR UNA MEDICIÓN: las dos corridas son sobre la MISMA versión
// viva (v133), con casos disjuntos. El archivo pasa a ser lo que siempre tuvo que ser — el "antes"
// completo de v133— y el "después" se compara contra él caso por caso.
//
// REVERSIBLE: baseline-v133.json está commiteado en d251c11 y sin modificar.

import fs from 'node:fs'

const BASE = 'evals/baseline-v133.json'
const NUEVO = 'evals/antes-guarda-anticipo.json'

const base = JSON.parse(fs.readFileSync(BASE, 'utf8'))
const nuevo = JSON.parse(fs.readFileSync(NUEVO, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ids = (a) => [...new Set(a.map((r) => r.id))]
const idsBase = ids(base)
const idsNuevo = ids(nuevo)

ok(base.length === 12, `baseline-v133 tenía que tener 12 entradas, tiene ${base.length}`)
ok(nuevo.length === 9, `la corrida nueva tenía que tener 9 entradas, tiene ${nuevo.length}`)

// Sin esto, fusionar pisaría una medición con otra y el "antes" quedaría contaminado.
const choque = idsNuevo.filter((i) => idsBase.includes(i))
ok(choque.length === 0, `hay casos en los dos archivos y se pisarían: ${choque.join(', ')}`)

// Los 3 casos nuevos TIENEN que estar en rojo en el "antes": si alguno estuviera verde, no habría
// bug que arreglar y v134 no tendría por qué existir.
for (const id of idsNuevo) {
  const corridas = nuevo.filter((r) => r.id === id)
  const verdes = corridas.filter((r) => !r.failures.length && !r.error).length
  ok(verdes < corridas.length, `"${id}" está ${verdes}/${corridas.length} en el ANTES: no falla, así que no es el bug`)
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

const fusion = [...base, ...nuevo]
fs.writeFileSync(BASE, JSON.stringify(fusion, null, 2) + '\n')

const releido = JSON.parse(fs.readFileSync(BASE, 'utf8'))
if (releido.length !== 21) {
  console.error(`ASERCIÓN FALLIDA: quedaron ${releido.length} entradas, tenían que ser 21`)
  process.exit(1)
}

console.log(`OK: ${BASE}`)
console.log(`  ${base.length} + ${nuevo.length} = ${releido.length} entradas · ${ids(releido).length} casos`)
for (const id of ids(releido)) {
  const c = releido.filter((r) => r.id === id)
  const v = c.filter((r) => !r.failures.length && !r.error).length
  console.log(`  ${v === c.length ? '✓' : v === 0 ? '✗' : '~'} ${id} ${v}/${c.length}`)
}
