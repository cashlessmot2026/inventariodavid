import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, adminClient } from './supabase.js'
import { isIOS, isStandalone } from './utils.js'
import { askPermission, expiringBatches, notifSupported, notifyExpiring, lowStock, notifyLowStock, primeVoice } from './notify.js'
import Exit from './components/Exit.jsx'
import Stock from './components/Stock.jsx'
import Inventory from './components/Inventory.jsx'
import Shelves from './components/Shelves.jsx'
import History from './components/History.jsx'
import Panel from './components/Panel.jsx'
import Settings from './components/Settings.jsx'
import Unlock from './components/Unlock.jsx'

// Interfaz pública: solo salida y estado del inventario
const PUBLIC_TABS = [
  ['exit', '📤 Salida'],
  ['stock', '📦 Inventario']
]
// Interfaz del administrador (oculta): todas las funciones
const ADMIN_TABS = [
  ['panel', '📊 Panel'],
  ['exit', '📤 Salida'],
  ['inv', '📦 Inventario'],
  ['shelves', '🗄 Estanterías'],
  ['hist', '🧾 Historial'],
  ['cfg', '⚙ Ajustes']
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
  const [data, setData] = useState({ shelves: [], products: [], batches: [], settings: DEFAULTS })
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [installEvt, setInstallEvt] = useState(null)
  const [pendingTag, setPendingTag] = useState(() => new URLSearchParams(location.search).get('tag'))
  const [iosHint, setIosHint] = useState(() => isIOS() && !isStandalone())
  const [token, setTokenState] = useState(savedToken)
  const [asking, setAsking] = useState(() => location.hash === '#admin' && !savedToken())
  const [tab, setTab] = useState(() => (savedToken() && !pendingTag ? 'panel' : 'exit'))
  const [perm, setPerm] = useState(() => (notifSupported() ? Notification.permission : 'unsupported'))
  const taps = useRef({ n: 0, t: 0 })

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

  // ===== Administrador =====
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
  const isAdmin = admin.unlocked
  const tabs = isAdmin ? ADMIN_TABS : PUBLIC_TABS
  const cur = tabs.some(([k]) => k === tab) ? tab : tabs[0][0]

  // Acceso oculto: 5 toques seguidos sobre el logo (o abrir la dirección terminada en #admin)
  const secretTap = () => {
    if (isAdmin) return
    const now = Date.now()
    const s = taps.current
    s.n = now - s.t < 1500 ? s.n + 1 : 1
    s.t = now
    if (s.n >= 5) {
      s.n = 0
      setAsking(true)
    }
  }

  const logout = () => {
    admin.lock()
    setTab('exit')
    if (location.hash) history.replaceState(null, '', location.pathname + location.search)
    say('Sesión de administrador cerrada')
  }

  // Si la contraseña guardada en esta sesión ya no es válida (la cambiaron), se cierra la sesión
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
    const onHash = () => location.hash === '#admin' && !savedToken() && setAsking(true)
    window.addEventListener('hashchange', onHash)

    // Tiempo real: si otro dispositivo cambia el inventario, se recarga (y dispara el aviso de stock bajo)
    let timer
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(load, 600)
    }
    const ch = supabase
      .channel('stock')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refresh)
      .subscribe()
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall)
      window.removeEventListener('hashchange', onHash)
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
    if (fresh.length) say(fresh.length > 3 ? `⚠ ${fresh.length} productos con stock bajo` : `⚠ Stock bajo: ${fresh.map((p) => p.name).join(', ')}`)
  }, [low, loaded, say])

  const install = async () => {
    installEvt.prompt()
    await installEvt.userChoice
    setInstallEvt(null)
  }

  const enableNotif = async () => {
    const r = await askPermission()
    setPerm(r)
    if (r === 'granted') say('Avisos activados')
  }

  const clearTag = useCallback(() => {
    setPendingTag(null)
    history.replaceState(null, '', location.pathname)
  }, [])

  const props = { ...data, load, say, expiring, low, admin, pendingTag, clearTag }

  return (
    <div className="app">
      <div className="top">
        <header>
          <div className="brand" onClick={secretTap}>
            <div className="logo">💊</div>
            <div>
              <h1>Urueta Farmacia</h1>
              <small>{isAdmin ? 'Panel de administración' : 'Inventario y salidas'}</small>
            </div>
          </div>
          <div className="row">
            {!isAdmin && perm === 'default' && (
              <button className="btn sm" onClick={enableNotif} title="Activar avisos de stock bajo">
                🔔 Avisos
              </button>
            )}
            {installEvt && (
              <button className="btn primary sm" onClick={install}>
                ⬇ Instalar
              </button>
            )}
            {isAdmin && (
              <button className="btn dark sm" onClick={logout}>
                Salir
              </button>
            )}
          </div>
        </header>
        <div className={'tabs' + (isAdmin ? '' : ' public')}>
          {tabs.map(([k, l]) => (
            <button key={k} className={'tab' + (cur === k ? ' active' : '')} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {iosHint && (
        <div className="alert info" onClick={() => setIosHint(false)}>
          Para instalar en iPhone/iPad: toca <b>Compartir</b> ⬆ y luego <b>Añadir a pantalla de inicio</b>. (toca para cerrar)
        </div>
      )}
      {error && (
        <div className="alert bad">
          Error de base de datos: {error}. ¿Ejecutaste los archivos de <code>supabase/</code>?
        </div>
      )}
      {isAdmin && expiring.length > 0 && cur !== 'panel' && (
        <div className="alert warn" onClick={() => setTab('panel')}>
          ⚠ {expiring.length} lote(s) vencen en menos de {data.settings.alert_months} mes(es). Ver detalle →
        </div>
      )}
      {isAdmin && low.length > 0 && cur !== 'panel' && (
        <div className="alert bad" style={{ cursor: 'pointer' }} onClick={() => setTab('panel')}>
          ⚠ {low.length} producto(s) con stock en {data.settings.min_stock} o menos. Ver detalle →
        </div>
      )}

      <main key={cur}>
        {cur === 'exit' && <Exit {...props} />}
        {cur === 'stock' && <Stock {...props} />}
        {cur === 'panel' && <Panel {...props} go={setTab} />}
        {cur === 'inv' && <Inventory {...props} />}
        {cur === 'shelves' && <Shelves {...props} />}
        {cur === 'hist' && <History say={say} />}
        {cur === 'cfg' && <Settings {...props} />}
      </main>

      {asking && (
        <Unlock
          onClose={() => setAsking(false)}
          onUnlock={(t) => {
            setToken(t)
            setAsking(false)
            setTab('panel')
            say('Bienvenido, administrador')
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
