// Reenvío server-side a los endpoints auxiliares de n8n (leads, sessions,
// session-messages, session-save). Comparten SIEMPRE el mismo origen que ya
// usa el chat (N8N_WEBHOOK_URL) — nunca un dominio hardcodeado nuevo — solo
// cambia el path. Compartido entre server.js (producción) y vite.config.js
// (proxy de dev), igual que server/transcribe.js.
const N8N_PROXY_TIMEOUT_MS = 20_000

function getN8nOrigin() {
  const raw = process.env.N8N_WEBHOOK_URL
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

// Se arma siempre (incluso para GET, que no tienen body) para que el header de
// auth también viaje en Leads/Historial. Content-Type solo cuando hay body.
function buildHeaders(hasBody) {
  const headers = {}
  if (hasBody) headers['Content-Type'] = 'application/json'
  if (process.env.N8N_AUTH_TOKEN) headers['X-Franco-Auth'] = process.env.N8N_AUTH_TOKEN
  return headers
}

// Devuelve el texto crudo de la respuesta tal cual (mismo patrón que
// /api/franco): sin parsear ni transformar el body de n8n.
export async function forwardToN8n({ method, path, search, body }) {
  const origin = getN8nOrigin()
  if (!origin) {
    return {
      status: 500,
      text: JSON.stringify({ error: 'N8N_WEBHOOK_URL no está configurada en el servidor.' }),
      contentType: 'application/json',
    }
  }

  const url = `${origin}${path}${search ? `?${search}` : ''}`

  try {
    const upstream = await fetch(url, {
      method,
      headers: buildHeaders(body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(N8N_PROXY_TIMEOUT_MS),
    })
    const text = await upstream.text()
    return {
      status: upstream.status,
      text,
      contentType: upstream.headers.get('content-type') || 'application/json',
    }
  } catch {
    return {
      status: 502,
      text: JSON.stringify({ error: 'No se pudo contactar al webhook de n8n.' }),
      contentType: 'application/json',
    }
  }
}
