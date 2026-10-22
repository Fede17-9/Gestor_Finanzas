-- Read-only inspection. No user profiles or financial details are exported.
-- Run with an administrative SQL connection; keep its output outside public Git.
begin transaction read only;

select table_name,column_name,data_type,udt_name,is_nullable,column_default
from information_schema.columns where table_schema='public'
and table_name in ('usuarios','tipos_movimiento','categorias','movimientos','config_recurrencias','presupuestos_mensuales','metas_ahorro')
order by table_name,ordinal_position;

select c.relname table_name,c.relrowsecurity rls,c.relforcerowsecurity forced_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('usuarios','tipos_movimiento','categorias','movimientos','config_recurrencias','presupuestos_mensuales','metas_ahorro');

select tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname='public'
and tablename in ('usuarios','tipos_movimiento','categorias','movimientos','config_recurrencias','presupuestos_mensuales','metas_ahorro')
order by tablename,policyname;

select c.relname table_name,k.conname,pg_get_constraintdef(k.oid) definition,k.convalidated
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('usuarios','tipos_movimiento','categorias','movimientos','config_recurrencias','presupuestos_mensuales','metas_ahorro');

select tablename,indexname,indexdef from pg_indexes where schemaname='public'
and tablename in ('usuarios','tipos_movimiento','categorias','movimientos','config_recurrencias','presupuestos_mensuales','metas_ahorro');

select grantee,table_name,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('usuarios','tipos_movimiento','categorias','movimientos','config_recurrencias','presupuestos_mensuales','metas_ahorro')
order by table_name,grantee,privilege_type;

select n.nspname schema_name,c.relname table_name,t.tgname trigger_name,pg_get_triggerdef(t.oid) definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and ((n.nspname='auth' and c.relname='users') or (n.nspname='public'
and c.relname in ('usuarios','tipos_movimiento','categorias','movimientos','config_recurrencias','presupuestos_mensuales','metas_ahorro')));

-- Column grants can differ from table grants (for example, profile currency).
select grantee,table_name,column_name,privilege_type
from information_schema.column_privileges
where table_schema='public' and table_name in ('usuarios','tipos_movimiento','categorias','movimientos','config_recurrencias','presupuestos_mensuales','metas_ahorro')
order by table_name,column_name,grantee,privilege_type;

-- Inventory only: do not execute exposed functions or query view contents.
select p.oid::regprocedure::text signature,pg_get_userbyid(p.proowner) owner,
  p.prosecdef security_definer,p.proconfig settings,
  has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f'
order by signature;

select c.relname view_name,c.relkind kind,pg_get_userbyid(c.relowner) owner,c.reloptions settings,
  has_table_privilege('anon',c.oid,'SELECT') anon_select,
  has_table_privilege('authenticated',c.oid,'SELECT') authenticated_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('v','m')
order by c.relname;

select id_tipo,nombre_tipo,signo_contable from public.tipos_movimiento order by id_tipo;
commit;
