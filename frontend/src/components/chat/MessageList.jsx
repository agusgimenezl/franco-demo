import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import AudioBubble from './AudioBubble'
import ImageGroup from './ImageGroup'
import ProductCarousel from './ProductCarousel'
import ErrorBubble from './ErrorBubble'
import TypingIndicator from './TypingIndicator'

function ChatItem({ item }) {
  switch (item.kind) {
    case 'user-text':
      return <MessageBubble text={item.text} timestamp={item.timestamp} isUser />
    case 'user-audio':
      return <AudioBubble timestamp={item.timestamp} />
    case 'franco-text':
      return <MessageBubble text={item.text} timestamp={item.timestamp} isUser={false} />
    case 'image-group':
      return <ImageGroup images={item.images} />
    case 'product-cards':
      return <ProductCarousel cards={item.cards} />
    case 'error':
      return <ErrorBubble text={item.text} />
    default:
      return null
  }
}

export default function MessageList({ items, isSending, pendingType }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [items, isSending])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#efeae2] px-3 py-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        {items.length === 0 && !isSending && (
          <p className="mt-10 text-center text-sm text-slate-500">
            Escribile a Franco para empezar la conversación.
          </p>
        )}
        {items.map((item) => (
          <ChatItem key={item.id} item={item} />
        ))}
        {isSending && (
          <TypingIndicator
            label={pendingType === 'audio' ? 'Franco está transcribiendo' : 'Franco está escribiendo'}
          />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
