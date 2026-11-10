import React, { useMemo, useState } from 'react'
import { stockStatus } from '../utils.js'
import ProductInfo from './ProductInfo.jsx'

const GROUPS = [
  ['category', 'Categoría', 'Sin categoría'],
  ['brand', 'Marca', 'Sin marca'],
  ['reference', 'Referencia', '']
]
const FILTERS = [
  ['all', 'Todos'],
  ['ok', 'Disponibles'],
  ['warn', 'Stock bajo'],
  ['bad', 'Agotados']
]

// Vista pública: estado del inventario (solo lectura)
export default function Stock({ products, batches, shelves, settings }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [by, setBy] = useState(() => {
    try {
      return localStorage.getItem('groupBy') || 'category'
    } catch {
      return 'category'
    }
  })
  const min = Number(settings.min_stock)

  const totals = useMemo(() => {
    const t = {}
    for (const b of batches) t[b.product_id] = (t[b.product_id] || 0) + Number(b.qty)
    return t
  }, [batches])
  const total = (p) => totals[p.id] || 0
  const shelfName = (id) => shelves.find((s) => s.id === id)?.name
  const location = (p) => (p.shelf_id ? `${shelfName(p.shelf_id)} · espacio ${p.space ?? '?'}` : 'Sin ubicación')

  const pick = (k) => {
    setBy(k)
    try {
      localStorage.setItem('groupBy', k)
    } catch {}
  }

  const count = { ok: 0, warn: 0, bad: 0 }
  for (const p of products) count[stockStatus(total(p), min)]++

  const t = q.trim().toLowerCase()
  const list = products.filter((p) => {
    if (filter !== 'all' && stockStatus(total(p), min) !== filter) return false
    return (
      !t ||
      [p.name, p.category, p.brand, p.reference, p.nfc_code, location(p)].some((v) => (v || '').toLowerCase().includes(t))
    )
  })

  const groups = useMemo(() => {
    if (by === 'reference') {
      const sorted = [...list].sort((a, b) =>
        (a.reference || '￿').localeCompare(b.reference || '￿', 'es', { numeric: true }) || a.name.localeCompare(b.name, 'es')
      )
      return sorted.length ? [['Por referencia', sorted]] : []
    }
    const none = GROUPS.find((g) => g[0] === by)[2]
    const map = new Map()
    for (const p of list) {
      const k = (p[by] || '').trim() || none
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(p)
    }
    return [...map.entries()].sort(([a], [b]) => (a === none) - (b === none) || a.localeCompare(b, 'es'))
  }, [list, by])

  return (
    <section>
      <h2>Estado del inventario</h2>
      <div className="kpis k3">
        <div className="kpi ok">
          <b>{count.ok}</b>
          <span>Disponibles</span>
        </div>
        <div className="kpi warn">
          <b>{count.warn}</b>
          <span>Stock bajo</span>
        </div>
        <div className="kpi bad">
          <b>{count.bad}</b>
          <span>Agotados</span>
        </div>
      </div>

      <p className="muted">Verde: más de {min} unidades · Ámbar: {min} o menos · Rojo: agotado</p>
      <input className="search" placeholder="🔍 Buscar producto, marca, referencia o estantería" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="muted mt" style={{ marginLeft: 4 }}>Organizar por</div>
      <div className="seg">
        {GROUPS.map(([k, l]) => (
          <button key={k} className={by === k ? 'on' : ''} onClick={() => pick(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="row wrap mt">
        {FILTERS.map(([k, l]) => (
          <button key={k} className={'btn sm' + (filter === k ? ' dark' : '')} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
      </div>

      {groups.map(([title, items]) => (
        <div key={title}>
          <div className="group-h">
            {title} <span>{items.length}</span>
          </div>
          {items.map((p) => (
            <div className={'card st-' + stockStatus(total(p), min)} key={p.id}>
              <ProductInfo p={p} total={total(p)} min={min} location={location(p)} />
            </div>
          ))}
        </div>
      ))}
      {!list.length && <p className="muted mt">Sin resultados.</p>}
    </section>
  )
}
