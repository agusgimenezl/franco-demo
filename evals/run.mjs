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

// ── ESPEJO DEL DEDUP DE CARDS (para `media_si_lista_autos`) ────────────────────────────────
// `Armar respuesta` NO reenvía cards ni fotos de autos ya mostrados hace poco. No es un bug:
// el comentario del nodo dice "Pedido de Agustina: no repetir el mismo mazo cuando el cliente
// sigue hablando de esos autos". Exigir media por esos autos es exigir que se rompa esa regla,
// y por eso el check daba rojo sobre una conducta correcta (medido con v118: el turno 2 nombra
// justo los 3 chicos que el turno 1 ya mostró, y las cards se suprimen bien).
//
// LA VENTANA SALE DEL NODO `Autos ya mostrados`, NO DE UNA ESTIMACIÓN: mira `LIMIT 8` filas de
// `mensajes_demo`, y cada turno escribe DOS (la del usuario y la de Franco), así que son los
// últimos 4 turnos.
const VENTANA_DEDUP_TURNOS = 4
const mediaPorTurno = []        // modelos que salieron con card O con foto, por turno
const imagenesPorTurno = []     // modelos que salieron con FOTO, por turno
const modeloPorId = new Map()   // id -> modelo, aprendido de las cards de la propia sesión
// Lo que el CLIENTE dijo en esta corrida. Un check normal ve sólo la respuesta de Franco, y para
// saber si un nombre es inventado hay que saber si el cliente lo dio alguna vez: sin esto,
// `no_nombre_inventado` no puede distinguir "Perfecto Martín" legítimo de uno sacado del prompt.
const dichoPorCliente = []

// SON DOS DEDUP DISTINTOS Y HAY QUE RESPETAR LA DIFERENCIA. En `Armar respuesta`:
//   · las CARDS se suprimen si ese auto ya salió como card hace poco (`cards_recientes`);
//   · las FOTOS se suprimen sólo si ya salieron FOTOS de ese auto (`ids_recientes`) — y el propio
//     nodo aclara que "haber aparecido como card NO cuenta, porque ver la ficha con fotos después
//     de la miniatura es un flujo válido".
// Si `images_min` usara el rastreo combinado, perdonaría un turno sin fotos cuando lo único previo
// fue una card, y eso SÍ es un bug. Por eso van separados.

const modeloDe = (txt) =>
  CATALOGO.find((m) => String(txt || '').toLowerCase().includes(m.toLowerCase())) || null

// Se llama DESPUÉS de correr los checks del turno: lo que importa es lo que el cliente ya vio
// en los turnos ANTERIORES, no lo que le llega en este.
function registrarMedia(r) {
  const modelos = new Set()
  const conFoto = new Set()
  for (const c of (r.product_cards || [])) {
    const m = modeloDe(c?.titulo)
    if (m) {
      modelos.add(m)
      if (c?.id != null) modeloPorId.set(Number(c.id), m)
    }
  }
  // Las fotos sólo traen el id en la URL (`foto-4-1.webp`). Se resuelve con el mapa que
  // construyeron las cards de esta sesión; si un auto llegó SÓLO como foto y nunca como card,
  // queda sin resolver y el check sigue exigiendo media. El sesgo es deliberado: falso ROJO,
  // nunca falso verde.
  for (const i of (r.images || [])) {
    const hit = String(i?.url || '').match(/foto-(\d+)-/)
    const m = hit ? modeloPorId.get(Number(hit[1])) : null
    if (m) { modelos.add(m); conFoto.add(m) }
  }
  mediaPorTurno.push(modelos)
  imagenesPorTurno.push(conFoto)
}

const acumular = (porTurno) => {
  const vistos = new Set()
  for (const t of porTurno.slice(-VENTANA_DEDUP_TURNOS)) for (const m of t) vistos.add(m)
  return vistos
}
const yaTienenMedia = () => acumular(mediaPorTurno)
const yaTienenFotos = () => acumular(imagenesPorTurno)

