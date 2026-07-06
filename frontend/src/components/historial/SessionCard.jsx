import { TemperatureBadge } from '../common/Badge'

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true">
      <path d="M6 3a1 1 0 0 0-1 1v16l7-4 7 4V4a1 1 0 0 0-1-1H6Z" />
    </svg>
  )
}

export default function SessionCard({ session, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {session.is_saved && <BookmarkIcon />}
          <p className="truncate text-sm font-semibold text-slate-800">{session.nombre || 'Sin nombre'}</p>
          {isActive && (
            <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              Activa
            </span>
          )}
        </div>
        <TemperatureBadge value={session.temperatura} />
      </div>
      <p className="line-clamp-2 text-xs text-slate-500">{session.primer_mensaje}</p>
      <p className="text-[11px] text-slate-400">{session.fecha_contacto}</p>
    </button>
  )
}
