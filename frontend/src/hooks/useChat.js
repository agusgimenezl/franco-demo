import { useCallback, useRef, useState } from 'react'
import { sendMessageToWebhook, WebhookError } from '../lib/webhook'

// Pausa entre burbujas consecutivas de Franco, para que se sienta como una
// persona mandando varios mensajes seguidos en vez de un bloque de golpe.
const BUBBLE_DELAY_MS = 300

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function extractErrorText(error) {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    return error.user_message || error.message || null
  }
  return null
}

// Convierte la respuesta cruda del webhook en una lista plana de items
// renderizables, intercalando imágenes y cards en el orden que pide el
// contrato (imágenes después del mensaje cuyo índice indican).
function buildFrancoItems(response) {
  const items = []
  const messages = Array.isArray(response?.messages) ? response.messages : []
  const images = Array.isArray(response?.images) ? response.images : []
  const productCards = Array.isArray(response?.product_cards) ? response.product_cards : []
  const now = new Date().toISOString()

  messages.forEach((message, index) => {
    items.push({
      id: makeId(),
      kind: 'franco-text',
      text: message?.content ?? '',
      timestamp: now,
    })

    const imagesForIndex = images
      .filter((img) => img?.after_message_index === index)
      .map((img) => img.url)
      .filter(Boolean)

    if (imagesForIndex.length > 0) {
      items.push({ id: makeId(), kind: 'image-group', images: imagesForIndex })
    }
  })

  const lastIndex = messages.length - 1
  const strayImages = images
    .filter((img) => img?.after_message_index == null || img.after_message_index > lastIndex)
    .map((img) => img.url)
    .filter(Boolean)

  if (strayImages.length > 0) {
    items.push({ id: makeId(), kind: 'image-group', images: strayImages })
  }

  if (productCards.length > 0) {
    items.push({ id: makeId(), kind: 'product-cards', cards: productCards })
  }

  const errorText = extractErrorText(response?.error)
  if (errorText) {
    items.push({ id: makeId(), kind: 'error', text: errorText })
  }

  return items
}

export function useChat() {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const [items, setItems] = useState([])
  const [isSending, setIsSending] = useState(false)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  const sendMessage = useCallback(
    async (rawText) => {
      const text = rawText.trim()
      if (!text || isSending) return

      setItems((prev) => [
        ...prev,
        { id: makeId(), kind: 'user-text', text, timestamp: new Date().toISOString() },
      ])
      setIsSending(true)

      try {
        const response = await sendMessageToWebhook({
          sessionId: sessionIdRef.current,
          type: 'text',
          content: text,
        })

        if (response?.session_id && response.session_id !== sessionIdRef.current) {
          setSessionId(response.session_id)
        }

        const francoItems = buildFrancoItems(response)
        if (francoItems.length === 0) {
          francoItems.push({
            id: makeId(),
            kind: 'error',
            text: 'Franco no mandó respuesta esta vez. Probá de nuevo.',
          })
        }

        // Reveladas de a una: la primera aparece al toque (el usuario ya
        // esperó al webhook con el indicador visible); antes de cada
        // siguiente, una pausa corta durante la cual isSending sigue en true,
        // así el indicador "escribiendo..." se muestra entre burbuja y burbuja.
        for (let i = 0; i < francoItems.length; i++) {
          if (i > 0) await sleep(BUBBLE_DELAY_MS)
          const item = francoItems[i]
          setItems((prev) => [...prev, item])
        }
      } catch (err) {
        const text =
          err instanceof WebhookError
            ? err.userMessage
            : 'Uy, algo falló de nuestro lado. Probá de nuevo en un momento.'
        setItems((prev) => [...prev, { id: makeId(), kind: 'error', text }])
      } finally {
        setIsSending(false)
      }
    },
    [isSending],
  )

  const startNewConversation = useCallback(() => {
    setSessionId(crypto.randomUUID())
    setItems([])
  }, [])

  return { sessionId, items, isSending, sendMessage, startNewConversation }
}
