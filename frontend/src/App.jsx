import { useState } from 'react'
import ChatTab from './components/chat/ChatTab'
import TabNav from './components/layout/TabNav'
import { TABS } from './config/tabs'

// Cada tab habilitado en config/tabs.js debe tener una entrada acá.
const TAB_CONTENT = {
  chat: ChatTab,
}

function App() {
  const [activeTab, setActiveTab] = useState(TABS[0].id)
  const ActiveComponent = TAB_CONTENT[activeTab]

  return (
    <div className="flex h-dvh flex-col bg-slate-50">
      <div className="min-h-0 flex-1">{ActiveComponent && <ActiveComponent />}</div>
      <TabNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  )
}

export default App
