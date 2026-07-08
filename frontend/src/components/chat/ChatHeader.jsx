import { useState } from 'react'
import { saveSession } from '../../lib/crm'

// Vuelve a 'idle' un rato después de guardar (ok) o fallar, para que el
// botón no quede pegado en "Guardada ✓" / error para siempre.
const RESET_DELAY_MS = 2500

const SAVE_LABELS = {
  idle: 'Guardar',
  saving: 'Guardando…',
  saved: 'Guardada ✓',
  error: 'No se pudo',
}

export default function ChatHeader({ sessionId, onNewConversation }) {
  const [saveStatus, setSaveStatus] = useState('idle')

  const handleSave = async () => {
    if (saveStatus === 'saving') return
    setSaveStatus('saving')
    try {
      await saveSession(sessionId)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    } finally {
      setTimeout(() => setSaveStatus('idle'), RESET_DELAY_MS)
    }
  }

  return (
    <header className="flex flex-shrink-0 items-center justify-between gap-2 bg-[#008069] px-3 py-2.5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#00a884] text-lg font-semibold text-white shadow-inner">
          F
        </div>
        <div className="min-w-0">
          <h1 className="text-[16px] font-medium leading-tight text-white">Franco</h1>
          <p className="truncate text-[12px] leading-tight text-white/80">Asistente de Automotores Tucumán</p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition active:scale-95 disabled:opacity-70 ${
            saveStatus === 'saved'
              ? 'bg-white text-[#008069]'
              : saveStatus === 'error'
                ? 'border border-white/40 bg-red-500/20 text-white'
                : 'border border-white/40 text-white hover:bg-white/10'
          }`}
        >
          {SAVE_LABELS[saveStatus]}
        </button>
        <button
          type="button"
          onClick={onNewConversation}
          className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#008069] shadow-sm transition hover:bg-gray-100 active:scale-95"
        >
          Nueva
        </button>
      </div>
    </header>
  )
}
