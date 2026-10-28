import React, { useEffect, useRef, useState } from 'react'
import { nfcSupported, startNfc } from '../utils.js'

// Botón que activa el escáner NFC y entrega cada código leído
export default function NfcButton({ onCode, label = 'Escanear NFC', continuous = false, say }) {
  const [on, setOn] = useState(false)
  const stop = useRef(null)
  const cb = useRef(onCode)
  cb.current = onCode

  const off = () => {
    stop.current?.()
    stop.current = null
    setOn(false)
  }
  useEffect(() => off, [])

  const toggle = async () => {
    if (on) return off()
    if (!nfcSupported()) return say?.('NFC no soportado: usa Chrome en Android o escribe el código')
    setOn(true)
    stop.current = await startNfc(
      (code) => {
        cb.current(code)
        if (!continuous) off()
      },
      (m) => {
        say?.(m)
        off()
      }
    )
  }

  return (
    <button type="button" className={'btn ' + (on ? 'danger' : 'primary')} onClick={toggle}>
      {on ? '● Escuchando… (toca para parar)' : '📡 ' + label}
    </button>
  )
}
