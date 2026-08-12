// Centinela `no_url_en_texto` en ALWAYS + el caso que lo reproduce.
//
// EL BUG (captura de Agustina, 2026-08-12, sobre v134): al pedir fotos del Volkswagen Vento,
// Franco manda las fotos por el canal `images` —bien— y ADEMÁS pega las tres URLs crudas de
// Supabase como texto de una burbuja. El cliente ve tres links kilométricos en el chat. En una
// demo que se muestra a dueños de concesionaria, eso se lee como un producto roto.
//
// POR QUÉ VA EN ALWAYS Y NO EN UN CASO: no es un bug de un caso puntual, es algo que NUNCA tiene
// que pasar en ninguna respuesta. Mismo criterio que `no_template_leak` y `no_fallback_bubble`.
//
// MEDIDO CONTRA EL CORPUS ANTES DE ESCRIBIRLO, como se hizo con `no_vocabulario_interno` y
// `no_nombre_inventado`: de 13.366 burbujas de Franco en 2.881 sesiones, sólo 6 tienen una URL en
// el texto, y las 6 son ESTE bug (fotos pegadas como texto). **0 falsos positivos.** La más
// reciente es la captura de hoy.
//
// EL CHECK MIRA `allText(r)`, QUE ES SÓLO EL CONTENIDO DE LAS BURBUJAS — no el JSON entero. Es la
// distinción que lo hace seguro: en `images` y en `product_cards` las URLs son legítimas y tienen
// su propio check (`photo_urls_canonical`). Si mirara el JSON completo, daría rojo siempre.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RUN = join(ROOT, 'evals', 'run.mjs')
const CASES = join(ROOT, 'evals', 'cases.json')

let run = readFileSync(RUN, 'utf8')
const una = (s, t) => s.split(t).length === 2

// run.mjs está guardado con CRLF: los anclas multilínea escritos con \n no matchean nada y el
// script aborta sin tocar el archivo (pasó al primer intento). Se normaliza para editar y se
// restaura el estilo original al escribir, para no ensuciar el diff con 985 líneas cambiadas.
const EOL = run.includes('\r\n') ? '\r\n' : '\n'
run = run.replace(/\r\n/g, '\n')

// ── 1) EL CHECK, insertado justo antes de `text_not_matches` (o sea, después de no_template_leak) ──
const ANCLA = '  text_not_matches: (r, pattern) => {'
if (!una(run, ANCLA)) throw new Error(`el ancla tiene que estar 1 vez; está ${run.split(ANCLA).length - 1}`)
if (run.includes('no_url_en_texto')) throw new Error('el check no_url_en_texto YA EXISTE')

const CHECK = `
  // Una URL cruda pegada en el TEXTO de una burbuja. Las fotos viajan por \`images\`, que es otro
  // canal: si además se escriben como texto, el cliente ve tres links kilométricos de Supabase.
  // Capturado por Agustina el 2026-08-12 pidiendo fotos del Vento, sobre v134.
  // MEDIDO CONTRA EL CORPUS: 6 burbujas de 13.366 en 2.881 sesiones, y las 6 son este bug —
  // 0 falsos positivos. Mira allText (sólo el contenido de las burbujas) y NO el JSON entero:
  // en \`images\` y \`product_cards\` las URLs son legítimas y las cubre photo_urls_canonical.
  // Corre en TODOS los turnos.
  no_url_en_texto: (r) => {
    const hits = [...allText(r).matchAll(/https?:\\/\\/\\S+/g)].map((m) => m[0])
    return hits.length === 0 ? null : \`se filtró una URL al texto de la burbuja: \${hits.slice(0, 2).join(' | ')}\`
  },
`
// El ancla es la línea de `text_not_matches`, así que el check se inserta ANTES de ella: queda
// justo después de no_template_leak, que es donde va por afinidad.
run = run.replace(ANCLA, CHECK.trim() + '\n\n' + ANCLA)

// ── 2) A ALWAYS ──────────────────────────────────────────────────────────────────────────────
const ALWAYS_VIEJO = `const ALWAYS = ['no_template_leak', 'no_fallback_bubble', 'media_si_lista_autos',
  'no_inventa_autos', 'no_filtra_centinela', 'no_vocabulario_interno', 'no_nombre_inventado']`
if (!una(run, ALWAYS_VIEJO)) throw new Error('no encontré el array ALWAYS tal cual')
run = run.replace(
  ALWAYS_VIEJO,
  `const ALWAYS = ['no_template_leak', 'no_fallback_bubble', 'media_si_lista_autos',
  'no_inventa_autos', 'no_filtra_centinela', 'no_vocabulario_interno', 'no_nombre_inventado',
  'no_url_en_texto']`,
)