// Precio real de cada modelo, para cazar autos INVENTADOS (ver `no_inventa_autos`).
// No alcanza con validar el nombre: Franco inventó "Ford Ranger 2017 — $9.200.000",
// y "Ranger" SÍ está en el catálogo — lo inventado era el año y el precio.
// ⚠️ SI CAMBIA EL STOCK, ESTO SE ACTUALIZA. Verificado contra el stock vivo el 2026-08-05.
// 2026-08-10: el Etios pasó de 2019 a 2021 (ficha técnica V2 del depósito) y con eso su precio
// pasó de $12.500.000 a $14.500.000. ESTE MAPA VA SIEMPRE JUNTO CON LA BASE: `no_inventa_autos`
// corre en TODOS los turnos, así que si quedan desincronizados el eval marca como "precio
// inventado" el precio correcto, y la suite entera se pone roja por una causa propia.
// Lo verifica un assert en `scripts/stock-etapa1-specs-del-documento.mjs`.
const PRECIOS = {
  Ranger: 57000000, S10: 39500000, Hilux: 38000000, 'T-Cross': 34000000,
  Amarok: 32000000, Vento: 31000000, Renegade: 25500000, Corolla: 24800000,
  Duster: 22500000, Onix: 21500000, 208: 21000000, EcoSport: 19800000,
  Kangoo: 18500000, Cronos: 16800000, Etios: 14500000, 'Gol Trend': 9200000,
  Fiesta: 8200000,
}

// Carrocería real de cada modelo. Verificada contra `autos_disponibles` (Supabase por MCP)
// el 2026-08-06, no transcripta a ojo. Sirve para cazar la OTRA invención, la de CATEGORÍA:
// Franco dijo "tenés este abanico de opciones de pickup 4x2" y listó Gol Trend, Etios,
// EcoSport y Kangoo (ejecución 12047). Modelo y precio correctos —`no_inventa_autos` no se
// dispara, y hace bien— pero ninguno es pickup. ⚠️ SI CAMBIA EL STOCK, ESTO SE ACTUALIZA.
const CARROCERIA = {
  Ranger: 'pickup', S10: 'pickup', Hilux: 'pickup', Amarok: 'pickup',
  'T-Cross': 'suv', EcoSport: 'suv', Duster: 'suv', Renegade: 'suv',
  Vento: 'sedan', Cronos: 'sedan', Onix: 'sedan', Corolla: 'sedan',
  Fiesta: 'hatchback', 'Gol Trend': 'hatchback', Etios: 'hatchback', 208: 'hatchback',
  Kangoo: 'utilitario',
}

const PHOTO_RE =
  /^https:\/\/qfmsdgjtlduravrtqrif\.supabase\.co\/storage\/v1\/object\/public\/fotos-vehiculos-stock\/foto-\d+-\d+\.webp$/

