export default function TypingIndicator({ label = 'Franco está escribiendo' }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-lg rounded-tl-none bg-white px-3 py-2.5 shadow-sm">
        <span className="mr-1 text-xs text-[#667781]">{label}</span>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8696a0] [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8696a0] [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8696a0]" />
      </div>
    </div>
  )
}
