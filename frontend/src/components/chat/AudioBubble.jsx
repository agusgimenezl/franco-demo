function formatTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M6 11a6 6 0 0 0 12 0M12 17v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

// El usuario no ve la transcripción (la hace n8n con Whisper); mostramos una
// burbuja simple que indica que mandó una nota de voz. Estilo WhatsApp: burbuja
// verde de usuario, misma que los mensajes de texto.
export default function AudioBubble({ timestamp }) {
  return (
    <div className="flex justify-end">
      <div className="flex max-w-[85%] items-center gap-2 rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[14.5px] text-[#111b21] shadow-sm">
        <span className="text-[#00a884]">
          <MicIcon />
        </span>
        <span>Mensaje de voz</span>
        <span className="ml-1 text-[11px] text-[#667781]">{formatTime(timestamp)}</span>
      </div>
    </div>
  )
}