// UN RENGLÓN DE LISTA: la forma en la que Franco OFRECE un auto. Tres checks razonan sobre esto
// (`cars_in_list_format`, `no_inventa_autos`, `carroceria_solo_si_hay`) y lo tenían copiado cada
// uno por su lado; acá está una sola vez para que no vuelvan a divergir.
// EL ENCABEZADO DE BLOQUE PUEDE VENIR PEGADO ADELANTE, y ese es el agujero que tapa v114:
//   "Alto: - Volkswagen Polo 2021 — 25.000 km — $15.000.000 (hatchback)"
// MEDIDO, no supuesto: `mensajes_demo` 11684, salido a producción. No hay ningún Polo en el stock
// —es una invención, el peor error del proyecto— y NINGUNO de los dos lados lo vio: ni este check
// ni el borrado de v109 en `Armar respuesta`, porque los dos exigían la viñeta al PRINCIPIO del
// renglón. El mismo texto con la viñeta en su propia línea sí se caza por los dos lados.
// ⚠️ ESTE PATRÓN ESTÁ TAMBIÉN EN `Armar respuesta` (v114, `_ITEM`) y tiene que quedar IDÉNTICO:
// si sólo se arregla de un lado, el formato sigue pasando entero. Lo verifica el assert de
// `scripts/el-encabezado-pegado-al-item.mjs`.
const ES_ITEM = /^\s*(?:[^\n:]{1,25}:\s*)?(?:[-•*]|\d+[.)])\s+\S/
const esItem = (l) => ES_ITEM.test(l)

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
    const items = t.split('\n').filter(esItem).length
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

  // Ninguna card debe ser de una marca/modelo que no corresponde al filtro pedido: "Volkswagen"
  // no debe traer cards Ford/Chevrolet. Los checks de texto no ven las cards; este mira el titulo
  // de cada product_card. Cazó el bug de alternativas-por-carroceria explotando en una consulta por marca.
  cards_titles_not_contains: (r, needles) => {
    const titles = (r.product_cards || []).map((c) => String(c?.titulo || '').toLowerCase())
    const bad = needles.filter((n) => titles.some((t) => t.includes(String(n).toLowerCase())))
    return bad.length === 0 ? null : `cards con marca/modelo que no debería aparecer: ${bad.join(', ')}`
  },
  images_min: (r, n) => {
    const tengo = (r.images || []).length
    if (tengo >= n) return null
    // Mismo choque que en `media_si_lista_autos`, ahora del lado de las fotos: `Armar respuesta`
    // no reenvía las FOTOS de un auto cuyas fotos ya mandó hace poco, así que exigirlas es exigir
    // que se rompa esa regla. MEDIDO el 2026-08-10, sesión f0c23a2f: el turno 1 mandó las fotos de
    // los ids 17 y 9, el turno 2 preguntaba justo por el 9, y el dedup las suprimió BIEN.
    // Sólo perdona si TODOS los autos que nombra ya tienen foto dada: si nombra uno nuevo, va rojo.
    const vistos = yaTienenFotos()
    const nombrados = CATALOGO.filter((m) => allText(r).toLowerCase().includes(m.toLowerCase()))
    if (nombrados.length && nombrados.every((m) => vistos.has(m))) return null
    return `${tengo} imágenes, mínimo ${n}`
  },
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
  // FRANCO INVENTA STOCK. El peor error posible: viola `# Regla base: no inventar` y delante
  // de un dueño es fatal. Visto el 2026-08-05 midiendo v92: listó "Nissan Frontier 2016 —
  // 110.000 km — $9.800.000" y "Ford Ranger 2017 — 120.000 km — $9.200.000". No hay ningún
  // Nissan en el stock, y la única Ranger es una 2024 de $57.000.000.
  // Causa (ejecución 11923): `Listar stock` le devolvió CERO FILAS once veces seguidas por el
  // gate de v89, y el modelo llenó el vacío.
  //
  // POR QUÉ NO ALCANZA CON VALIDAR EL NOMBRE: "Ford Ranger 2017" nombra un modelo que SÍ existe;
  // lo inventado es el año y el precio. Por eso se valida MODELO **Y** PRECIO contra `PRECIOS`.
  //
  // Sólo mira líneas que OFRECEN un auto (item de lista con precio), que es donde aparece la
  // invención; una mención suelta en prosa ("el Etios que viste") no dispara.
  // Corre en TODOS los turnos a propósito: cualquier turno de cualquier caso es superficie útil.
  no_inventa_autos: (r) => {
    const ofertas = allText(r)
      .split('\n')
      .filter((l) => esItem(l) && /\$\s?\d{1,3}(?:\.\d{3})+/.test(l))
    const malas = []
    for (const linea of ofertas) {
      const modelos = Object.keys(PRECIOS).filter((m) => linea.toLowerCase().includes(m.toLowerCase()))
      if (modelos.length === 0) {
        malas.push(`${linea.trim().slice(0, 70)} → no es ningún auto del catálogo`)
        continue
      }
      const precios = [...linea.matchAll(/\$\s?(\d{1,3}(?:\.\d{3})+)/g)].map((m) => Number(m[1].replace(/\./g, '')))
      if (precios.length && !precios.some((p) => modelos.some((m) => PRECIOS[m] === p))) {
        malas.push(`${linea.trim().slice(0, 70)} → precio inventado (el real de ${modelos[0]} es $${PRECIOS[modelos[0]].toLocaleString('es-AR')})`)
      }
    }
    return malas.length === 0 ? null : `INVENTÓ STOCK: ${malas.join(' | ')}`
  },

  // La fila centinela de `Listar stock` (v93) es una INSTRUCCIÓN para el modelo, nunca contenido
  // para el cliente. Este check es el precio de haberla introducido: si alguna vez Franco la copia,
  // se ve acá y no en una demo. Corre en TODOS los turnos.
  no_filtra_centinela: (r) => {
    const t = allText(r)
    const hit = /ESTE TURNO NO ES PARA MOSTRAR AUTOS|no_mostrar/i.exec(t)
    return hit ? `se filtró la fila centinela de Listar stock al cliente: ${JSON.stringify(hit[0])}` : null
  },

  // EL VOCABULARIO INTERNO NO SE LE DICE AL CLIENTE. `Listar stock` devuelve `categoria`
  // (entra/estirar/economica) y `tamano` (chico/mediano/grande) como valores crudos, y el prompt
  // los repite: son términos de trabajo nuestros, no cosas que se le dicen a alguien que vino a
  // comprar un auto. Hermano de `no_filtra_centinela`, y por el mismo motivo: es el precio de
  // haber metido etiquetas en la cadena. Corre en TODOS los turnos.
  //
  // NO PROHÍBE LAS PALABRAS, y ahí está toda la gracia: "económica" y "estirar" son español
  // normal y aparecen 91 y 404 veces de forma legítima en el historial ("una opción económica",
  // "podés estirar un poco", "algo de más categoría", "equipada para su categoría"). Prohibir el
  // token habría pintado de rojo medio corpus. Lo que se caza es la etiqueta USADA COMO ETIQUETA.
  //
  // LAS TRES FIRMAS SALIERON DE LEER LAS 19 FUGAS, NO DE IMAGINARLAS (medido contra
  // `mensajes_demo` el 2026-08-11: 19 sesiones sobre 2701, y 3 de las 26 corridas del guion de
  // `chico-no-es-utilitario`, o sea ~12% ahí):
  //   · entre comillas — 15 casos. 'opciones "estirar"', 'categoría "económica"', 'segmento de
  //     precio "entra"'. El modelo cita el término porque sabe que es un término, no una palabra.
  //   · "categoría <token>" sin comillas — 2 casos.
  //   · el valor de `tamano` como sustantivo y sin concordancia — 5 casos: "la opción chico",
  //     "las otras opciones chico", "opciones mediano/grande". Nadie escribe así en español: es
  //     el valor crudo pegado en la oración. Por eso pide la forma masculina exacta, que después
  //     de "opción/opciones" sólo aparece si la pegó una máquina — "opciones chicas" no matchea.
  //   · nombres de campo — 0 casos hoy, pero v118 sumó `otro_tamano` y v126 `anticipo_minimo`:
  //     la superficie crece con cada campo nuevo y este es el lugar donde se ve.
  //
  // VERIFICADO CONTRA LAS 2701 SESIONES DEL HISTORIAL: 19 rojos, todos fugas reales, 0 falsos
  // positivos. Es la lección de v122 aplicada a una regex — no alcanza con que el patrón parezca
  // bien, hay que correrlo contra los datos antes de confiarle 91 casos.
  // NO LE PONGAS NOMBRE AL QUE NO SE PRESENTÓ. Franco saluda por su nombre a clientes que nunca se
  // lo dieron —"Perfecto Martín" a un desconocido—, porque copia el nombre de ejemplo de un guion
  // del prompt. Delante del dueño de una concesionaria es de las cosas más caras que pueden pasar,
  // y NINGUNO de los 93 casos lo cazaba: se encontró leyendo `mensajes_demo` a mano el 2026-08-11,
  // después de que la cadena v128→v130 lo amplificara. Corre en TODOS los turnos.
  //
  // NO ES UN BUG NUEVO, y por eso va en ALWAYS y no en un caso: medido contra las 2701 sesiones hay
  // 22 nombres inventados (Martín 19, Lucía 2, Agustín 1) repartidos en 20–25/07, 06/08, 10/08 y
  // 11/08. Vive hace meses. Lo que lo hacía invisible es que ningún check mira esto.
  //
  // LA SEÑAL ES EL VOCATIVO, no el nombre: Franco sólo nombra al cliente para dirigirse a él
  // ("Perfecto X", "Gracias X", "Hola X"). Y la prueba de que es inventado es que el cliente NUNCA
  // lo escribió — de ahí `dichoPorCliente`, que acumula sus turnos.
  //
  // VERIFICADO CONTRA LAS 2701 SESIONES: 380 vocativos con nombre, 358 legítimos (Agustina 152,
  // Julieta 78, Pedro 42, Martin 14, Natalia 11...) y 22 inventados. **0 falsos positivos.**
  // Compara sin tildes a propósito: el cliente escribe "Martin" y Franco contesta "Martín", y eso
  // es correcto — es la lección 6 de la migración, aplicada acá.
  no_nombre_inventado: (r) => {
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const dicho = norm(dichoPorCliente.join(' '))
    // Palabras que pueden caer detrás de un vocativo y NO son nombres: conectivas que arrancan
    // oración y marcas/modelos del catálogo ("Dale Ford tiene la Ranger").
    const NO_SON_NOMBRES = new Set([
      'con', 'para', 'ahora', 'entonces', 'igual', 'ese', 'esta', 'este', 'esto', 'mira', 'dale',
      'listo', 'bueno', 'genial', 'hola', 'perfecto', 'gracias', 'como', 'cuando', 'tengo',
      'tenemos', 'buenisimo', 'excelente', 'anotado', 'quedamos', 'aca', 'ahi',
      'ford', 'chevrolet', 'toyota', 'volkswagen', 'renault', 'peugeot', 'fiat', 'jeep', 'nissan',
      'ranger', 'hilux', 'amarok', 'corolla', 'etios', 'onix', 'cronos', 'kangoo', 'duster',
      'renegade', 'ecosport', 'fiesta', 'vento', 'sandero', 'partner', 'franco',
    ])
    const hits = []
    const re = /(?:Perfecto|Gracias|Dale|Listo|Bueno|Genial|Hola|Buen[ií]simo|Excelente)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})(?![a-záéíóúñ])/g
    for (const m of allText(r).matchAll(re)) {
      const nombre = m[1]
      if (NO_SON_NOMBRES.has(norm(nombre))) continue
      if (dicho.includes(norm(nombre))) continue
      hits.push(nombre)
    }
    return hits.length === 0
      ? null
      : `le dijo "${hits[0]}" a un cliente que NUNCA dio su nombre — sale de un ejemplo del prompt`
  },

  no_vocabulario_interno: (r) => {
    const t = allText(r)
    const hits = []
    for (const [re, que] of [
      [/["“”]\s*(?:econ[oó]mica|estirar|entra|otro_tamano)\s*["“”]/gi, 'etiqueta entre comillas'],
      [/categor[ií]a\s+(?:econ[oó]mica|estirar|entra)\b/gi, 'etiqueta nombrada como categoría'],
      [/opci[oó]n(?:es)?\s+(?:chico|mediano|grande)\b/gi, 'el valor crudo de tamano como sustantivo'],
      [/\b(?:otro_tamano|auto_ids|entrega_plata|carroceria_pedida|monto_financiar_hist|estado_ficha|ficha_completa|anticipo_minimo|pisos_carroceria|tiene_permuta)\b/gi, 'nombre de campo interno'],
    ]) {
      for (const m of t.matchAll(re)) hits.push(`${que} ${JSON.stringify(m[0])}`)
    }
    return hits.length === 0
      ? null
      : `se le filtró vocabulario interno al cliente — ${[...new Set(hits)].slice(0, 3).join(' · ')}`
  },

  // NO OFRECER LO QUE NO EXISTE. Rojo si Franco AFIRMA que lo que ofrece o va a mostrar es de
  // una carrocería y no hay NI UNO de esa carrocería en lo que efectivamente ofrece.
  // Cubre los dos síntomas medidos del mismo bug:
  //   · el ofrecimiento vacío — "Querés que te muestre las pickups 4x2 que te entran con ese
  //     presupuesto?" con techo $10.000.000, donde hay CERO pickups (la más accesible es la
  //     Amarok a $32.000.000);
  //   · la etiqueta falsa — "tenés este abanico de opciones de pickup 4x2" seguido de Gol Trend,
  //     Etios, EcoSport y Kangoo (ejecución 12047, leída del log, no del volcado).
  //
  // NO corre en ALWAYS a propósito: "querés que te muestre las pickups?" es legítimo cuando el
  // cliente no puso techo. Sólo se declara en los turnos donde está medido que no entra ninguna.
  //
  // Cómo distingue afirmar de negar, que es la parte delicada: la palabra de carrocería tiene que
  // venir precedida (45 chars) de una frase de OFRECER, y la burbuja no puede tener una negación.
  // Así "estas pickups 4x2 dentro de tu capacidad no hay" —la conducta que SÍ queremos— no
  // dispara, y "tenés este abanico de opciones de pickup" sí.
  carroceria_solo_si_hay: (r, tipo) => {
    const PALABRA = {
      pickup: /pickups?|camionetas?/i, suv: /\bsuvs?\b/i, sedan: /sed[aá]n(es)?\b/i,
      hatchback: /hatchbacks?/i, utilitario: /utilitarios?/i,
    }[tipo]
    if (!PALABRA) return `carroceria_solo_si_hay: tipo desconocido ${JSON.stringify(tipo)}`
    const OFRECE = /(ten[eé]s|te (muestro|paso|muestre|puedo mostrar)|mostrarte|mostrar(te)? (algunas?|opciones)|estas|estos|ac[aá] (van|te)|opciones de|abanico de|que te entran|entran)/i
    const NIEGA = /\bno\b|ning[uú]n|ninguna|cero |sin stock/i

    const afirmaciones = (r.messages || [])
      .map((m) => String(m?.content ?? ''))
      .filter((b) => {
        const hit = PALABRA.exec(b)
        if (!hit || NIEGA.test(b)) return false
        return OFRECE.test(b.slice(Math.max(0, hit.index - 45), hit.index))
      })
    if (afirmaciones.length === 0) return null

    // Lo que EFECTIVAMENTE ofrece: los títulos de las cards y los modelos nombrados en líneas
    // de lista. Si no ofrece nada concreto, tampoco hay ni uno de la carrocería afirmada.
    const ofrecido = [
      ...(r.product_cards || []).map((c) => String(c?.titulo ?? '')),
      ...allText(r).split('\n').filter(esItem),
    ].join('\n').toLowerCase()
    const hay = Object.keys(CARROCERIA)
      .filter((m) => CARROCERIA[m] === tipo && ofrecido.includes(m.toLowerCase()))
    if (hay.length > 0) return null

    const otros = Object.keys(CARROCERIA).filter((m) => ofrecido.includes(m.toLowerCase()))
    return `OFRECIÓ ${tipo} Y NO HAY NI UNA: ${JSON.stringify(afirmaciones[0].slice(0, 90))}` +
      (otros.length ? ` → lo que ofrece es ${otros.map((m) => `${m} (${CARROCERIA[m]})`).join(', ')}` : ' → no ofrece ningún auto concreto')
  },

  media_si_lista_autos: (r) => {
    const t = allText(r).toLowerCase()
    const nombrados = CATALOGO.filter((m) => t.includes(m.toLowerCase()))
    if (nombrados.length < 3) return null
    const media = (r.product_cards || []).length + (r.images || []).length
    if (media > 0) return null
    // El dedup de `Armar respuesta` no reenvía media de autos ya mostrados en los últimos
    // turnos, así que sólo cuentan los que el cliente TODAVÍA no vio. Sin esto, el check
    // pide justo lo que el nodo tiene prohibido hacer. Ver el bloque del espejo, arriba.
    const vistos = yaTienenMedia()
    const nuevos = nombrados.filter((m) => !vistos.has(m))
    if (nuevos.length < 3) return null
    return `TIPO B: nombró ${nuevos.length} autos que el cliente todavía no vio ` +
      `(${nuevos.join(', ')}) y no mandó ninguna card ni imagen`
  },

  manual: (_r, note) => ({ manual: note }),
}

