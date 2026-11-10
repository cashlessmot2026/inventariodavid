import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { allocateFefo, fmtDate, expiryClass, num, sortedBatches } from '../utils.js'
import { downloadPdf, downloadPng } from '../receipt.js'
import NfcButton from './NfcButton.jsx'
import RecentExits from './RecentExits.jsx'
import TicketModal from './Ticket.jsx'

const MAX_FOUND = 8
// minúsculas y sin tildes, para que «acetaminofen» encuentre «Acetaminofén»
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export default function Exit({ products, batches, settings, load, say, pendingTag, clearTag }) {
  const [lines, setLines] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cart') || '[]')
    } catch {
      return []
    }
  }) // { productId, qty }
  const [invoice, setInvoice] = useState('')
  const [customer, setCustomer] = useState('')
  const [notes, setNotes] = useState('')
  const [manual, setManual] = useState('')
  const [find, setFind] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [ticket, setTicket] = useState(false)

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
  const batchesOf = (pid) => batches.filter((b) => b.product_id === pid)

  // Cada escaneo suma 1 unidad del producto
  const addProduct = (p) => {
    setDone(null)
    setLines((ls) => {
      const i = ls.findIndex((l) => l.productId === p.id)
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: Number(l.qty) + 1 } : l))
      return [...ls, { productId: p.id, qty: 1 }]
    })
    say(`${p.name} agregado`)
  }

  const onCode = (code) => {
    const p = products.find((x) => x.nfc_code === String(code).trim())
    if (!p) return say(`Tag sin producto asignado: ${code}`)
    addProduct(p)
  }

  // Búsqueda manual: todas las palabras escritas deben aparecer en nombre, categoría, marca o referencia
  const words = norm(find).split(/\s+/).filter(Boolean)
  const found = useMemo(() => {
    if (!words.length) return []
    return products
      .filter((p) => {
        const hay = norm([p.name, p.category, p.brand, p.reference].filter(Boolean).join(' '))
        return words.every((w) => hay.includes(w))
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))
  }, [find, products])
  const stockOf = (pid) => batchesOf(pid).reduce((s, b) => s + Number(b.qty || 0), 0)
  const minStock = Number(settings?.min_stock ?? 8)
  const pick = (p) => {
    if (stockOf(p.id) <= 0) return say(`${p.name} está agotado`)
    addProduct(p)
  }

  const addManual = () => {
    if (manual.trim()) onCode(manual)
    setManual('')
  }

  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(lines))
    } catch {}
  }, [lines])

  // Tag abierto por enlace (iPhone): suma 1 unidad cuando ya cargó el catálogo
  useEffect(() => {
    if (pendingTag && products.length) {
      onCode(pendingTag)
      clearTag()
    }
  }, [pendingTag, products])

  const plan = lines.filter((l) => byId[l.productId]).map((l) => ({ ...l, p: byId[l.productId], ...allocateFefo(batchesOf(l.productId), l.qty) }))
  const invalid = plan.some((x) => x.missing > 0 || !(Number(x.qty) > 0))

  const confirm = async () => {
    if (!invoice.trim()) return say('Escribe el número de factura')
    if (!lines.length || invalid) return say('Revisa las cantidades y el stock')
    setBusy(true)
    const items = plan.flatMap((x) => x.allocations.map((a) => ({ batch_id: a.batch.id, qty: a.qty })))
    const { data: id, error } = await supabase.rpc('register_exit', {
      p_invoice: invoice.trim(),
      p_customer: customer.trim() || null,
      p_notes: notes.trim() || null,
      p_items: items
    })
    if (error) {
      setBusy(false)
      return say('Error: ' + error.message)
    }
    const { data: mov } = await supabase.from('movements').select('*').eq('id', id).single()
    const { data: its } = await supabase.from('movement_items').select('*').eq('movement_id', id)
    setBusy(false)
    setDone({ mov, items: its })
    setLines([])
    setInvoice('')
    setCustomer('')
    setNotes('')
    load()
  }

  return (
    <section>
      <h2>Salida de inventario</h2>
      <div className="card">
        <NfcButton continuous onCode={onCode} label="Escanear NFC (varios)" say={say} />
        <div className="row mt">
          <input
            placeholder="Código NFC manual / lector USB"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addManual()}
          />
          <button className="btn" onClick={addManual}>
            Agregar
          </button>
        </div>
        <div className="group-h">Salida manual</div>
        <input
          className="search"
          type="search"
          placeholder="🔍 Buscar producto: nombre, categoría o marca"
          value={find}
          onChange={(e) => setFind(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && found.length === 1 && pick(found[0])}
        />
        {words.length > 0 && found.length === 0 && <p className="muted mt">Ningún producto coincide con la búsqueda.</p>}
        {found.slice(0, MAX_FOUND).map((p) => {
          const stock = stockOf(p.id)
          const inCart = lines.find((l) => l.productId === p.id)
          return (
            <div className="found" key={p.id}>
              <div className="found-info">
                <strong>{p.name}</strong>
                <div className="chips">
                  {p.category && <span className="chip">{p.category}</span>}
                  {p.brand && <span className="chip ghost">{p.brand}</span>}
                  {p.reference && <span className="chip ghost">Ref. {p.reference}</span>}
                </div>
                <span className={'pill ' + (stock <= 0 ? 'bad' : stock <= minStock ? 'warn' : 'ok')}>
                  {stock <= 0 ? 'Agotado' : `${num(stock)} ${p.unit || ''} disponibles`}
                </span>
              </div>
              <button className="btn primary sm" disabled={stock <= 0} onClick={() => pick(p)}>
                {inCart ? `+1 (${num(inCart.qty)})` : 'Dar salida'}
              </button>
            </div>
          )
        })}
        {found.length > MAX_FOUND && (
          <p className="muted mt">
            Hay {found.length - MAX_FOUND} producto(s) más: escribe algo más para afinar la búsqueda.
          </p>
        )}
      </div>

      {plan.map((x) => (
        <div className="card" key={x.productId}>
          <div className="row between">
            <strong>{x.p?.name}</strong>
            <button className="btn sm danger" onClick={() => setLines(lines.filter((l) => l.productId !== x.productId))}>
              Quitar
            </button>
          </div>
          <div className="row mt">
            <label>Cantidad ({x.p?.unit})</label>
            <input
              type="number"
              min="0"
              step="any"
              value={x.qty}
              onChange={(e) =>
                setLines(lines.map((l) => (l.productId === x.productId ? { ...l, qty: e.target.value } : l)))
              }
            />
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Vence</th>
                <th>Disp.</th>
                <th>Sale</th>
              </tr>
            </thead>
            <tbody>
              {sortedBatches(batchesOf(x.productId)).map((b) => {
                const a = x.allocations.find((z) => z.batch.id === b.id)
                return (
                  <tr key={b.id} className={a ? 'hl' : ''}>
                    <td>{b.lot}</td>
                    <td>
                      <span className={'pill ' + expiryClass(b.expiry, settings.alert_months)}>{fmtDate(b.expiry)}</span>
                    </td>
                    <td>{num(b.qty)}</td>
                    <td>{a ? <b>{num(a.qty)}</b> : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {x.missing > 0 && (
            <p className="err">
              Faltan {num(x.missing)} {x.p?.unit} de stock
            </p>
          )}
        </div>
      ))}

      {lines.length > 0 && (
        <div className="card">
          <input placeholder="Número de factura *" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
          <input className="mt" placeholder="Cliente / destino (opcional)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          <input className="mt" placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn primary block mt" disabled={busy} onClick={confirm}>
            {busy ? 'Registrando…' : 'Confirmar salida y descontar'}
          </button>
        </div>
      )}

      {done && (
        <div className="card ok-card">
          <strong>
            ✔ Salida {done.mov.number != null ? `N° ${done.mov.number} ` : ''}registrada (factura {done.mov.invoice})
          </strong>
          <div className="row wrap mt">
            <button className="btn primary" onClick={() => setTicket(true)}>
              👁 Ver ticket
            </button>
            <button className="btn" onClick={() => downloadPdf(done.mov, done.items)}>
              PDF
            </button>
            <button className="btn" onClick={() => downloadPng(done.mov, done.items)}>
              Imagen
            </button>
          </div>
        </div>
      )}

      {ticket && done && <TicketModal mov={{ ...done.mov, movement_items: done.items }} onClose={() => setTicket(false)} />}

      <RecentExits say={say} refresh={done?.mov?.id} />
    </section>
  )
}
