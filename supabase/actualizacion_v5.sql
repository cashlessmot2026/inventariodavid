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
