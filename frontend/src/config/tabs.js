// Estructura preparada para los 5 tabs de la demo. Por ahora solo "chat" está
// habilitado y tiene componente asociado en App.jsx. Los demás se agregan
// más adelante: alcanza con sumar su componente a TAB_CONTENT y poner enabled: true.
export const TABS = [
  { id: 'chat', label: 'Chat', enabled: true },
  { id: 'crm', label: 'Leads', enabled: false },
  { id: 'stock', label: 'Stock', enabled: false },
  { id: 'historial', label: 'Historial', enabled: false },
  { id: 'config', label: 'Config', enabled: false },
]
