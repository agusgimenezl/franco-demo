import MessageBubble from './MessageBubble'
import AudioBubble from './AudioBubble'
import ImageGroup from './ImageGroup'
import ProductCarousel from './ProductCarousel'
import ErrorBubble from './ErrorBubble'

// Renderiza un item del chat según su tipo. Lo usan tanto MessageList (chat
// vivo) como SessionDetail (historial), para que ambos se vean idénticos y no
// se duplique la lógica de render (burbujas, cards, imágenes).
export default function ChatItem({ item }) {
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
