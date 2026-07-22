#!/usr/bin/env node
// Runner de evals de Franco. Sin dependencias: Node 18+ (fetch nativo).
//
//   FRANCO_URL=https://n8n.utopiaflow.tech FRANCO_TOKEN=xxx node evals/run.mjs
//   node evals/run.mjs --case saludo-solo,stock-general-completo
//   node evals/run.mjs --no-cleanup      (deja las sesiones en la base para inspeccionar)
//   node evals/run.mjs --json out.json   (guarda el detalle completo)
//
// Cada caso corre sobre un session_id nuevo y al final se borra, así los evals
// no ensucian el CRM de la demo.

import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE = (process.env.FRANCO_URL || '').replace(/\/$/, '')
const TOKEN = process.env.FRANCO_TOKEN || ''
const TIMEOUT_MS = 90_000

const argv = process.argv.slice(2)
const arg = (name) => {
  const i = argv.indexOf(name)
  return i === -1 ? null : argv[i + 1]
}
const only = arg('--case')?.split(',').map((s) => s.trim())
// Repite cada caso N veces. Para medir flakiness: un caso que pasa 4/5 no está "ok",
// está fallando el 20% de las veces y hay que verlo como tal.
const repeat = Math.max(1, parseInt(arg('--repeat') || '1', 10))
// Pausa entre casos. El bloque CRM corre async DESPUÉS de responder al webhook, así que
// sin pausa las ejecuciones se apilan y compiten por conexiones de Postgres. Si la suite
// pasa con --delay y falla sin él, el problema es contención, no lógica.
const delay = Math.max(0, parseInt(arg('--delay') || '0', 10))
const cleanup = !argv.includes('--no-cleanup')
const jsonOut = arg('--json')

if (!BASE) {
  console.error('Falta FRANCO_URL (ej: https://n8n.utopiaflow.tech)')
  process.exit(2)
}

const C = { red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', dim: '\x1b[2m', off: '\x1b[0m' }

// Los 17 modelos del stock. Se usa para razonar sobre qué autos nombró Franco en el texto.
const CATALOGO = ['Ranger', 'S10', 'Hilux', 'Amarok', 'T-Cross', 'Vento', 'Renegade',
  'Corolla', 'Onix', 'EcoSport', 'Duster', 'Kangoo', '208', 'Cronos', 'Etios',
  'Gol Trend', 'Fiesta']

const PHOTO_RE =
  /^https:\/\/qfmsdgjtlduravrtqrif\.supabase\.co\/storage\/v1\/object\/public\/fotos-vehiculos-stock\/foto-\d+-\d+\.webp$/

// ---------------------------------------------------------------- helpers

const headers = () => ({
  'Content-Type': 'application/json',
  ...(TOKEN ? { 'X-Franco-Auth': TOKEN } : {}),
})

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${text.slice(0, 200)}`)
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${path} -> respuesta no-JSON: ${text.slice(0, 200)}`)
  }
}

