# Historial del proyecto · Inventario de medicamentos (PWA)

Última actualización: 2026-10-28

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

## Pendiente / siguiente
1. **Ejecutar `supabase/schema.sql` en Supabase → SQL Editor** (lo hace el usuario). Sin esto la app muestra error de base de datos.
2. Probar la app en un Android y un iPhone reales; nada se ha probado en uso (solo se verificó que el build de GitHub Actions termina en éxito).
3. Push real con la app cerrada: hoy las notificaciones son locales (1 aviso diario con la app abierta/instalada). Para push de verdad hace falta Web Push con VAPID + una Edge Function / cron en Supabase.
4. Seguridad: no hay login; cualquiera con el enlace puede ver y editar. Opciones: PIN de admin o Supabase Auth + políticas RLS más estrictas.
5. Ideas: editar/anular salidas, exportar a Excel, alertas de stock mínimo.

## Notas técnicas
- Archivos clave: `src/App.jsx` (estado y tabs), `src/components/*` (pestañas), `src/utils.js` (FEFO, NFC, fechas), `src/receipt.js` (PDF/PNG), `src/notify.js` (alertas), `vite.config.js` (manifest PWA, base `/inventariodavid/`).
- Iconos PNG generados con un script Node (192 y 512) en `public/`.
- En esta sesión el shell Bash falló al recibir heredocs largos con comillas; se resolvió usando la herramienta Write y ejecutando el script.
- Git: usuario con sesión `gh` de `cashlessmot2026`; commits con `Co-Authored-By: Claude Sonnet 5.5`.
