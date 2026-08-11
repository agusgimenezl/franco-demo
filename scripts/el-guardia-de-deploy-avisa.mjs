// Prueba el guardia de deploy de `evals/run.mjs`. NO prueba una copia: extrae la función real del
// archivo y la ejecuta, así que si alguien la edita, esto corre sobre el texto editado.
//
// POR QUÉ EXISTE: el guardia sólo hace algo cuando alguien despliega en mitad de una tanda, o sea
// casi nunca. Un guardia que falla justo el día que hace falta es peor que no tenerlo, y no se
// puede probar en vivo sin desplegar a propósito. Por eso la lógica está separada y pura.
//
// EL CASO QUE ORIGINÓ ESTO (2026-08-10): tres deploys entraron con tandas corriendo. Cada vez hubo
// que reconstruir a mano qué corrida había caído de cada lado, cruzando `updatedAt` del workflow
// contra los timestamps de sesión en `mensajes_demo`.

import fs from 'node:fs'

const src = fs.readFileSync('evals/run.mjs', 'utf8')
const lines = src.split('\n')
const iC = lines.findIndex((l) => l.startsWith('const C = {'))
const iFn = lines.findIndex((l) => l.startsWith('function veredictoDeploy('))
if (iC === -1 || iFn === -1) {
  console.error('no encontré `const C` o `veredictoDeploy` en evals/run.mjs — ¿los renombraron?')
  process.exit(1)
}
let fin = iFn
let prof = 0
for (let k = iFn; k < lines.length; k++) {
  prof += (lines[k].match(/\{/g) || []).length - (lines[k].match(/\}/g) || []).length
  if (k > iFn && prof === 0) { fin = k; break }
}
const bloque = (nombre) => {
  const i = lines.findIndex((l) => l.startsWith(`function ${nombre}(`))
  if (i === -1) { console.error(`no encontré ${nombre} en evals/run.mjs`); process.exit(1) }
  let p = 0
  for (let k = i; k < lines.length; k++) {
    p += (lines[k].match(/\{/g) || []).length - (lines[k].match(/\}/g) || []).length
    if (k > i && p === 0) return lines.slice(i, k + 1).join('\n')
  }
  return lines.slice(i).join('\n')
}
const codigo = [
  lines[iC],
  lines.slice(iFn, fin + 1).join('\n'),
  bloque('esFallaDeRed'),
  bloque('veredictoRed'),
  'export { veredictoDeploy, esFallaDeRed, veredictoRed }',
].join('\n')
const { veredictoDeploy, esFallaDeRed, veredictoRed } = await import('data:text/javascript;base64,' + Buffer.from(codigo).toString('base64'))

