import { TABS } from '../../config/tabs'
import TabIcon from './TabIcon'

export default function TabNav({ activeTab, onChange }) {
  return (
    <nav className="flex flex-shrink-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
              isActive ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <TabIcon id={tab.id} />
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
