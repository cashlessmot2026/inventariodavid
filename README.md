# Inventario de medicamentos (PWA)

React + Vite + Supabase. Control de inventario por lote/vencimiento (FEFO) con tags NFC, salidas con factura, PDF/imagen, estanterías, analítica y alertas de vencimiento.

## Puesta en marcha
1. En Supabase > SQL Editor ejecutar `supabase/schema.sql`.
2. En GitHub > Settings > Pages > Source: **GitHub Actions**.
3. Cada push a `main` compila y publica en https://cashlessmot2026.github.io/inventariodavid/
4. Abrir en Chrome (Android) y pulsar **Instalar app**.

NFC: Web NFC solo funciona en Chrome para Android y con HTTPS.
