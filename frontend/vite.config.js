import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/franco': {
          target: webhookUrl.origin,
          changeOrigin: true,
          rewrite: () => webhookUrl.pathname,
        },
      },
    },
  }
})
