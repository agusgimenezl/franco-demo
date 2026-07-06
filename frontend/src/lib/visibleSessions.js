// Sesiones que este navegador generó, para pedirle al backend "mostrame estas
// aunque no estén guardadas" en los tabs de Leads e Historial (visible_ids).
const STORAGE_KEY = 'franco_visible_sessions'

export function getVisibleSessionIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id) : []
  } catch {
    return []
  }
}

export function addVisibleSessionId(sessionId) {
  if (!sessionId) return
  const current = getVisibleSessionIds()
  if (current.includes(sessionId)) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, sessionId]))
  } catch {
    // localStorage no disponible (modo privado, cuota llena, etc.); no es crítico.
  }
}
