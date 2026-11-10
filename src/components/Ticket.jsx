import React, { useEffect } from 'react'
import { fmtDate, fmtDateTime, num } from '../utils.js'
import { downloadPdf, downloadPng } from '../receipt.js'

// Ticket de una salida (o entrada) con todos sus detalles
export function Ticket({ mov }) {
  const items = mov.movement_items || []
  const isIn = mov.type === 'in'
  return (
    <div className="ticket">
      <div className="tk-head">
        <div className="tk-logo">💊</div>
        <b>URUETA FARMACIA</b>
        <span>{isIn ? 'Entrada de inventario' : 'Salida de inventario'}</span>
      </div>
      {mov.number != null && <div className="tk-num">N° {String(mov.number).padStart(5, '0')}</div>}
      <div className="tk-sep" />
      <div className="tk-row">
        <span>Factura</span>
        <b>{mov.invoice || '—'}</b>
      </div>
      <div className="tk-row">
        <span>{isIn ? 'Proveedor' : 'Cliente'}</span>
        <b>{mov.customer || '—'}</b>
      </div>
      <div className="tk-row">
        <span>Fecha</span>
        <b>{fmtDateTime(mov.created_at)}</b>
      </div>
      <div className="tk-sep" />
      <div className="tk-row tk-th">
        <span>Producto</span>
        <span>Cant.</span>
      </div>
      {items.map((i) => (
        <div className="tk-item" key={i.id}>
          <div className="tk-row">
            <b>{i.product_name}</b>
            <b>
              {num(i.qty)} {i.unit}
            </b>
          </div>
          <small>
            Lote {i.lot || '—'} · Vence {fmtDate(i.expiry)}
          </small>
        </div>
      ))}
      <div className="tk-sep" />
      <div className="tk-row">
        <span>Productos</span>
        <b>{items.length}</b>
      </div>
      {mov.notes && (
        <>
          <div className="tk-sep" />
          <small>Notas: {mov.notes}</small>
        </>
      )}
      <div className="tk-foot">* Gracias *</div>
    </div>
  )
}

// Ventana emergente con la vista previa del ticket
export default function TicketModal({ mov, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const items = mov.movement_items || []
  return (
    <div className="modal" onClick={onClose}>
      <div className="tk-wrap" onClick={(e) => e.stopPropagation()}>
        <Ticket mov={mov} />
        <div className="row wrap tk-actions">
          <button className="btn primary" onClick={() => downloadPdf(mov, items)}>
            ⬇ PDF
          </button>
          <button className="btn" onClick={() => downloadPng(mov, items)}>
            ⬇ Imagen
          </button>
          <button className="btn dark" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
