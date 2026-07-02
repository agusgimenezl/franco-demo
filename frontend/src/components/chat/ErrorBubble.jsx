export default function ErrorBubble({ text }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-amber-200 bg-amber-50 px-4 py-2 text-[15px] leading-relaxed whitespace-pre-line text-amber-800 shadow-sm">
        {text}
      </div>
    </div>
  )
}
