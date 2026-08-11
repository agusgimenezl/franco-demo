// El botón "Guardar" se eliminó: toda conversación se registra sola después del
// primer intercambio (ver el auto-guardado en useChat.js). `saveSession` sigue
// existiendo en lib/crm.js por si vuelve a hacer falta un guardado manual.
export default function ChatHeader({ onNewConversation }) {
  return (
    <header className="flex flex-shrink-0 items-center justify-between gap-2 bg-[#008069] px-3 py-2.5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src="/franco-avatar.jpg"
          alt="Franco"
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover shadow-inner"
        />
        <div className="min-w-0">
          <h1 className="text-[16px] font-medium leading-tight text-white">Franco</h1>
          <p className="truncate text-[12px] leading-tight text-white/80">Asistente de Automotores Tucumán</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onNewConversation}
        className="flex-shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#008069] shadow-sm transition hover:bg-gray-100 active:scale-95"
      >
        Nueva
      </button>
    </header>
  )
}
