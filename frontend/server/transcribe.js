// Transcripción de audio con Whisper de OpenAI, compartida por el server de
// producción (server.js) y el proxy de dev (vite.config.js) para no duplicar
// la lógica. Corre siempre server-side: la API key nunca toca el navegador.
//
// Recibe el audio en base64 (webm/opus, sin prefijo data:) y devuelve un objeto
// { status, body } listo para responder. No lanza: cualquier fallo se traduce a
// un status/error, así el frontend siempre recibe JSON.

const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions'
const TRANSCRIBE_TIMEOUT_MS = 60_000

export async function transcribeBase64(base64) {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1'

  if (!apiKey) {
    return { status: 500, body: { error: 'OPENAI_API_KEY no está configurada en el servidor.' } }
  }
  if (typeof base64 !== 'string' || base64.length === 0) {
    return { status: 400, body: { error: 'Falta el audio a transcribir.' } }
  }

  try {
    const audioBuffer = Buffer.from(base64, 'base64')
    const form = new FormData()
    // El navegador graba webm/opus; Whisper lo reconoce por la extensión.
    form.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm')
    form.append('model', model)
    // Fijamos español: evita que Whisper "adivine" otro idioma en audios cortos.
    form.append('language', 'es')

    const upstream = await fetch(OPENAI_TRANSCRIBE_URL, {
      method: 'POST',
      // Sin Content-Type manual: fetch le pone el boundary del multipart solo.
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
    })

    if (!upstream.ok) {
      return { status: 502, body: { error: 'No se pudo transcribir el audio.' } }
    }

    const data = await upstream.json()
    return { status: 200, body: { text: typeof data?.text === 'string' ? data.text.trim() : '' } }
  } catch {
    return { status: 502, body: { error: 'No se pudo transcribir el audio.' } }
  }
}
