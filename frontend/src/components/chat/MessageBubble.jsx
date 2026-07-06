function formatTime(timestamp) {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// timestamp es opcional: el historial (session-messages) no lo trae, así que
// la burbuja simplemente no muestra hora en ese caso.
export default function MessageBubble({ text, timestamp, isUser }) {
  const time = formatTime(timestamp)

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-[15px] leading-relaxed whitespace-pre-line shadow-sm ${
          isUser
            ? 'rounded-br-sm bg-emerald-600 text-white'
            : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
        }`}
      >
        <p>{text}</p>
        {time && (
          <span
            className={`mt-1 block text-right text-[11px] ${
              isUser ? 'text-emerald-100' : 'text-slate-400'
            }`}
          >
            {time}
          </span>
        )}
      </div>
    </div>
  )
}
