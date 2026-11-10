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


-- ===== v3: precio, stock mínimo y contraseña de administrador =====
-- Ejecutar completo en Supabase > SQL Editor (es idempotente, se puede repetir).
create extension if not exists pgcrypto;

alter table products add column if not exists price numeric check (price is null or price >= 0);
alter table settings add column if not exists min_stock numeric not null default 8;

-- Contraseña de administrador (solo se guarda el hash; la app no puede leer esta tabla)
create table if not exists admin_secret (
  id int primary key default 1 check (id = 1),
  hash text not null
);
alter table admin_secret enable row level security;
revoke all on admin_secret from anon, authenticated;

create or replace function admin_has_password() returns boolean
language sql security definer stable set search_path = public, extensions as $$
  select exists (select 1 from admin_secret where id = 1);
$$;

create or replace function admin_check(p_pass text) returns boolean
language sql security definer stable set search_path = public, extensions as $$
  select exists (
    select 1 from admin_secret where id = 1 and p_pass is not null and hash = crypt(p_pass, hash)
  );
$$;

-- La app envía la contraseña en la cabecera x-admin-pass de cada petición de edición
create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public, extensions as $$
  select admin_check(nullif(current_setting('request.headers', true), '')::json ->> 'x-admin-pass');
$$;

-- Crea la contraseña (si no existe) o la cambia (exige la actual)
create or replace function admin_set_password(p_old text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if coalesce(length(p_new), 0) < 8 then raise exception 'Contraseña inválida'; end if;
  if admin_has_password() and not admin_check(p_old) then
    raise exception 'Contraseña actual incorrecta';
  end if;
  insert into admin_secret (id, hash) values (1, crypt(p_new, gen_salt('bf')))
    on conflict (id) do update set hash = excluded.hash;
end $$;

grant execute on function admin_has_password() to anon;
grant execute on function admin_check(text) to anon;
grant execute on function is_admin() to anon;
grant execute on function admin_set_password(text, text) to anon;

-- Inventario, estanterías y ajustes: todos pueden ver, solo el administrador modifica.
-- (Las salidas siguen funcionando sin contraseña mediante register_exit.)
do $$ declare t text; begin
  foreach t in array array['shelves','products','batches','settings'] loop
    execute format('drop policy if exists "anon_all" on %I', t);
    execute format('drop policy if exists "read_all" on %I', t);
    execute format('drop policy if exists "admin_insert" on %I', t);
    execute format('drop policy if exists "admin_update" on %I', t);
    execute format('drop policy if exists "admin_delete" on %I', t);
    execute format('create policy "read_all" on %I for select to anon using (true)', t);
    execute format('create policy "admin_insert" on %I for insert to anon with check ((select is_admin()))', t);
    execute format('create policy "admin_update" on %I for update to anon using ((select is_admin())) with check ((select is_admin()))', t);
    execute format('create policy "admin_delete" on %I for delete to anon using ((select is_admin()))', t);
  end loop;
end $$;

-- Las entradas de lote también exigen contraseña
create or replace function register_entry(
  p_product uuid, p_lot text, p_expiry date, p_qty numeric, p_invoice text, p_supplier text, p_notes text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_mov uuid; v_batch uuid; p products%rowtype;
begin
  if not is_admin() then raise exception 'Se requiere la contraseña de administrador'; end if;
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

-- Tiempo real: los demás dispositivos con la app abierta reciben el cambio de stock al instante
do $$ begin
  alter publication supabase_realtime add table batches;
exception when others then null;
end $$;

-- Si se olvida la contraseña: ejecutar  delete from admin_secret;  y crear una nueva desde la app.


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


-- ===== v5: número consecutivo de salida =====
-- Ejecutar completo en Supabase > SQL Editor (es idempotente, se puede repetir).
alter table movements add column if not exists number bigint;
create sequence if not exists exit_number_seq;

-- Numera las salidas que ya existen, de la más antigua a la más nueva
with n as (
  select id,
         row_number() over (order by created_at, id) + coalesce((select max(number) from movements), 0) as rn
  from movements
  where type = 'out' and number is null
)
update movements m set number = n.rn from n where m.id = n.id;

select setval(
  'exit_number_seq',
  greatest(coalesce((select max(number) from movements), 0), 1),
  (select max(number) is not null from movements)
);

-- Cada salida nueva recibe el siguiente número automáticamente
create or replace function set_exit_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'out' and new.number is null then
    new.number := nextval('exit_number_seq');
  end if;
  return new;
end $$;

drop trigger if exists movements_exit_number on movements;
create trigger movements_exit_number before insert on movements
  for each row execute function set_exit_number();

create unique index if not exists movements_number_idx on movements(number) where number is not null;
