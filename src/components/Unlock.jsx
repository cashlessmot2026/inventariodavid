import React, { useEffect, useState } from 'react'
import { supabase, hashPass } from '../supabase.js'

// Ventana para escribir la contraseña de administrador (o crearla si aún no existe)
export default function Unlock({ onUnlock, onClose }) {
  const [has, setHas] = useState(null) // null = consultando
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.rpc('admin_has_password').then(({ data, error }) => {
      if (error) setErr('Falta ejecutar supabase/actualizacion_v3.sql en Supabase')
      else setHas(!!data)
    })
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (has === false) {
      if (pw.length < 4) return setErr('Mínimo 4 caracteres')
      if (pw !== pw2) return setErr('Las contraseñas no coinciden')
    }
    setBusy(true)
    const token = await hashPass(pw)
    if (has) {
      const { data, error } = await supabase.rpc('admin_check', { p_pass: token })
      setBusy(false)
      if (error) return setErr(error.message)
      if (!data) return setErr('Contraseña incorrecta')
    } else {
      const { error } = await supabase.rpc('admin_set_password', { p_old: null, p_new: token })
      setBusy(false)
      if (error) return setErr(error.message)
    }
    onUnlock(token)
  }

  return (
    <div className="modal" onClick={onClose}>
      <form className="card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>🔒 {has === false ? 'Crear contraseña de administrador' : 'Contraseña de administrador'}</h3>
        <p className="muted">
          {has === false
            ? 'Aún no hay contraseña. Créala para poder modificar el inventario.'
            : 'Se necesita para modificar inventario, estanterías y ajustes.'}
        </p>
        <input type="password" autoFocus placeholder="Contraseña" value={pw} onChange={(e) => setPw(e.target.value)} />
        {has === false && (
          <input className="mt" type="password" placeholder="Repetir contraseña" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        )}
        {err && <p className="err">{err}</p>}
        <div className="row mt">
          <button className="btn primary" disabled={busy || has === null || !pw}>
            {has === false ? 'Crear y entrar' : 'Entrar'}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
