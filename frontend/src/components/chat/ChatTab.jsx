import { useChat } from '../../hooks/useChat'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import ChatInput from './ChatInput'

export default function ChatTab() {
  const { items, isSending, pendingType, sendMessage, sendAudio, startNewConversation } = useChat()

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <ChatHeader onNewConversation={startNewConversation} />
      <MessageList items={items} isSending={isSending} pendingType={pendingType} />
      <ChatInput onSend={sendMessage} onSendAudio={sendAudio} disabled={isSending} />
    </div>
  )
}
