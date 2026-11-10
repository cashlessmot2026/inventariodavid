import React, { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { fmtDateTime, num } from '../utils.js'
import TicketModal from './Ticket.jsx'

// Buscador de salidas (número, factura, cliente, fecha) + historial de las últimas 10
export default function RecentExits({ say, refresh }) {
  const [q, setQ] = useState('')
  const [day, setDay] = useState('')
  const [rows, setRows] = useState(null)
  const [preview, setPreview] = useState(null) // salida mostrada en la ventana emergente
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
      {rows?.map((m) => (
        <div className="stub" key={m.id}>
          <div className="stub-top">
            <span className="stub-num">{m.number != null ? 'N° ' + String(m.number).padStart(5, '0') : 'SALIDA'}</span>
            <span>{fmtDateTime(m.created_at)}</span>
          </div>
          <div className="tk-row">
            <span>Factura</span>
            <b>{m.invoice || '—'}</b>
          </div>
          <div className="tk-row">
            <span>Cliente</span>
            <b>{m.customer || '—'}</b>
          </div>
          <div className="tk-sep" />
          {m.movement_items.slice(0, 3).map((i) => (
            <div className="tk-row" key={i.id}>
              <span>{i.product_name}</span>
              <b>
                {num(i.qty)} {i.unit}
              </b>
            </div>
          ))}
          {m.movement_items.length > 3 && <small>… y {m.movement_items.length - 3} producto(s) más</small>}
          <button className="btn primary block mt" onClick={() => setPreview(m)}>
            👁 Vista previa del ticket
          </button>
        </div>
      ))}
      {preview && <TicketModal mov={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
