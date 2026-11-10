import React, { useState } from 'react'
import { supabase, hashPass } from '../supabase.js'
import { askPermission, notifSupported, setVoice, speak, voiceOn } from '../notify.js'
import { isIOS, isStandalone, nfcSupported } from '../utils.js'

export default function Settings({ settings, load, say, admin }) {
  const [months, setMonths] = useState(settings.alert_months)
  const [minStock, setMinStock] = useState(settings.min_stock)
  const [perm, setPerm] = useState(notifSupported() ? Notification.permission : 'unsupported')
  const [voice, setVoiceState] = useState(voiceOn())
  const [pw, setPw] = useState(null) // formulario de cambio de contraseña

  const save = async () => {
    if (!admin.unlocked) return admin.ask()
    if (!(Number(minStock) >= 0)) return say('Stock mínimo inválido')
    const { error } = await admin.db
      .from('settings')
      .upsert({ id: 1, alert_months: Number(months), min_stock: Number(minStock) })
    if (error) return say(error.message)
    say('Guardado')
    load()
  }

  const enable = async () => {
    const r = await askPermission()
    setPerm(r)
    if (r === 'granted') say('Notificaciones activadas')
  }

  const toggleVoice = (on) => {
    setVoice(on)
    setVoiceState(on)
    if (on) speak('Aviso por voz activado')
  }

  const changePass = async () => {
    if (pw.next.length < 4) return say('La nueva contraseña debe tener mínimo 4 caracteres')
    if (pw.next !== pw.again) return say('Las contraseñas no coinciden')
    const [oldT, newT] = await Promise.all([hashPass(pw.old), hashPass(pw.next)])
    const { error } = await supabase.rpc('admin_set_password', { p_old: oldT, p_new: newT })
    if (error) return say(error.message)
    admin.setToken(newT)
    setPw(null)
    say('Contraseña cambiada')
  }

  return (
    <section>
      <h2>Ajustes</h2>

      <div className="card">
        <h3>🔒 Administrador</h3>
        <p className="muted">
          Usuario: <b>admin</b>. El panel de administración está oculto: se abre tocando 5 veces seguidas el logo, o con la dirección de la app terminada en <code>#admin</code>.
        </p>
        {!admin.unlocked ? (
          <button className="btn primary" onClick={admin.ask}>
            Desbloquear / crear contraseña
          </button>
        ) : (
          <>
            <p className="muted">Sesión iniciada en este dispositivo (se cierra al cerrar la app o con «Salir»).</p>
            <div className="row">
              <button className="btn" onClick={() => setPw(pw ? null : { old: '', next: '', again: '' })}>
                Cambiar contraseña
              </button>
            </div>
            {pw && (
              <>
                <input className="mt" type="password" placeholder="Contraseña actual" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} />
                <input className="mt" type="password" placeholder="Nueva contraseña" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                <input className="mt" type="password" placeholder="Repetir nueva contraseña" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} />
                <button className="btn primary mt" onClick={changePass}>
                  Guardar contraseña
                </button>
              </>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h3>Alertas</h3>
        <div className="row">
          <label>Vencimiento: avisar cuando falten</label>
          <input type="number" min="0" step="0.5" value={months} onChange={(e) => setMonths(e.target.value)} />
          <label>meses</label>
        </div>
        <div className="row mt">
          <label>Stock mínimo: avisar al llegar a</label>
          <input type="number" min="0" step="any" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          <label>unidades</label>
        </div>
        <button className="btn primary mt" onClick={save}>
          {admin.unlocked ? 'Guardar' : '🔒 Guardar'}
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
        {isIOS() && !isStandalone() && <p className="err">En iPhone las notificaciones solo funcionan con la app instalada (Compartir → Añadir a pantalla de inicio, iOS 16.4+).</p>}
        <label className="row mt" style={{ whiteSpace: 'normal' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={voice} onChange={(e) => toggleVoice(e.target.checked)} />
          Aviso por voz de stock bajo («Hay 8 unidades de …»)
        </label>
        <p className="muted mt">
          Cuando un producto llega al stock mínimo se muestra una notificación con su nombre y se dice en voz alta. También se envía un aviso
          diario con los lotes por vencer. Los avisos llegan con la app abierta o en segundo plano.
        </p>
      </div>

      <div className="card">
        <h3>NFC</h3>
        {isIOS() && (
          <p className="muted">
            iPhone: el navegador no puede leer NFC dentro de la app. Acerca el teléfono al tag (escrito desde un Android con
            «Escribir enlace en el tag»): se abre el enlace y suma 1 unidad a la salida.
          </p>
        )}
        <p className="muted">{nfcSupported() ? 'Este dispositivo soporta lectura NFC (Web NFC).' : 'Este dispositivo/navegador no soporta Web NFC (usa Chrome en Android). Puedes escribir el código manualmente o usar un lector USB.'}</p>
      </div>
    </section>
  )
}
