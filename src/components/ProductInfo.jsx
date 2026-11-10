import React from 'react'
import { money, num, stockStatus, STATUS_LABEL } from '../utils.js'

// Cabecera de un producto: nombre, referencia/marca/categoría, ubicación, cantidad (con color) y precio
export default function ProductInfo({ p, total, min, location, onClick }) {
  const st = stockStatus(total, min)
  return (
    <div className="prod" onClick={onClick}>
      <div className="prod-main">
        <strong>{p.name}</strong>
        <div className="chips">
          {p.reference && <span className="chip ghost">Ref. {p.reference}</span>}
          {p.brand && <span className="chip">{p.brand}</span>}
          {p.category && <span className="chip">{p.category}</span>}
        </div>
        <div className="muted">📍 {location}</div>
      </div>
      <div className="prod-side">
        <div className={'qty ' + st}>
          <b>{num(total)}</b>
          <small>{p.unit}</small>
        </div>
        <span className={'state ' + st}>{STATUS_LABEL[st]}</span>
        <div className={'price' + (p.price == null ? ' none' : '')}>{p.price != null ? money(p.price) : 'Sin precio'}</div>
      </div>
    </div>
  )
}
