-- Phase 3. Apply once, AFTER the two phase-2 migrations. No historical payments
-- are inferred or deleted. Existing rules start processing on today's Bogota date.
begin;

create schema finance_private;
revoke all on schema finance_private from public, anon, authenticated;

alter table public.config_recurrencias
  add column nombre text not null default 'Recurrencia' check (length(btrim(nombre)) between 1 and 120),
  add column confirmacion_automatica boolean not null default false,
  add column archivada boolean not null default false,
  add column generar_desde date not null default ((now() at time zone 'America/Bogota')::date);

create table public.ocurrencias_recurrentes (
  id_ocurrencia uuid primary key default gen_random_uuid(),
  id_recurrencia uuid not null references public.config_recurrencias(id_recurrencia),
  id_usuario uuid not null references public.usuarios(id_usuario) on delete cascade,
  fecha_programada date not null check (isfinite(fecha_programada)),
  fecha_prevista date not null check (isfinite(fecha_prevista)),
  nombre text not null,
  id_tipo integer not null references public.tipos_movimiento(id_tipo),
  id_categoria uuid references public.categorias(id_categoria) on delete set null,
  monto_previsto numeric(15,2) not null check (monto_previsto > 0 and monto_previsto <= 9999999999999.99),
  estado text not null default 'pendiente' check (estado in ('pendiente','confirmada','omitida')),
  automatica boolean not null default false,
  creada_en timestamptz not null default now(),
  unique(id_recurrencia,fecha_programada)
);
create index ocurrencias_usuario_estado_fecha on public.ocurrencias_recurrentes(id_usuario,estado,fecha_prevista);
alter table public.movimientos add column id_ocurrencia uuid unique references public.ocurrencias_recurrentes(id_ocurrencia);

create table public.historial_recurrencias (
  id_evento uuid primary key default gen_random_uuid(),
  id_usuario uuid not null references public.usuarios(id_usuario) on delete cascade,
  id_recurrencia uuid not null references public.config_recurrencias(id_recurrencia),
  id_ocurrencia uuid references public.ocurrencias_recurrentes(id_ocurrencia),
  accion text not null,
  detalle jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);
create index historial_recurrencias_usuario_fecha on public.historial_recurrencias(id_usuario,creado_en desc,id_evento);

alter table public.ocurrencias_recurrentes enable row level security;
alter table public.historial_recurrencias enable row level security;
revoke all on public.ocurrencias_recurrentes,public.historial_recurrencias from public,anon,authenticated;
grant select on public.ocurrencias_recurrentes,public.historial_recurrencias to authenticated;
grant all on public.ocurrencias_recurrentes,public.historial_recurrencias to service_role;
create policy own_select on public.ocurrencias_recurrentes for select to authenticated using ((select auth.uid())=id_usuario);
create policy own_select on public.historial_recurrencias for select to authenticated using ((select auth.uid())=id_usuario);
-- All rule/occurrence mutations go through owner-checked transactional functions.
revoke insert,update,delete on public.config_recurrencias from authenticated;

create function finance_private.hoy() returns date language sql stable set search_path='' as $$
  select (now() at time zone 'America/Bogota')::date
$$;

-- The calendar uses the same schedule contract (day 31 clamps to month end).
create function finance_private.corresponde(r public.config_recurrencias, d date) returns boolean
language sql immutable set search_path='' as $$
  select d >= r.fecha_inicio and (r.fecha_fin is null or d <= r.fecha_fin) and case r.frecuencia
    when 'Diario' then true
    when 'Semanal' then (d-r.fecha_inicio)%7=0
    when 'Mensual' then extract(day from d)=least(r.dia_ejecucion,extract(day from (date_trunc('month',d)+interval '1 month - 1 day'))::int)
    when 'Anual' then extract(month from d)=extract(month from r.fecha_inicio)
      and extract(day from d)=least(extract(day from r.fecha_inicio),extract(day from (date_trunc('month',d)+interval '1 month - 1 day')))
    else false end
$$;

