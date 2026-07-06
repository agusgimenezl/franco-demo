import { useState } from 'react'
import { useChat } from './hooks/useChat'
import ChatTab from './components/chat/ChatTab'
import LeadsTab from './components/leads/LeadsTab'
import HistorialTab from './components/historial/HistorialTab'
import TabNav from './components/layout/TabNav'
import { TABS } from './config/tabs'

function App() {
  const [activeTab, setActiveTab] = useState(TABS[0].id)
  // Vive acá (no en ChatTab) para que Historial sepa cuál es la sesión activa
  // del navegador y pueda ofrecer "Continuar conversación" sobre ella.
  const chat = useChat()

  return (
    <div className="flex h-dvh flex-col bg-slate-50">
      <div className="min-h-0 flex-1">
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
