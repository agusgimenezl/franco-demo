export default function ChatHeader({ onNewConversation }) {
  return (
    <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-base font-semibold text-white">
          F
        </div>
        <div>
          <h1 className="text-[15px] font-semibold leading-tight text-slate-900">Franco</h1>
          <p className="text-xs leading-tight text-slate-500">Asistente de Automotores Tucumán</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onNewConversation}
        className="flex-shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 active:scale-95"
      >
        Nueva conversación
      </button>
    </header>
  )
}