create function finance_private.preparar(p_usuario uuid) returns integer
language plpgsql set search_path='' as $$
declare r public.config_recurrencias; d date; hasta date; n integer; total integer:=0;
begin
  for r in select * from public.config_recurrencias where id_usuario=p_usuario
    and estado_activo=true and not archivada order by id_recurrencia for no key update
  loop
    -- Bounded catch-up: an offline year cannot exhaust a request. Repeated calls
    -- continue at the cursor; edits require this catch-up to be finished first.
    hasta:=least(finance_private.hoy(),r.generar_desde+365);
    d:=greatest(r.generar_desde,r.fecha_inicio);
    while d<=hasta loop
      if finance_private.corresponde(r,d) then
        insert into public.ocurrencias_recurrentes(id_recurrencia,id_usuario,fecha_programada,fecha_prevista,nombre,id_tipo,id_categoria,monto_previsto,automatica)
          values(r.id_recurrencia,r.id_usuario,d,d,r.nombre,r.id_tipo,r.id_categoria,r.monto_recurrente,r.confirmacion_automatica)
          on conflict(id_recurrencia,fecha_programada) do nothing;
        get diagnostics n=row_count;
        total:=total+n;
      end if;
      d:=d+1;
    end loop;
    update public.config_recurrencias set generar_desde=greatest(generar_desde,hasta+1) where id_recurrencia=r.id_recurrencia;
  end loop;
  return total;
end $$;

create function finance_private.confirmar(p_ocurrencia uuid,p_usuario uuid,p_monto numeric,p_fecha date,p_metodo text,p_automatica boolean) returns uuid
language plpgsql set search_path='' as $$
declare o public.ocurrencias_recurrentes; movimiento uuid;
begin
  select * into o from public.ocurrencias_recurrentes where id_ocurrencia=p_ocurrencia and id_usuario=p_usuario for update;
  if not found then raise exception 'Vencimiento no disponible.' using errcode='42501'; end if;
  if o.estado='confirmada' then
    select id_movimiento into movimiento from public.movimientos where id_ocurrencia=o.id_ocurrencia;
    return movimiento; -- Idempotent retries, including concurrent requests.
  end if;
  if o.estado<>'pendiente' then raise exception 'Primero devuelve el vencimiento a pendiente.'; end if;
  if p_monto is null or not (p_monto>0 and p_monto<=9999999999999.99) or scale(p_monto)>2 then
    raise exception 'Ingresa un importe positivo con un máximo de dos decimales.';
  end if;
  if p_fecha is null or not isfinite(p_fecha) or p_fecha>finance_private.hoy() or extract(year from p_fecha) not between 1000 and 9999 then
    raise exception 'La fecha real debe ser válida y no estar en el futuro.';
  end if;
  if p_metodo is null or length(btrim(p_metodo)) not between 1 and 80 then raise exception 'Indica un método de pago válido.'; end if;
  insert into public.movimientos(id_usuario,id_tipo,id_categoria,monto_transaccion,fecha_operacion,metodo_pago,descripcion_detalle,es_automatico,id_ocurrencia)
    values(o.id_usuario,o.id_tipo,o.id_categoria,p_monto,p_fecha::timestamp at time zone 'UTC',btrim(p_metodo),o.nombre,p_automatica,o.id_ocurrencia)
    returning id_movimiento into movimiento;
  update public.ocurrencias_recurrentes set estado='confirmada' where id_ocurrencia=o.id_ocurrencia;
  insert into public.historial_recurrencias(id_usuario,id_recurrencia,id_ocurrencia,accion,detalle)
    values(o.id_usuario,o.id_recurrencia,o.id_ocurrencia,case when p_automatica then 'confirmacion_automatica' else 'confirmacion_manual' end,
      jsonb_build_object('id_movimiento',movimiento,'monto',p_monto,'fecha',p_fecha,'metodo',btrim(p_metodo)));
  return movimiento;
end $$;

-- Prevent direct edits/deletes from detaching a confirmed occurrence. The RPC
-- runs as the migration owner; a JWT claim or browser-set flag cannot bypass it.
create function public.proteger_movimiento_recurrente() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if not pg_has_role(current_user,(select relowner from pg_class where oid='public.movimientos'::regclass),'USAGE')
    and ((tg_op<>'INSERT' and old.id_ocurrencia is not null) or (tg_op<>'DELETE' and new.id_ocurrencia is not null)) then
    raise exception 'Gestiona este movimiento desde Recurrencias. Puedes deshacer su confirmación.' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger proteger_vinculo_recurrente before insert or update or delete on public.movimientos
  for each row execute function public.proteger_movimiento_recurrente();
revoke all on function public.proteger_movimiento_recurrente() from public,anon,authenticated;