// ── 3) EL CHECK SE EJECUTA ACÁ, contra la burbuja REAL del bug y contra respuestas sanas ─────
// El check vive dentro del objeto CHECKS de run.mjs, así que para probarlo se lo reimplementa
// idéntico. Si alguien cambia el de run.mjs y no éste, el assert de abajo deja de representarlo:
// por eso además se verifica que el texto del check quedó en el archivo.
const allText = (r) => (r.messages || []).map((m) => m?.content || '').join('\n')
const noUrl = (r) => {
  const hits = [...allText(r).matchAll(/https?:\/\/\S+/g)].map((m) => m[0])
  return hits.length === 0 ? null : `se filtró una URL al texto de la burbuja: ${hits.slice(0, 2).join(' | ')}`
}

const laDeLaCaptura = {
  messages: [
    { type: 'text', content: 'El Volkswagen Vento 2023 es un sedán mediano, color blanco, con 24.000 km.' },
    {
      type: 'text',
      content:
        'Las fotos que tenemos del Volkswagen Vento son estas, incluyen vistas generales y de la carrocería:\n- https://qfmsdgjtlduravrtqrif.supabase.co/storage/v1/object/public/fotos-vehiculos-stock/foto-6-1.webp\n- https://qfmsdgjtlduravrtqrif.supabase.co/storage/v1/object/public/fotos-vehiculos-stock/foto-6-2.webp',
    },
  ],
  images: [{ url: 'https://qfmsdgjtlduravrtqrif.supabase.co/storage/v1/object/public/fotos-vehiculos-stock/foto-6-1.webp' }],
}
// La MISMA respuesta pero sana: las fotos sólo por `images`. No tiene que dar rojo aunque el
// canal de imágenes esté lleno de URLs — es la distinción que hace seguro al check.
const sana = {
  messages: [
    { type: 'text', content: 'El Volkswagen Vento 2023 es un sedán mediano, color blanco, con 24.000 km.' },
    { type: 'text', content: 'Te paso las fotos que tenemos. Querés que te conecte con un asesor?' },
  ],
  images: [
    { url: 'https://qfmsdgjtlduravrtqrif.supabase.co/storage/v1/object/public/fotos-vehiculos-stock/foto-6-1.webp' },
    { url: 'https://qfmsdgjtlduravrtqrif.supabase.co/storage/v1/object/public/fotos-vehiculos-stock/foto-6-2.webp' },
  ],
  product_cards: [{ foto_principal: 'https://qfmsdgjtlduravrtqrif.supabase.co/storage/v1/object/public/fotos-vehiculos-stock/foto-6-1.webp' }],
}

if (noUrl(laDeLaCaptura) === null) throw new Error('el check NO caza la respuesta real del bug')
if (noUrl(sana) !== null) throw new Error(`el check da rojo con una respuesta sana: ${noUrl(sana)}`)
if (!run.includes('no_url_en_texto: (r) => {')) throw new Error('el check no quedó escrito en run.mjs')
if (!run.includes("'no_url_en_texto']")) throw new Error('el check no quedó en ALWAYS')

// Se restaura el estilo de fin de línea original: sin esto el diff serían 985 líneas cambiadas.
writeFileSync(RUN, run.split('\n').join(EOL), 'utf8')

// ── 4) EL CASO QUE LO REPRODUCE ──────────────────────────────────────────────────────────────
const doc = JSON.parse(readFileSync(CASES, 'utf8'))
const antes = doc.cases.length
if (doc.cases.some((c) => c.id === 'fotos-sin-urls-en-el-texto')) throw new Error('el caso YA EXISTE')

doc.cases.push({
  id: 'fotos-sin-urls-en-el-texto',
  bug:
    'CAPTURA DE AGUSTINA 2026-08-12 sobre v134. Al pedir fotos del Volkswagen Vento, Franco las manda por el canal ' +
    '`images` —bien— y ADEMÁS pega las tres URLs crudas de Supabase como texto de una burbuja: el cliente ve tres ' +
    'links kilométricos. El check que lo caza es `no_url_en_texto`, que corre en ALWAYS porque esto no tiene que ' +
    'pasar en ninguna respuesta, no sólo en ésta. Medido contra el corpus: 6 burbujas de 13.366 lo tienen y las 6 ' +
    'son este bug. Este caso existe para ejercitarlo a propósito, porque pedir fotos es lo que lo dispara.',
  turns: [
    {
      say: 'El volkswagen vento tiene algún detalle? Me compartirías fotos por dentro y fuera del mismo?',
      checks: [
        ['media_min', 1],
        [
          'manual',
          'Las fotos van por el canal de imágenes, NUNCA como URLs escritas en el texto. Franco puede decir que le ' +
            'pasa las fotos y aclarar que las del interior las facilita un asesor, pero sin pegar un solo link.',
        ],
      ],
    },
  ],
})

writeFileSync(CASES, JSON.stringify(doc, null, 2) + '\n', 'utf8')
const releido = JSON.parse(readFileSync(CASES, 'utf8'))
if (releido.cases.length !== antes + 1) throw new Error(`quedaron ${releido.cases.length} casos`)

console.log('✓ check no_url_en_texto agregado a CHECKS y a ALWAYS')
console.log('✓ caza la respuesta real de la captura y NO da rojo con una sana llena de URLs en images')
console.log(`✓ casos ${antes} → ${releido.cases.length}`)
console.log('  + fotos-sin-urls-en-el-texto')
