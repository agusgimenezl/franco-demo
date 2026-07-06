import { useEffect, useState } from 'react'
import { fetchSessionMessages } from '../../lib/crm'
import MessageBubble from '../chat/MessageBubble'

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Detalle read-only de una conversación guardada/histórica: mismas burbujas
// que el chat en vivo (MessageBubble), sin hora porque session-messages no la trae.
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="flex-shrink-0 rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100"
          aria-label="Volver al historial"
        >
          <BackIcon />
        </button>
        <h1 className="min-w-0 truncate text-[15px] font-semibold text-slate-900">Conversación</h1>
        {isActive && (
          <button
            type="button"
            onClick={onContinue}
            className="ml-auto flex-shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 active:scale-95"
          >
            Continuar conversación
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {status === 'loading' && (
            <p className="mt-10 text-center text-sm text-slate-400">Cargando mensajes…</p>
          )}
          {status === 'error' && (
            <p className="mt-10 text-center text-sm text-red-500">No pudimos cargar esta conversación.</p>
          )}
          {status === 'ready' && messages.length === 0 && (
            <p className="mt-10 text-center text-sm text-slate-400">
              Esta conversación todavía no tiene mensajes.
            </p>
          )}
          {status === 'ready' &&
            messages.map((message, index) => (
              <MessageBubble key={index} text={message.contenido} isUser={message.tipo === 'human'} />
            ))}
        </div>
      </div>
    </div>
  )
}
