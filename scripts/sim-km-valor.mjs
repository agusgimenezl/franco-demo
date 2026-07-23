#!/usr/bin/env node
// Espejo offline FIEL del km_factor de Valuar usado (v46) — prueba determinística de "el 2".
//   node scripts/sim-km-valor.mjs
//
// SQL de Valuar usado (v46):
//   valor = round( base_2020
//                  * power(0.93, GREATEST(LEAST(2020 - anio, 20), -5))          -- age_factor
//                  * (CASE WHEN km <= 0 THEN 1                                   -- km_factor
//                          ELSE LEAST(1, GREATEST(0.65,
//                                 power(0.88, (km - 15000*GREATEST(year_now - anio,0)) / 50000.0))) END)
//                )::bigint
// Penaliza el exceso de km sobre el esperado para la edad (15k/año), no premia el bajo km (techo 1.0).
// Con km=0 (Franco no lo pidió) → factor 1.0 → idéntico a v45.

const ANIO_ACTUAL = new Date().getFullYear() // el SQL usa EXTRACT(YEAR FROM CURRENT_DATE)

// valores_usados_referencia (valor_ref_2020) — Ford Ka
const KA_2020 = 12696000

const ageFactor = (anio) => Math.pow(0.93, Math.max(Math.min(2020 - anio, 20), -5))
const kmFactor = (anio, km) => {
  if (km <= 0) return 1
  const esperado = 15000 * Math.max(ANIO_ACTUAL - anio, 0)
  return Math.min(1, Math.max(0.65, Math.pow(0.88, (km - esperado) / 50000)))
}
const valuarUsado = (base, anio, km) => Math.round(base * ageFactor(anio) * kmFactor(anio, km))

// stock (modelo, precio) para el abanico
const STOCK = [
  ['Ranger', 57000000], ['S10', 39500000], ['Hilux', 38000000], ['T-Cross', 34000000],
  ['Amarok', 32000000], ['Vento', 31000000], ['Renegade', 25500000], ['Corolla', 24800000],
  ['Duster', 22500000], ['Onix', 21500000], ['208', 21000000], ['EcoSport', 19800000],
  ['Kangoo', 18500000], ['Cronos', 16800000], ['Etios', 12500000], ['Gol Trend', 9200000],
  ['Fiesta', 8200000],
]
// tramos de Listar stock: CB = anticipo + usado*0.70; techo = CB*2; 'fuera' >techo lo FILTRA el SQL v45
const abanico = (anticipo, usado) => {
  const CB = anticipo + usado * 0.70, techo = CB * 2
  const r = { CB, techo, entrada: [], intermedio: [], alto: [], fuera: [] }
  for (const [m, p] of STOCK) {
    r[p > techo ? 'fuera' : p <= CB * 1.2 ? 'entrada' : p <= CB * 1.5 ? 'intermedio' : 'alto'].push(m)
  }
  return r
}

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-AR')
const linea = (label, anticipo, usado) => {
  const a = abanico(anticipo, usado)
  console.log(`\n${label}`)
  console.log(`  usado=${fmt(usado)}  CB=${fmt(a.CB)}  techo=${fmt(a.techo)}`)
  console.log(`  entrada: ${a.entrada.join(', ')}`)
  console.log(`  intermedio: ${a.intermedio.join(', ')}`)
  console.log(`  alto: ${a.alto.join(', ')}`)
  console.log(`  FILTRADOS (fuera): ${a.fuera.join(', ')}`)
}

console.log(`año_actual=${ANIO_ACTUAL} · km_esperado Ka 2015 = ${(15000 * (ANIO_ACTUAL - 2015)).toLocaleString('es-AR')} km`)
const ANTICIPO = 7000000
linea('Ka 2015, sin km (v45 / km=0 en v46)  → valor pleno', ANTICIPO, valuarUsado(KA_2020, 2015, 0))
linea('Ka 2015, 100.000 km (bien cuidado)   → factor 1.0 (bajo esperado)', ANTICIPO, valuarUsado(KA_2020, 2015, 100000))
linea('Ka 2015, 250.000 km (muy rodado)     → CAE Corolla/Renegade', ANTICIPO, valuarUsado(KA_2020, 2015, 250000))

console.log('\n=== factor de km (Ka 2015) ===')
for (const km of [0, 100000, 165000, 200000, 250000, 300000, 400000]) {
  console.log(`  ${String(km).padStart(6)} km → factor ${kmFactor(2015, km).toFixed(3)} → valor ${fmt(valuarUsado(KA_2020, 2015, km))}`)
}