// Checks que corren en cada turno de cada caso, sin declararlos.
const ALWAYS = ['no_template_leak', 'no_fallback_bubble', 'media_si_lista_autos',
  'no_inventa_autos', 'no_filtra_centinela', 'no_vocabulario_interno', 'no_nombre_inventado']

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
  // Cada corrida es una sesión nueva: lo que el cliente vio en la anterior no cuenta.
  mediaPorTurno.length = 0
  imagenesPorTurno.length = 0
  modeloPorId.clear()
  dichoPorCliente.length = 0

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

      // ANTES de los checks, al revés que `registrarMedia`: lo que el cliente acaba de decir SÍ
      // cuenta para este turno. Si dio su nombre recién ahora, usarlo en la respuesta es correcto.
      dichoPorCliente.push(String(turn.say || ''))

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
      // Después de los checks, no antes: la media de ESTE turno no cuenta como "ya vista".
      registrarMedia(res)
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

// ── GUARDIA DE DEPLOY ────────────────────────────────────────────────────────────────────────
// El 2026-08-10 entraron TRES deploys en mitad de una tanda y cada vez costó lo mismo: la corrida
// de "antes" deja de valer y hay que reconstruirla a mano cruzando `updatedAt` del workflow contra
// los timestamps de cada sesión. Esto lo hace solo: pregunta la versión antes y después de CADA
// corrida y marca las que quedaron a caballo de un deploy.
//
// ES OPT-IN: la API de n8n pide su propia key, que el eval no necesita para nada más. Sin
// N8N_API_KEY el guardia no corre, y lo AVISA — no falla en silencio, que sería peor que no tenerlo.
const N8N_KEY = process.env.N8N_API_KEY || ''
const WF_ID = process.env.N8N_WORKFLOW_ID || 'Khct6BjiMNXZK5Oi'

