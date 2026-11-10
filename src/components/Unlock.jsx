import React, { useEffect, useState } from 'react'
import { supabase, hashPass } from '../supabase.js'

const ADMIN_USER = 'admin'

// Inicio de sesión del administrador (acceso oculto). Si aún no hay contraseña, la primera que se escriba queda guardada.
export default function Unlock({ onUnlock, onClose }) {
  const [has, setHas] = useState(null) // null = consultando
  const [user, setUser] = useState('')
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
    if (user.trim().toLowerCase() !== ADMIN_USER) return setErr('Usuario o contraseña incorrectos')
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
      if (!data) return setErr('Usuario o contraseña incorrectos')
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
        <h3>🔒 Administrador</h3>
        {has === false && <p className="muted">Primer ingreso: la contraseña que escribas quedará guardada como contraseña del administrador.</p>}
        <input autoFocus autoCapitalize="none" autoComplete="username" placeholder="Usuario" value={user} onChange={(e) => setUser(e.target.value)} />
        <input className="mt" type="password" autoComplete="current-password" placeholder="Contraseña" value={pw} onChange={(e) => setPw(e.target.value)} />
        {has === false && (
          <input className="mt" type="password" placeholder="Repetir contraseña" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        )}
        {err && <p className="err">{err}</p>}
        <div className="row mt">
          <button className="btn primary" disabled={busy || has === null || !pw || !user}>
            Entrar
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
