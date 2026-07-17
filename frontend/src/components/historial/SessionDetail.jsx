import { useEffect, useState } from 'react'
import { fetchSessionMessages } from '../../lib/crm'
import { buildFrancoItems, makeId } from '../../lib/francoItems'
import ChatItem from '../chat/ChatItem'

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// El backend guarda cada fila como { rol, contenido }. contenido puede venir
// como objeto o como string JSON: lo normalizamos con parseo seguro.
function parseContenido(contenido) {
  if (contenido == null) return null
  if (typeof contenido === 'string') {
    try {
      return JSON.parse(contenido)
    } catch {
      return null
    }
  }
  return contenido
}

// Convierte la conversación guardada a la MISMA lista de items del chat vivo:
// - rol "user": una burbuja de usuario con contenido.text.
// - rol "franco": contenido es { messages, images, product_cards } igual que la
//   respuesta del chat vivo, así que lo pasamos por el mismo buildFrancoItems
//   (texto + cards + fotos, respetando after_message_index).
// Un mensaje que no parsea se saltea sin romper la vista. Sin timestamp: el
// historial no guarda hora, así las burbujas no muestran una hora engañosa.
function buildHistoryItems(messages) {
  const items = []
  messages.forEach((message) => {
    const contenido = parseContenido(message.contenido)
    if (!contenido) return

    if (message.rol === 'user') {
      const text = typeof contenido.text === 'string' ? contenido.text : ''
      if (text) items.push({ id: makeId(), kind: 'user-text', text })
    } else if (message.rol === 'franco') {
      buildFrancoItems(contenido).forEach((item) => {
        items.push({ ...item, timestamp: undefined })
      })
    }
  })
  return items
}

// Detalle read-only de una conversación histórica, con el mismo look de chat.
// contactName es el campo 'nombre' de la sesión (viene de /sessions, ya
// resuelto por el backend a nombre real o teléfono ficticio si no lo dio):
// no hace falta pedir nada más para mostrarlo en el header, tipo contacto de
// WhatsApp.
export default function SessionDetail({ sessionId, contactName, isActive, onBack, onContinue }) {
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

  const items = buildHistoryItems(messages)

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
        <img
          src="/franco-avatar.jpg"
          alt="Franco"
          className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
        />
        <h1 className="min-w-0 flex-1 truncate text-[16px] font-medium text-white">
          {contactName || 'Contacto'}
        </h1>
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
          {status === 'ready' && items.length === 0 && (
            <p className="mt-10 text-center text-sm text-slate-500">
              Esta conversación todavía no tiene mensajes.
            </p>
          )}
          {status === 'ready' && items.map((item) => <ChatItem key={item.id} item={item} />)}
        </div>
      </div>
    </div>
  )
}
