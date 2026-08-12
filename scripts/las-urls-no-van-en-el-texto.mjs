// v136 -> v137 · LAS URLs DE LAS FOTOS NO VAN EN EL TEXTO DE LAS BURBUJAS
//
// EL BUG (captura de Agustina 2026-08-12): al pedir fotos del Vento, Franco las manda por el canal
// `images` —bien— y ADEMÁS pega las tres URLs crudas de Supabase como texto. El cliente ve tres
// links kilométricos en el chat.
//
// FRECUENCIA, MEDIDA: el centinela `no_url_en_texto` (agregado hoy a ALWAYS) disparó en **3 de los
// 5 casos** de una misma tanda sobre v135, en casos que no tienen nada que ver entre sí. El conteo
// histórico del corpus (6 burbujas de 13.486) subestimaba el problema porque el bug depende de que
// se hable de fotos, no de la cantidad de turnos. Es el bug más reproducible de todos los de hoy.
//
// POR QUÉ VA EN CÓDIGO Y NO EN EL PROMPT: que un texto no lleve URLs es verificable con un regex.
// Es la regla del proyecto — lo determinístico va a código. Además ya se intentó por prompt en su
// momento y el modelo las sigue escribiendo cuando la tool le devuelve el campo `fotos`.
//
// EL CUIDADO QUE TIENE EL FIX, Y ES LO QUE LO HACE SEGURO: si la burbuja NO tiene links, el texto
// se devuelve intacto, byte por byte. Cero efecto sobre el 99% de las respuestas. Sólo cuando hay
// un link se limpia, y ahí además se barren los restos que deja el borrado: la viñeta huérfana de
// la lista y los dos puntos colgando al final ("...y de la carrocería:").
//
// Y SI LA BURBUJA ERA SÓLO LINKS, SE ELIMINA ENTERA: en el corpus hay un caso así (id 14546, tres
// URLs y nada más). Dejarla vacía sería peor que dejarla como estaba.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v136.json'
const DESTINO = 'workflows/franco-n8n-v137.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const nodo = wf.nodes.find((n) => n.name === 'Armar respuesta')
ok(!!nodo, 'no está el nodo "Armar respuesta"')

const VIEJO = `  msgs = msgs.map(m => Object.assign({}, m, {
    content: String(m.content || '').replace(/[¿¡]/g, ''),
  }));`

const NUEVO = `  // v137 · LAS URLs NO VAN EN EL TEXTO. Las fotos viajan por \`images\`, que es otro canal: si
  // además se escriben como texto, el cliente ve tres links kilométricos de Supabase. Medido: el
  // centinela no_url_en_texto disparó en 3 de 5 casos de una misma tanda sobre v135.
  // SI LA BURBUJA NO TIENE LINKS, EL TEXTO VUELVE INTACTO: cero efecto sobre el resto.
  const sinUrls = (t) => {
    const s = String(t || '');
    if (!/https?:\\/\\//.test(s)) return s;
    return s
      .replace(/https?:\\/\\/\\S+/g, '')
      .replace(/^[\\s\\-–—*·]+$/gm, '')
      .replace(/[ \\t]+$/gm, '')
      .replace(/\\n{2,}/g, '\\n')
      .trim()
      .replace(/[:\\-–—,]\\s*$/, '.');
  };
  msgs = msgs
    .map(m => Object.assign({}, m, {
      content: sinUrls(m.content).replace(/[¿¡]/g, ''),
    }))
    // Si la burbuja era SOLO links, queda sin nada que decir y se va (pasó: burbuja 14546 del
    // corpus, tres URLs y ni una palabra). Dejarla vacía sería peor que dejarla como estaba.
    .filter(m => /[a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]/.test(String(m.content || '')));`

const codigoAntes = String(nodo.parameters.jsCode)
const veces = codigoAntes.split(VIEJO).length - 1
ok(veces === 1, `el bloque del strip de ¿¡ tenía que estar 1 vez; está ${veces}`)

if (veces === 1) {
  nodo.parameters.jsCode = codigoAntes.split(VIEJO).join(NUEVO)
  ok(!String(nodo.parameters.jsCode).includes(VIEJO), 'quedó el bloque viejo')
}