// ── ¿LA CORRIDA MURIÓ POR RED, O POR UN BUG? ────────────────────────────────────────────────
// El 2026-08-11 n8n se cayó ~4 horas en mitad de una tanda y el eval reportó `FAIL` y `ERROR`
// mezclados: una falla de red se leía IGUAL que un rojo de contenido, y esa tanda se estuvo
// interpretando como si midiera algo. No medía nada.
// Función pura y separada para poder probarla sin tirar abajo n8n. Prueba:
// `scripts/el-guardia-de-deploy-avisa.mjs`.
function esFallaDeRed(msg) {
  if (!msg) return false
  return /fetch failed|aborted due to timeout|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network|Timeout|HTTP 5\d\d|HTTP 408|HTTP 429/i.test(String(msg))
}

// Igual que el veredicto de deploy: va DESPUÉS de los resultados, porque cambia cómo se lee todo
// lo de arriba. Una tanda con corridas caídas por red no es una medición a medias: es un dato menos.
function veredictoRed(results) {
  const caidas = results.filter((r) => esFallaDeRed(r.error))
  if (!caidas.length) return []
  const out = [
    `\n${C.red}── ⚠ ${caidas.length} CORRIDA(S) MURIERON POR RED, NO POR UN BUG ──${C.off}`,
    `  ${C.dim}No midieron nada. Los checks de esas corridas no dicen nada de Franco.${C.off}`,
  ]
  for (const r of caidas) out.push(`    · ${r.id}: ${String(r.error).slice(0, 90)}`)
  const total = results.length
  const sanas = total - caidas.length
  out.push(`  ${C.yel}la tanda midió de verdad ${sanas} de ${total} corridas${C.off}`)
  if (sanas === 0) out.push(`  ${C.red}NINGUNA corrida llegó al servidor: esta tanda no vale. Repetirla.${C.off}`)
  else out.push(`  ${C.dim}Si el backend estuvo inestable, repetir antes de sacar conclusiones.${C.off}`)
  return out
}

