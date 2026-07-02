export class WebhookError extends Error {
  constructor(code, userMessage) {
    super(userMessage)
    this.name = 'WebhookError'
    this.code = code
    this.userMessage = userMessage
  }
}

// Ruta same-origin. El navegador nunca llama al dominio de n8n directo:
// en dev, Vite la proxea (ver vite.config.js); en producción, Render la
// reescribe hacia el webhook real (ver render.yaml). Así evitamos CORS sin
// tocar el fetch ni exponer la URL de n8n en el bundle del cliente.
const WEBHOOK_PATH = '/api/franco'

// Manda un mensaje al webhook de n8n y devuelve el JSON de respuesta tal
// cual, sin transformarlo (eso lo hace quien llame a esta función).
export async function sendMessageToWebhook({ sessionId, type, content }) {
  let response
  try {
    response = await fetch(WEBHOOK_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        type,
        content,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
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