// ── LA FUNCIÓN, EJECUTADA DE VERDAD contra la burbuja REAL del bug y contra texto sano ───────
// Se extrae del código nuevo y se corre: no alcanza con que el string esté (lección de v122).
const codigo = String(nodo.parameters.jsCode)
const ini = codigo.indexOf('const sinUrls = (t) => {')
const fin = codigo.indexOf('};', ini) + 2
ok(ini !== -1 && fin > ini, 'no pude aislar sinUrls para evaluarlo')
let sinUrls
try {
  sinUrls = new Function(`${codigo.slice(ini, fin)}; return sinUrls;`)()
} catch (e) {
  fallas.push(`sinUrls no evalúa: ${e.message}`)
}

if (sinUrls) {
  // 1) La burbuja REAL de la captura del Vento.
  const real =
    'Las fotos que tenemos del Volkswagen Vento son estas, incluyen vistas generales y de la carrocería:\n' +
    '- https://qfmsdgjtlduravrtqrif.supabase.co/storage/v1/object/public/fotos-vehiculos-stock/foto-6-1.webp\n' +
    '- https://qfmsdgjtlduravrtqrif.supabase.co/storage/v1/object/public/fotos-vehiculos-stock/foto-6-2.webp\n' +
    '- https://qfmsdgjtlduravrtqrif.supabase.co/storage/v1/object/public/fotos-vehiculos-stock/foto-6-3.webp'
  const limpio = sinUrls(real)
  ok(!/https?:\/\//.test(limpio), `quedó una URL: ${JSON.stringify(limpio.slice(0, 80))}`)
  ok(limpio.includes('vistas generales y de la carrocería'), 'se comió el texto útil de la burbuja')
  ok(!/[-–—*·]\s*$/.test(limpio) && !/:\s*$/.test(limpio), `quedaron restos de la lista: ${JSON.stringify(limpio.slice(-30))}`)
  ok(!/\n\s*\n/.test(limpio), 'quedaron líneas vacías')

  // 2) TEXTO SANO: tiene que volver IDÉNTICO, byte por byte. Es la garantía de no-regresión.
  const sanos = [
    'El Volkswagen Vento 2023 es un sedán mediano, color blanco, con 24.000 km.',
    'Te paso las fotos que tenemos:',
    'Perfecto. En cuántas cuotas lo pensabas, 12, 24, 36 o 48?',
    'Mirá todo lo que tenemos ahora:\n- Ford Ranger 2024 — 18.000 km — $57.000.000 (4x4)\n- Toyota Etios 2021 — 45.000 km — $14.500.000',
    '',
  ]
  for (const s of sanos) ok(sinUrls(s) === s, `un texto sin links cambió: ${JSON.stringify(s.slice(0, 40))} -> ${JSON.stringify(sinUrls(s).slice(0, 40))}`)

  // 3) La burbuja que era SÓLO links (corpus id 14546) queda sin letras -> el filter la elimina.
  const soloLinks =
    'https://qfmsdgjtlduravrtqrif.supabase.co/storage/v1/object/public/fotos-vehiculos-stock/foto-8-1.webp ' +
    'https://qfmsdgjtlduravrtqrif.supabase.co/storage/v1/object/public/fotos-vehiculos-stock/foto-8-2.webp'
  ok(!/[a-zA-Z0-9]/.test(sinUrls(soloLinks)), `la burbuja de sólo links no quedó vacía: ${JSON.stringify(sinUrls(soloLinks))}`)
}

// ── Nada más se movió ────────────────────────────────────────────────────────────────────────
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const distintos = wf.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name)
ok(distintos.length === 1 && distintos[0] === 'Armar respuesta', `tocó ${distintos.length} nodos (${distintos.join(', ')})`)
ok(wf.nodes.length === 35, `quedaron ${wf.nodes.length} nodos, tenían que ser 35`)
// El strip de ¿¡ (invariante del proyecto) sigue estando.
ok(String(nodo.parameters.jsCode).includes("replace(/[¿¡]/g, '')"), 'se perdió el strip de ¿/¡')
// Y el guard de cierre y el fallback siguen intactos.
ok(String(nodo.parameters.jsCode).includes('Uy, se me trabó el sistema un segundo'), 'se perdió el fallback')
ok(String(nodo.parameters.jsCode).includes('Querés que un asesor te prepare una cotización'), 'se perdió el guard de cierre')

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  nodos: ${wf.nodes.length} · con diferencias: ${distintos.join(', ')}`)
console.log('  sinUrls ejecutado: limpia la burbuja real del Vento, deja 5 textos sanos IDÉNTICOS')
console.log('  y vacía la burbuja que era sólo links, para que el filter la elimine')
