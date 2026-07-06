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
    <header className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-base font-semibold text-white">
          F
        </div>
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold leading-tight text-slate-900">Franco</h1>
          <p className="truncate text-xs leading-tight text-slate-500">Asistente de Automotores Tucumán</p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 disabled:opacity-60 ${
            saveStatus === 'saved'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : saveStatus === 'error'
                ? 'border-red-200 bg-red-50 text-red-600'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {SAVE_LABELS[saveStatus]}
        </button>
        <button
          type="button"
          onClick={onNewConversation}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 active:scale-95"
        >
          Nueva conversación
        </button>
      </div>
    </header>
  )
}
