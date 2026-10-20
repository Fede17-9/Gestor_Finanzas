-- Replaces API access policies ONLY on the seven application tables.
-- Does not delete, merge or rewrite financial records. Validation fails closed.
begin;

do $$
begin
  if exists (
    select 1 from (values (1,1), (2,-1), (3,-1), (4,0)) expected(id,sign)
    left join public.tipos_movimiento actual on actual.id_tipo = expected.id
    where actual.id_tipo is null or actual.signo_contable is distinct from expected.sign
  ) then
    raise exception 'Movement catalog differs from the documented application contract. Reconcile it before migration.';
  end if;
  if exists (
    select 1 from public.movimientos m join public.categorias c using(id_categoria)
    where c.id_usuario is not null and c.id_usuario <> m.id_usuario
  ) or exists (
    select 1 from public.config_recurrencias m join public.categorias c using(id_categoria)
    where c.id_usuario is not null and c.id_usuario <> m.id_usuario
  ) or exists (
    select 1 from public.presupuestos_mensuales m join public.categorias c using(id_categoria)
    where c.id_usuario is not null and c.id_usuario <> m.id_usuario
  ) then
    raise exception 'Existing category ownership is inconsistent. Review it without deleting records before migration.';
  end if;
end $$;

alter table public.usuarios
  add constraint usuarios_nombre_valido check (length(btrim(nombre_completo)) between 1 and 120) not valid,
  add constraint usuarios_username_valido check (username is not null and length(btrim(username)) between 3 and 32) not valid,
  add constraint usuarios_moneda_valida check (codigo_moneda is not null and codigo_moneda in ('COP','USD','EUR')) not valid;
alter table public.categorias
  add constraint categorias_nombre_valido check (length(btrim(nombre_categoria)) between 1 and 80) not valid;
alter table public.movimientos
  add constraint movimientos_monto_valido check (monto_transaccion > 0 and monto_transaccion <= 9999999999999.99) not valid,
  add constraint movimientos_fecha_valida check (fecha_operacion is not null and isfinite(fecha_operacion)) not valid,
  add constraint movimientos_tipo_valido check (id_tipo in (1,2,3,4)) not valid;
alter table public.config_recurrencias
  add constraint recurrencias_monto_valido check (monto_recurrente > 0 and monto_recurrente <= 9999999999999.99) not valid,
  add constraint recurrencias_frecuencia_valida check (frecuencia is not null and frecuencia in ('Diario','Semanal','Mensual','Anual')) not valid,
  add constraint recurrencias_vigencia_valida check (isfinite(fecha_inicio) and (fecha_fin is null or (isfinite(fecha_fin) and fecha_fin >= fecha_inicio))) not valid,
  add constraint recurrencias_dia_valido check ((dia_ejecucion is null or dia_ejecucion between 1 and 31) and (frecuencia <> 'Mensual' or dia_ejecucion is not null)) not valid,
  add constraint recurrencias_tipo_valido check (id_tipo in (1,2,3,4)) not valid;
alter table public.presupuestos_mensuales
  add constraint presupuestos_monto_valido check (monto_limite > 0 and monto_limite <= 9999999999999.99) not valid,
  add constraint presupuestos_periodo_valido check (mes_calendario is not null and mes_calendario between 1 and 12 and anio_calendario is not null and anio_calendario between 1000 and 9999) not valid,
  add constraint presupuestos_alerta_valida check (porcentaje_alerta is not null and porcentaje_alerta between 1 and 100) not valid;
alter table public.metas_ahorro
  add constraint metas_objetivo_valido check (monto_objetivo > 0 and monto_objetivo <= 9999999999999.99) not valid,
  add constraint metas_actual_valido check (monto_actual is not null and monto_actual >= 0 and monto_actual <= 9999999999999.99) not valid,
  add constraint metas_nombre_valido check (length(btrim(nombre_meta)) between 1 and 120) not valid,
  add constraint metas_fecha_valida check (fecha_proyectada is null or isfinite(fecha_proyectada)) not valid;

-- Historical invalid rows stop the transaction. Nothing is repaired silently.
do $$
declare item record;
begin
  for item in select conrelid::regclass relation, conname from pg_catalog.pg_constraint
    where connamespace = 'public'::regnamespace and not convalidated
      and conrelid = any(array['public.usuarios'::regclass,'public.categorias'::regclass,'public.movimientos'::regclass,'public.config_recurrencias'::regclass,'public.presupuestos_mensuales'::regclass,'public.metas_ahorro'::regclass])
  loop
    execute format('alter table %s validate constraint %I', item.relation, item.conname);
  end loop;
