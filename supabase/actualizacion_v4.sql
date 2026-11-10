-- ===== v4: categoría, marca y referencia del producto =====
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de actualizacion_v3.sql (es idempotente).
alter table products add column if not exists category text;
alter table products add column if not exists brand text;
alter table products add column if not exists reference text;
create index if not exists products_category_idx on products(category);

-- Tiempo real también para productos (precio, ubicación y datos se actualizan en las demás pantallas)
do $$ begin
  alter publication supabase_realtime add table products;
exception when others then null;
end $$;
