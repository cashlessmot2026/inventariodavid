import React, { useState } from 'react'

export default function Shelves({ shelves, products, load, say, admin }) {
  const can = admin.unlocked
  const db = admin.db
  const [name, setName] = useState('')
  const [spaces, setSpaces] = useState(3)

  const add = async () => {
    if (!name.trim()) return say('Escribe el nombre de la estantería')
    const { error } = await db.from('shelves').insert({ name: name.trim(), spaces: Number(spaces) || 1 })
    if (error) return say(error.message)
    setName('')
    load()
  }

  const edit = async (s, patch) => {
    const { error } = await db.from('shelves').update(patch).eq('id', s.id)
    if (error) say(error.message)
    load()
  }

  const del = async (s) => {
    if (!confirm(`¿Eliminar la estantería ${s.name}? Los productos quedarán sin ubicación.`)) return
    const { error } = await db.from('shelves').delete().eq('id', s.id)
    if (error) say(error.message)
    load()
  }

  return (
    <section>
      <h2>Estanterías</h2>
      {!can && (
        <button className="btn block" onClick={admin.ask}>
          🔒 Desbloquear para modificar
        </button>
      )}
      {can && <div className="card">
        <div className="row">
          <input placeholder="Nombre (ej. EA)" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="number" min="1" value={spaces} onChange={(e) => setSpaces(e.target.value)} title="Espacios" />
          <button className="btn primary" onClick={add}>
            + Agregar
          </button>
        </div>
      </div>}

      {shelves.map((s) => (
        <div className="card" key={s.id}>
          <div className="row between">
            <input disabled={!can} defaultValue={s.name} onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && edit(s, { name: e.target.value.trim() })} />
            <input
              type="number"
              disabled={!can}
              min="1"
              defaultValue={s.spaces}
              title="Espacios"
              onBlur={(e) => Number(e.target.value) >= 1 && Number(e.target.value) !== s.spaces && edit(s, { spaces: Number(e.target.value) })}
            />
            {can && (
              <button className="btn sm danger" onClick={() => del(s)}>
                ✕
              </button>
            )}
          </div>
          {Array.from({ length: s.spaces }, (_, i) => i + 1).map((n) => {
            const ps = products.filter((p) => p.shelf_id === s.id && p.space === n)
            return (
              <div key={n} className="space">
                <b>
                  {s.name} espacio {n}
                </b>
                <span className="muted">{ps.length ? ps.map((p) => p.name).join(', ') : 'vacío'}</span>
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}
