import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { transcribeBase64 } from './server/transcribe.js'
import { forwardToN8n } from './server/n8n.js'

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

// Igual que /api/transcribe: en dev no corre server.js, así que proxeamos acá
// los endpoints del CRM (leads/sessions/session-messages/session-save) con la
// MISMA lógica de reenvío que usa producción (./server/n8n.js). Derivan del
// mismo origen que /api/franco: nunca un dominio hardcodeado nuevo.
function crmDevPlugin() {
  const routes = {
    '/api/leads': '/webhook/leads',
    '/api/sessions': '/webhook/sessions',
    '/api/session-messages': '/webhook/session-messages',
    '/api/session-save': '/webhook/session-save',
    '/api/session-delete': '/webhook/session-delete',
  }

  return {
    name: 'dev-crm',
    configureServer(server) {
      for (const [routePath, n8nPath] of Object.entries(routes)) {
        server.middlewares.use(routePath, async (req, res) => {
          let body
          if (req.method === 'POST') {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            try {
              body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
            } catch {
              body = {}
            }
          }

          // Connect ya recortó routePath del inicio; lo que queda es la
          // query string (con o sin "?"/"/" adelante según el caso).
          const [, search] = (req.url || '').split('?')
          const { status, text, contentType } = await forwardToN8n({
            method: req.method,
            path: n8nPath,
            search,
            body,
          })
          res.statusCode = status
          res.setHeader('Content-Type', contentType)
          res.end(text)
        })
      }
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

  // server/n8n.js (forwardToN8n, usado por crmDevPlugin) lee process.env, no
  // el "env" de loadEnv. Sin esto, /api/leads y compañía en dev tirarían 500
  // aunque /api/franco funcione bien (ese usa webhookUrl directamente).
  if (!process.env.N8N_WEBHOOK_URL) {
    process.env.N8N_WEBHOOK_URL = webhookUrl.href
  }

  // El módulo de transcripción lee process.env; en dev pasamos lo que haya en el
  // .env para poder transcribir localmente sin exportar variables a mano.
  if (env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
  }
  if (env.OPENAI_TRANSCRIBE_MODEL && !process.env.OPENAI_TRANSCRIBE_MODEL) {
    process.env.OPENAI_TRANSCRIBE_MODEL = env.OPENAI_TRANSCRIBE_MODEL
  }

  return {
    plugins: [react(), transcribeDevPlugin(), crmDevPlugin()],
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
