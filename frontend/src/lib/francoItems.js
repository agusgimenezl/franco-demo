import { normalizeSupabaseUrl, resolveProductCardPhoto } from './supabaseUrl'

// Lógica compartida por el chat vivo (useChat) y el historial (SessionDetail):
// convierte una respuesta de Franco ({ messages, images, product_cards }) en la
// lista plana de items que renderiza <ChatItem>. Vive acá para que ambos usen
// EXACTAMENTE el mismo pipeline y se vean idénticos (incluida la regla de oro
// de las imágenes, que queda intacta: foto_principal / url pasan por el mismo
// tratamiento que ya usa el chat, sin lógica nueva).

export function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function extractErrorText(error) {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    return error.user_message || error.message || null
  }
  return null
}

// Red de seguridad: el prompt de Franco le pide separar ideas distintas en
// burbujas propias usando el array 'messages'. A veces el modelo no lo respeta
// y empaqueta varios párrafos (separados por línea en blanco) en un solo
// item. Si eso pasa, los partimos acá para no mostrar un muro de texto. Si no
// hay separador, devuelve el texto tal cual en un único item.
function splitIntoBubbles(content) {
  const paragraphs = String(content ?? '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  return paragraphs.length > 0 ? paragraphs : ['']
}

// Convierte la respuesta de Franco en una lista plana de items renderizables,
// intercalando imágenes y cards en el orden que pide el contrato (imágenes
// después del mensaje cuyo índice indican).
export function buildFrancoItems(response) {
  const items = []
  const messages = Array.isArray(response?.messages) ? response.messages : []
  const images = Array.isArray(response?.images) ? response.images : []
  const productCards = Array.isArray(response?.product_cards) ? response.product_cards : []
  const now = new Date().toISOString()

  messages.forEach((message, index) => {
    splitIntoBubbles(message?.content).forEach((paragraph) => {
      items.push({
        id: makeId(),
        kind: 'franco-text',
        text: paragraph,
        timestamp: now,
      })
    })

    const imagesForIndex = images
      .filter((img) => img?.after_message_index === index)
      .map((img) => normalizeSupabaseUrl(img.url))
      .filter(Boolean)

    if (imagesForIndex.length > 0) {
      items.push({ id: makeId(), kind: 'image-group', images: imagesForIndex })
    }
  })

  const lastIndex = messages.length - 1
  const strayImages = images
    .filter((img) => img?.after_message_index == null || img.after_message_index > lastIndex)
    .map((img) => normalizeSupabaseUrl(img.url))
    .filter(Boolean)

  if (strayImages.length > 0) {
    items.push({ id: makeId(), kind: 'image-group', images: strayImages })
  }

  if (productCards.length > 0) {
    const normalizedCards = productCards.map((card) => ({
      ...card,
      foto_principal: resolveProductCardPhoto(card.foto_principal, card.id),
    }))
    items.push({ id: makeId(), kind: 'product-cards', cards: normalizedCards })
  }

  const errorText = extractErrorText(response?.error)
  if (errorText) {
    items.push({ id: makeId(), kind: 'error', text: errorText })
  }

  return items
}
