const ICONS = {
  chat: (
    <path
      d="M4 5h16v10H8l-4 4V5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  ),
  crm: (
    <>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 8a3 3 0 1 1 3 3M21 20c0-2.6-1.9-4.8-4.5-5.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </>
  ),
  historial: (
    <>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
}

export default function TabIcon({ id }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      {ICONS[id] ?? null}
    </svg>
  )
}
