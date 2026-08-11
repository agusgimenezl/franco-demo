import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import ChatInput from './ChatInput'

// El estado del chat vive en App.jsx (useChat), no acá: así el tab Historial
// puede leer sessionId para saber cuál es "la conversación activa". ChatTab ya no
// necesita el sessionId (lo usaba el botón "Guardar", que se eliminó); App sigue
// pasándolo por el spread y acá simplemente no se desestructura.
export default function ChatTab({
  items,
  isSending,
  pendingType,
  sendMessage,
  sendAudio,
  startNewConversation,
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <ChatHeader onNewConversation={startNewConversation} />
      <MessageList items={items} isSending={isSending} pendingType={pendingType} />
      <ChatInput onSend={sendMessage} onSendAudio={sendAudio} disabled={isSending} />
    </div>
  )
}
