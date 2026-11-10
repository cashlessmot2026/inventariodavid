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
