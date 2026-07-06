import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { transcribeBase64 } from './server/transcribe.js'
import { forwardToN8n } from './server/n8n.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, 'dist')

const PORT = process.env.PORT || 10000
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL
// El webhook puede tardar hasta ~40s (procesa un prompt largo y a veces arma
// el catálogo de autos). Le damos 60s antes de abortar, para no cortar una
// respuesta que todavía viene en camino. El cliente usa el mismo tope.
const UPSTREAM_TIMEOUT_MS = 60_000

const app = express()
// Límite holgado: los mensajes de audio llegan como base64 y pueden pesar.
app.use(express.json({ limit: '15mb' }))

// Único endpoint del cliente. Reenvía server-side al webhook real de n8n:
// mismo origen para el navegador, sin CORS, y con control total de método,
// body y timeout (el webhook puede tardar hasta ~40s en responder).
app.post('/api/franco', async (req, res) => {
  if (!N8N_WEBHOOK_URL) {
    res.status(500).json({ error: 'N8N_WEBHOOK_URL no está configurada en el servidor.' })
    return
  }

  try {
    const upstream = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })

    const text = await upstream.text()
    res.status(upstream.status)
    res.set('Content-Type', upstream.headers.get('content-type') || 'application/json')
    res.send(text)
  } catch {
    res.status(502).json({ error: 'No se pudo contactar al webhook de n8n.' })
  }
})

// Transcribe un audio (base64 webm/opus) con Whisper y devuelve { text }. Lo
// llama el frontend por CADA audio antes de armar el mensaje de texto que va al
// webhook (ver src/hooks/useChat.js). La lógica vive en ./server/transcribe.js,
// compartida con el proxy de dev.
app.post('/api/transcribe', async (req, res) => {
  const { status, body } = await transcribeBase64(req.body?.audio)
  res.status(status).json(body)
})

// Endpoints del CRM (tabs Leads e Historial). Mismo origen que /api/franco
// (N8N_WEBHOOK_URL): solo cambia el path de n8n. Ver ./server/n8n.js.
async function proxyGet(req, res, n8nPath) {
  const search = new URLSearchParams(req.query).toString()
  const { status, text, contentType } = await forwardToN8n({ method: 'GET', path: n8nPath, search })
  res.status(status).set('Content-Type', contentType).send(text)
}

app.get('/api/leads', (req, res) => proxyGet(req, res, '/webhook/leads'))
app.get('/api/sessions', (req, res) => proxyGet(req, res, '/webhook/sessions'))
app.get('/api/session-messages', (req, res) => proxyGet(req, res, '/webhook/session-messages'))

app.post('/api/session-save', async (req, res) => {
  const { status, text, contentType } = await forwardToN8n({
    method: 'POST',
    path: '/webhook/session-save',
    body: req.body,
  })
  res.status(status).set('Content-Type', contentType).send(text)
})

app.use(express.static(DIST_DIR))

// Catch-all vía middleware (no ruta con patrón) para no depender de la
// sintaxis de wildcards de path-to-regexp entre versiones de Express.
app.use((req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Franco frontend escuchando en el puerto ${PORT}`)
})
