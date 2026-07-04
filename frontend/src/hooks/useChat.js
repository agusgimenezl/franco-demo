import { useCallback, useEffect, useRef, useState } from 'react'
import { sendMessageToWebhook, transcribeAudio, WebhookError } from '../lib/webhook'

// Pausa entre burbujas consecutivas de Franco, para que se sienta como una
// persona mandando varios mensajes seguidos en vez de un bloque de golpe.
const BUBBLE_DELAY_MS = 300

// Cuando el usuario manda varias burbujas seguidas, esperamos este tiempo de
// inactividad desde la última antes de llamar al webhook, y mandamos toda la
// ráfaga en una sola request. Así Franco responde una vez a una idea partida
// en varias burbujas, en vez de una vez por burbuja.
const BURST_DEBOUNCE_MS = 5000

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
  // Qué tipo de entrada está esperando respuesta ('text' | 'audio' | null).
  // El indicador cambia entre "escribiendo..." y "transcribiendo..." según esto.
  const [pendingType, setPendingType] = useState(null)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId
  const isSendingRef = useRef(false)

  // Ráfaga acumulada: partes {type, content} en orden de llegada. No se manda
  // al webhook hasta que pasen BURST_DEBOUNCE_MS sin actividad.
  const burstRef = useRef([])
  const flushTimerRef = useRef(null)

  // Vacía la ráfaga acumulada en una única llamada al webhook y revela las
  // burbujas de Franco de a una.
  const flush = useCallback(async () => {
    flushTimerRef.current = null

    // Si hay una request en vuelo, reintentá en breve sin perder la ráfaga.
    if (isSendingRef.current) {
      flushTimerRef.current = setTimeout(flush, 300)
      return
    }

    const parts = burstRef.current
    if (parts.length === 0) return
    burstRef.current = []

    const hasAudio = parts.some((part) => part.type === 'audio')
    isSendingRef.current = true
    setIsSending(true)
    // Con audio en la ráfaga mostramos "transcribiendo..."; solo texto, "escribiendo...".
    setPendingType(hasAudio ? 'audio' : 'text')

    try {
      // Transcribimos TODO el audio acá (en paralelo) y mandamos siempre texto
      // al webhook. n8n nunca ve audio. Las partes de texto pasan tal cual.
      let text
      if (hasAudio) {
        const results = await Promise.allSettled(
          parts.map((part) =>
            part.type === 'audio' ? transcribeAudio(part.content) : Promise.resolve(part.content),
          ),
        )
        const failed = results.find((r) => r.status === 'rejected')
        if (failed) {
          throw failed.reason instanceof WebhookError
            ? failed.reason
            : new WebhookError('transcription_error', 'No pudimos transcribir tu audio. Probá de nuevo.')
        }
        // Unimos las partes en orden; descartamos vacíos (audio en silencio).
        text = results
          .map((r) => r.value.trim())
          .filter(Boolean)
          .join('\n')
        // Ya transcribimos: el indicador pasa a "escribiendo..." para la respuesta.
        setPendingType('text')
      } else {
        text = parts
          .map((part) => part.content.trim())
          .filter(Boolean)
          .join('\n')
      }

      if (!text) {
        throw new WebhookError('empty_message', 'No te llegué a escuchar bien, probá de nuevo.')
      }

      const response = await sendMessageToWebhook({
        sessionId: sessionIdRef.current,
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
      isSendingRef.current = false
      setIsSending(false)
      setPendingType(null)
    }
  }, [])

  // Agrega la burbuja del usuario al instante, suma la parte a la ráfaga y
  // (re)arranca el contador de 5s. Cada nueva burbuja reinicia el contador.
  const enqueue = useCallback(
    (part, userItem) => {
      setItems((prev) => [...prev, userItem])
      burstRef.current = [...burstRef.current, part]
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
      flushTimerRef.current = setTimeout(flush, BURST_DEBOUNCE_MS)
    },
    [flush],
  )

  const sendMessage = useCallback(
    (rawText) => {
      const text = rawText.trim()
      if (!text) return
      enqueue(
        { type: 'text', content: text },
        { id: makeId(), kind: 'user-text', text, timestamp: new Date().toISOString() },
      )
    },
    [enqueue],
  )

  const sendAudio = useCallback(
    (base64) => {
      if (!base64) return
      enqueue(
        { type: 'audio', content: base64 },
        { id: makeId(), kind: 'user-audio', timestamp: new Date().toISOString() },
      )
    },
    [enqueue],
  )

  const startNewConversation = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    flushTimerRef.current = null
    burstRef.current = []
    setSessionId(crypto.randomUUID())
    setItems([])
  }, [])

  // Cancelá cualquier ráfaga pendiente si el componente se desmonta.
  useEffect(() => () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
  }, [])

  return { sessionId, items, isSending, pendingType, sendMessage, sendAudio, startNewConversation }
}
