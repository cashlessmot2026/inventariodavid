import React, { useState } from 'react'
import { supabase } from '../supabase.js'
import { askPermission, notifSupported } from '../notify.js'
import { nfcSupported } from '../utils.js'

export default function Settings({ settings, load, say }) {
  const [months, setMonths] = useState(settings.alert_months)
  const [perm, setPerm] = useState(notifSupported() ? Notification.permission : 'unsupported')

  const save = async () => {
    const { error } = await supabase.from('settings').upsert({ id: 1, alert_months: Number(months) })
    if (error) return say(error.message)
    say('Guardado')
    load()
  }

  const enable = async () => {
    const r = await askPermission()
    setPerm(r)
    if (r === 'granted') say('Notificaciones activadas')
  }

  return (
    <section>
      <h2>Ajustes</h2>
      <div className="card">
        <h3>Alerta de vencimiento</h3>
        <div className="row">
          <label>Avisar cuando falten</label>
          <input type="number" min="0" step="0.5" value={months} onChange={(e) => setMonths(e.target.value)} />
          <label>meses</label>
        </div>
        <button className="btn primary mt" onClick={save}>
          Guardar
        </button>
      </div>
      <div className="card">
        <h3>Notificaciones</h3>
        <p className="muted">Estado: {perm === 'granted' ? 'activadas' : perm === 'denied' ? 'bloqueadas en el navegador' : perm === 'unsupported' ? 'no soportadas' : 'sin activar'}</p>
        {perm !== 'granted' && perm !== 'unsupported' && (
          <button className="btn primary" onClick={enable}>
            Activar notificaciones
          </button>
        )}
        <p className="muted mt">Se envía un aviso diario con los lotes por vencer cuando la app está abierta o instalada.</p>
      </div>
      <div className="card">
        <h3>NFC</h3>
        <p className="muted">{nfcSupported() ? 'Este dispositivo soporta lectura NFC (Web NFC).' : 'Este dispositivo/navegador no soporta Web NFC (usa Chrome en Android). Puedes escribir el código manualmente o usar un lector USB.'}</p>
      </div>
    </section>
  )
}
