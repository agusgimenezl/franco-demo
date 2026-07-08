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

// Doble tilde azul de "leído", como WhatsApp.
function BlueTicks() {
  return (
    <svg viewBox="0 0 16 11" width="15" height="11" className="fill-[#53bdeb]" aria-hidden="true">
      <path d="M11.8 1.6l-6.5 7.1-3.6-3.7L.3 6.4l4.9 5.1L13.2 3z" />
      <path d="M15.7 1.6l-6.5 7.1-1.3-1.4 1.4-1.5 5.1-5.6z" />
    </svg>
  )
}

// Burbuja estilo WhatsApp. timestamp es opcional: el historial no lo trae, así
// que sin hora la burbuja simplemente no muestra el pie (ni las tildes).
export default function MessageBubble({ text, timestamp, isUser }) {
  const time = formatTime(timestamp)

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-2.5 py-1.5 shadow-sm ${
          isUser ? 'rounded-tr-none bg-[#d9fdd3]' : 'rounded-tl-none bg-white'
        }`}
      >
        <div className="flex flex-wrap items-end gap-x-2">
          <p className="whitespace-pre-line text-[14.5px] leading-snug text-[#111b21]">{text}</p>
          {time && (
            <span className="ml-auto flex items-center gap-1 whitespace-nowrap text-[11px] text-[#667781]">
              {time}
              {isUser && <BlueTicks />}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