// Función PURA a propósito: es la parte que sólo se ejecuta cuando alguien despliega en el medio,
// o sea casi nunca, y un guardia que falla justo el día que hace falta no sirve de nada. Separada
// se puede probar sin desplegar. La prueba vive en `scripts/el-guardia-de-deploy-avisa.mjs`.
function veredictoDeploy(inicial, final, results) {
  if (!inicial || !final) return []
  const aCaballo = results.filter((r) => r.aCaballo)
  const versiones = [...new Set(results.map((r) => r.deploy?.antes).filter(Boolean))]
  if (inicial === final && !aCaballo.length) {
    return [`\n${C.dim}guardia de deploy: OK — una sola versión en toda la tanda (${final})${C.off}`]
  }
  const out = [
    `\n${C.red}── ⚠ EL WORKFLOW CAMBIÓ DURANTE LA TANDA — ESTA MEDICIÓN NO VALE COMO UNA SOLA ──${C.off}`,
    `  al arrancar: ${inicial}`,
    `  al terminar: ${final}`,
  ]
  if (aCaballo.length) {
    out.push(`  ${C.red}${aCaballo.length} corrida(s) a caballo del deploy, y esas no valen para ningún lado:${C.off}`)
    for (const r of aCaballo) out.push(`    · ${r.id} (${r.sessionId})`)
  }
  if (versiones.length > 1) {
    out.push(`  ${C.yel}corridas por versión — el "antes" y el "después" hay que leerlos separados:${C.off}`)
    for (const v of versiones) {
      const suyas = results.filter((r) => r.deploy?.antes === v && !r.aCaballo)
      const okv = suyas.filter((r) => !r.failures.length && !r.error).length
      out.push(`    · ${v}  ->  ${okv}/${suyas.length} ok`)
      for (const r of suyas) out.push(`        ${r.failures.length || r.error ? 'FAIL' : 'ok  '}  ${r.id}`)
    }
  }
  out.push(`  ${C.dim}Repetir la tanda entera sobre una sola versión antes de sacar conclusiones.${C.off}`)
  return out
}

