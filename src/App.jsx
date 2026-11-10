import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, adminClient } from './supabase.js'
import { isIOS, isStandalone } from './utils.js'
import { expiringBatches, notifyExpiring, lowStock, notifyLowStock, primeVoice } from './notify.js'
import Exit from './components/Exit.jsx'
import Inventory from './components/Inventory.jsx'
import Shelves from './components/Shelves.jsx'
import History from './components/History.jsx'
import Panel from './components/Panel.jsx'
import Settings from './components/Settings.jsx'
import Unlock from './components/Unlock.jsx'

const TABS = [
  ['exit', 'Salida'],
  ['inv', 'Inventario'],
  ['shelves', 'Estanterías'],
  ['hist', 'Historial'],
  ['panel', 'Panel'],
  ['cfg', 'Ajustes']
]
const DEFAULTS = { alert_months: 2, min_stock: 8 }

const savedToken = () => {
  try {
    return sessionStorage.getItem('admin') || ''
  } catch {
    return ''
  }
}

export default function App() {
  const [tab, setTab] = useState('exit')
  const [data, setData] = useState({ shelves: [], products: [], batches: [], settings: DEFAULTS })
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [installEvt, setInstallEvt] = useState(null)
  const [pendingTag, setPendingTag] = useState(() => new URLSearchParams(location.search).get('tag'))
  const [iosHint, setIosHint] = useState(() => isIOS() && !isStandalone())
  const [token, setTokenState] = useState(savedToken)
  const [asking, setAsking] = useState(false)

  const say = useCallback((m) => {
    setToast(m)
    setTimeout(() => setToast(''), 3200)
  }, [])

  const load = useCallback(async () => {
    const [s, p, b, c] = await Promise.all([
      supabase.from('shelves').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
      supabase.from('batches').select('*').order('expiry'),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle()
    ])
    const err = s.error || p.error || b.error || c.error
    if (err) return setError(err.message)
    setError('')
    setData({ shelves: s.data, products: p.data, batches: b.data, settings: { ...DEFAULTS, ...(c.data || {}) } })
    setLoaded(true)
  }, [])

  // ===== Administrador (contraseña) =====
  const setToken = useCallback((t) => {
    setTokenState(t)
    try {
      if (t) sessionStorage.setItem('admin', t)
      else sessionStorage.removeItem('admin')
    } catch {}
  }, [])

  const admin = useMemo(
    () => ({
      unlocked: !!token,
      db: token ? adminClient(token) : null,
      token,
      setToken,
      ask: () => setAsking(true),
      lock: () => setToken('')
    }),
    [token, setToken]
  )

  // Si la contraseña guardada en esta sesión ya no es válida (la cambiaron), se bloquea
  useEffect(() => {
    const t = savedToken()
    if (!t) return
    supabase.rpc('admin_check', { p_pass: t }).then(({ data: ok }) => {
      if (!ok) setToken('')
    })
  }, [setToken])

  useEffect(() => {
    load()
    primeVoice()
    const onInstall = (e) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', onInstall)

    // Tiempo real: si otro dispositivo cambia el stock, se recarga (y dispara el aviso de stock bajo)
    let timer
    const ch = supabase
      .channel('stock')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, () => {
        clearTimeout(timer)
        timer = setTimeout(load, 600)
      })
      .subscribe()
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall)
      document.removeEventListener('visibilitychange', onVisible)
      clearTimeout(timer)
      supabase.removeChannel(ch)
    }
  }, [load])

  // Alertas de vencimiento: al abrir la app y cada hora mientras esté abierta
  const expiring = useMemo(() => {
    const names = Object.fromEntries(data.products.map((p) => [p.id, p.name]))
    return expiringBatches(data.batches, Number(data.settings.alert_months)).map((b) => ({
      ...b,
      productName: names[b.product_id] || '?'
    }))
  }, [data])

  useEffect(() => {
    notifyExpiring(expiring)
    const t = setInterval(() => notifyExpiring(expiring), 3600000)
    return () => clearInterval(t)
  }, [expiring])

  // Stock mínimo: notificación + voz cuando un producto llega al mínimo
  const low = useMemo(() => lowStock(data.products, data.batches, data.settings.min_stock), [data])

  useEffect(() => {
    if (!loaded) return
    const fresh = notifyLowStock(low)
    if (fresh.length) say(`⚠ Stock bajo: ${fresh.map((p) => p.name).join(', ')}`)
  }, [low, loaded, say])

  const install = async () => {
    installEvt.prompt()
    await installEvt.userChoice
    setInstallEvt(null)
  }

  const clearTag = useCallback(() => {
    setPendingTag(null)
    history.replaceState(null, '', location.pathname)
  }, [])

  const props = { ...data, load, say, expiring, low, admin, pendingTag, clearTag }

  return (
    <div className="app">
      <header>
        <h1>💊 Urueta Farmacia</h1>
        <div className="row">
          {admin.unlocked && (
            <button className="btn sm" onClick={admin.lock} title="Bloquear edición">
              🔓 Admin
            </button>
          )}
          {installEvt && (
            <button className="btn primary sm" onClick={install}>
              ⬇ Instalar app
            </button>
          )}
        </div>
      </header>
      {iosHint && (
        <div className="alert info" onClick={() => setIosHint(false)}>
          Para instalar en iPhone/iPad: toca <b>Compartir</b> ⬆ y luego <b>Añadir a pantalla de inicio</b>. (toca para cerrar)
        </div>
      )}
      {error && (
        <div className="alert bad">
          Error de base de datos: {error}. ¿Ejecutaste <code>supabase/schema.sql</code>?
        </div>
      )}
      {expiring.length > 0 && tab !== 'panel' && (
        <div className="alert warn" onClick={() => setTab('panel')}>
          ⚠ {expiring.length} lote(s) vencen en menos de {data.settings.alert_months} mes(es). Ver detalle →
        </div>
      )}
      {low.length > 0 && tab !== 'panel' && (
        <div className="alert bad" style={{ cursor: 'pointer' }} onClick={() => setTab('panel')}>
          ⚠ {low.length} producto(s) con stock en {data.settings.min_stock} o menos. Ver detalle →
        </div>
      )}
      <main>
        {tab === 'exit' && <Exit {...props} />}
        {tab === 'inv' && <Inventory {...props} />}
        {tab === 'shelves' && <Shelves {...props} />}
        {tab === 'hist' && <History say={say} />}
        {tab === 'panel' && <Panel {...props} />}
        {tab === 'cfg' && <Settings {...props} />}
      </main>
      <nav>
        {TABS.map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </nav>
      {asking && (
        <Unlock
          onClose={() => setAsking(false)}
          onUnlock={(t) => {
            setToken(t)
            setAsking(false)
            say('Edición desbloqueada')
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
