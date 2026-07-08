import { useState } from 'react'
import { EstadoBadge } from '../common/Badge'
import TrashIcon from '../common/TrashIcon'

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// "No mencionado" / vacío se muestran atenuados; un valor real, resaltado.
function isMissing(value) {
  const key = normalize(value)
  return !key || key === 'no mencionado' || key === '-'
}

function LeadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12.5m-9 4h9m-11 4h11M5 7h.01M5 11h.01M5 15h.01" />
    </svg>
  )
}

function ChevronIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Termómetro de 3 segmentos: Frío = 1 (celeste), Intermedio = 2 (ámbar),
// Caliente = 3 (rojo). Tolerante a acentos ("Frío"/"Frio").
const TEMP_CONFIG = {
  frio: { filled: 1, color: 'bg-sky-400' },
  intermedio: { filled: 2, color: 'bg-amber-400' },
  caliente: { filled: 3, color: 'bg-red-500' },
}

function TemperatureMeter({ value }) {
  const { filled, color } = TEMP_CONFIG[normalize(value)] || { filled: 0, color: 'bg-gray-200' }
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Temp:</span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1.5 w-4 rounded-sm ${i < filled ? color : 'bg-gray-200'}`} />
        ))}
      </div>
    </div>
  )
}

function Field({ label, value }) {
  const missing = isMissing(value)
  return (
    <div className="flex justify-between border-b border-emerald-50 pb-2 sm:block sm:border-0 sm:pb-0">
      <p className="mb-0 text-[11px] font-semibold uppercase text-gray-400 sm:mb-1 sm:text-xs">{label}</p>
      <p
        className={`text-right font-medium sm:text-left ${
          missing ? 'italic text-gray-400' : 'text-gray-800'
        }`}
      >
        {value || '—'}
      </p>
    </div>
  )
}

export default function LeadCard({ lead, onDelete }) {
  const [open, setOpen] = useState(false)
  const presupuestoMencionado = !isMissing(lead.presupuesto)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <div className="flex gap-3 sm:gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700">
          <LeadIcon />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-bold text-gray-900 sm:text-lg">
              {lead.nombre || 'Sin nombre'}
            </h3>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <EstadoBadge value={lead.estado} />
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

          <p className="mb-2 truncate text-xs text-gray-600 sm:text-sm">
            Busca: <span className="font-medium text-gray-900">{lead.vehiculo_interes || 'No especificado'}</span>
          </p>

          <div className="mb-2">
            <TemperatureMeter value={lead.temperatura} />
          </div>

          {presupuestoMencionado ? (
            <p className="text-xs sm:text-sm">
              <span className="inline-block rounded border border-emerald-100 bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                Presupuesto: {lead.presupuesto}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-xs italic text-gray-400 sm:text-sm">Presupuesto no mencionado</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-100 py-2 text-sm text-emerald-700 transition hover:bg-emerald-50"
      >
        {open ? 'Ver menos' : 'Ver más'}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-emerald-50 pt-4 text-sm sm:grid-cols-2 sm:gap-y-4">
          <Field label="Teléfono" value={lead.telefono} />
          <Field label="Entrega usado" value={lead.entrega} />
          <Field label="Financia" value={lead.financia} />
          <Field label="Último contacto" value={lead.fecha_contacto} />
          {!isMissing(lead.descripcion_usado) && (
            <div className="sm:col-span-2">
              <p className="mb-1 text-[11px] font-semibold uppercase text-gray-400 sm:mb-2 sm:text-xs">
                Auto que entrega
              </p>
              <p className="text-gray-700">{lead.descripcion_usado}</p>
            </div>
          )}
          <div className="sm:col-span-2">
            <p className="mb-1 text-[11px] font-semibold uppercase text-gray-400 sm:mb-2 sm:text-xs">Resumen</p>
            <p className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-gray-700 sm:text-sm">
              {lead.resumen || 'Sin resumen todavía.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
