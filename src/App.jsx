import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'
import { expiringBatches, notifyExpiring } from './notify.js'
import Exit from './components/Exit.jsx'
import Inventory from './components/Inventory.jsx'
import Shelves from './components/Shelves.jsx'
import History from './components/History.jsx'
import Panel from './components/Panel.jsx'
import Settings from './components/Settings.jsx'

const TABS = [
  ['exit', 'Salida'],
  ['inv', 'Inventario'],
  ['shelves', 'Estanterías'],
  ['hist', 'Historial'],
  ['panel', 'Panel'],
  ['cfg', 'Ajustes']
]

export default function App() {
  const [tab, setTab] = useState('exit')
  const [data, setData] = useState({ shelves: [], products: [], batches: [], settings: { alert_months: 2 } })
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [installEvt, setInstallEvt] = useState(null)

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
    setData({ shelves: s.data, products: p.data, batches: b.data, settings: c.data || { alert_months: 2 } })
  }, [])

  useEffect(() => {
    load()
    const onInstall = (e) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', onInstall)
    return () => window.removeEventListener('beforeinstallprompt', onInstall)
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

  const install = async () => {
    installEvt.prompt()
    await installEvt.userChoice
    setInstallEvt(null)
  }

  const props = { ...data, load, say, expiring }

  return (
    <div className="app">
      <header>
        <h1>💊 Inventario</h1>
        {installEvt && (
          <button className="btn primary sm" onClick={install}>
            ⬇ Instalar app
          </button>
        )}
      </header>
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
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
