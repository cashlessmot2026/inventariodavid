import React, { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { fmtDate, fmtDateTime, localToday, num } from '../utils.js'
import { dailyCsv, dailyPdf } from '../report.js'
import { downloadPdf, downloadPng } from '../receipt.js'

export default function History({ say }) {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [day, setDay] = useState(localToday())

  useEffect(() => {
    let query = supabase.from('movements').select('*, movement_items(*)').order('created_at', { ascending: false })
    if (day) {
      const start = new Date(day + 'T00:00:00')
      const end = new Date(start.getTime() + 86400000)
      query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
    } else query = query.limit(200)
    query.then(({ data, error }) => (error ? say(error.message) : setRows(data)))
  }, [say, day])

  const list = rows.filter((m) => {
    const t = q.toLowerCase()
    return (
      !t ||
      (m.invoice || '').toLowerCase().includes(t) ||
      (m.customer || '').toLowerCase().includes(t) ||
      m.movement_items.some((i) => i.product_name.toLowerCase().includes(t) || (i.lot || '').toLowerCase().includes(t))
    )
  })

  return (
    <section>
      <h2>Historial de entradas y salidas</h2>
      <div className="row">
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <button className="btn" onClick={() => setDay('')}>
          Ver todo
        </button>
      </div>
      <div className="row mt">
        <button className="btn primary" disabled={!day} onClick={() => dailyPdf(day, list)}>
          ⬇ Reporte PDF del día
        </button>
        <button className="btn" disabled={!day} onClick={() => dailyCsv(day, list)}>
          ⬇ Excel (CSV)
        </button>
      </div>
      <input placeholder="🔍 Factura, cliente, producto o lote" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.map((m) => (
        <div className="card" key={m.id}>
          <div className="row between">
            <strong>
              {m.type === 'in' ? '⬆ Entrada' : '⬇ Salida'} · Factura {m.invoice || '—'}
            </strong>
            <span className="muted">{fmtDateTime(m.created_at)}</span>
          </div>
          {m.customer && <div className="muted">
              {m.type === 'in' ? 'Proveedor' : 'Cliente'}: {m.customer}
            </div>}
          <table className="tbl">
            <tbody>
              {m.movement_items.map((i) => (
                <tr key={i.id}>
                  <td>{i.product_name}</td>
                  <td>Lote {i.lot}</td>
                  <td>{fmtDate(i.expiry)}</td>
                  <td>
                    <b>
                      {num(i.qty)} {i.unit}
                    </b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row mt">
            <button className="btn sm" onClick={() => downloadPdf(m, m.movement_items)}>
              PDF
            </button>
            <button className="btn sm" onClick={() => downloadPng(m, m.movement_items)}>
              Imagen
            </button>
          </div>
        </div>
      ))}
      {!list.length && <p className="muted">Sin movimientos.</p>}
    </section>
  )
}
