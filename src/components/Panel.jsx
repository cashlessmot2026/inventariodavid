import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { daysUntil, fmtDate, num } from '../utils.js'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function Bars({ rows, fmt = num }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar" key={r.label}>
          <span className="bl">{r.label}</span>
          <div className="bt">
            <div className="bf" style={{ width: (r.value / max) * 100 + '%' }} />
          </div>
          <span className="bv">{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Panel({ expiring, settings }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    supabase
      .from('movement_items')
      .select('product_name, unit, qty, movements(created_at)')
      .then(({ data }) => setItems(data || []))
  }, [])

  const stats = useMemo(() => {
    const prod = {}
    const wd = Array(7).fill(0)
    const day = {}
    for (const i of items) {
      const d = new Date(i.movements.created_at)
      const key = d.toLocaleDateString('en-CA')
      prod[i.product_name] = (prod[i.product_name] || 0) + Number(i.qty)
      wd[d.getDay()] += Number(i.qty)
      day[key] = (day[key] || 0) + Number(i.qty)
    }
    const top = Object.entries(prod)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
    const bestDays = Object.entries(day)
      .map(([label, value]) => ({ label: fmtDate(label), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    const bestDay = wd.indexOf(Math.max(...wd))
    return { top, bestDays, wd: wd.map((value, i) => ({ label: DAYS[i], value })), bestDay: wd[bestDay] ? DAYS[bestDay] : '—' }
  }, [items])

  return (
    <section>
      <h2>Panel y analítica</h2>

      <div className="card">
        <h3>⚠ Por vencer (≤ {settings.alert_months} meses)</h3>
        {expiring.length === 0 && <p className="muted">Nada próximo a vencer.</p>}
        {expiring.map((b) => (
          <div className="row between line" key={b.id}>
            <span>
              {b.productName} · lote {b.lot} · {num(b.qty)}
            </span>
            <span className={'pill ' + (daysUntil(b.expiry) < 0 ? 'bad' : 'warn')}>
              {daysUntil(b.expiry) < 0 ? 'Vencido ' : ''}
              {fmtDate(b.expiry)}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Más vendidos (cantidad total)</h3>
        {stats.top.length ? <Bars rows={stats.top} /> : <p className="muted">Aún no hay salidas.</p>}
      </div>
      <div className="card">
        <h3>Salidas por día de la semana</h3>
        <p className="muted">Día con más salidas: <b>{stats.bestDay}</b></p>
        <Bars rows={stats.wd} />
      </div>
      <div className="card">
        <h3>Fechas con más salidas</h3>
        {stats.bestDays.length ? <Bars rows={stats.bestDays} /> : <p className="muted">Sin datos.</p>}
      </div>
    </section>
  )
}
