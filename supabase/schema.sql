-- Inventario de medicamentos · ejecutar completo en Supabase > SQL Editor
create extension if not exists pgcrypto;

create table if not exists shelves (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- ej. "EA"
  spaces int not null default 3,      -- cantidad de espacios (1..n)
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'unidades',   -- unidades, ml, mg, tabletas...
  nfc_code text unique,                    -- código/serial del tag NFC
  shelf_id uuid references shelves(id) on delete set null,
  space int,
  notes text,
  created_at timestamptz default now()
);

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  lot text not null,
  expiry date not null,
  qty numeric not null default 0 check (qty >= 0),
  created_at timestamptz default now()
);
create index if not exists batches_product_idx on batches(product_id, expiry);

create table if not exists movements (
  id uuid primary key default gen_random_uuid(),
  invoice text,
  customer text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists movement_items (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references movements(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  batch_id uuid references batches(id) on delete set null,
  product_name text not null,
  unit text,
  lot text,
  expiry date,
  qty numeric not null
);
create index if not exists mi_movement_idx on movement_items(movement_id);

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  alert_months numeric not null default 2
);
insert into settings (id, alert_months) values (1, 2) on conflict do nothing;
insert into shelves (name, spaces) values ('EA', 3) on conflict do nothing;

-- Salida atómica: valida stock, descuenta por lote y registra el movimiento
create or replace function register_exit(
  p_invoice text, p_customer text, p_notes text, p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_mov uuid;
  it jsonb;
  b batches%rowtype;
  p products%rowtype;
  q numeric;
begin
  insert into movements (invoice, customer, notes) values (p_invoice, p_customer, p_notes)
    returning id into v_mov;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it->>'qty')::numeric;
    select * into b from batches where id = (it->>'batch_id')::uuid for update;
    if not found then raise exception 'Lote no encontrado'; end if;
    if b.qty < q then raise exception 'Stock insuficiente en lote %', b.lot; end if;
    select * into p from products where id = b.product_id;
    update batches set qty = qty - q where id = b.id;
    insert into movement_items (movement_id, product_id, batch_id, product_name, unit, lot, expiry, qty)
      values (v_mov, p.id, b.id, p.name, p.unit, b.lot, b.expiry, q);
  end loop;
  return v_mov;
end $$;

-- Acceso desde la PWA con la anon key (app de una sola página, sin login)
alter table shelves enable row level security;
alter table products enable row level security;
alter table batches enable row level security;
alter table movements enable row level security;
alter table movement_items enable row level security;
alter table settings enable row level security;

do $$ declare t text; begin
  foreach t in array array['shelves','products','batches','movements','movement_items','settings'] loop
    execute format('drop policy if exists "anon_all" on %I', t);
    execute format('create policy "anon_all" on %I for all to anon using (true) with check (true)', t);
  end loop;
end $$;
grant execute on function register_exit(text,text,text,jsonb) to anon;

-- ===== Entradas (ejecutar también; es idempotente) =====
alter table movements add column if not exists type text not null default 'out'; -- 'out' salida, 'in' entrada
create index if not exists movements_created_idx on movements(created_at);

-- Entrada atómica: suma al lote (o lo crea) y registra el movimiento
create or replace function register_entry(
  p_product uuid, p_lot text, p_expiry date, p_qty numeric, p_invoice text, p_supplier text, p_notes text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_mov uuid; v_batch uuid; p products%rowtype;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Cantidad inválida'; end if;
  select * into p from products where id = p_product;
  if not found then raise exception 'Producto no encontrado'; end if;
  select id into v_batch from batches where product_id = p_product and lot = p_lot and expiry = p_expiry for update;
  if v_batch is null then
    insert into batches (product_id, lot, expiry, qty) values (p_product, p_lot, p_expiry, p_qty) returning id into v_batch;
  else
    update batches set qty = qty + p_qty where id = v_batch;
  end if;
  insert into movements (type, invoice, customer, notes) values ('in', p_invoice, p_supplier, p_notes) returning id into v_mov;
  insert into movement_items (movement_id, product_id, batch_id, product_name, unit, lot, expiry, qty)
    values (v_mov, p.id, v_batch, p.name, p.unit, p_lot, p_expiry, p_qty);
  return v_mov;
end $$;
grant execute on function register_entry(uuid,text,date,numeric,text,text,text) to anon;