const sinColor = (s) => s.replace(/\x1b\[[0-9;]*m/g, '')
const run = (id, v, ok, aCaballo = false) => ({
  id, sessionId: `sess-${id}-${v}`, failures: ok ? [] : ['x'], error: null,
  deploy: { antes: v, despues: aCaballo ? 'B' : v }, aCaballo,
})

let malos = 0
const t = (nombre, cond, detalle) => {
  if (!cond) { malos++; console.log(`  MAL  ${nombre}${detalle ? `\n        ${detalle}` : ''}`) }
  else console.log(`  ok   ${nombre}`)
}

// ── 1. Tanda limpia: una sola versión ────────────────────────────────────────────────────────
{
  const out = veredictoDeploy('A', 'A', [run('caso1', 'A', true), run('caso1', 'A', false)]).map(sinColor)
  t('tanda limpia -> dice OK y no alarma', out.length === 1 && /una sola versión/.test(out[0]), JSON.stringify(out))
}

// ── 2. El caso real del 2026-08-10: deploy en el medio, corridas partidas ────────────────────
{
  const results = [
    run('sin-presupuesto', 'A', false),   // pre-deploy, falló
    run('sin-presupuesto', 'A', false),   // pre-deploy, falló
    run('sin-presupuesto', 'B', true),    // post-deploy, pasó
  ]
  const out = veredictoDeploy('A', 'B', results).map(sinColor)
  const txt = out.join('\n')
  t('deploy en el medio -> alarma', /NO VALE COMO UNA SOLA/.test(txt), txt)
  t('muestra la versión inicial y la final', /al arrancar: A/.test(txt) && /al terminar: B/.test(txt))
  t('separa el antes y el después', /A {2}-> {2}0\/2 ok/.test(txt) && /B {2}-> {2}1\/1 ok/.test(txt), txt)
  t('dice qué hacer', /Repetir la tanda entera/.test(txt))
}

// ── 3. Corrida a caballo: no vale para ningún lado ───────────────────────────────────────────
{
  const results = [run('caso1', 'A', true), run('caso1', 'A', false, true), run('caso1', 'B', true)]
  const out = veredictoDeploy('A', 'B', results).map(sinColor)
  const txt = out.join('\n')
  t('marca la corrida a caballo', /1 corrida\(s\) a caballo/.test(txt), txt)
  t('la nombra con su sessionId', /sess-caso1-A/.test(txt))
  t('NO la cuenta en ninguna versión', /A {2}-> {2}1\/1 ok/.test(txt), txt)
}

// ── 4. Mismo timestamp al inicio y al final pero una corrida a caballo (deploy y rollback) ───
{
  const out = veredictoDeploy('A', 'A', [run('caso1', 'A', true, true)]).map(sinColor)
  t('deploy+rollback dentro de la tanda igual alarma', /NO VALE COMO UNA SOLA/.test(out.join('\n')), out.join('\n'))
}

// ── 5. Sin guardia (falta la key): no dice nada, no rompe ────────────────────────────────────
{
  t('sin versión inicial -> silencio', veredictoDeploy(null, 'A', [run('c', 'A', true)]).length === 0)
  t('sin versión final -> silencio', veredictoDeploy('A', null, [run('c', 'A', true)]).length === 0)
  t('sin results -> no explota', Array.isArray(veredictoDeploy('A', 'A', [])))
}

// ── EL OTRO GUARDIA: distinguir una falla de RED de un rojo de contenido ─────────────────────
// Los dos primeros mensajes son LITERALES de la caída de n8n del 2026-08-11.
console.log('')
const red = (id, err) => ({ id, sessionId: 's-' + id, failures: [], error: err, deploy: {}, aCaballo: false })
t('reconoce "fetch failed" (mensaje real de hoy)', esFallaDeRed('fetch failed'))
t('reconoce el timeout abortado (mensaje real de hoy)', esFallaDeRed('The operation was aborted due to timeout'))
t('reconoce ECONNREFUSED', esFallaDeRed('connect ECONNREFUSED 1.2.3.4:443'))
t('reconoce un 502 del proxy', esFallaDeRed('/webhook/franco-chat -> HTTP 502: bad gateway'))
t('reconoce socket hang up', esFallaDeRed('socket hang up'))
t('NO confunde un rojo de contenido', !esFallaDeRed('no matcheó /(?i)etios/'))
t('NO confunde un 404 de ruta mal', !esFallaDeRed('/webhook/x -> HTTP 404: not found'))
t('NO confunde una respuesta no-JSON', !esFallaDeRed('respuesta no-JSON: <html>'))
t('sin error -> no es falla de red', !esFallaDeRed(null))

{
  const out = veredictoRed([red('c1', 'fetch failed'), run('c2', 'A', true), run('c3', 'A', false)]).map(sinColor)
  const txt = out.join('\n')
  t('avisa cuántas murieron por red', /1 CORRIDA\(S\) MURIERON POR RED/.test(txt), txt)
  t('dice cuántas midieron de verdad', /midió de verdad 2 de 3/.test(txt), txt)
  t('no grita "no vale" si algo sí midió', !/NINGUNA corrida llegó/.test(txt))
}
{
  const out = veredictoRed([red('c1', 'fetch failed'), red('c2', 'The operation was aborted due to timeout')]).map(sinColor)
  t('si TODAS murieron, dice que la tanda no vale', /NINGUNA corrida llegó al servidor/.test(out.join('\n')))
}
t('tanda sana -> silencio', veredictoRed([run('c1', 'A', true)]).length === 0)

console.log(`\n${malos === 0 ? 'TODO OK' : malos + ' FALLA(S)'}`)
process.exit(malos ? 1 : 0)
