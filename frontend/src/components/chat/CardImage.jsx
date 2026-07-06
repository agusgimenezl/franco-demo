import { useState } from 'react'

function CarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-slate-300" aria-hidden="true">
      <path
        d="M3 13l2-5.2A2 2 0 0 1 6.9 6.5h10.2a2 2 0 0 1 1.9 1.3L21 13v4a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1H6.5v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="15" r="1" fill="currentColor" />
      <circle cx="16.5" cy="15" r="1" fill="currentColor" />
    </svg>
  )
}

// <img> robusto para las fotos de las cards: skeleton mientras carga, un
// reintento único con cache-buster ante fallo de carga, y un placeholder
// prolijo (nunca el ícono de imagen rota del navegador con el alt suelto) si
// el reintento tampoco carga. Pensado para reusarse en cualquier card (chat y
// futuro tab de stock).
export default function CardImage({ src, alt }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'loaded' | 'error'
  const [attempt, setAttempt] = useState(0)

  const handleError = () => {
    if (attempt === 0) {
      setAttempt(1) // segundo intento con cache-buster
    } else {
      setStatus('error')
    }
  }

  if (status === 'error' || !src) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-100 px-2 text-center">
        <CarIcon />
        <span className="line-clamp-2 text-xs text-slate-400">{alt}</span>
      </div>
    )
  }

  const finalSrc = attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}retry=1`

  return (
    <div className="relative h-full w-full bg-slate-100">
      {status !== 'loaded' && <div className="absolute inset-0 animate-pulse bg-slate-200" />}
      <img
        key={finalSrc}
        src={finalSrc}
        alt={alt}
        loading="eager"
        decoding="async"
        onLoad={() => setStatus('loaded')}
        onError={handleError}
        className={`h-full w-full object-cover transition-opacity duration-200 ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
