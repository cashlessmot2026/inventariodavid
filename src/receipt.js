import { jsPDF } from 'jspdf'
import { fmtDate, fmtDateTime, num } from './utils.js'

// Dibuja el comprobante de salida en un canvas (se usa para imagen y PDF)
export function receiptCanvas(mov, items) {
  const w = 800
  const rowH = 64
  const h = 300 + items.length * rowH + 60
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#0b0f14'
  g.fillRect(0, 0, w, 90)
  g.fillStyle = '#7cc4f2'
  g.font = 'bold 30px sans-serif'
  g.fillText('Salida de inventario', 30, 56)
  g.fillStyle = '#0b0f14'
  g.font = '22px sans-serif'
  let y = 140
  const line = (k, v) => {
    g.font = 'bold 22px sans-serif'
    g.fillText(k, 30, y)
    g.font = '22px sans-serif'
    g.fillText(String(v || '—'), 210, y)
    y += 36
  }
  line('Factura:', mov.invoice)
  line('Cliente:', mov.customer)
  line('Fecha:', fmtDateTime(mov.created_at))
  if (mov.notes) line('Notas:', mov.notes)
  y += 10
  g.fillStyle = '#e6f3fc'
  g.fillRect(20, y - 28, w - 40, 40)
  g.fillStyle = '#0b0f14'
  g.font = 'bold 20px sans-serif'
  g.fillText('Producto', 30, y)
  g.fillText('Lote', 400, y)
  g.fillText('Vence', 540, y)
  g.fillText('Cant.', 690, y)
  y += 44
  for (const it of items) {
    g.font = '20px sans-serif'
    g.fillText(it.product_name.slice(0, 28), 30, y)
    g.fillText(String(it.lot || '').slice(0, 12), 400, y)
    g.fillText(fmtDate(it.expiry), 540, y)
    g.fillText(`${num(it.qty)} ${it.unit || ''}`.slice(0, 12), 690, y)
    g.strokeStyle = '#d5e6f2'
    g.beginPath()
    g.moveTo(20, y + 18)
    g.lineTo(w - 20, y + 18)
    g.stroke()
    y += rowH
  }
  return c
}

const fileName = (mov) => `salida-${(mov.invoice || mov.id.slice(0, 6)).replace(/\W+/g, '_')}`

export function downloadPng(mov, items) {
  const a = document.createElement('a')
  a.href = receiptCanvas(mov, items).toDataURL('image/png')
  a.download = fileName(mov) + '.png'
  a.click()
}

export function downloadPdf(mov, items) {
  const c = receiptCanvas(mov, items)
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pw = pdf.internal.pageSize.getWidth() - 60
  pdf.addImage(c.toDataURL('image/png'), 'PNG', 30, 30, pw, (c.height / c.width) * pw)
  pdf.save(fileName(mov) + '.pdf')
}
