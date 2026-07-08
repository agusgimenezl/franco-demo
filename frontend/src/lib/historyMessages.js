// PARCHE DE FRONTEND (la causa raíz es del backend). El endpoint
// /webhook/session-messages devuelve los mensajes 'human' como texto plano,
// pero los mensajes 'ai' llegan como el JSON estructurado crudo del agente:
//   {"output":{"messages":[{"type":"text","content":"..."}],"product_cards":[...]}}
// Mostrar eso tal cual deja un bloque JSON ilegible en el historial. Acá
// extraemos solo los textos de messages[].content. Si el contenido ya es texto
// plano (mensajes 'human', o si el backend algún día devuelve texto limpio),
// pasa tal cual. Esto NO inventa datos: parsea una estructura conocida.
//
// Fix real (backend): que session-messages devuelva el texto ya extraído para
// los mensajes 'ai', igual que hace con los 'human'.
export function extractHistoryTexts(contenido) {
  if (typeof contenido !== 'string') return ['']
  const trimmed = contenido.trim()

  // Texto plano (caso 'human' y fallback): no intentamos parsear.
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return [trimmed]

  try {
    const parsed = JSON.parse(trimmed)
    const messages = parsed?.output?.messages ?? parsed?.messages
    if (Array.isArray(messages)) {
      const texts = messages
        .map((message) => message?.content)
        .filter((text) => typeof text === 'string' && text.trim())
      if (texts.length > 0) return texts
    }
    // JSON pero sin la forma esperada: mostramos el texto plano como último recurso.
    return [trimmed]
  } catch {
    return [trimmed]
  }
}
