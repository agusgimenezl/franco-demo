import { useState } from 'react'
import CardImage from './CardImage'

export default function ImageGroup({ images }) {
  const [expandedUrl, setExpandedUrl] = useState(null)

  if (!images || images.length === 0) return null

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[85%] gap-2 overflow-x-auto pb-1">
        {images.map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            onClick={() => setExpandedUrl(url)}
            className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
          >
            <CardImage src={url} alt="Foto del vehículo" />
          </button>
        ))}
      </div>

      {expandedUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpandedUrl(null)}
        >
          <img
            src={expandedUrl}
            alt="Foto del vehículo ampliada"
            className="max-h-full max-w-full rounded-lg"
          />
        </div>
      )}
    </div>
  )
}
