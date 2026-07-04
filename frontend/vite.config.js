import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { transcribeBase64 } from './server/transcribe.js'

// En dev no corre server.js: Vite proxea /api/franco a n8n. Pero /api/transcribe
// necesita lógica real (no un proxy), así que la servimos acá con la MISMA
// función que usa server.js en producción. Sin este plugin, /api/transcribe
// caería al fallback SPA y devolvería HTML en vez de JSON.
function transcribeDevPlugin() {
  return {
    name: 'dev-transcribe',
    configureServer(server) {
      server.middlewares.use('/api/transcribe', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const { audio } = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const { status, body } = await transcribeBase64(audio)
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Body inválido.' }))
        }
      })
    },
  }
}

// URL real del webhook de n8n. Solo vive acá (config de Vite, corre en
// Node) y en server.js para producción. Nunca se manda al bundle del
// navegador: el frontend siempre pega a la ruta same-origin /api/franco
// (ver src/lib/webhook.js), que en dev proxeamos hacia acá.
const DEFAULT_N8N_WEBHOOK_URL = 'https://n8n.utopiaflow.tech/webhook/franco-chat'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Sin prefijo "VITE_" a propósito: loadEnv con prefijo vacío la lee para
  // uso acá en el config, pero Vite no la expone en import.meta.env del cliente.
  const env = loadEnv(mode, process.cwd(), '')
  const webhookUrl = new URL(env.N8N_WEBHOOK_URL || DEFAULT_N8N_WEBHOOK_URL)

  // El módulo de transcripción lee process.env; en dev pasamos lo que haya en el
  // .env para poder transcribir localmente sin exportar variables a mano.
  if (env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
  }
  if (env.OPENAI_TRANSCRIBE_MODEL && !process.env.OPENAI_TRANSCRIBE_MODEL) {
    process.env.OPENAI_TRANSCRIBE_MODEL = env.OPENAI_TRANSCRIBE_MODEL
  }

  return {
    plugins: [react(), transcribeDevPlugin()],
    server: {
      proxy: {
        '/api/franco': {
          target: webhookUrl.origin,
          changeOrigin: true,
          rewrite: () => webhookUrl.pathname,
          // El webhook puede tardar hasta ~40s; damos 60s para que el proxy
          // de dev no corte la espera antes que el cliente (paridad con prod).
          proxyTimeout: 60_000,
          timeout: 60_000,
        },
      },
    },
  }
})
