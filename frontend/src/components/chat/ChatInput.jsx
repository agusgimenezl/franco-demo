import { useState } from 'react'

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M4 12L20 4L13 20L11 13L4 12Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState('')

  const handleSend = () => {
    if (!value.trim() || disabled) return
    onSend(value)
    setValue('')
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-3 py-3">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribí tu mensaje..."
        disabled={disabled}
        className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] text-slate-800 outline-none focus:border-emerald-400 focus:bg-white disabled:opacity-60"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 active:scale-95"
        aria-label="Enviar mensaje"
      >
        <SendIcon />
      </button>
    </div>
  )
}
