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
  - La app se llama **Urueta Farmacia** (título, manifest, encabezado). Desde nov-2026 se publica en https://uruetafarmacia.online (base `/`, archivo `public/CNAME`).
  - **Stock mínimo** (`settings.min_stock`, por defecto 8, editable en Ajustes): al llegar al mínimo se muestra notificación con el nombre del producto y voz «Hay 8 unidades de X» (se puede apagar la voz en Ajustes). Un aviso por producto hasta que se reponga. Tiempo real de Supabase sobre `batches` para que avise en los demás dispositivos con la app abierta. Tarjeta «Stock bajo» en Panel y etiqueta en Inventario.
  - **Contraseña de administrador**: inventario, estanterías, entradas y ajustes solo se modifican con contraseña; ver y registrar salidas no la requiere. Se valida en la base de datos (RLS + cabecera `x-admin-pass`, hash bcrypt en `admin_secret`), no solo en pantalla. Se crea la primera vez que alguien pulsa «Desbloquear» y se cambia en Ajustes → Administrador. Si se olvida: `delete from admin_secret;` en Supabase.
  - **Precio** por producto (`products.price`), editable en el formulario del producto y visible para todos en Inventario.
- 2026-11-09 (v4, rediseño):
  - **Dos interfaces.** Pública: pestañas Salida e Inventario (estado de solo lectura: cantidad en verde si hay más del mínimo, ámbar si llegó al mínimo, rojo agotado; precio; ubicación; organizado por categoría, marca o referencia). Administrador (oculta): Panel, Salida, Inventario, Estanterías, Historial, Ajustes.
  - **Acceso oculto al admin:** 5 toques seguidos sobre el logo o abrir la app con `#admin` al final de la dirección. Usuario `admin` (se comprueba en la app); la contraseña la valida la base de datos. No se guardó ninguna contraseña en el repo (es público): en el primer ingreso, la contraseña que se escriba queda guardada.
  - Pestañas arriba (fijas), botones redondeados con sombra, tarjetas con animación, Panel tipo dashboard con indicadores (productos, disponibles, stock bajo, agotados, por vencer, valor del inventario).
  - Productos con `category`, `brand`, `reference` (`supabase/actualizacion_v4.sql`). Archivos nuevos: `Stock.jsx` (vista pública), `ProductInfo.jsx`, `Unlock.jsx` (login).
- 2026-11-09 (v5):
  - Pestaña Salida (pública y admin): buscador de salidas por N° de salida, factura, cliente y fecha; debajo, historial de las últimas 10 salidas con detalle y PDF/imagen (`RecentExits.jsx`).
  - Número consecutivo de salida (`movements.number`, `supabase/actualizacion_v5.sql`); aparece en el comprobante y en Historial.
  - Admin: la pestaña Inventario ahora se llama **Productos**; el precio se muestra siempre («Sin precio» si falta), es la primera casilla del formulario y se puede cambiar rápido al abrir la tarjeta del producto.
- 2026-11-09 (v6): las salidas se muestran como **tickets** (`Ticket.jsx`): cada salida de la lista es un talón con N°, fecha, factura, cliente y productos, y un botón «Vista previa del ticket» abre una ventana emergente con el ticket completo (lotes, vencimientos, notas) y botones PDF / Imagen / Cerrar. El mismo botón está en Historial (admin) y al terminar de registrar una salida. Sin cambios de SQL.
- 2026-11-10 (v7): **salida manual con buscador de producto** en la pestaña Salida (pública y admin, es el mismo `Exit.jsx`). Reemplaza la lista desplegable: se escribe nombre, categoría, marca o referencia (sin importar tildes ni mayúsculas) y cada resultado muestra el stock disponible y un botón «Dar salida» que lo agrega a la salida; los agotados salen deshabilitados. Máximo 8 resultados a la vez. Sin cambios de SQL.

## Estado al cierre de la sesión del 2026-11-09
- Todo está subido a `main` y publicado (último commit de código: `d0981d0`, tickets de salida; los despliegues de GitHub Actions terminaron en éxito).
- Supabase: **v3, v4 y v5 ya están ejecutadas** (comprobado consultando la base: existen `price`, `category`, `brand`, `reference` y `movements.number`). Al ejecutar la v5 el SQL Editor respondió `setval 48`: es lo normal, las 48 salidas existentes quedaron numeradas y la siguiente será la N° 49. Ya existe contraseña de admin; el usuario es `admin`. La contraseña no se anota aquí porque el repo es público; se cambia en Ajustes → Administrador.
- El usuario confirmó el 2026-11-09 que todo funciona bien tras ejecutar el SQL. **No queda SQL pendiente.**
- La base tiene 97 productos, todos sin categoría/marca/referencia y sin precio; 43 con stock en 8 o menos.
- Las últimas 10 salidas del 2026-11-09 son «Factura 0», sin cliente y de 1 unidad: parecen pruebas, pero descontaron stock real.
- Revisado en navegador (copia compilada en carpeta temporal, con los datos reales): vista pública de Inventario, pestaña Salida con las últimas 10 salidas, y el diseño del panel admin. **No probado:** iniciar sesión, guardar productos/precios, escribir en el buscador de salidas, notificaciones y voz en un teléfono.

## Pendiente / siguiente
1. Cargar precio, categoría, marca y referencia de los productos desde el admin (pestaña Productos).
2. Probar la app en un Android y un iPhone reales: login de admin, guardar cambios, avisos de stock bajo y voz.
3. Push real con la app cerrada: hoy las notificaciones (vencimiento y stock bajo) son locales, requieren la app abierta o en segundo plano. Para push de verdad hace falta Web Push con VAPID + una Edge Function / cron en Supabase.
4. Seguridad: editar exige contraseña de admin, pero ver datos y registrar salidas sigue abierto a quien tenga el enlace; la página pública muestra clientes y facturas de las salidas. Conviene usar una contraseña de admin más fuerte.
5. Ideas: editar/anular salidas (serviría para borrar las de prueba), exportar a Excel, stock mínimo distinto por producto.

## Notas técnicas
- Archivos clave: `src/App.jsx` (estado, modo público/admin y tabs), `src/components/*` (pestañas; `Stock.jsx` vista pública, `Inventory.jsx` productos del admin, `RecentExits.jsx` buscador de salidas, `Unlock.jsx` login), `src/utils.js` (FEFO, NFC, fechas), `src/receipt.js` (PDF/PNG), `src/notify.js` (alertas), `vite.config.js` (manifest PWA, base `/`).
- Iconos PNG generados con un script Node (192 y 512) en `public/`.
- En esta sesión el shell Bash falló al recibir heredocs largos con comillas; se resolvió usando la herramienta Write y ejecutando el script. Tampoco usar `node -e "..."` con comillas invertidas dentro: bash las ejecuta.
- Git: usuario con sesión `gh` de `cashlessmot2026`; commits con `Co-Authored-By` de Claude.
- Para revisar el diseño sin tocar el proyecto: copiar a una carpeta temporal, `npm install`, `vite build` y `vite preview` allí (el proyecto no tiene `node_modules`).
- No escribir contraseñas en ningún archivo del repo: es público.
- Para una instalación desde cero basta ejecutar `supabase/schema.sql` (incluye v3, v4 y v5). Todos los SQL son idempotentes.
