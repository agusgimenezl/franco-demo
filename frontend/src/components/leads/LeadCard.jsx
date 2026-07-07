import { useState } from 'react'
import { TemperatureBadge, EstadoBadge } from '../common/Badge'
import TrashIcon from '../common/TrashIcon'

function ChevronIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-slate-700">{value || '—'}</dd>
    </div>
  )
}

export default function LeadCard({ lead, onDelete }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{lead.nombre || 'Sin nombre'}</p>
          <p className="truncate text-xs text-slate-500">{lead.vehiculo_interes || 'Interés no especificado'}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <TemperatureBadge value={lead.temperatura} />
          <button
            type="button"
            onClick={onDelete}
            aria-label="Eliminar lead"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:scale-95"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-emerald-700">
          {lead.presupuesto || 'Presupuesto sin definir'}
        </p>
        <EstadoBadge value={lead.estado} />
      </div>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
      >
        {open ? 'Ver menos' : 'Ver más'}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-2 text-xs">
          <Field label="Teléfono" value={lead.telefono} />
          <Field label="Entrega usado" value={lead.entrega} />
          <Field label="Financia" value={lead.financia} />
          <Field label="Último contacto" value={lead.fecha_contacto} />
          <div className="col-span-2">
            <Field label="Auto que entrega" value={lead.descripcion_usado} />
          </div>
          <div className="col-span-2">
            <Field label="Resumen" value={lead.resumen} />
          </div>
        </dl>
      )}
    </div>
  )
}
