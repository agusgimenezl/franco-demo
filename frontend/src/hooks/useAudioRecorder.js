import { useCallback, useRef, useState } from 'react'

// Grabaciones más cortas que esto se descartan: cubren el toque accidental y
// el primer "hold" que en realidad solo dispara el pedido de permiso del mic.
const MIN_DURATION_MS = 600

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      // readAsDataURL da "data:audio/webm;base64,XXXX"; mandamos solo el XXXX.
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const preferred = ['audio/webm;codecs=opus', 'audio/webm']
  for (const type of preferred) {
    if (MediaRecorder.isTypeSupported?.(type)) return type
  }
  return ''
}

// Grabación por "mantener presionado": start() al apretar, stop() al soltar.
// Resuelve el audio como base64 crudo (sin el prefijo data:) vía onComplete.
export function useAudioRecorder({ onComplete, onError }) {
  const [isRecording, setIsRecording] = useState(false)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const startedAtRef = useRef(0)
  // Si el usuario suelta antes de que getUserMedia resuelva, dejamos anotado
  // que hay que frenar apenas arranque el recorder.
  const pendingStopRef = useRef(false)

  const start = useCallback(async () => {
    if (recorderRef.current) return
    pendingStopRef.current = false

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      onError?.('No pudimos acceder al micrófono. Revisá los permisos del navegador.')
      return
    }

    streamRef.current = stream
    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    chunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
    }

    recorder.onstop = async () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      recorderRef.current = null
      setIsRecording(false)

      const chunks = chunksRef.current
      chunksRef.current = []
      const tooShort = Date.now() - startedAtRef.current < MIN_DURATION_MS
      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
      if (tooShort || blob.size === 0) return

      try {
        onComplete?.(await blobToBase64(blob))
      } catch {
        onError?.('No pudimos procesar el audio. Probá de nuevo.')
      }
    }

    recorderRef.current = recorder
    startedAtRef.current = Date.now()
    recorder.start()
    setIsRecording(true)

    // El usuario ya había soltado mientras pedíamos permiso: frenamos ya.
    if (pendingStopRef.current) {
      pendingStopRef.current = false
      recorder.stop()
    }
  }, [onComplete, onError])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    } else {
      pendingStopRef.current = true
    }
  }, [])

  return { isRecording, start, stop }
}
