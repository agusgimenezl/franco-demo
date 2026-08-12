// QUÉ CASOS DE EVAL ATRAVIESAN UN TURNO DONDE SE SUPRIMIRÍAN LOS PISOS DE STOCK.
//
// POR QUÉ EXISTE: v138 salió a producción y rompió `capacidad-de-compra-financiada` (2/3 -> 0/3),
// haciendo que Franco volviera a pedir datos del usado que el cliente ya había dado. El fix se
// había verificado contra 5 escenarios INVENTADOS por mí, no contra los casos que la suite ya
// ejercita. `capacidad-de-compra-financiada` estaba incluso en mi lista de controles —lo medí
// antes— y aun así no leí sus turnos.
//
// LA LECCIÓN: antes de suprimir un insumo del prompt, hay que saber QUIÉN lo consume. Eso no se
// adivina: se enumera. Este script enumera.
//
// CÓMO: recorre cases.json y marca los turnos donde el cliente declara PLATA o USADO sin pedir ver
// autos —que es la condición en la que v138 suprimía los pisos— y, para cada caso así, muestra qué
// checks POSTERIORES exigen precios, modelos o cantidades. Esos son los que se pueden romper.
//
// NO reemplaza a medir: reemplaza a adivinar a quién medir.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { cases } = JSON.parse(readFileSync(join(ROOT, 'evals', 'cases.json'), 'utf8'))

// Las mismas señales que mira Config, en versión aproximada: alcanza para enumerar candidatos.
const DECLARA_PLATA = /\b\d[\d.\s]*\s*(millones|millon|m|k|lucas|palos)?\b/i
const VERBO_PLATA = /(entrego|entregar|doy|dar|pongo|poner|adelanto|aporto|anticipo|seña|efectivo|financiar|presupuesto|tengo)/i
const DECLARA_USADO = /(entrego|entregar|para entregar|permut|parte de pago|mi (auto|coche|camioneta)|tengo (un|una)\s+\w+|usado)/i
const PIDE_VER = /(most(ra|rá)|mostrame|ver(la|lo|las|los)?\b|qué (autos|tenés|hay)|opciones que|pasame|mandame|dale.*most)/i

// Checks que dependen de tener números o nombres de autos a mano.
const CONSUME_STOCK = (check) => {
  const [tipo, arg] = check
  if (tipo === 'cards_min' || tipo === 'media_min' || tipo === 'first_car_in' || tipo === 'carroceria_solo_si_hay') return true
  if (tipo !== 'text_matches') return false
  const s = String(arg)
  return /\d{2}[\.\s]?\d{3}|millones|onix|208|ecosport|duster|corolla|renegade|hilux|s10|amarok|ranger|cronos|kangoo|etios|gol|fiesta|vento|t-?cross|50\s*%/i.test(s)
}

const enRiesgo = []

for (const c of cases) {
  const turnos = c.turns || []
  let idxSupresion = -1
  for (let i = 0; i < turnos.length; i++) {
    const say = String(turnos[i].say || '')
    if (PIDE_VER.test(say)) continue
    const plata = DECLARA_PLATA.test(say) && VERBO_PLATA.test(say)
    const usado = DECLARA_USADO.test(say)
    if (plata || usado) { idxSupresion = i; break }
  }
  if (idxSupresion === -1) continue

  // Checks del turno de la supresión EN ADELANTE: son los que quedarían sin el insumo.
  const expuestos = []
  for (let i = idxSupresion; i < turnos.length; i++) {
    for (const ch of turnos[i].checks || []) {
      if (CONSUME_STOCK(ch)) expuestos.push(`T${i + 1} ${ch[0]}: ${String(ch[1]).slice(0, 58)}`)
    }
  }
  if (expuestos.length) enRiesgo.push({ id: c.id, desde: idxSupresion + 1, expuestos })
}

enRiesgo.sort((a, b) => b.expuestos.length - a.expuestos.length)

console.log(`CASOS QUE ATRAVIESAN UN TURNO DE "DAR UN DATO" Y DESPUÉS EXIGEN STOCK: ${enRiesgo.length}\n`)
for (const r of enRiesgo) {
  console.log(`── ${r.id}  (la supresión empezaría en T${r.desde})`)
  for (const e of r.expuestos) console.log(`     ${e}`)
}
console.log(`\nTOTAL de checks expuestos: ${enRiesgo.reduce((a, r) => a + r.expuestos.length, 0)}`)
console.log('Estos son los casos que hay que medir ANTES de tocar el bloque de PISOS DE STOCK.')
