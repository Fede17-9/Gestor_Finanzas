-- Run in Supabase SQL Editor AFTER the phase-3 migration, to enable server-side
-- processing every 15 minutes. Existing rules default to MANUAL confirmation.
-- Install/enable Supabase Cron (pg_cron) first in Integrations > Cron if needed.
-- No service key or external scheduler is needed.
do $$ begin
  if to_regprocedure('public.procesar_recurrencias()') is null then
    raise exception 'Aplica primero la migración 20261022000100_recurrence_occurrences.sql';
  end if;
  if not exists(select 1 from pg_extension where extname='pg_cron') then
    raise exception 'Activa Supabase Cron (pg_cron) en Integrations > Cron y vuelve a ejecutar este archivo.';
  end if;
end $$;
select cron.schedule('flux-recurrencias','*/15 * * * *','select public.procesar_recurrencias();');
select jobid,jobname,schedule,active from cron.job where jobname='flux-recurrencias';
-- Runs are visible in Integrations > Cron > flux-recurrencias > History.
-- To pause all server processing: select cron.unschedule('flux-recurrencias');
