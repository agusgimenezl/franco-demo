// ¿QUIÉN DICTA ESTA FRASE? — EL PRIMER PASO ANTES DE ARMAR CUALQUIER FIX DE LENGUAJE.
//
// POR QUÉ EXISTE (2026-08-12, y es la cuarta vez que pasa lo mismo): ante la captura del monto a
// financiar armé v145 asumiendo que Franco "no razonaba", y el bloque nuevo perdió 0/3. La respuesta
// del eval salió BYTE-IDÉNTICA a la captura porque las dos frases **las dictaba el workflow**: un
// guion textual bajo `# Financiación` que ordena decir "el auto tiene que valer al menos X" y
// después "dale. Y de anticipo, de cuánto pensás poner más o menos?". El fix correcto no era agregar
// un bloque: era ACOTAR ese guion.
//
// La trampa 7 de CLAUDE.md ya lo decía. Documentarla no alcanzó: hay que poder correrla.
//
// USO:  node scripts/quien-dicta-esta-frase.mjs "de cuánto pensás poner"
//       node scripts/quien-dicta-esta-frase.mjs "tiene que valer al menos" --wf v145
//
// SI IMPRIME ALGO, EL BUG NO ES DEL MODELO: es un guion. Reescribí o acotá ESE guion, no agregues
// una regla arriba — el ejemplo concreto le gana a la regla abstracta (trampa 6).
import fs from 'node:fs'
import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const frase = args.find((a) => !a.startsWith('--'))
if (!frase) { console.error('uso: node scripts/quien-dicta-esta-frase.mjs "<frase de la captura>"'); process.exit(1) }
const i = args.indexOf('--wf')
const archivo = i !== -1 ? `workflows/franco-n8n-${args[i + 1].replace(/^v?/, 'v')}.json`
  : `workflows/${/const PRODUCCION = '([^']+)'/.exec(fs.readFileSync('scripts/state-sync.mjs', 'utf8'))[1]}`

const wf = JSON.parse(fs.readFileSync(archivo, 'utf8'))
// Se normaliza igual que el chat: sin tildes, sin ¿¡, minúsculas. Una captura casi nunca se pega
// byte por byte, y buscar el string crudo fue lo que hizo dar por descartada la trampa 7 otras veces.
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿¡]/g, '')
const aguja = norm(frase)

let hits = 0
for (const n of wf.nodes) {
  // Se recorre TODO el nodo, no sólo el campo "esperable": el systemMessage, las descripciones de
  // las tools, el jsCode de Armar respuesta y los assignments de Config.
  for (const [campo, valor] of Object.entries(n.parameters ?? {})) {
    const textos = campo === 'options' || campo === 'assignments'
      ? Object.entries(valor ?? {}).flatMap(([k, v]) => (Array.isArray(v?.assignments) ? v.assignments.map((a) => [a.name, a.value]) : [[k, v]]))
      : [[campo, valor]]
    for (const [sub, v] of textos) {
      if (typeof v !== 'string') continue
      const h = norm(v)
      let p = h.indexOf(aguja)
      while (p !== -1) {
        hits++
        console.log(`\n▶ ${n.name} · ${campo}${sub && sub !== campo ? '.' + sub : ''}`)
        console.log('  …' + v.slice(Math.max(0, p - 160), p + aguja.length + 160).replace(/\s+/g, ' ') + '…')
        p = h.indexOf(aguja, p + 1)
      }
    }
  }
}

console.log(hits
  ? `\n${hits} coincidencia(s) en ${archivo}.\nEL BUG NO ES DEL MODELO: hay un guion que dicta esa frase.\nAcotá o reescribí ESE guion. Agregar una regla arriba pierde contra el ejemplo (trampa 6).`
  : `\nSin coincidencias en ${archivo}. La frase la escribe el modelo: ahí sí el fix es de prompt o de datos.`)
