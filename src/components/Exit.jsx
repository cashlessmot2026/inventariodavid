import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { allocateFefo, fmtDate, expiryClass, num, sortedBatches } from '../utils.js'
import { downloadPdf, downloadPng } from '../receipt.js'
import NfcButton from './NfcButton.jsx'

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
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

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
        <select className="mt" value="" onChange={(e) => e.target.value && addProduct(byId[e.target.value])}>
          <option value="">…o elegir producto de la lista</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
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
          <strong>✔ Salida registrada (factura {done.mov.invoice})</strong>
          <div className="row mt">
            <button className="btn" onClick={() => downloadPdf(done.mov, done.items)}>
              PDF
            </button>
            <button className="btn" onClick={() => downloadPng(done.mov, done.items)}>
              Imagen
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
