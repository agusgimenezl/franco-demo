import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, 'dist')

const PORT = process.env.PORT || 10000
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL
const UPSTREAM_TIMEOUT_MS = 30_000

const app = express()
app.use(express.json({ limit: '1mb' }))

// Único endpoint del cliente. Reenvía server-side al webhook real de n8n:
// mismo origen para el navegador, sin CORS, y con control total de método,
// body y timeout (el webhook puede tardar hasta ~25s en responder).
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

app.use(express.static(DIST_DIR))

// Catch-all vía middleware (no ruta con patrón) para no depender de la
// sintaxis de wildcards de path-to-regexp entre versiones de Express.
app.use((req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Franco frontend escuchando en el puerto ${PORT}`)
})
