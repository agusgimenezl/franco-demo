// QUÉ CASOS DE EVAL ATRAVIESAN UN TURNO DONDE EL CLIENTE NOMBRA UN MODELO CONCRETO.
//
// POR QUÉ EXISTE: el fix de `modelo-inexistente-se-avisa-y-se-ofrece` toca el guion de apertura de
// "## Paso 3 — Interés en un auto puntual", que es el que hoy manda arrancar por el porqué de
// `descripcion`. Ese guion lo consume TODO turno en que el cliente nombra un auto, no sólo el que
// nombra uno que no existe. Un guion nuevo mal acotado hace que Franco avise "no tenemos" de un
// auto que SÍ está: el mismo modo de falla que costó los reverts de v138 y v139, donde la
// superficie real era 16 casos y se habían medido 3.
//
// LA REGLA QUE APLICA: antes de tocar un insumo del prompt hay que saber quién lo consume, y eso
// se ENUMERA, no se estima.
//
// CÓMO: recorre cases.json y marca los turnos donde el cliente nombra un modelo del stock (o pide
// un auto puntual). Para cada caso así, lista los checks de ese turno en adelante que podrían
// leerse distinto si Franco abre avisando que algo no está.
//
// NO reemplaza a medir: reemplaza a adivinar a quién medir.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { cases } = JSON.parse(readFileSync(join(ROOT, 'evals', 'cases.json'), 'utf8'))

// Los 17 modelos del stock vivo (autos_disponibles). Si cambia el stock, cambia esta lista.
const MODELOS = /(fiesta|208|etios|gol\s*trend|\bgol\b|s10|s-10|ranger|hilux|amarok|onix|cronos|corolla|vento|ecosport|eco\s*sport|renegade|duster|t-?cross|kangoo)/i
// Pedidos de auto puntual sin nombrarlo por modelo del stock.
const PIDE_PUNTUAL = /(me interesa|contame de|contame del|qué onda|que onda|info de|detalle de|características de|caracteristicas de|estoy buscando|busco un)/i

// Checks que se pueden mover si la respuesta abre avisando que algo no está en stock.
const SENSIBLE = (check) => {
  const [tipo, arg] = check
  if (tipo === 'media_min' || tipo === 'cards_min' || tipo === 'first_car_in') return true
  if (tipo === 'text_not_contains') return true
  if (tipo !== 'text_matches') return false
  return /no (la |lo )?ten|no hay|no contamos|no dispon|\d{2}[.\s]?\d{3}|millones|20\d\d/i.test(String(arg))
}

const enRiesgo = []

for (const c of cases) {
  const turnos = c.turns || []
  let idx = -1
  for (let i = 0; i < turnos.length; i++) {
    const say = String(turnos[i].say || '')
    if (MODELOS.test(say) || PIDE_PUNTUAL.test(say)) { idx = i; break }
  }
  if (idx === -1) continue

  const expuestos = []
  for (let i = idx; i < turnos.length; i++) {
    for (const ch of turnos[i].checks || []) {
      if (SENSIBLE(ch)) expuestos.push(`T${i + 1} ${ch[0]}: ${String(ch[1]).slice(0, 58)}`)
    }
  }
  enRiesgo.push({ id: c.id, desde: idx + 1, say: String(turnos[idx].say || '').slice(0, 60), expuestos })
}

enRiesgo.sort((a, b) => b.expuestos.length - a.expuestos.length)

console.log(`CASOS QUE ATRAVIESAN UN TURNO DE "NOMBRAR UN AUTO PUNTUAL": ${enRiesgo.length}\n`)
for (const r of enRiesgo) {
  console.log(`── ${r.id}  (T${r.desde}: "${r.say}")`)
  for (const e of r.expuestos) console.log(`     ${e}`)
}
console.log(`\nTOTAL de checks expuestos: ${enRiesgo.reduce((a, r) => a + r.expuestos.length, 0)}`)
console.log('Estos son los casos que hay que medir ANTES de tocar el guion del detalle.')
