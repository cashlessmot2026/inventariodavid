import React, { useMemo, useState } from 'react'
import { expiryClass, nfcSupported, stockStatus, tagUrl, today, writeNfcUrl } from '../utils.js'
import NfcButton from './NfcButton.jsx'
import ProductInfo from './ProductInfo.jsx'

const UNITS = ['unidades', 'ml', 'mg', 'g', 'tabletas', 'cápsulas', 'ampollas', 'frascos', 'cajas']
const EMPTY = { name: '', reference: '', brand: '', category: '', unit: 'unidades', price: '', nfc_code: '', shelf_id: '', space: '', notes: '' }
const FILTERS = [
  ['all', 'Todos'],
  ['ok', 'Disponibles'],
  ['warn', 'Stock bajo'],
  ['bad', 'Agotados']
]
const uniq = (arr) => [...new Set(arr.map((v) => (v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))

// Inventario del administrador: crear/editar productos, lotes, entradas, precio y ubicación
export default function Inventory({ products, batches, shelves, settings, load, say, admin }) {
  const db = admin.db
  const min = Number(settings.min_stock)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [cat, setCat] = useState('')
  const [form, setForm] = useState(null) // producto en edición/creación
  const [open, setOpen] = useState(null) // producto con lotes desplegados
  const [nb, setNb] = useState({ lot: '', expiry: '', qty: '', invoice: '', supplier: '' })

  const totals = useMemo(() => {
    const t = {}
    for (const b of batches) t[b.product_id] = (t[b.product_id] || 0) + Number(b.qty)
    return t
  }, [batches])
  const total = (p) => totals[p.id] || 0
  const shelfName = (id) => shelves.find((s) => s.id === id)?.name
  const location = (p) => (p.shelf_id ? `${shelfName(p.shelf_id)} · espacio ${p.space ?? '?'}` : 'Sin ubicación')

  const categories = useMemo(() => uniq(products.map((p) => p.category)), [products])
  const brands = useMemo(() => uniq(products.map((p) => p.brand)), [products])

  const t = q.trim().toLowerCase()
  const list = products.filter((p) => {
    if (filter !== 'all' && stockStatus(total(p), min) !== filter) return false
    if (cat && (p.category || '') !== cat) return false
    return (
      !t ||
      [p.name, p.category, p.brand, p.reference, p.nfc_code, location(p)].some((v) => (v || '').toLowerCase().includes(t))
    )
  })

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async () => {
    if (!form.name.trim()) return say('Falta el nombre')
    const noPrice = form.price === '' || form.price == null
    if (!noPrice && !(Number(form.price) >= 0)) return say('Precio inválido')
    const txt = (v) => (v || '').trim() || null
    const row = {
      name: form.name.trim(),
      reference: txt(form.reference),
      brand: txt(form.brand),
      category: txt(form.category),
      unit: (form.unit || '').trim() || 'unidades',
      price: noPrice ? null : Number(form.price),
      nfc_code: txt(form.nfc_code),
      shelf_id: form.shelf_id || null,
      space: form.shelf_id && form.space ? Number(form.space) : null,
      notes: form.notes || null
    }
    const { error } = form.id ? await db.from('products').update(row).eq('id', form.id) : await db.from('products').insert(row)
    if (error) {
      if (error.message.includes('nfc_code')) return say('Ese tag NFC ya está asignado')
      if (/category|brand|reference/.test(error.message)) return say('Falta ejecutar supabase/actualizacion_v4.sql en Supabase')
      return say(error.message)
    }
    setForm(null)
    say('Producto guardado')
    load()
  }

  const del = async (p) => {
    if (!confirm(`¿Eliminar ${p.name} y todos sus lotes?`)) return
    const { error } = await db.from('products').delete().eq('id', p.id)
    if (error) return say(error.message)
    load()
  }

  const addBatch = async (pid) => {
    if (!nb.lot.trim() || !nb.expiry || !(Number(nb.qty) > 0)) return say('Completa lote, vencimiento y cantidad')
    const { error } = await db.rpc('register_entry', {
      p_product: pid,
      p_lot: nb.lot.trim(),
      p_expiry: nb.expiry,
      p_qty: Number(nb.qty),
      p_invoice: nb.invoice.trim() || null,
      p_supplier: nb.supplier.trim() || null,
      p_notes: null
    })
    if (error) return say(error.message)
    setNb({ lot: '', expiry: '', qty: '', invoice: '', supplier: '' })
    say('Entrada registrada')
    load()
  }

  const editBatch = async (b, patch) => {
    const { error } = await db.from('batches').update(patch).eq('id', b.id)
    if (error) say(error.message)
    load()
  }

  const delBatch = async (b) => {
    if (!confirm(`¿Eliminar lote ${b.lot}?`)) return
    const { error } = await db.from('batches').delete().eq('id', b.id)
    if (error) say(error.message)
    load()
  }

  const writeTag = async () => {
    if (!nfcSupported()) return say('Escribir tags requiere Chrome en Android')
    const code = form.nfc_code?.trim() || Math.random().toString(36).slice(2, 10)
    setForm((f) => ({ ...f, nfc_code: code }))
    say('Acerca el tag para escribirlo…')
    try {
      await writeNfcUrl(tagUrl(code))
      say('Tag escrito ✔ (funciona en iPhone y Android). Guarda el producto.')
    } catch (e) {
      say('No se pudo escribir: ' + e.message)
    }
  }

  const shelf = shelves.find((s) => s.id === form?.shelf_id)

  return (
    <section>
      <div className="row between">
        <h2>Inventario</h2>
        <button className="btn primary" onClick={() => setForm(form ? null : { ...EMPTY })}>
          {form ? 'Cerrar' : '+ Nuevo producto'}
        </button>
      </div>

      {form && (
        <div className="card">
          <h3>{form.id ? 'Editar producto' : 'Nuevo producto'}</h3>
          <label className="field">
            <span>Nombre *</span>
            <input value={form.name} onChange={set('name')} />
          </label>
          <div className="grid2 mt">
            <label className="field">
              <span>Referencia</span>
              <input value={form.reference || ''} onChange={set('reference')} />
            </label>
            <label className="field">
              <span>Marca</span>
              <input list="brands" value={form.brand || ''} onChange={set('brand')} />
            </label>
            <label className="field">
              <span>Categoría</span>
              <input list="cats" value={form.category || ''} onChange={set('category')} />
            </label>
            <label className="field">
              <span>Precio $</span>
              <input type="number" min="0" step="any" inputMode="decimal" value={form.price ?? ''} onChange={set('price')} />
            </label>
            <label className="field">
              <span>Unidad de medida</span>
              <input list="units" value={form.unit || ''} onChange={set('unit')} />
            </label>
            <label className="field">
              <span>Código NFC</span>
              <input value={form.nfc_code || ''} onChange={set('nfc_code')} />
            </label>
          </div>
          <datalist id="units">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <datalist id="brands">
            {brands.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <datalist id="cats">
            {categories.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <div className="row wrap mt">
            <NfcButton label="Leer tag" onCode={(c) => setForm((f) => ({ ...f, nfc_code: c }))} say={say} />
            <button type="button" className="btn" onClick={writeTag}>
              ✍ Escribir enlace en el tag (iPhone)
            </button>
          </div>
          <label className="field mt">
            <span>📍 Ubicación en la estantería</span>
          </label>
          <div className="row">
            <select value={form.shelf_id || ''} onChange={(e) => setForm({ ...form, shelf_id: e.target.value, space: '' })}>
              <option value="">Sin estantería</option>
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select disabled={!shelf} value={form.space || ''} onChange={set('space')}>
              <option value="">Espacio</option>
              {shelf &&
                Array.from({ length: shelf.spaces }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Espacio {n}
                  </option>
                ))}
            </select>
          </div>
          <label className="field mt">
            <span>Notas</span>
            <input value={form.notes || ''} onChange={set('notes')} />
          </label>
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

      <input className="search" placeholder="🔍 Buscar producto, marca, referencia, código o estantería" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row wrap mt">
        {FILTERS.map(([k, l]) => (
          <button key={k} className={'btn sm' + (filter === k ? ' dark' : '')} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
        {categories.length > 0 && (
          <select style={{ width: 'auto', flex: '1 1 140px' }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {list.map((p) => {
        const bs = batches.filter((b) => b.product_id === p.id)
        const isOpen = open === p.id
        return (
          <div className={'card st-' + stockStatus(total(p), min) + (isOpen ? '' : ' click')} key={p.id}>
            <ProductInfo p={p} total={total(p)} min={min} location={location(p)} onClick={() => setOpen(isOpen ? null : p.id)} />
            {isOpen && (
              <div className="detail">
                {p.nfc_code && <div className="muted">NFC: {p.nfc_code}</div>}
                {p.notes && <div className="muted">Notas: {p.notes}</div>}
                {bs.length > 0 ? (
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
                ) : (
                  <p className="muted">Sin lotes registrados. Agrega la primera entrada:</p>
                )}
                <h3 className="mt">Entrada de lote</h3>
                <div className="row">
                  <input placeholder="Lote" value={nb.lot} onChange={(e) => setNb({ ...nb, lot: e.target.value })} />
                  <input type="date" min={today()} value={nb.expiry} onChange={(e) => setNb({ ...nb, expiry: e.target.value })} />
                  <input type="number" step="any" placeholder="Cant." value={nb.qty} onChange={(e) => setNb({ ...nb, qty: e.target.value })} />
                </div>
                <div className="row mt">
                  <input placeholder="Factura (opcional)" value={nb.invoice} onChange={(e) => setNb({ ...nb, invoice: e.target.value })} />
                  <input placeholder="Proveedor (opcional)" value={nb.supplier} onChange={(e) => setNb({ ...nb, supplier: e.target.value })} />
                </div>
                <div className="row wrap mt">
                  <button className="btn primary" onClick={() => addBatch(p.id)}>
                    + Registrar entrada
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setForm({ ...EMPTY, ...p })
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    ✎ Editar producto
                  </button>
                  <button className="btn danger" onClick={() => del(p)}>
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      {!list.length && <p className="muted mt">Sin resultados.</p>}
    </section>
  )
}
