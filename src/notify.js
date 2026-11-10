import { daysUntil, num } from './utils.js'

export const notifSupported = () => 'Notification' in window
const ICON = import.meta.env.BASE_URL + 'icon-192.png'

export async function askPermission() {
  if (!notifSupported()) return 'unsupported'
  return Notification.requestPermission()
}

async function show(title, opts) {
  if (!notifSupported() || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { icon: ICON, ...opts })
    else new Notification(title, { icon: ICON, ...opts })
  } catch {}
}

// Lotes con stock que vencen dentro del umbral (en meses) o ya vencidos
export const expiringBatches = (batches, months) =>
  batches
    .filter((b) => Number(b.qty) > 0 && daysUntil(b.expiry) <= months * 30.4)
    .sort((a, b) => a.expiry.localeCompare(b.expiry))

// Muestra una notificación por día con el resumen de lotes por vencer
export async function notifyExpiring(list) {
  if (!notifSupported() || Notification.permission !== 'granted' || !list.length) return
  const key = 'notif-' + new Date().toISOString().slice(0, 10)
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
  } catch {}
  const body = list
    .slice(0, 4)
    .map((b) => `${b.productName} (lote ${b.lot})`)
    .join('\n')
  show('Medicamentos por vencer', { body: `${list.length} lote(s) por vencer:\n${body}`, tag: 'vencimientos' })
}

// ===== Stock mínimo =====

// Productos (con al menos un lote registrado) cuyo stock total llegó al mínimo o menos
export function lowStock(products, batches, min) {
  const tot = {}
  for (const b of batches) tot[b.product_id] = (tot[b.product_id] || 0) + Number(b.qty)
  return products
    .filter((p) => p.id in tot && tot[p.id] <= Number(min))
    .map((p) => ({ id: p.id, name: p.name, unit: p.unit, total: tot[p.id] }))
}

export const lowText = (p) => `Hay ${num(p.total)} ${p.unit || 'unidades'} de ${p.name}`

export const voiceOn = () => {
  try {
    return localStorage.getItem('voice') !== '0'
  } catch {
    return true
  }
}
export const setVoice = (on) => {
  try {
    localStorage.setItem('voice', on ? '1' : '0')
  } catch {}
}

export function speak(text) {
  if (!('speechSynthesis' in window)) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'es-ES'
    window.speechSynthesis.speak(u)
  } catch {}
}

// iPhone solo deja hablar después de un toque: se "desbloquea" la voz con el primer toque
export function primeVoice() {
  const once = () => {
    speak('')
    window.removeEventListener('pointerdown', once)
  }
  window.addEventListener('pointerdown', once)
}

// Avisa (notificación + voz) una sola vez por producto cuando entra en stock bajo.
// Si el producto se repone por encima del mínimo, vuelve a avisar la próxima vez que baje.
export function notifyLowStock(list) {
  let seen = {}
  try {
    seen = JSON.parse(localStorage.getItem('low-seen') || '{}')
  } catch {}
  const fresh = list.filter((p) => !seen[p.id])
  try {
    localStorage.setItem('low-seen', JSON.stringify(Object.fromEntries(list.map((p) => [p.id, 1]))))
  } catch {}
  if (fresh.length > 3) {
    const text = `Hay ${fresh.length} productos con stock bajo`
    show('Stock bajo', { body: text + ': ' + fresh.slice(0, 5).map((p) => p.name).join(', ') + '…', tag: 'stock-resumen' })
    if (voiceOn()) speak(text)
  } else {
    for (const p of fresh) show('Stock bajo', { body: lowText(p), tag: 'stock-' + p.id })
    if (voiceOn()) fresh.forEach((p) => speak(lowText(p)))
  }
  return fresh
}
