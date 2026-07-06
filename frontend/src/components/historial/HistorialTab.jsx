import { useEffect, useState } from 'react'
import { fetchSessions } from '../../lib/crm'
import { getVisibleSessionIds } from '../../lib/visibleSessions'
import SessionCard from './SessionCard'
import SessionDetail from './SessionDetail'

// activeSessionId: el session_id actual del hook de chat (App.jsx), para
// distinguir "tu conversación activa" (permite Continuar) de una guardada
// read-only. onContinueActive: vuelve al tab Chat.
export default function HistorialTab({ activeSessionId, onContinueActive }) {
  const [sessions, setSessions] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [openSessionId, setOpenSessionId] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetchSessions(getVisibleSessionIds())
      .then((data) => {
        if (cancelled) return
        setSessions(data)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (openSessionId) {
    return (
      <SessionDetail
        sessionId={openSessionId}
        isActive={openSessionId === activeSessionId}
        onBack={() => setOpenSessionId(null)}
        onContinue={onContinueActive}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <header className="flex-shrink-0 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h1 className="text-[15px] font-semibold text-slate-900">Historial</h1>
        <p className="text-xs text-slate-500">Tus conversaciones con Franco</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {status === 'loading' && (
            <p className="mt-10 text-center text-sm text-slate-400">Cargando conversaciones…</p>
          )}
          {status === 'error' && (
            <p className="mt-10 text-center text-sm text-red-500">
              No pudimos cargar el historial. Probá de nuevo más tarde.
            </p>
          )}
          {status === 'ready' && sessions.length === 0 && (
            <p className="mt-10 text-center text-sm text-slate-400">
              Todavía no tenés conversaciones guardadas.
            </p>
          )}
          {status === 'ready' &&
            sessions.map((session) => (
              <SessionCard
                key={session.session_id}
                session={session}
                isActive={session.session_id === activeSessionId}
                onClick={() => setOpenSessionId(session.session_id)}
              />
            ))}
        </div>
      </div>
    </div>
  )
}
