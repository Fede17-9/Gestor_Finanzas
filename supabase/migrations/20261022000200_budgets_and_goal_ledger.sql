-- Phase 4, after recurrence migration. Preserve existing goals and opening balances.
begin;
alter table public.metas_ahorro add column archivada boolean not null default false;
create table public.aportes_metas (
  id_aporte uuid primary key default gen_random_uuid(),
  id_meta uuid not null references public.metas_ahorro(id_meta),
  id_usuario uuid not null references public.usuarios(id_usuario) on delete cascade,
  monto numeric(15,2) not null check (monto<>0 and abs(monto)<=9999999999999.99),
  tipo text not null check (tipo in ('saldo_inicial','aporte','retiro','reversion')),
  fecha date not null check (isfinite(fecha)),
  concepto text not null check (length(btrim(concepto)) between 1 and 160),
  id_origen uuid unique references public.aportes_metas(id_aporte),
  creado_en timestamptz not null default now(),
  check ((tipo='reversion')=(id_origen is not null)),
  check (tipo not in ('aporte','saldo_inicial') or monto>0),
  check (tipo<>'retiro' or monto<0)
);
create index aportes_meta_fecha on public.aportes_metas(id_usuario,id_meta,fecha desc,id_aporte);
alter table public.aportes_metas enable row level security;
revoke all on public.aportes_metas from public,anon,authenticated;
grant select on public.aportes_metas to authenticated;
grant all on public.aportes_metas to service_role;
create policy own_select on public.aportes_metas for select to authenticated using ((select auth.uid())=id_usuario);
insert into public.aportes_metas(id_meta,id_usuario,monto,tipo,fecha,concepto)
  select id_meta,id_usuario,monto_actual,'saldo_inicial',finance_private.hoy(),'Saldo existente al iniciar el historial'
  from public.metas_ahorro where monto_actual>0;
update public.metas_ahorro set estado_meta=case when monto_actual>=monto_objetivo then 'Completada' else 'En Progreso' end;
revoke insert,update,delete on public.metas_ahorro from authenticated;
revoke insert,update on public.presupuestos_mensuales from authenticated;

