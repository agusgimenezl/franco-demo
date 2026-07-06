const TEMPERATURE_STYLES = {
  Frío: 'bg-sky-100 text-sky-700',
  Intermedio: 'bg-amber-100 text-amber-700',
  Caliente: 'bg-red-100 text-red-700',
}

export function TemperatureBadge({ value }) {
  const style = TEMPERATURE_STYLES[value] || 'bg-slate-100 text-slate-500'
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${style}`}
    >
      {value || 'Sin dato'}
    </span>
  )
}

const ESTADO_STYLES = {
  Nuevo: 'bg-slate-100 text-slate-600',
  'En conversación': 'bg-blue-100 text-blue-700',
  'Requiere asesor': 'bg-emerald-100 text-emerald-700',
}

export function EstadoBadge({ value }) {
  const style = ESTADO_STYLES[value] || 'bg-slate-100 text-slate-500'
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${style}`}
    >
      {value || 'Sin dato'}
    </span>
  )
}
