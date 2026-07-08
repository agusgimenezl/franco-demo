import TrashIcon from '../common/TrashIcon'

// No es un <button> raíz porque adentro va otro botón (eliminar) y no se
// pueden anidar: el contenido clickeable (abrir la conversación) y el tacho
// son dos botones hermanos dentro de un contenedor.
export default function SessionCard({ session, isActive, onOpen, onDelete }) {
  return (
    <div className="flex items-stretch gap-1 rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-l-xl p-3 text-left transition hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-slate-800">{session.nombre || 'Sin nombre'}</p>
          {isActive && (
            <span className="flex-shrink-0 rounded-full bg-[#00a884]/15 px-2 py-0.5 text-[10px] font-medium text-[#008069]">
              Activa
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-xs text-slate-500">
          {session.primer_mensaje || 'Sin mensajes'}
        </p>
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label="Eliminar conversación"
        className="flex flex-shrink-0 items-center rounded-r-xl px-3 text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:scale-95"
      >
        <TrashIcon />
      </button>
    </div>
  )
}
