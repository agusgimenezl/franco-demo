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
    <div className="flex-shrink-0 border-t border-slate-200 bg-white">
      {recError && (
        <p className="px-4 pt-2 text-center text-xs text-red-500">{recError}</p>
      )}
      <div className="flex items-center gap-2 px-3 py-3">
        {recorder.isRecording ? (
          <div className="flex flex-1 items-center gap-2 rounded-full bg-red-50 px-4 py-2.5 text-[15px] text-red-600">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="font-medium">Grabando…</span>
            <span className="ml-auto text-xs text-red-400">Soltá para enviar</span>
          </div>
        ) : (
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu mensaje..."
            disabled={disabled}
            className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] text-slate-800 outline-none focus:border-emerald-400 focus:bg-white disabled:opacity-60"
          />
        )}

        {hasText ? (
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 active:scale-95"
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
            className={`flex h-10 w-10 flex-shrink-0 touch-none items-center justify-center rounded-full text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 active:scale-95 ${
              recorder.isRecording ? 'bg-red-500 scale-110' : 'bg-emerald-600'
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
