import { useState } from 'react'
import { useChat } from './hooks/useChat'
import ChatTab from './components/chat/ChatTab'
import LeadsTab from './components/leads/LeadsTab'
import HistorialTab from './components/historial/HistorialTab'
import TabNav from './components/layout/TabNav'
import SidebarNav from './components/layout/SidebarNav'
import { TABS } from './config/tabs'

function App() {
  const [activeTab, setActiveTab] = useState(TABS[0].id)
  // Vive acá (no en ChatTab) para que Historial sepa cuál es la sesión activa
  // del navegador y pueda ofrecer "Continuar conversación" sobre ella.
  const chat = useChat()

  return (
    // En mobile: columna con TabNav abajo. En desktop (md+): fila con
    // SidebarNav a la izquierda (estilo WhatsApp Web), TabNav se oculta solo.
    <div className="flex h-dvh flex-col bg-slate-50 md:flex-row">
      <SidebarNav activeTab={activeTab} onChange={setActiveTab} />
      <div className="min-h-0 min-w-0 flex-1">
        {activeTab === 'chat' && <ChatTab {...chat} />}
        {activeTab === 'crm' && <LeadsTab />}
        {activeTab === 'historial' && (
          <HistorialTab
            activeSessionId={chat.sessionId}
            onContinueActive={() => setActiveTab('chat')}
          />
        )}
      </div>
      <TabNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  )
}

export default App
