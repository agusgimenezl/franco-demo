import { useEffect, useState } from 'react'
import { fetchSessionMessages } from '../../lib/crm'
import { extractHistoryTexts } from '../../lib/historyMessages'
import MessageBubble from '../chat/MessageBubble'

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Aplana los mensajes del historial a burbujas. Cada fila 'ai' puede traer
// varios textos empaquetados en su JSON (ver extractHistoryTexts), y cada uno
// se muestra como su propia burbuja, igual que en el chat en vivo.
function toBubbles(messages) {
  const bubbles = []
  messages.forEach((message) => {
    const isUser = message.tipo === 'human'
    extractHistoryTexts(message.contenido).forEach((text) => {
      bubbles.push({ text, isUser })
    })
  })
  return bubbles
}

// Detalle read-only de una conversación histórica, con el mismo look de chat.
export default function SessionDetail({ sessionId, isActive, onBack, onContinue }) {
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    fetchSessionMessages(sessionId)
      .then((data) => {
        if (cancelled) return
        setMessages(data)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  const bubbles = toBubbles(messages)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-shrink-0 items-center gap-2 bg-[#008069] px-2 py-2.5 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="flex-shrink-0 rounded-full p-1.5 text-white transition hover:bg-white/10"
          aria-label="Volver al historial"
        >
          <BackIcon />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[16px] font-medium text-white">Conversación</h1>
        {isActive && (
          <button
            type="button"
            onClick={onContinue}
            className="flex-shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#008069] transition hover:bg-gray-100 active:scale-95"
          >
            Continuar
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#efeae2] px-3 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {status === 'loading' && (
            <p className="mt-10 text-center text-sm text-slate-500">Cargando mensajes…</p>
          )}
          {status === 'error' && (
            <p className="mt-10 text-center text-sm text-red-500">No pudimos cargar esta conversación.</p>
          )}
          {status === 'ready' && bubbles.length === 0 && (
            <p className="mt-10 text-center text-sm text-slate-500">
              Esta conversación todavía no tiene mensajes.
            </p>
          )}
          {status === 'ready' &&
            bubbles.map((bubble, index) => (
              <MessageBubble key={index} text={bubble.text} isUser={bubble.isUser} />
            ))}
        </div>
      </div>
    </div>
  )
}
