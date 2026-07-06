import { WebhookError } from './webhook'

// Rutas same-origin (mismo patrón que webhook.js): el navegador nunca llama a
// n8n directo, siempre pega acá y server.js/vite.config.js reenvían server-side.
const LEADS_PATH = '/api/leads'
const SESSIONS_PATH = '/api/sessions'
const SESSION_MESSAGES_PATH = '/api/session-messages'
const SESSION_SAVE_PATH = '/api/session-save'
const REQUEST_TIMEOUT_MS = 20_000

async function getJson(path, params) {
  const search = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') search.set(key, value)
    }
  }
  const query = search.toString()

  let response
  try {
    response = await fetch(query ? `${path}?${query}` : path, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new WebhookError('network', 'No pudimos conectar con el servidor. Revisá tu conexión.')
  }

  if (!response.ok) {
    throw new WebhookError('http_error', 'El servidor tuvo un problema para responder.')
  }

  // Body vacío (200 sin contenido) se trata como "sin datos", no como error:
  // un workflow de n8n recién conectado puede responder así antes de tener
  // datos reales, y no es distinto de un array vacío para la UI.
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    throw new WebhookError('invalid_response', 'Recibimos una respuesta inesperada del servidor.')
  }
}

export async function fetchLeads(visibleIds) {
  const data = await getJson(LEADS_PATH, { visible_ids: visibleIds.join(',') })
  return Array.isArray(data) ? data : []
}

export async function fetchSessions(visibleIds) {
  const data = await getJson(SESSIONS_PATH, { visible_ids: visibleIds.join(',') })
  return Array.isArray(data) ? data : []
}

export async function fetchSessionMessages(sessionId) {
  const data = await getJson(SESSION_MESSAGES_PATH, { session_id: sessionId })
  return Array.isArray(data) ? data : []
}

// Marca una sesión como guardada. No hace falta leer la respuesta más allá
// del status: si no tira, se guardó.
export async function saveSession(sessionId) {
  let response
  try {
    response = await fetch(SESSION_SAVE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new WebhookError('network', 'No pudimos guardar la conversación. Revisá tu conexión.')
  }

  if (!response.ok) {
    throw new WebhookError('http_error', 'No pudimos guardar la conversación.')
  }
}
