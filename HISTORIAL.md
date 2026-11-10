# Historial del proyecto · Urueta Farmacia (PWA de inventario de medicamentos)

Última actualización: 2026-11-09

## Enlaces
- Repo: https://github.com/cashlessmot2026/inventariodavid (rama `main`)
- App publicada: https://cashlessmot2026.github.io/inventariodavid/
- Supabase: https://nnibpmxtivlalrwjieyb.supabase.co (la anon key está en `src/supabase.js`; se puede sobrescribir con `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`)

## Pedido original (resumen)
PWA instalable (Android e iOS), React, colores blanco / azul claro / negro, para controlar inventario y salidas de medicamentos:
- Un tag NFC por referencia de medicamento (varias unidades; unidad de medida variable: ml, unidades, etc.).
- Cada escaneo muestra unidades disponibles con lote y vencimiento (prioridad al que vence antes) y descuenta stock.
- Campo manual para el número de factura (trazabilidad: a quién, lote, vencimiento).
- Varias lecturas NFC / varios productos en la misma salida.
- PDF o imagen del comprobante de la salida.
- Pestaña de analítica: más vendido, día con más salidas.
- Estanterías (ej. EA espacio 1, 2, 3), el admin puede agregar más; buscador que indica ubicación; todo editable.
- Alertas/notificaciones cuando falten X meses para vencer (X lo define el admin).
- Una sola página, sin login. Los archivos van en esta carpeta y en el repo, sin ejecutar nada en local.

## Lo hecho
- Proyecto Vite + React + `vite-plugin-pwa` + `@supabase/supabase-js` + `jspdf`.
- Despliegue automático a GitHub Pages con GitHub Actions (`.github/workflows/deploy.yml`) en cada push a `main`. Pages ya activado (source: Actions).
- `supabase/schema.sql`: tablas `shelves`, `products`, `batches`, `movements`, `movement_items`, `settings`; función `register_exit` (salida atómica, valida stock y descuenta por lote); RLS abierto para `anon`.
- Pestañas: Salida, Inventario, Estanterías, Historial, Panel (analítica + por vencer), Ajustes.
- FEFO: la salida reparte la cantidad entre lotes empezando por el que vence primero.
- Soporte iOS (commit "Soporte iOS"):
  - Safari no tiene Web NFC. Los tags se pueden escribir (desde Android/Chrome) con un enlace `?tag=CODIGO`; el iPhone lo abre al acercarlo y suma 1 unidad.
  - Aviso de instalación en iOS (Compartir → Añadir a pantalla de inicio).
  - PDF/imagen usan el menú Compartir en móvil.
  - Carrito guardado en `localStorage`.
- 2026-10-31: reporte diario PDF/CSV de entradas y salidas (`src/report.js`), registro de entradas (`register_entry`), ubicación visible en el producto.
- 2026-11-09 (v3):
  - La app se llama **Urueta Farmacia** (título, manifest, encabezado). La URL sigue siendo `/inventariodavid/`.
  - **Stock mínimo** (`settings.min_stock`, por defecto 8, editable en Ajustes): al llegar al mínimo se muestra notificación con el nombre del producto y voz «Hay 8 unidades de X» (se puede apagar la voz en Ajustes). Un aviso por producto hasta que se reponga. Tiempo real de Supabase sobre `batches` para que avise en los demás dispositivos con la app abierta. Tarjeta «Stock bajo» en Panel y etiqueta en Inventario.
  - **Contraseña de administrador**: inventario, estanterías, entradas y ajustes solo se modifican con contraseña; ver y registrar salidas no la requiere. Se valida en la base de datos (RLS + cabecera `x-admin-pass`, hash bcrypt en `admin_secret`), no solo en pantalla. Se crea la primera vez que alguien pulsa «Desbloquear» y se cambia en Ajustes → Administrador. Si se olvida: `delete from admin_secret;` en Supabase.
  - **Precio** por producto (`products.price`), editable en el formulario del producto y visible para todos en Inventario.

## Pendiente / siguiente
1. **Ejecutar `supabase/actualizacion_v3.sql` en Supabase → SQL Editor** (lo hace el usuario). Sin esto no se puede desbloquear la edición. (`supabase/schema.sql` contiene todo, para una instalación desde cero.)
2. Probar la app en un Android y un iPhone reales; nada se ha probado en uso (solo se verificó que el build de GitHub Actions termina en éxito).
3. Push real con la app cerrada: hoy las notificaciones (vencimiento y stock bajo) son locales, requieren la app abierta o en segundo plano. Para push de verdad hace falta Web Push con VAPID + una Edge Function / cron en Supabase.
4. Seguridad: editar exige contraseña de admin; ver datos y registrar salidas sigue abierto a quien tenga el enlace.
5. Ideas: editar/anular salidas, exportar a Excel, stock mínimo distinto por producto.

## Notas técnicas
- Archivos clave: `src/App.jsx` (estado y tabs), `src/components/*` (pestañas), `src/utils.js` (FEFO, NFC, fechas), `src/receipt.js` (PDF/PNG), `src/notify.js` (alertas), `vite.config.js` (manifest PWA, base `/inventariodavid/`).
- Iconos PNG generados con un script Node (192 y 512) en `public/`.
- En esta sesión el shell Bash falló al recibir heredocs largos con comillas; se resolvió usando la herramienta Write y ejecutando el script.
- Git: usuario con sesión `gh` de `cashlessmot2026`; commits con `Co-Authored-By: Claude Sonnet 5.5`.