create function public.actualizar_pendientes() returns integer
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión.' using errcode='42501'; end if;
  return finance_private.preparar(auth.uid());
end $$;

create function public.guardar_recurrencia(p_id uuid,p_nombre text,p_tipo integer,p_categoria uuid,p_monto numeric,p_frecuencia text,p_dia integer,p_inicio date,p_fin date,p_automatica boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.config_recurrencias; identificador uuid; usuario uuid:=auth.uid();
begin
  if usuario is null then raise exception 'Inicia sesión.' using errcode='42501'; end if;
  if p_nombre is null or length(btrim(p_nombre)) not between 1 and 120 or p_monto is null or scale(p_monto)>2
    or p_automatica is null or p_inicio is null or not isfinite(p_inicio) or extract(year from p_inicio) not between 1000 and 9999
    or (p_fin is not null and (not isfinite(p_fin) or extract(year from p_fin) not between 1000 and 9999)) then
    raise exception 'Revisa el nombre, importe y fechas de la regla.';
  end if;
  if p_id is null then
    if p_inicio<finance_private.hoy() then raise exception 'Una regla nueva debe comenzar hoy o en el futuro.'; end if;
    insert into public.config_recurrencias(id_usuario,nombre,id_tipo,id_categoria,monto_recurrente,frecuencia,dia_ejecucion,fecha_inicio,fecha_fin,confirmacion_automatica)
      values(usuario,btrim(p_nombre),p_tipo,p_categoria,p_monto,p_frecuencia,p_dia,p_inicio,p_fin,p_automatica) returning id_recurrencia into identificador;
  else
    -- Same lock order as the scheduler: rules before occurrences.
    perform finance_private.preparar(usuario);
    select * into r from public.config_recurrencias where id_recurrencia=p_id and id_usuario=usuario for no key update;
    if not found then raise exception 'Regla no disponible.' using errcode='42501'; end if;
    if r.archivada then raise exception 'Una regla archivada no se edita.'; end if;
    if r.estado_activo and r.generar_desde<=finance_private.hoy() then raise exception 'Actualiza los pendientes de nuevo antes de editar.'; end if;
    update public.config_recurrencias set nombre=btrim(p_nombre),id_tipo=p_tipo,id_categoria=p_categoria,monto_recurrente=p_monto,
      frecuencia=p_frecuencia,dia_ejecucion=p_dia,fecha_inicio=p_inicio,fecha_fin=p_fin,confirmacion_automatica=p_automatica where id_recurrencia=p_id;
    identificador:=p_id;
  end if;
  insert into public.historial_recurrencias(id_usuario,id_recurrencia,accion,detalle)
    values(usuario,identificador,case when p_id is null then 'regla_creada' else 'regla_editada' end,
      jsonb_build_object('nombre',btrim(p_nombre),'monto',p_monto,'frecuencia',p_frecuencia,'automatica',p_automatica));
  return identificador;
end $$;

create function public.cambiar_recurrencia(p_id uuid,p_accion text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.config_recurrencias; usuario uuid:=auth.uid();
begin
  if usuario is null then raise exception 'Inicia sesión.' using errcode='42501'; end if;
  perform finance_private.preparar(usuario);
  select * into r from public.config_recurrencias where id_recurrencia=p_id and id_usuario=usuario for no key update;
  if not found then raise exception 'Regla no disponible.' using errcode='42501'; end if;
  if r.archivada then raise exception 'La regla ya está archivada.'; end if;
  if r.estado_activo and r.generar_desde<=finance_private.hoy() then raise exception 'Actualiza los pendientes de nuevo antes de continuar.'; end if;
  if p_accion='pausar' then
    update public.config_recurrencias set estado_activo=false where id_recurrencia=p_id;
  elsif p_accion='reactivar' then
    update public.config_recurrencias set estado_activo=true,generar_desde=greatest(generar_desde,finance_private.hoy()) where id_recurrencia=p_id;
  elsif p_accion='archivar' then
    update public.config_recurrencias set estado_activo=false,archivada=true where id_recurrencia=p_id;
  else raise exception 'Acción inválida.'; end if;
  if p_accion in ('pausar','archivar') then
    update public.ocurrencias_recurrentes set automatica=false where id_recurrencia=p_id and estado='pendiente';
  end if;
  insert into public.historial_recurrencias(id_usuario,id_recurrencia,accion) values(usuario,p_id,p_accion);
end $$;

create function public.confirmar_ocurrencia(p_id uuid,p_monto numeric,p_fecha date,p_metodo text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión.' using errcode='42501'; end if;
  return finance_private.confirmar(p_id,auth.uid(),p_monto,p_fecha,p_metodo,false);
end $$;

create function public.cambiar_ocurrencia(p_id uuid,p_accion text,p_fecha date) returns void
language plpgsql security definer set search_path='' as $$
declare o public.ocurrencias_recurrentes; anterior jsonb;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.' using errcode='42501'; end if;
  select * into o from public.ocurrencias_recurrentes where id_ocurrencia=p_id and id_usuario=auth.uid() for update;
  if not found then raise exception 'Vencimiento no disponible.' using errcode='42501'; end if;
  if p_accion='deshacer' then
    if o.estado<>'confirmada' then return; end if;
    delete from public.movimientos where id_ocurrencia=p_id returning to_jsonb(movimientos.*) into anterior;
    update public.ocurrencias_recurrentes set estado='pendiente',automatica=false where id_ocurrencia=p_id;
  elsif p_accion='reprogramar' then
    if o.estado<>'pendiente' or p_fecha is null or not isfinite(p_fecha) or extract(year from p_fecha) not between 1000 and 9999 then
      raise exception 'Solo puedes reprogramar un pendiente con una fecha válida.';
    end if;
    update public.ocurrencias_recurrentes set fecha_prevista=p_fecha,automatica=false where id_ocurrencia=p_id;
    anterior:=jsonb_build_object('fecha_anterior',o.fecha_prevista,'fecha_nueva',p_fecha);
  elsif p_accion in ('omitir','reabrir') then
    if o.estado='confirmada' then raise exception 'Deshaz la confirmación primero.'; end if;
    update public.ocurrencias_recurrentes set estado=case when p_accion='omitir' then 'omitida' else 'pendiente' end,automatica=false where id_ocurrencia=p_id;
  else raise exception 'Acción inválida.'; end if;
  insert into public.historial_recurrencias(id_usuario,id_recurrencia,id_ocurrencia,accion,detalle)
    values(o.id_usuario,o.id_recurrencia,p_id,p_accion,coalesce(anterior,'{}'::jsonb));
end $$;

-- Server-only entry point for Supabase Cron. Never callable with a browser key.
create function public.procesar_recurrencias() returns integer
language plpgsql security definer set search_path='' as $$
declare usuario uuid; o public.ocurrencias_recurrentes; total integer:=0;
begin
  -- Serialize scheduled executions; manual confirmation locks the same row.
  if not pg_try_advisory_xact_lock(860031) then return 0; end if;
  for usuario in select distinct id_usuario from public.config_recurrencias where estado_activo=true and not archivada order by id_usuario loop
    perform finance_private.preparar(usuario);
  end loop;
  for o in select occ.* from public.ocurrencias_recurrentes occ join public.config_recurrencias r using(id_recurrencia)
    where occ.estado='pendiente' and occ.automatica and occ.fecha_prevista<=finance_private.hoy() and r.estado_activo=true and not r.archivada
    order by occ.id_ocurrencia for update of occ
  loop
    perform finance_private.confirmar(o.id_ocurrencia,o.id_usuario,o.monto_previsto,o.fecha_prevista,'Automático',true);
    total:=total+1;
  end loop;
  return total;
end $$;

-- Functions are executable by PUBLIC by default in PostgreSQL: close that default.
revoke all on all functions in schema finance_private from public,anon,authenticated;
revoke all on function public.actualizar_pendientes(),public.guardar_recurrencia(uuid,text,integer,uuid,numeric,text,integer,date,date,boolean),
  public.cambiar_recurrencia(uuid,text),public.confirmar_ocurrencia(uuid,numeric,date,text),public.cambiar_ocurrencia(uuid,text,date),public.procesar_recurrencias() from public,anon,authenticated;
grant execute on function public.actualizar_pendientes(),public.guardar_recurrencia(uuid,text,integer,uuid,numeric,text,integer,date,date,boolean),
  public.cambiar_recurrencia(uuid,text),public.confirmar_ocurrencia(uuid,numeric,date,text),public.cambiar_ocurrencia(uuid,text,date) to authenticated;
grant execute on function public.procesar_recurrencias() to service_role;

commit;
