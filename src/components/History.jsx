import React, { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { fmtDate, fmtDateTime, num } from '../utils.js'
import { downloadPdf, downloadPng } from '../receipt.js'

export default function History({ say }) {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase
      .from('movements')
      .select('*, movement_items(*)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => (error ? say(error.message) : setRows(data)))
  }, [say])

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
      <h2>Historial de salidas</h2>
      <input placeholder="🔍 Factura, cliente, producto o lote" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.map((m) => (
        <div className="card" key={m.id}>
          <div className="row between">
            <strong>Factura {m.invoice || '—'}</strong>
            <span className="muted">{fmtDateTime(m.created_at)}</span>
          </div>
          {m.customer && <div className="muted">Cliente: {m.customer}</div>}
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