async function deployActual() {
  if (!N8N_KEY) return null
  try {
    // CON TIMEOUT, como todos los demás fetch del archivo. Sin esto, el guardia —que existe para
    // proteger la medición— podía COLGAR la tanda entera si n8n no responde. Corto más agresivo
    // que TIMEOUT_MS a propósito: esto es telemetría, no la medición; si tarda, no vale la espera.
    const res = await fetch(`${BASE}/api/v1/workflows/${WF_ID}`, {
      headers: { 'X-N8N-API-KEY': N8N_KEY },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    return (await res.json())?.updatedAt || null
  } catch (e) {
    return null // la red del eval ya se mide sola; el guardia nunca puede tumbar la tanda
  }
}

console.log(`\nFranco evals · ${selected.length} caso(s) · ${BASE}`)
console.log(`${C.dim}cleanup=${cleanup} · token=${TOKEN ? 'sí' : 'NO (si n8n ya exige auth, esto va a dar 403)'}${C.off}`)

const deployInicial = await deployActual()
if (!N8N_KEY) {
  console.log(`${C.dim}guardia de deploy: APAGADA (falta N8N_API_KEY) — si alguien despliega en el medio, esta medición no te lo va a avisar${C.off}\n`)
} else if (!deployInicial) {
  console.log(`${C.yel}guardia de deploy: no pude leer la versión del workflow (¿key o id mal?) — la tanda sigue, pero sin protección${C.off}\n`)
} else {
  console.log(`${C.dim}guardia de deploy: activa · workflow ${WF_ID} @ ${deployInicial}${C.off}\n`)
}

const results = []
let first = true
for (const c of selected) {
  const runs = []
  for (let i = 0; i < repeat; i++) {
    if (delay && !first) await new Promise((r) => setTimeout(r, delay))
    first = false
    process.stdout.write(`  ${(repeat > 1 ? `${c.id} [${i + 1}/${repeat}]` : c.id).padEnd(38)} `)
    const deployAntes = await deployActual()
    const r = await runCase(c)
    const deployDespues = await deployActual()
    // Una corrida sólo vale si el workflow no se movió mientras corría.
    r.deploy = { antes: deployAntes, despues: deployDespues }
    r.aCaballo = !!(deployAntes && deployDespues && deployAntes !== deployDespues)
    runs.push(r)
    results.push(r)
    if (r.error) console.log(`${C.red}ERROR${C.off}  ${r.error}`)
    else if (r.failures.length) console.log(`${C.red}FAIL${C.off}   ${r.failures.length} check(s)`)
    else console.log(`${C.grn}ok${C.off}     ${r.turns.reduce((a, t) => a + t.ms, 0)}ms`)
    if (r.aCaballo) console.log(`  ${C.red}⚠ esta corrida quedó A CABALLO de un deploy — no vale${C.off}`)
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

// ── Veredicto del guardia de deploy ──────────────────────────────────────────────────────────
// Va DESPUÉS de los resultados y antes del total, porque cambia cómo hay que leer todo lo de
// arriba: una tanda partida por un deploy no es una medición, son dos a medias.
for (const l of veredictoRed(results)) console.log(l)

const deployFinal = await deployActual()
for (const l of veredictoDeploy(deployInicial, deployFinal, results)) console.log(l)

const ok = results.length - failed.length
console.log(`\n${failed.length ? C.red : C.grn}${ok}/${results.length} casos ok${C.off}\n`)
process.exit(failed.length ? 1 : 0)