end $$;

create unique index usuarios_username_normalizado on public.usuarios(lower(btrim(username)));
create unique index categorias_nombre_normalizado on public.categorias(id_usuario,lower(btrim(nombre_categoria))) where id_usuario is not null;
create unique index presupuestos_categoria_periodo on public.presupuestos_mensuales(id_usuario,id_categoria,anio_calendario,mes_calendario) where id_categoria is not null;
create unique index presupuestos_total_periodo on public.presupuestos_mensuales(id_usuario,anio_calendario,mes_calendario) where id_categoria is null;
create index movimientos_usuario_fecha on public.movimientos(id_usuario,fecha_operacion desc,id_movimiento desc);
create index recurrencias_usuario_estado on public.config_recurrencias(id_usuario,estado_activo,fecha_inicio);
create index metas_usuario_fecha on public.metas_ahorro(id_usuario,fecha_proyectada);

create function public.check_finance_category_owner() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.id_categoria is not null and not exists (
    select 1 from public.categorias c where c.id_categoria = new.id_categoria
      and (c.id_usuario = new.id_usuario or c.id_usuario is null)
  ) then
    raise exception 'Category does not belong to the record owner' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.check_finance_category_owner() from public, anon, authenticated;

create trigger movimientos_categoria_propia before insert or update of id_usuario,id_categoria on public.movimientos
  for each row execute function public.check_finance_category_owner();
create trigger recurrencias_categoria_propia before insert or update of id_usuario,id_categoria on public.config_recurrencias
  for each row execute function public.check_finance_category_owner();
create trigger presupuestos_categoria_propia before insert or update of id_usuario,id_categoria on public.presupuestos_mensuales
  for each row execute function public.check_finance_category_owner();

-- Remove old permissive policies only inside this application's scope.
do $$
declare item record; target text;
begin
  for item in select schemaname,tablename,policyname from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = any(array['usuarios','tipos_movimiento','categorias','movimientos','config_recurrencias','presupuestos_mensuales','metas_ahorro'])
  loop
    execute format('drop policy %I on %I.%I', item.policyname, item.schemaname, item.tablename);
  end loop;
  foreach target in array array['usuarios','tipos_movimiento','categorias','movimientos','config_recurrencias','presupuestos_mensuales','metas_ahorro'] loop
    execute format('alter table public.%I enable row level security', target);
    execute format('revoke all on table public.%I from public, anon, authenticated', target);
    execute format('grant all on table public.%I to service_role', target);
  end loop;
  foreach target in array array['movimientos','config_recurrencias','presupuestos_mensuales','metas_ahorro'] loop
    execute format('grant select,insert,update,delete on public.%I to authenticated', target);
    execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid()) = id_usuario)', target);
    execute format('create policy own_insert on public.%I for insert to authenticated with check ((select auth.uid()) = id_usuario)', target);
    execute format('create policy own_update on public.%I for update to authenticated using ((select auth.uid()) = id_usuario) with check ((select auth.uid()) = id_usuario)', target);
    execute format('create policy own_delete on public.%I for delete to authenticated using ((select auth.uid()) = id_usuario)', target);
  end loop;
end $$;

grant usage on schema public to authenticated, service_role;
grant select on public.usuarios,public.categorias,public.tipos_movimiento to authenticated;
grant insert(id_usuario,nombre_completo,username,codigo_moneda,url_avatar) on public.usuarios to authenticated;
grant update(nombre_completo,username,url_avatar) on public.usuarios to authenticated;
grant insert,update,delete on public.categorias to authenticated;
revoke all on sequence public.tipos_movimiento_id_tipo_seq from public,anon,authenticated;
grant all on sequence public.tipos_movimiento_id_tipo_seq to service_role;

create policy own_select on public.usuarios for select to authenticated using ((select auth.uid()) = id_usuario);
create policy own_insert on public.usuarios for insert to authenticated with check ((select auth.uid()) = id_usuario);
create policy own_update on public.usuarios for update to authenticated using ((select auth.uid()) = id_usuario) with check ((select auth.uid()) = id_usuario);
create policy category_read on public.categorias for select to authenticated using (id_usuario is null or (select auth.uid()) = id_usuario);
create policy category_insert on public.categorias for insert to authenticated with check ((select auth.uid()) = id_usuario);
create policy category_update on public.categorias for update to authenticated using ((select auth.uid()) = id_usuario) with check ((select auth.uid()) = id_usuario);
create policy category_delete on public.categorias for delete to authenticated using ((select auth.uid()) = id_usuario);
create policy catalog_read on public.tipos_movimiento for select to authenticated using (true);

commit;
