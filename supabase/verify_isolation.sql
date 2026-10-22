-- Run in SQL Editor after creating the two named test movements in different accounts.
-- Every write is rolled back. Any failed expectation stops the transaction.
begin;

do $$
begin
  if (select count(*) from public.movimientos where descripcion_detalle = 'PRUEBA_PRIVACIDAD_A') <> 1
     or (select count(*) from public.movimientos where descripcion_detalle = 'PRUEBA_PRIVACIDAD_B') <> 1 then
    raise exception 'Debe existir exactamente un movimiento A y uno B con las descripciones indicadas.';
  end if;
  if (select id_usuario from public.movimientos where descripcion_detalle = 'PRUEBA_PRIVACIDAD_A')
     = (select id_usuario from public.movimientos where descripcion_detalle = 'PRUEBA_PRIVACIDAD_B') then
    raise exception 'Los movimientos A y B deben pertenecer a cuentas distintas.';
  end if;
end $$;

select set_config('flux_test.owner_a',id_usuario::text,true),
       set_config('flux_test.movement_a',id_movimiento::text,true)
from public.movimientos where descripcion_detalle = 'PRUEBA_PRIVACIDAD_A';
select set_config('flux_test.owner_b',id_usuario::text,true),
       set_config('flux_test.movement_b',id_movimiento::text,true)
from public.movimientos where descripcion_detalle = 'PRUEBA_PRIVACIDAD_B';

set local role authenticated;

do $$
declare
  owner_id text; own_id text; foreign_owner text; foreign_id text;
  own_visible integer; foreign_visible integer; edited integer; deleted integer;
  blocked boolean; results jsonb := '[]'::jsonb; side text;
begin
  foreach side in array array['a','b'] loop
    owner_id := current_setting('flux_test.owner_' || side);
    own_id := current_setting('flux_test.movement_' || side);
    foreign_owner := current_setting('flux_test.owner_' || case when side='a' then 'b' else 'a' end);
    foreign_id := current_setting('flux_test.movement_' || case when side='a' then 'b' else 'a' end);
    perform set_config('request.jwt.claim.sub',owner_id,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);

    select count(*) into own_visible from public.movimientos where id_movimiento=own_id::uuid;
    select count(*) into foreign_visible from public.movimientos where id_movimiento=foreign_id::uuid;
    update public.movimientos set descripcion_detalle=descripcion_detalle where id_movimiento=foreign_id::uuid;
    get diagnostics edited = row_count;
    delete from public.movimientos where id_movimiento=foreign_id::uuid;
    get diagnostics deleted = row_count;

    blocked := false;
    begin
      insert into public.movimientos(id_usuario,id_tipo,monto_transaccion,descripcion_detalle)
      values(foreign_owner::uuid,2,1,'PRUEBA_RLS_TRANSACCIONAL');
    exception when insufficient_privilege then
      blocked := true;
    end;
    if own_visible <> 1 or foreign_visible <> 0 or edited <> 0 or deleted <> 0 or not blocked then
      raise exception 'Fallo de aislamiento para la cuenta %. Revisar permisos antes de continuar.', upper(side);
    end if;
    results := results || jsonb_build_array(jsonb_build_object(
      'cuenta',upper(side), 've_su_movimiento',own_visible=1,
      'lectura_ajena_bloqueada',foreign_visible=0,
      'edicion_ajena_bloqueada',edited=0,
      'borrado_ajeno_bloqueado',deleted=0,
      'insercion_ajena_bloqueada',blocked
    ));
  end loop;
  perform set_config('flux_test.results',results::text,true);
end $$;

reset role;
select * from jsonb_to_recordset(current_setting('flux_test.results')::jsonb)
as resultado(cuenta text,ve_su_movimiento boolean,lectura_ajena_bloqueada boolean,
edicion_ajena_bloqueada boolean,borrado_ajeno_bloqueado boolean,insercion_ajena_bloqueada boolean);

rollback;
