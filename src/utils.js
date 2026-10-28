export const today = () => new Date().toISOString().slice(0, 10)

export const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}
export const fmtDateTime = (d) =>
  new Date(d).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })

export const daysUntil = (expiry) =>
  Math.ceil((new Date(expiry + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000)

export const expiryClass = (expiry, months) => {
  const d = daysUntil(expiry)
  if (d < 0) return 'bad'
  if (d <= months * 30.4) return 'warn'
  return 'ok'
}

export const num = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 })

// Lotes con stock, el que vence primero va primero (FEFO)
export const sortedBatches = (batches) =>
  batches.filter((b) => Number(b.qty) > 0).sort((a, b) => a.expiry.localeCompare(b.expiry))

// Reparte la cantidad pedida entre lotes, priorizando la fecha de vencimiento más corta
export function allocateFefo(batches, qty) {
  let left = Number(qty) || 0
  const out = []
  for (const b of sortedBatches(batches)) {
    if (left <= 0) break
    const take = Math.min(left, Number(b.qty))
    out.push({ batch: b, qty: take })
    left -= take
  }
  return { allocations: out, missing: left }
}

export const nfcSupported = () => 'NDEFReader' in window

// Lee tags NFC (Web NFC, Chrome Android). Devuelve función para detener.
export async function startNfc(onCode, onError) {
  const ctrl = new AbortController()
  try {
    const reader = new window.NDEFReader()
    await reader.scan({ signal: ctrl.signal })
    reader.onreading = (e) => onCode(e.serialNumber)
    reader.onreadingerror = () => onError?.('No se pudo leer el tag')
  } catch (err) {
    onError?.(err.message || 'NFC no disponible')
  }
  return () => ctrl.abort()
}

export const monthName = (m) => m
