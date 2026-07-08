// Normaliza para comparar sin depender de acentos/mayúsculas: el backend a
// veces manda "En conversacion" (sin acento) y otras "En conversación".
function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

const ESTADO_STYLES = {
  nuevo: 'bg-slate-100 text-slate-600 border-slate-200',
  'en conversacion': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'requiere asesor': 'bg-emerald-700 text-white border-emerald-800 shadow-sm',
}

// Label canónico para los estados conocidos (así se ve prolijo aunque el
// backend mande el valor sin acento). Para un valor desconocido, mostramos el
// que vino tal cual.
const ESTADO_LABELS = {
  nuevo: 'Nuevo',
  'en conversacion': 'En conversación',
  'requiere asesor': 'Requiere asesor',
}

export function EstadoBadge({ value }) {
  const key = normalize(value)
  const style = ESTADO_STYLES[key] || 'bg-slate-100 text-slate-500 border-slate-200'
  const label = ESTADO_LABELS[key] || value || 'Sin estado'
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:text-xs ${style}`}
    >
      {label}
    </span>
  )
}
