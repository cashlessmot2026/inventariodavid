import { jsPDF } from 'jspdf'
import { deliver } from './receipt.js'
import { fmtDate, fmtDateTime, num } from './utils.js'

const kind = (m) => (m.type === 'in' ? 'Entrada' : 'Salida')

// Reporte diario en PDF: resumen + detalle de cada entrada y salida
export function dailyPdf(day, movs) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  let y = 50
  const need = (h) => {
    if (y + h > H - 40) {
      pdf.addPage()
      y = 50
    }
  }
  const txt = (s, x, size = 10, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.text(String(s ?? '—'), x, y)
  }

  const ins = movs.filter((m) => m.type === 'in')
  const outs = movs.filter((m) => m.type !== 'in')
  const sum = (arr) => arr.reduce((a, m) => a + m.movement_items.reduce((b, i) => b + Number(i.qty), 0), 0)

  txt('Reporte diario de inventario', 40, 18, true)
  y += 20
  txt(`Fecha: ${fmtDate(day)}`, 40, 11)
  y += 16
  txt(`Entradas: ${ins.length} (${num(sum(ins))} uds)   Salidas: ${outs.length} (${num(sum(outs))} uds)`, 40, 11)
  y += 26

  for (const m of movs) {
    need(60 + m.movement_items.length * 14)
    pdf.setFillColor(m.type === 'in' ? 214 : 230, m.type === 'in' ? 240 : 243, m.type === 'in' ? 214 : 252)
    pdf.rect(40, y - 12, W - 80, 18, 'F')
    txt(`${kind(m)} · ${new Date(m.created_at).toLocaleTimeString('es-CO', { timeStyle: 'short' })} · Factura ${m.invoice || '—'}`, 46, 10, true)
    y += 16
    if (m.customer) {
      txt(`${m.type === 'in' ? 'Proveedor' : 'Cliente'}: ${m.customer}`, 46, 9)
      y += 13
    }
    txt('Producto', 46, 9, true)
    txt('Lote', 300, 9, true)
    txt('Vence', 380, 9, true)
    txt('Cantidad', 460, 9, true)
    y += 13
    for (const i of m.movement_items) {
      need(14)
      txt(String(i.product_name).slice(0, 42), 46, 9)
      txt(String(i.lot || '—').slice(0, 14), 300, 9)
      txt(fmtDate(i.expiry), 380, 9)
      txt(`${num(i.qty)} ${i.unit || ''}`.slice(0, 16), 460, 9)
      y += 13
    }
    y += 12
  }
  if (!movs.length) txt('Sin movimientos en este día.', 40, 11)
  deliver(pdf.output('blob'), `reporte-${day}.pdf`)
}

// Mismo reporte en CSV (abre en Excel)
export function dailyCsv(day, movs) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = [['Tipo', 'Fecha y hora', 'Factura', 'Cliente/Proveedor', 'Producto', 'Lote', 'Vence', 'Cantidad', 'Unidad']]
  for (const m of movs)
    for (const i of m.movement_items)
      rows.push([kind(m), fmtDateTime(m.created_at), m.invoice, m.customer, i.product_name, i.lot, fmtDate(i.expiry), i.qty, i.unit])
  const csv = '\ufeff' + rows.map((r) => r.map(esc).join(';')).join('\r\n')
  deliver(new Blob([csv], { type: 'text/csv' }), `reporte-${day}.csv`)
}
