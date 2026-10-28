import { daysUntil } from './utils.js'

export const notifSupported = () => 'Notification' in window

export async function askPermission() {
  if (!notifSupported()) return 'unsupported'
  return Notification.requestPermission()
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
  const opts = {
    body: `${list.length} lote(s) por vencer:\n${body}`,
    icon: '/inventariodavid/icon-192.png',
    tag: 'vencimientos'
  }
  const reg = await navigator.serviceWorker?.getRegistration()
  if (reg) reg.showNotification('Medicamentos por vencer', opts)
  else new Notification('Medicamentos por vencer', opts)
}
