import { useEffect, useState } from 'react'
import { fetchLeads } from '../../lib/crm'
import { getVisibleSessionIds } from '../../lib/visibleSessions'
import LeadCard from './LeadCard'

const POLL_INTERVAL_MS = 4000

function LeadsSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="h-4 w-1/2 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
          <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
        </div>
      ))}
    </>
  )
}

export default function LeadsTab() {
  const [leads, setLeads] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await fetchLeads(getVisibleSessionIds())
        if (cancelled) return
        setLeads(data)
        setStatus('ready')
      } catch {
        if (cancelled) return
        // Si ya había datos, un fallo puntual del polling no los tapa con un error.
        setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'))
      }
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <header className="flex-shrink-0 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h1 className="text-[15px] font-semibold text-slate-900">Leads</h1>
        <p className="text-xs text-slate-500">Conversaciones con interés comercial</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {status === 'loading' && <LeadsSkeleton />}
          {status === 'error' && (
            <p className="mt-10 text-center text-sm text-red-500">
              No pudimos cargar los leads. Reintentando…
            </p>
          )}
          {status === 'ready' && leads.length === 0 && (
            <p className="mt-10 text-center text-sm text-slate-400">
              Todavía no hay leads. Cuando alguien converse con Franco, aparecen acá.
            </p>
          )}
          {status === 'ready' &&
            leads.map((lead) => <LeadCard key={lead.session_id} lead={lead} />)}
        </div>
      </div>
    </div>
  )
}
