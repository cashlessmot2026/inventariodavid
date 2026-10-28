import React, { useState } from 'react'
import { supabase } from '../supabase.js'
import { expiryClass, fmtDate, num, today } from '../utils.js'
import NfcButton from './NfcButton.jsx'

const UNITS = ['unidades', 'ml', 'mg', 'g', 'tabletas', 'cápsulas', 'ampollas', 'frascos', 'cajas']
const EMPTY = { name: '', unit: 'unidades', nfc_code: '', shelf_id: '', space: '', notes: '' }

export default function Inventory({ products, batches, shelves, settings, load, say }) {
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null) // producto en edición/creación
  const [open, setOpen] = useState(null) // producto con lotes desplegados
  const [nb, setNb] = useState({ lot: '', expiry: '', qty: '' })

  const shelfName = (id) => shelves.find((s) => s.id === id)?.name
  const location = (p) => (p.shelf_id ? `${shelfName(p.shelf_id)} · espacio ${p.space ?? '?'}` : 'Sin ubicación')
  const total = (pid) => batches.filter((b) => b.product_id === pid).reduce((a, b) => a + Number(b.qty), 0)

  const list = products.filter((p) => {
    const t = q.toLowerCase()
    return !t || p.name.toLowerCase().includes(t) || (p.nfc_code || '').toLowerCase().includes(t) || location(p).toLowerCase().includes(t)
  })

  const save = async () => {
    if (!form.name.trim()) return say('Falta el nombre')
    const row = {
      name: form.name.trim(),
      unit: form.unit.trim() || 'unidades',
      nfc_code: form.nfc_code.trim() || null,
      shelf_id: form.shelf_id || null,
      space: form.shelf_id && form.space ? Number(form.space) : null,
      notes: form.notes || null
    }
    const { error } = form.id
      ? await supabase.from('products').update(row).eq('id', form.id)
      : await supabase.from('products').insert(row)
    if (error) return say(error.message.includes('nfc_code') ? 'Ese tag NFC ya está asignado' : error.message)
    setForm(null)
    load()
  }

  const del = async (p) => {
    if (!confirm(`¿Eliminar ${p.name} y todos sus lotes?`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) return say(error.message)
    load()
  }

  const addBatch = async (pid) => {
    if (!nb.lot.trim() || !nb.expiry || !(Number(nb.qty) > 0)) return say('Completa lote, vencimiento y cantidad')
    const { error } = await supabase
      .from('batches')
      .insert({ product_id: pid, lot: nb.lot.trim(), expiry: nb.expiry, qty: Number(nb.qty) })
    if (error) return say(error.message)
    setNb({ lot: '', expiry: '', qty: '' })
    load()
  }

  const editBatch = async (b, patch) => {
    const { error } = await supabase.from('batches').update(patch).eq('id', b.id)
    if (error) say(error.message)
    load()
  }

  const delBatch = async (b) => {
    if (!confirm(`¿Eliminar lote ${b.lot}?`)) return
    await supabase.from('batches').delete().eq('id', b.id)
    load()
  }

  const shelf = shelves.find((s) => s.id === form?.shelf_id)

  return (
    <section>
      <h2>Inventario</h2>
      <div className="row">
        <input placeholder="🔍 Buscar producto, código o estantería" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" onClick={() => setForm({ ...EMPTY })}>
          + Producto
        </button>
      </div>

      {form && (
        <div className="card">
          <h3>{form.id ? 'Editar producto' : 'Nuevo producto'}</h3>
          <input placeholder="Nombre / referencia *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="row mt">
            <input list="units" placeholder="Unidad de medida" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <datalist id="units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div className="row mt">
            <input placeholder="Código NFC" value={form.nfc_code || ''} onChange={(e) => setForm({ ...form, nfc_code: e.target.value })} />
            <NfcButton label="Leer tag" onCode={(c) => setForm((f) => ({ ...f, nfc_code: c }))} say={say} />
          </div>
          <div className="row mt">
            <select value={form.shelf_id || ''} onChange={(e) => setForm({ ...form, shelf_id: e.target.value, space: '' })}>
              <option value="">Sin estantería</option>
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select disabled={!shelf} value={form.space || ''} onChange={(e) => setForm({ ...form, space: e.target.value })}>
              <option value="">Espacio</option>
              {shelf && Array.from({ length: shelf.spaces }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Espacio {n}
                </option>
              ))}
            </select>
          </div>
          <input className="mt" placeholder="Notas" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="row mt">
            <button className="btn primary" onClick={save}>
              Guardar
            </button>
            <button className="btn" onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {list.map((p) => {
        const bs = batches.filter((b) => b.product_id === p.id)
        return (
          <div className="card" key={p.id}>
            <div className="row between" onClick={() => setOpen(open === p.id ? null : p.id)}>
              <div>
                <strong>{p.name}</strong>
                <div className="muted">📍 {location(p)}</div>
                {p.nfc_code && <div className="muted">NFC: {p.nfc_code}</div>}
              </div>
              <div className="stock">
                {num(total(p.id))}
                <small> {p.unit}</small>
              </div>
            </div>
            {open === p.id && (
              <>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Lote</th>
                      <th>Vence</th>
                      <th>Cant.</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {bs.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <input defaultValue={b.lot} onBlur={(e) => e.target.value !== b.lot && editBatch(b, { lot: e.target.value })} />
                        </td>
                        <td>
                          <input
                            type="date"
                            className={'pill-in ' + expiryClass(b.expiry, settings.alert_months)}
                            defaultValue={b.expiry}
                            onBlur={(e) => e.target.value && e.target.value !== b.expiry && editBatch(b, { expiry: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            defaultValue={b.qty}
                            onBlur={(e) => Number(e.target.value) !== Number(b.qty) && editBatch(b, { qty: Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <button className="btn sm danger" onClick={() => delBatch(b)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="row mt">
                  <input placeholder="Lote" value={nb.lot} onChange={(e) => setNb({ ...nb, lot: e.target.value })} />
                  <input type="date" min={today()} value={nb.expiry} onChange={(e) => setNb({ ...nb, expiry: e.target.value })} />
                  <input type="number" step="any" placeholder="Cant." value={nb.qty} onChange={(e) => setNb({ ...nb, qty: e.target.value })} />
                  <button className="btn primary" onClick={() => addBatch(p.id)}>
                    + Lote
                  </button>
                </div>
                <div className="row mt">
                  <button className="btn" onClick={() => setForm({ ...p })}>
                    Editar producto
                  </button>
                  <button className="btn danger" onClick={() => del(p)}>
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}
      {!list.length && <p className="muted">Sin resultados.</p>}
    </section>
  )
}
