export class WebhookError extends Error {
  constructor(code, userMessage) {
    super(userMessage)
    this.name = 'WebhookError'
    this.code = code
    this.userMessage = userMessage
  }
}

// Rutas same-origin. El navegador nunca llama a n8n ni a OpenAI directo: en dev
// las sirve Vite (proxy + plugin), en producción server.js. Así evitamos CORS y
// no exponemos ninguna URL ni API key en el bundle del cliente.
const WEBHOOK_PATH = '/api/franco'
const TRANSCRIBE_PATH = '/api/transcribe'

// El webhook de n8n puede tardar hasta ~40s (procesa un prompt largo y a veces
// arma el catálogo). Damos 60s antes de abortar del lado del cliente: así no
// cortamos una request que sigue viva, y el indicador se mantiene toda la espera.
// La transcripción usa el mismo tope (Whisper suele ser mucho más rápido).
const REQUEST_TIMEOUT_MS = 60_000

// Transcribe un audio (base64 webm/opus) llamando a /api/transcribe, que del
// lado del server usa Whisper de OpenAI. Devuelve el texto ya transcripto. El
// frontend transcribe TODO el audio antes de mandar al webhook, así el contrato
// con n8n es solo texto.
export async function transcribeAudio(base64) {
  let response
  try {
    response = await fetch(TRANSCRIBE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64 }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      throw new WebhookError(
        'timeout',
        'La transcripción del audio está tardando más de lo normal. Probá de nuevo.',
      )
    }
    throw new WebhookError(
      'network',
      'No pudimos procesar tu audio. Revisá tu conexión e intentá de nuevo.',
    )
  }

  if (!response.ok) {
    throw new WebhookError('transcription_error', 'No pudimos transcribir tu audio. Probá de nuevo.')
  }

  try {
    const data = await response.json()
    return typeof data?.text === 'string' ? data.text : ''
  } catch {
    throw new WebhookError(
      'invalid_response',
      'Recibimos una respuesta inesperada al transcribir. Probá de nuevo.',
    )
  }
}

// Manda un mensaje de texto al webhook de n8n y devuelve el JSON de respuesta
// tal cual, sin transformarlo (eso lo hace quien llame a esta función). El
// contrato es solo texto: cualquier audio ya se transcribió antes (ver
// transcribeAudio y src/hooks/useChat.js).
export async function sendMessageToWebhook({ sessionId, content }) {
  let response
  try {
    response = await fetch(WEBHOOK_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        type: 'text',
        content,
        timestamp: new Date().toISOString(),
      }),
      // Aborta recién a los 60s. No usamos un valor menor para no cortar
      // respuestas lentas pero válidas del agente.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    // Timeout real (se cumplieron los 60s) vs. fallo de conexión: mensajes
    // distintos para no confundir "tardó demasiado" con "no hay red".
    if (err?.name === 'TimeoutError') {
      throw new WebhookError(
        'timeout',
        'Franco está tardando más de lo normal. Probá de nuevo en un momento.',
      )
    }
    throw new WebhookError(
      'network',
      'No pudimos conectar con Franco. Revisá tu conexión e intentá de nuevo.',
    )
  }

  if (!response.ok) {
    throw new WebhookError(
      'http_error',
      'Franco tuvo un problema para responder. Probá de nuevo en un momento.',
    )
  }

  try {
    return await response.json()
  } catch {
    throw new WebhookError(
      'invalid_response',
      'Recibimos una respuesta inesperada de Franco. Probá de nuevo.',
    )
  }
}