async function getLead(sessionId) {
  const res = await fetch(`${BASE}/webhook/leads?visible_ids=${encodeURIComponent(sessionId)}`, {
    headers: headers(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`GET /leads -> HTTP ${res.status}`)
  const rows = await res.json()
  return (Array.isArray(rows) ? rows : []).find((r) => r.session_id === sessionId) || null
}

// El historial que se guarda en `mensajes_demo` es lo que ve el DUEÑO en la pestaña
// "Historial" de la demo. No es lo mismo que la respuesta del webhook: "Armar respuesta"
// devuelve `respuesta` (con saludo, guard y sin ¿/¡) y `historial` por separado. Si se
// desincronizan, el dueño ve una conversación peor que la que tuvo el cliente, y ningún
// check de los de arriba se entera porque todos miran la respuesta.
async function getHistory(sessionId) {
  const res = await fetch(
    `${BASE}/webhook/session-messages?session_id=${encodeURIComponent(sessionId)}`,
    { headers: headers(), signal: AbortSignal.timeout(TIMEOUT_MS) },
  )
  if (!res.ok) throw new Error(`GET /session-messages -> HTTP ${res.status}`)
  const rows = await res.json()
  return Array.isArray(rows) ? rows : []
}

// Las burbujas de Franco tal como quedaron guardadas, en orden.
const historyBubbles = (rows) =>
  rows
    .filter((r) => r?.rol === 'franco')
    .flatMap((r) => {
      let c = r.contenido
      if (typeof c === 'string') { try { c = JSON.parse(c) } catch { c = null } }
      return (c && Array.isArray(c.messages) ? c.messages : []).map((m) => String(m?.content ?? ''))
    })

const allText = (r) => (r.messages || []).map((m) => m?.content || '').join('\n')
const allPhotoUrls = (r) => [
  ...(r.images || []).map((i) => i?.url),
  ...(r.product_cards || []).map((c) => c?.foto_principal),
].filter(Boolean)

// Precios que Franco escribió en el texto, como enteros. "$12.500.000" -> 12500000
const pricesInText = (r) =>
  [...allText(r).matchAll(/\$\s?([\d.]{7,})/g)]
    .map((m) => parseInt(m[1].replace(/\./g, ''), 10))
    .filter((n) => Number.isFinite(n) && n > 1_000_000)

// ---------------------------------------------------------------- checks
// Cada check devuelve null si pasa, o un string con el motivo si falla.
// 'manual' devuelve {manual: '...'} — no cuenta como falla, se lista aparte.

const CHECKS = {
  first_message_greeting: (r) =>
    /^Hola! Soy /.test(r.messages?.[0]?.content || '')
      ? null
      : `messages[0] no arranca con el saludo: ${JSON.stringify(r.messages?.[0]?.content?.slice(0, 60))}`,

  ends_with_question: (r) => {
    const last = (r.messages || []).at(-1)?.content?.trim() || ''
    return last.endsWith('?') ? null : `la última burbuja no cierra con pregunta: ${JSON.stringify(last.slice(-70))}`
  },

  // El opuesto: en un turno de CIERRE (el cliente se está despidiendo) la respuesta NO
  // debe terminar en una pregunta de venta forzada. El guard de "Armar respuesta" pegaba
  // una pregunta genérica a toda respuesta que no terminara en "?"; esto lo detecta.
  not_ends_with_question: (r) => {
    const last = (r.messages || []).at(-1)?.content?.trim() || ''
    return last.endsWith('?') ? `la última burbuja cierra con pregunta y debería ser un cierre: ${JSON.stringify(last.slice(-70))}` : null
  },

  no_apertura: (r) => {
    const t = allText(r)
    const hits = [...t.matchAll(/[¿¡]/g)].length
    return hits === 0 ? null : `usó ${hits} signo(s) de apertura (¿ o ¡), están prohibidos`
  },

  // "Una pregunta a la vez" es contable, así que se mide en vez de dejarlo a criterio.
  // Pedirle al cliente nombre + apellido + marca + modelo + año + km de una sola vez se lee
  // como formulario y es donde abandona. Cuenta signos "?" en todo el turno: el guard de
  // cierre agrega una pregunta comercial, así que el mínimo razonable para un turno que
  // además pide un dato es 2, no 1.
  max_preguntas: (r, n) => {
    const t = allText(r)
    const preguntas = (t.match(/\?/g) || []).length
    return preguntas <= n
      ? null
      : `${preguntas} preguntas en el turno, máximo ${n} — al cliente le llega como formulario`
  },

  bubbles_max: (r, n) =>
    (r.messages || []).length <= n ? null : `${r.messages.length} burbujas, máximo ${n}`,
  bubbles_min: (r, n) =>
    (r.messages || []).length >= n ? null : `${(r.messages || []).length} burbujas, mínimo ${n}`,

  // El PRIMER auto nombrado es la recomendación principal: es el que el cliente lee primero
  // y el que ancla la conversación. Si puso una restricción (mantener el tamaño), el primero
  // tiene que cumplirla — no vale liderar con uno que no encaja y aclararlo después.
  first_car_in: (r, modelos) => {
    const t = allText(r).toLowerCase()
    let primero = null
    let pos = Infinity
    for (const m of CATALOGO) {
      const i = t.indexOf(m.toLowerCase())
      if (i !== -1 && i < pos) { pos = i; primero = m }
    }
    if (!primero) return 'no nombró ningún auto del catálogo'
    return modelos.some((m) => m.toLowerCase() === primero.toLowerCase())
      ? null
      : `el primer auto recomendado es ${primero}, que no cumple lo que pidió el cliente; esperaba uno de: ${modelos.join(', ')}`
  },

  // Si nombra 3+ autos, tienen que ir en lista (uno por renglón), no en un párrafo corrido.
  // Condicional a propósito: recomendar UN auto en prosa bien justificada es válido y no
  // debe dar rojo — el bug era el párrafo con varios autos encadenados.
  cars_in_list_format: (r) => {
    const t = allText(r)
    const nombrados = CATALOGO.filter((m) => t.toLowerCase().includes(m.toLowerCase())).length
    if (nombrados < 3) return null
    const items = t.split('\n').filter((l) => /^\s*(?:[-•*]|\d+[.)])\s+\S/.test(l)).length
    return items >= 3
      ? null
      : `nombró ${nombrados} autos pero solo ${items} en formato lista — van uno por renglón, no en párrafo corrido`
  },

  cards_min: (r, n) =>
    (r.product_cards || []).length >= n ? null : `${(r.product_cards || []).length} cards, mínimo ${n}`,
  // Techo de cards. Sirve para criterios que RECORTAN el stock (año, color, carrocería):
  // devolver el catálogo entero cuando el cliente pidió un subconjunto es el bug, y
  // `cards_min` no lo caza porque 17 >= 1.
  cards_max: (r, n) =>
    (r.product_cards || []).length <= n
      ? null
      : `${r.product_cards.length} cards, máximo ${n} — devolvió de más para el criterio que pidió`,

  cards_empty: (r) =>
    (r.product_cards || []).length === 0 ? null : `esperaba 0 cards, hay ${r.product_cards.length}`,
  images_min: (r, n) =>
    (r.images || []).length >= n ? null : `${(r.images || []).length} imágenes, mínimo ${n}`,
  images_empty: (r) =>
    (r.images || []).length === 0 ? null : `esperaba 0 imágenes, hay ${r.images.length}`,

  // Tipo B: el turno muestra autos en el texto pero llegan 0 cards Y 0 imágenes.
  // No sirve pedir cards_min ni images_min por separado: "Armar respuesta" manda cards
  // con 3+ autos e imágenes con 1-2, así que un umbral fijo da rojos falsos según cuántos
  // autos haya elegido Franco. Lo que el cliente tiene que ver es material gráfico, sea
  // cual sea la forma.
  media_min: (r, n) => {
    const total = (r.product_cards || []).length + (r.images || []).length
    return total >= n
      ? null
      : `${total} piezas gráficas (${(r.product_cards || []).length} cards + ${(r.images || []).length} imágenes), mínimo ${n}`
  },

  cards_xor_images: (r) => {
    const c = (r.product_cards || []).length
    const i = (r.images || []).length
    return c > 0 && i > 0 ? `mandó cards (${c}) E imágenes (${i}) juntas; debe ser una u otra` : null
  },

  // El check clave de C2/#6: toda URL tiene que ser del bucket real y con forma válida.
  photo_urls_canonical: (r) => {
    const bad = allPhotoUrls(r).filter((u) => !PHOTO_RE.test(u))
    return bad.length === 0 ? null : `${bad.length} URL(s) fuera del bucket canónico: ${bad.slice(0, 3).join(' | ')}`
  },

  // La foto de una card tiene que corresponder al id de esa card (bug #2).
  card_photo_matches_id: (r) => {
    const bad = (r.product_cards || []).filter(
      (c) => c?.id != null && !String(c.foto_principal || '').includes(`foto-${c.id}-`),
    )
    return bad.length === 0
      ? null
      : `${bad.length} card(s) con foto que no corresponde al id: ${bad.slice(0, 3).map((c) => `id=${c.id} -> ${c.foto_principal}`).join(' | ')}`
  },

  price_max_in_text: (r, max) => {
    const over = pricesInText(r).filter((p) => p > max)
    return over.length === 0
      ? null
      : `mencionó precio(s) por encima de ${max.toLocaleString('es-AR')}: ${over.join(', ')}`
  },

  text_contains_all: (r, needles) => {
    const t = allText(r).toLowerCase()
    const missing = needles.filter((n) => !t.includes(String(n).toLowerCase()))
    return missing.length === 0 ? null : `falta en la respuesta: ${missing.join(', ')}`
  },

  text_not_contains: (r, needles) => {
    const t = allText(r).toLowerCase()
    const found = needles.filter((n) => t.includes(String(n).toLowerCase()))
    return found.length === 0 ? null : `no debería aparecer: ${found.join(', ')}`
  },

  text_matches: (r, pattern) => {
    const flags = pattern.startsWith('(?i)') ? 'i' : ''
    const re = new RegExp(pattern.replace(/^\(\?i\)/, ''), flags)
    return re.test(allText(r)) ? null : `no matcheó /${pattern}/`
  },

  // Una expresión de n8n que no se resolvió y se filtró al usuario. Pasó de verdad:
  // el systemMessage no arrancaba con "=", así que las 18 expresiones {{ }} del prompt
  // eran texto literal y Franco a veces las copiaba tal cual. Corre en TODOS los turnos.
  no_template_leak: (r) => {
    const t = JSON.stringify(r)
    const hits = [...t.matchAll(/\{\{[^}]{0,80}\}\}|\$node\[|\$\('Config'\)/g)].map((m) => m[0])
    return hits.length === 0 ? null : `se filtró una expresión de n8n sin resolver: ${[...new Set(hits)].slice(0, 3).join(' | ')}`
  },

  text_not_matches: (r, pattern) => {
    const flags = pattern.startsWith('(?i)') ? 'i' : ''
    const re = new RegExp(pattern.replace(/^\(\?i\)/, ''), flags)
    const m = allText(r).match(re)
    return m ? `matcheó /${pattern}/ y no debería: ${JSON.stringify(m[0].slice(0, 80))}` : null
  },

  // Detectado en v7: cuando el Structured Output Parser no devuelve {messages, auto_ids}
  // válido, "Armar respuesta" cae a esta burbuja genérica. Es HTTP 200 con error: null,
  // indistinguible del éxito para el resto de los checks. Reproducido 2/8 veces en
  // fuera-de-alcance (--repeat 8). Corre en TODOS los turnos.
  no_fallback_bubble: (r) => {
    const hit = (r.messages || []).find((m) => /se me trabó el sistema/i.test(m?.content || ''))
    return hit ? `burbuja de fallback (parser falló): ${JSON.stringify(hit.content)}` : null
  },

  // "Tipo B": Franco lista autos en el texto pero la respuesta llega sin cards NI imágenes,
  // y sin burbuja de fallback. Causa conocida: el schema del parser no exige `auto_ids`, así
  // que un output que omite la clave pasa la validación y "Hidratar autos" no recibe ningún
  // id (ejecución 3681).
  //
  // Corre en TODOS los turnos a propósito: el bug es intermitente (~1 de cada 10) y buscarlo
  // en un solo caso desperdicia toda la superficie de la suite. Acá cada turno de cada caso
  // es una oportunidad de detección.
  //
  // El umbral de 3 modelos es para no dar rojos falsos: Franco nombra un auto suelto en
  // despedidas y derivaciones ("el Etios que viste") sin tener que mostrarlo, pero nadie
  // enumera 3 autos del catálogo sin estar mostrando stock.
  media_si_lista_autos: (r) => {
    const t = allText(r)
    const nombrados = CATALOGO.filter((m) => t.toLowerCase().includes(m.toLowerCase())).length
    if (nombrados < 3) return null
    const media = (r.product_cards || []).length + (r.images || []).length
    return media > 0
      ? null
      : `TIPO B: nombró ${nombrados} autos del catálogo y no mandó ninguna card ni imagen`
  },

  manual: (_r, note) => ({ manual: note }),
}

// Checks que corren en cada turno de cada caso, sin declararlos.
const ALWAYS = ['no_template_leak', 'no_fallback_bubble', 'media_si_lista_autos']

// Checks sobre el historial guardado. Corren contra `mensajes_demo`, no contra la
// respuesta del webhook.
const HISTORY_CHECKS = {
  // El saludo lo agrega "Armar respuesta" solo en `respuesta`. Si `historial` se lleva la
  // copia previa, el dueño ve la conversación arrancando sin saludo.
  first_bubble_greeting: (rows) => {
    const b = historyBubbles(rows)
    if (b.length === 0) return 'el historial no tiene ninguna burbuja de Franco'
    return /^Hola! Soy /.test(b[0])
      ? null
      : `la primera burbuja guardada no es el saludo: ${JSON.stringify(b[0].slice(0, 70))}`
  },

  // Mismo strip de ¿/¡ que se le aplica al cliente. Si el historial guarda el texto crudo,
  // los signos aparecen ahí aunque el cliente nunca los haya visto.
  no_apertura: (rows) => {
    const hits = historyBubbles(rows).join('\n').match(/[¿¡]/g) || []
    return hits.length === 0
      ? null
      : `el historial guardó ${hits.length} signo(s) de apertura que el cliente no vio`
  },

  // El historial tiene que tener al menos tantas burbujas como mandó Franco: si le falta
  // la pregunta de cierre del guard, quedan menos.
  bubbles_min: (rows, n) => {
    const b = historyBubbles(rows)
    return b.length >= n ? null : `${b.length} burbujas guardadas, mínimo ${n}`
  },
}

const LEAD_CHECKS = {
  field_equals: (lead, field, expected) =>
    lead?.[field] === expected ? null : `${field} = ${JSON.stringify(lead?.[field])}, esperaba ${JSON.stringify(expected)}`,
  field_matches: (lead, field, pattern) => {
    const flags = pattern.startsWith('(?i)') ? 'i' : ''
    const re = new RegExp(pattern.replace(/^\(\?i\)/, ''), flags)
    return re.test(String(lead?.[field] ?? '')) ? null : `${field} = ${JSON.stringify(lead?.[field])} no matchea /${pattern}/`
  },
  field_not_matches: (lead, field, pattern) => {
    const flags = pattern.startsWith('(?i)') ? 'i' : ''
    const re = new RegExp(pattern.replace(/^\(\?i\)/, ''), flags)
    return !re.test(String(lead?.[field] ?? '')) ? null : `${field} = ${JSON.stringify(lead?.[field])} NO debería matchear /${pattern}/`
  },
}

// ---------------------------------------------------------------- runner

async function runCase(c) {
  const sessionId = randomUUID()
  const result = { id: c.id, bug: c.bug, sessionId, turns: [], failures: [], manuals: [], error: null }

  try {
    for (const [i, turn] of c.turns.entries()) {
      const t0 = Date.now()
      const res = await post('/webhook/franco-chat', {
        session_id: sessionId,
        type: 'text',
        content: turn.say,
        timestamp: new Date().toISOString(),
      })
      const ms = Date.now() - t0
      const turnRec = { n: i + 1, say: turn.say, ms, response: res, failures: [] }

      for (const [name, ...args] of [...ALWAYS.map((n) => [n]), ...(turn.checks || [])]) {
        const fn = CHECKS[name]
        if (!fn) throw new Error(`check desconocido: ${name}`)
        const out = fn(res, ...args)
        if (out && typeof out === 'object' && out.manual) {
          result.manuals.push({ turn: i + 1, note: out.manual })
        } else if (out) {
          const f = `turno ${i + 1} · ${name}: ${out}`
          turnRec.failures.push(f)
          result.failures.push(f)
        }
      }
      result.turns.push(turnRec)
    }

    if (c.lead_checks?.length) {
      // El bloque CRM corre asincrónicamente DESPUÉS de responder al webhook, así que
      // el lead tarda en reflejar el último turno. Un sleep fijo hacía fallar casos al
      // azar (dos casos idénticos, uno pasaba y otro no). Poleamos hasta que todos los
      // checks pasen, o hasta agotar el margen. Registramos cuánto tardó: si un caso
      // necesita casi todo el margen, el CRM está lento y conviene saberlo.
      const DEADLINE_MS = 30_000
      const INTERVAL_MS = 2500
      const t0 = Date.now()
      let lead = null
      let fails = []

      while (Date.now() - t0 < DEADLINE_MS) {
        await new Promise((r) => setTimeout(r, INTERVAL_MS))
        lead = await getLead(sessionId)
        fails = lead
          ? c.lead_checks.map(([n, ...a]) => LEAD_CHECKS[n](lead, ...a)).filter(Boolean)
          : ['no se creó ninguna fila en crm_leads']
        if (fails.length === 0) break
      }

      result.lead = lead
      result.leadWaitMs = Date.now() - t0
      // Agotar el margen y leer un dato equivocado son DOS fallas distintas con la misma
      // pinta. Si se agotó, lo más probable es que el CRM todavía no haya escrito el último
      // turno y la fila leída sea de un turno anterior — no un dato corrupto. Pasó una vez
      // en 38 observaciones (baseline-v11: 31071ms contra una mediana de ~2.9s) y se leyó
      // durante una sesión entera como "el CRM guardó el teléfono como nombre".
      result.leadTimedOut = fails.length > 0 && result.leadWaitMs >= DEADLINE_MS
      const prefijo = result.leadTimedOut
        ? `lead TIMEOUT (${Math.round(result.leadWaitMs / 1000)}s sin que el CRM escriba; la fila leída puede ser de un turno anterior, no un dato corrupto)`
        : `lead (tras ${Math.round(result.leadWaitMs / 1000)}s)`
      for (const f of fails) result.failures.push(`${prefijo}: ${f}`)
    }

    if (c.history_checks?.length) {
      // "Guardar mensajes (historial)" corre dentro de la cadena, pero la fila puede tardar
      // en estar visible. Mismo patrón de poleo que los lead_checks.
      const DEADLINE_MS = 15_000
      const INTERVAL_MS = 2000
      const t0 = Date.now()
      let rows = []
      let fails = []

      while (Date.now() - t0 < DEADLINE_MS) {
        await new Promise((r) => setTimeout(r, INTERVAL_MS))
        rows = await getHistory(sessionId)
        fails = rows.length
          ? c.history_checks.map(([n, ...a]) => {
              const fn = HISTORY_CHECKS[n]
              if (!fn) throw new Error(`history check desconocido: ${n}`)
              return fn(rows, ...a)
            }).filter(Boolean)
          : ['no se guardó ninguna fila en mensajes_demo']
        if (fails.length === 0) break
      }

      result.history = rows
      for (const f of fails) result.failures.push(`historial: ${f}`)
    }
  } catch (err) {
    result.error = err.message
  }

  if (cleanup) {
    try {
      await post('/webhook/session-delete', { session_id: sessionId })
    } catch {
      /* si falla el borrado no invalida el eval */
    }
  }
  return result
}

const { cases } = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8'))
const selected = only ? cases.filter((c) => only.includes(c.id)) : cases

if (selected.length === 0) {
  console.error(`Ningún caso matcheó. Disponibles: ${cases.map((c) => c.id).join(', ')}`)
  process.exit(2)
}

console.log(`\nFranco evals · ${selected.length} caso(s) · ${BASE}`)
console.log(`${C.dim}cleanup=${cleanup} · token=${TOKEN ? 'sí' : 'NO (si n8n ya exige auth, esto va a dar 403)'}${C.off}\n`)

const results = []
let first = true
for (const c of selected) {
  const runs = []
  for (let i = 0; i < repeat; i++) {
    if (delay && !first) await new Promise((r) => setTimeout(r, delay))
    first = false
    process.stdout.write(`  ${(repeat > 1 ? `${c.id} [${i + 1}/${repeat}]` : c.id).padEnd(38)} `)
    const r = await runCase(c)
    runs.push(r)
    results.push(r)
    if (r.error) console.log(`${C.red}ERROR${C.off}  ${r.error}`)
    else if (r.failures.length) console.log(`${C.red}FAIL${C.off}   ${r.failures.length} check(s)`)
    else console.log(`${C.grn}ok${C.off}     ${r.turns.reduce((a, t) => a + t.ms, 0)}ms`)
  }
  if (repeat > 1) {
    const ok = runs.filter((r) => !r.failures.length && !r.error).length
    const col = ok === repeat ? C.grn : ok === 0 ? C.red : C.yel
    console.log(`  ${C.dim}└─${C.off} ${col}${ok}/${repeat} estable${C.off}`)
  }
}

// ---------------------------------------------------------------- reporte

const failed = results.filter((r) => r.failures.length || r.error)
if (failed.length) {
  console.log(`\n${C.red}── Fallas ──${C.off}`)
  for (const r of failed) {
    console.log(`\n${C.red}✗ ${r.id}${C.off} ${C.dim}(${r.bug})${C.off}`)
    if (r.error) console.log(`    ERROR: ${r.error}`)
    for (const f of r.failures) console.log(`    · ${f}`)
    const lastTurn = r.turns.at(-1)
    if (lastTurn) {
      console.log(`    ${C.dim}última respuesta:${C.off}`)
      for (const m of lastTurn.response.messages || [])
        console.log(`      ${C.dim}| ${String(m.content).slice(0, 110)}${C.off}`)
    }
  }
}

const manuals = results.filter((r) => r.manuals.length)
if (manuals.length) {
  console.log(`\n${C.yel}── Revisión manual (no cuentan como falla) ──${C.off}`)
  for (const r of manuals) {
    console.log(`\n${C.yel}? ${r.id}${C.off}`)
    for (const m of r.manuals) console.log(`    turno ${m.turn}: ${m.note}`)
    for (const m of r.turns.at(-1)?.response?.messages || [])
      console.log(`      ${C.dim}| ${String(m.content).slice(0, 110)}${C.off}`)
  }
}

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify(results, null, 2))
  console.log(`\n${C.dim}detalle completo -> ${jsonOut}${C.off}`)
}

const ok = results.length - failed.length
console.log(`\n${failed.length ? C.red : C.grn}${ok}/${results.length} casos ok${C.off}\n`)
process.exit(failed.length ? 1 : 0)