create function public.guardar_presupuesto(p_id uuid,p_categoria uuid,p_monto numeric,p_mes integer,p_anio integer,p_alerta integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare identificador uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.' using errcode='42501'; end if;
  if p_monto is null or scale(p_monto)>2 then raise exception 'El importe admite hasta dos decimales.'; end if;
  if p_id is null then
    insert into public.presupuestos_mensuales(id_usuario,id_categoria,monto_limite,mes_calendario,anio_calendario,porcentaje_alerta)
      values(auth.uid(),p_categoria,p_monto,p_mes,p_anio,p_alerta) returning id_presupuesto into identificador;
  else
    update public.presupuestos_mensuales set id_categoria=p_categoria,monto_limite=p_monto,mes_calendario=p_mes,anio_calendario=p_anio,porcentaje_alerta=p_alerta
      where id_presupuesto=p_id and id_usuario=auth.uid() returning id_presupuesto into identificador;
    if not found then raise exception 'Presupuesto no disponible.' using errcode='42501'; end if;
  end if;
  return identificador;
end $$;

create function public.guardar_meta(p_id uuid,p_nombre text,p_objetivo numeric,p_inicial numeric,p_fecha date,p_prioridad text) returns uuid
language plpgsql security definer set search_path='' as $$
declare identificador uuid; m public.metas_ahorro;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.' using errcode='42501'; end if;
  if p_nombre is null or length(btrim(p_nombre)) not between 1 and 120 or p_objetivo is null or scale(p_objetivo)>2
    or p_inicial is null or not(p_inicial>=0 and p_inicial<=9999999999999.99) or scale(p_inicial)>2
    or p_prioridad is null or p_prioridad not in ('Bajo','Medio','Alto')
    or (p_fecha is not null and (not isfinite(p_fecha) or extract(year from p_fecha) not between 1000 and 9999)) then
    raise exception 'Revisa el nombre, importes, prioridad y fecha de la meta.';
  end if;
  if p_id is null then
    insert into public.metas_ahorro(id_usuario,nombre_meta,monto_objetivo,monto_actual,fecha_proyectada,prioridad_nivel,estado_meta)
      values(auth.uid(),btrim(p_nombre),p_objetivo,p_inicial,p_fecha,p_prioridad,case when p_inicial>=p_objetivo then 'Completada' else 'En Progreso' end)
      returning id_meta into identificador;
    if p_inicial>0 then
      insert into public.aportes_metas(id_meta,id_usuario,monto,tipo,fecha,concepto)
        values(identificador,auth.uid(),p_inicial,'saldo_inicial',finance_private.hoy(),'Ahorro inicial');
    end if;
  else
    select * into m from public.metas_ahorro where id_meta=p_id and id_usuario=auth.uid() for update;
    if not found then raise exception 'Meta no disponible.' using errcode='42501'; end if;
    if m.archivada then raise exception 'Reactiva la meta antes de editarla.'; end if;
    if p_inicial<>0 then raise exception 'El saldo inicial solo se indica al crear la meta.'; end if;
    update public.metas_ahorro set nombre_meta=btrim(p_nombre),monto_objetivo=p_objetivo,fecha_proyectada=p_fecha,prioridad_nivel=p_prioridad,
      estado_meta=case when monto_actual>=p_objetivo then 'Completada' else 'En Progreso' end where id_meta=p_id;
    identificador:=p_id;
  end if;
  return identificador;
end $$;

create function public.registrar_aporte_meta(p_id uuid,p_meta uuid,p_monto numeric,p_tipo text,p_fecha date,p_concepto text) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.metas_ahorro; a public.aportes_metas; importe numeric; saldo numeric;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.' using errcode='42501'; end if;
  select * into m from public.metas_ahorro where id_meta=p_meta and id_usuario=auth.uid() for update;
  if not found then raise exception 'Meta no disponible.' using errcode='42501'; end if;
  select * into a from public.aportes_metas where id_aporte=p_id;
  if found then
    if a.id_usuario<>auth.uid() or a.id_meta<>p_meta then raise exception 'Aporte no disponible.' using errcode='42501'; end if;
    if a.tipo is distinct from p_tipo or a.fecha is distinct from p_fecha or a.concepto is distinct from btrim(p_concepto)
      or a.monto is distinct from (case when p_tipo='retiro' then -p_monto else p_monto end) then
      raise exception 'Este envío ya se guardó con otros datos. Recarga el historial antes de crear otro registro.';
    end if;
    return a.id_aporte;
  end if;
  if m.archivada then raise exception 'Reactiva la meta antes de registrar aportes o retiros.'; end if;
  if p_id is null or p_monto is null or not(p_monto>0 and p_monto<=9999999999999.99) or scale(p_monto)>2
    or p_tipo is null or p_tipo not in ('aporte','retiro') or p_fecha is null or not isfinite(p_fecha)
    or p_fecha>finance_private.hoy() or extract(year from p_fecha) not between 1000 and 9999
    or p_concepto is null or length(btrim(p_concepto)) not between 1 and 160 then raise exception 'Revisa importe, fecha y concepto del aporte o retiro.'; end if;
  importe:=case when p_tipo='retiro' then -p_monto else p_monto end;
  saldo:=m.monto_actual+importe;
  if saldo<0 or saldo>9999999999999.99 then raise exception 'El retiro supera lo ahorrado o el total supera el límite permitido.'; end if;
  insert into public.aportes_metas(id_aporte,id_meta,id_usuario,monto,tipo,fecha,concepto) values(p_id,p_meta,auth.uid(),importe,p_tipo,p_fecha,btrim(p_concepto));
  update public.metas_ahorro set monto_actual=saldo,estado_meta=case when saldo>=monto_objetivo then 'Completada' else 'En Progreso' end where id_meta=p_meta;
  return p_id;
end $$;

create function public.revertir_aporte_meta(p_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.aportes_metas; m public.metas_ahorro; identificador uuid; saldo numeric;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.' using errcode='42501'; end if;
  select * into a from public.aportes_metas where id_aporte=p_id and id_usuario=auth.uid();
  if not found then raise exception 'Aporte no disponible.' using errcode='42501'; end if;
  select * into m from public.metas_ahorro where id_meta=a.id_meta and id_usuario=auth.uid() for update;
  select id_aporte into identificador from public.aportes_metas where id_origen=p_id;
  if found then return identificador; end if;
  if m.archivada then raise exception 'Reactiva la meta antes de corregir aportes.'; end if;
  if a.tipo not in ('aporte','retiro') then raise exception 'Solo se pueden revertir aportes o retiros.'; end if;
  saldo:=m.monto_actual-a.monto;
  if saldo<0 or saldo>9999999999999.99 then raise exception 'No se puede revertir: el saldo resultante queda fuera del rango permitido. Revisa los retiros posteriores.'; end if;
  insert into public.aportes_metas(id_meta,id_usuario,monto,tipo,fecha,concepto,id_origen)
    values(a.id_meta,auth.uid(),-a.monto,'reversion',finance_private.hoy(),'Corrección: '||left(a.concepto,148),a.id_aporte) returning id_aporte into identificador;
  update public.metas_ahorro set monto_actual=saldo,estado_meta=case when saldo>=monto_objetivo then 'Completada' else 'En Progreso' end where id_meta=a.id_meta;
  return identificador;
end $$;

create function public.archivar_meta(p_id uuid,p_archivada boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or p_archivada is null then raise exception 'Solicitud no válida.' using errcode='42501'; end if;
  update public.metas_ahorro set archivada=p_archivada where id_meta=p_id and id_usuario=auth.uid();
  if not found then raise exception 'Meta no disponible.' using errcode='42501'; end if;
end $$;

revoke all on function public.guardar_presupuesto(uuid,uuid,numeric,integer,integer,integer),public.guardar_meta(uuid,text,numeric,numeric,date,text),
  public.registrar_aporte_meta(uuid,uuid,numeric,text,date,text),public.revertir_aporte_meta(uuid),public.archivar_meta(uuid,boolean) from public,anon,authenticated;
grant execute on function public.guardar_presupuesto(uuid,uuid,numeric,integer,integer,integer),public.guardar_meta(uuid,text,numeric,numeric,date,text),
  public.registrar_aporte_meta(uuid,uuid,numeric,text,date,text),public.revertir_aporte_meta(uuid),public.archivar_meta(uuid,boolean) to authenticated;
commit;
