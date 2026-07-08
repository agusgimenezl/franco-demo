import { useState } from 'react'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M4 12L20 4L13 20L11 13L4 12Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
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

// Ícono de emoji decorativo (como WhatsApp). No abre nada: es solo para que la
// barra de input se lea como la de WhatsApp en la demo.
function EmojiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.8 14.5a4.2 4.2 0 0 0 6.4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </svg>
  )
}

export default function ChatInput({ onSend, onSendAudio, disabled }) {
  const [value, setValue] = useState('')
  const [recError, setRecError] = useState('')

  const recorder = useAudioRecorder({
    onComplete: (base64) => onSendAudio(base64),
    onError: (message) => setRecError(message),
  })

  const hasText = value.trim().length > 0

  const handleSend = () => {
    if (!hasText || disabled) return
    onSend(value)
    setValue('')
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSend()
    }
  }

  const startRecording = (event) => {
    if (disabled) return
    event.preventDefault()
    setRecError('')
    // Capturamos el puntero para recibir el "soltar" aunque el dedo/mouse se
    // corra fuera del botón mientras graba. Si falla, seguimos grabando igual.
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      /* puntero no capturable; no es crítico */
    }
    recorder.start()
  }

  const stopRecording = (event) => {
    event.preventDefault()
    recorder.stop()
  }

  return (
    <div className="flex-shrink-0 bg-[#f0f2f5]">
      {recError && <p className="px-4 pt-2 text-center text-xs text-red-500">{recError}</p>}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {recorder.isRecording ? (
          <div className="flex min-h-[46px] flex-1 items-center gap-2 rounded-3xl bg-white px-4 text-[15px] text-red-600 shadow-sm">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="font-medium">Grabando…</span>
            <span className="ml-auto text-xs text-[#8696a0]">Soltá para enviar</span>
          </div>
        ) : (
          <div className="flex min-h-[46px] flex-1 items-center rounded-3xl bg-white px-3 shadow-sm">
            <span className="text-[#8696a0]" aria-hidden="true">
              <EmojiIcon />
            </span>
            <input
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Mensaje"
              disabled={disabled}
              className="flex-1 bg-transparent px-3 py-2.5 text-[15px] text-[#111b21] outline-none placeholder-[#8696a0] disabled:opacity-60"
            />
          </div>
        )}

        {hasText ? (
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled}
            className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow-sm transition hover:bg-[#008f6f] disabled:cursor-not-allowed disabled:bg-[#8696a0] active:scale-95"
            aria-label="Enviar mensaje"
          >
            <SendIcon />
          </button>
        ) : (
          <button
            type="button"
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerCancel={stopRecording}
            onContextMenu={(event) => event.preventDefault()}
            disabled={disabled}
            className={`flex h-[46px] w-[46px] flex-shrink-0 touch-none items-center justify-center rounded-full text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-[#8696a0] active:scale-95 ${
              recorder.isRecording ? 'scale-110 bg-red-500' : 'bg-[#00a884] hover:bg-[#008f6f]'
            }`}
            aria-label={recorder.isRecording ? 'Soltá para enviar el audio' : 'Mantené presionado para grabar'}
          >
            <MicIcon />
          </button>
        )}
      </div>
    </div>
  )
}
