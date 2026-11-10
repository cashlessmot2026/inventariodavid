import React, { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { fmtDate, fmtDateTime, num } from '../utils.js'
import { downloadPdf, downloadPng } from '../receipt.js'

// Buscador de salidas (número, factura, cliente, fecha) + historial de las últimas 10
export default function RecentExits({ say, refresh }) {
  const [q, setQ] = useState('')
  const [day, setDay] = useState('')
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(null)
  const text = q.trim().replace(/[,()%*"\\]/g, ' ').trim()
  const searching = !!(text || day)

  useEffect(() => {
    let off = false
    const run = (withNumber) => {
      let qy = supabase
        .from('movements')
        .select('*, movement_items(*)')
        .neq('type', 'in')
        .order('created_at', { ascending: false })
        .limit(searching ? 50 : 10)
      if (day) {
        const start = new Date(day + 'T00:00:00')
        const end = new Date(start.getTime() + 86400000)
        qy = qy.gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
      }
      if (text) {
        const parts = [`invoice.ilike."%${text}%"`, `customer.ilike."%${text}%"`]
        const n = text.replace(/^(#|n[°ºo]?\.?)\s*/i, '')
        if (withNumber && /^\d{1,15}$/.test(n)) parts.push(`number.eq.${n}`)
        qy = qy.or(parts.join(','))
      }
      return qy
    }
    const t = setTimeout(
      async () => {
        let { data, error } = await run(true)
        // Si aún no se ejecutó actualizacion_v5.sql no existe el número de salida: se busca sin él
        if (error && /number/.test(error.message)) ({ data, error } = await run(false))
        if (off) return
        if (error) return say(error.message)
        setRows(data)
      },
      text ? 350 : 0
    )
    return () => {
      off = true
      clearTimeout(t)
    }
  }, [text, day, searching, refresh, say])

  return (
    <div className="exits">
      <h2>Buscar salidas</h2>
      <input
        className="search"
        placeholder="🔍 N° de salida, factura o cliente"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="row mt">
        <label>Fecha</label>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        {searching && (
          <button
            className="btn sm"
            onClick={() => {
              setQ('')
              setDay('')
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="group-h">
        {searching ? 'Resultados' : 'Últimas 10 salidas'} {rows && <span>{rows.length}</span>}
      </div>
      {rows === null && <p className="muted mt">Cargando…</p>}
      {rows?.length === 0 && <p className="muted mt">{searching ? 'Ninguna salida coincide con la búsqueda.' : 'Aún no hay salidas.'}</p>}
      {rows?.map((m) => {
        const isOpen = open === m.id
        return (
          <div className={'card' + (isOpen ? '' : ' click')} key={m.id}>
            <div className="prod" onClick={() => setOpen(isOpen ? null : m.id)}>
              <div className="prod-main">
                <strong>
                  {m.number != null && <span className="chip num">N° {m.number}</span>} Factura {m.invoice || '—'}
                </strong>
                <div className="muted">👤 {m.customer || 'Sin cliente'}</div>
                <div className="muted">🕑 {fmtDateTime(m.created_at)}</div>
              </div>
              <div className="prod-side">
                <span className="pill ok">{m.movement_items.length} producto(s)</span>
                <span className="muted">{isOpen ? 'Ocultar ▲' : 'Ver detalle ▼'}</span>
              </div>
            </div>
            {isOpen && (
              <div className="detail">
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
                {m.notes && <div className="muted mt">Notas: {m.notes}</div>}
                <div className="row mt">
                  <button className="btn sm" onClick={() => downloadPdf(m, m.movement_items)}>
                    PDF
                  </button>
                  <button className="btn sm" onClick={() => downloadPng(m, m.movement_items)}>
                    Imagen
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
