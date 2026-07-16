import { TABS } from '../../config/tabs'
import TabIcon from './TabIcon'

// Barra lateral estilo WhatsApp Web/Desktop: solo en pantallas md+ (oculta en
// mobile, donde se usa TabNav abajo en su lugar). Mismos TABS/TabIcon que la
// barra inferior, para no duplicar la fuente de verdad de la navegación.
export default function SidebarNav({ activeTab, onChange }) {
  return (
    <nav className="hidden w-60 flex-shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4">
        <img
          src="/franco-avatar.jpg"
          alt="Franco"
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">Franco</p>
          <p className="truncate text-xs text-slate-500">Automotores Tucumán</p>
        </div>
      </div>

      <div className="flex flex-col gap-1 p-2">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-[#00a884]/10 text-[#008069]'
                  : 'text-[#54656f] hover:bg-slate-50'
              }`}
            >
              <TabIcon id={tab.id} />
              {tab.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
