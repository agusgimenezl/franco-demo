import { useState } from 'react'

// Traba de conveniencia para la demo: evita borrar sin querer. NO es seguridad
// real (el PIN vive en el bundle del cliente). Cambialo acá si hace falta.
const DELETE_PIN = '1234'

// Modal reutilizable de confirmación con PIN de 4 dígitos. Lo usan tanto Leads
// como Historial. El borrado real lo hace onConfirm (async) en el componente
// padre; acá solo validamos el PIN y mostramos el estado. Si onConfirm rechaza,
// el modal queda abierto con el error (no se da falsa sensación de borrado).
export default function PinModal({ title, description, onConfirm, onCancel }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handlePinChange = (event) => {
    // Solo dígitos, máximo 4.
    const digits = event.target.value.replace(/\D/g, '').slice(0, 4)
    setPin(digits)
    if (error) setError('')
  }

  const handleConfirm = async () => {
    if (busy) return
    if (pin !== DELETE_PIN) {
      setError('PIN incorrecto')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onConfirm()
      // En éxito, el padre desmonta el modal (saca el registro de la vista).
    } catch {
      setError('No se pudo eliminar. Probá de nuevo.')
      setBusy(false)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleConfirm()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}

        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          value={pin}
          onChange={handlePinChange}
          onKeyDown={handleKeyDown}
          placeholder="••••"
          className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-lg tracking-[0.5em] text-slate-800 outline-none focus:border-emerald-400 focus:bg-white"
        />

        {error && <p className="mt-2 text-center text-xs font-medium text-red-500">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 rounded-full bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 active:scale-95 disabled:opacity-60"
          >
            {busy ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
