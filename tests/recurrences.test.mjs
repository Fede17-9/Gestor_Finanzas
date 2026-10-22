import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { calendarEvents, calendarTotals, occurrenceStatus, recurrenceDates } from '../lib/finance.ts';

const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const CAT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let db, today;
before(async () => {
  db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;`);
  const directory=new URL('../supabase/migrations/',import.meta.url);
  const migrations=(await readdir(directory)).filter(f=>f.endsWith('.sql')).sort();
  for (const name of migrations) await db.exec(await readFile(new URL(name,directory),'utf8'));
  await db.query('insert into auth.users values($1),($2)',[A,B]);
  await db.query(`insert into public.usuarios(id_usuario,nombre_completo,username) values($1,'Persona A','persona_a'),($2,'Persona B','persona_b')`,[A,B]);
  await db.query(`insert into public.categorias(id_categoria,id_usuario,nombre_categoria) values($1,$2,'Privada B')`,[CAT,B]);
  today=(await db.query('select finance_private.hoy()::text d')).rows[0].d;
});
after(async()=>{await db?.close();});
function user(id,fn,role='authenticated') {
  return db.transaction(async tx=>{
    await tx.exec('set local role '+role);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);
    return fn(tx);
  });
}
async function rule(overrides={}) {
  const r={name:'Prueba',type:2,category:null,amount:'12.30',frequency:'Diario',day:null,start:today,end:null,auto:false,...overrides};
  const result=await user(A,tx=>tx.query('select public.guardar_recurrencia(null,$1,$2,$3,$4,$5,$6,$7,$8,$9) id',
    [r.name,r.type,r.category,r.amount,r.frequency,r.day,r.start,r.end,r.auto]));
  return result.rows[0].id;
}
async function prepare(id) {
  await user(A,tx=>tx.query('select public.actualizar_pendientes()'));
  return (await db.query('select * from public.ocurrencias_recurrentes where id_recurrencia=$1 order by fecha_programada',[id])).rows;
}
const confirm=(id,amount='10.15',date=today)=>user(A,tx=>tx.query('select public.confirmar_ocurrencia($1,$2,$3,$4) id',[id,amount,date,'Efectivo']));
const change=(id,action,date=null)=>user(A,tx=>tx.query('select public.cambiar_ocurrencia($1,$2,$3)',[id,action,date]));

test('preparar es idempotente; un pendiente no cambia el saldo y la confirmación usa importe/fecha reales',async()=>{
  const id=await rule();
  const [o]=await prepare(id);
  await prepare(id);
  assert.equal((await db.query('select count(*)::int n from public.ocurrencias_recurrentes where id_recurrencia=$1',[id])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.movimientos where id_ocurrencia=$1',[o.id_ocurrencia])).rows[0].n,0);
  const yesterday=(await db.query("select (finance_private.hoy()-1)::text d")).rows[0].d;
  const first=await confirm(o.id_ocurrencia,'10.15',yesterday);
  const retry=await confirm(o.id_ocurrencia);
  assert.equal(first.rows[0].id,retry.rows[0].id);
  const movement=(await db.query("select monto_transaccion::text amount,(fecha_operacion at time zone 'UTC')::date::text d from public.movimientos where id_ocurrencia=$1",[o.id_ocurrencia])).rows;
  assert.deepEqual(movement,[{amount:'10.15',d:yesterday}]);
  assert.equal((await db.query('select monto_previsto::text amount,estado from public.ocurrencias_recurrentes where id_ocurrencia=$1',[o.id_ocurrencia])).rows[0].amount,'12.30');
});

test('confirmaciones simultáneas del mismo vencimiento producen un único movimiento y evento',async()=>{
  const [o]=await prepare(await rule());
  const results=await Promise.all([confirm(o.id_ocurrencia),confirm(o.id_ocurrencia),confirm(o.id_ocurrencia)]);
  assert.equal(new Set(results.map(r=>r.rows[0].id)).size,1);
  assert.equal((await db.query("select count(*)::int n from public.historial_recurrencias where id_ocurrencia=$1 and accion='confirmacion_manual'",[o.id_ocurrencia])).rows[0].n,1);
  // PGlite serializes transactions; unique(rule,date), unique(movement.occurrence)
  // plus FOR UPDATE are also enforced by the migration on server PostgreSQL.
});

test('confirmación inválida revierte el movimiento y conserva pendiente',async()=>{
  const [o]=await prepare(await rule());
  const tomorrow=(await db.query('select (finance_private.hoy()+1)::text d')).rows[0].d;
  for (const [amount,date] of [['1.001',today],['0',today],['NaN',today],['1',tomorrow],['10000000000000',today]]) {
    await assert.rejects(confirm(o.id_ocurrencia,amount,date));
  }
  assert.deepEqual((await db.query('select estado from public.ocurrencias_recurrentes where id_ocurrencia=$1',[o.id_ocurrencia])).rows,[{estado:'pendiente'}]);
  assert.equal((await db.query('select count(*)::int n from public.movimientos where id_ocurrencia=$1',[o.id_ocurrencia])).rows[0].n,0);
});

test('aislamiento de lecturas y RPC: B no lee, confirma ni cambia un vencimiento o regla de A',async()=>{
  const id=await rule(); const [o]=await prepare(id);
  assert.equal((await user(B,tx=>tx.query('select * from public.ocurrencias_recurrentes where id_ocurrencia=$1',[o.id_ocurrencia]))).rows.length,0);
  assert.equal((await user(B,tx=>tx.query('select * from public.historial_recurrencias where id_recurrencia=$1',[id]))).rows.length,0);
  for (const sql of [
    ['select public.confirmar_ocurrencia($1,10,$2,\'Efectivo\')',[o.id_ocurrencia,today]],
    ['select public.cambiar_ocurrencia($1,\'omitir\',null)',[o.id_ocurrencia]],
    ['select public.cambiar_recurrencia($1,\'archivar\')',[id]],
    ['select public.guardar_recurrencia($1,\'Ataque\',2,null,10,\'Diario\',null,$2,null,false)',[id,today]],
  ]) await assert.rejects(user(B,tx=>tx.query(...sql)),e=>e.code==='42501');
});

test('privilegios bloquean escrituras directas, funciones privadas, cron desde navegador e invitados',async()=>{
  const [o]=await prepare(await rule());
  for (const role of ['anon','authenticated']) {
    await assert.rejects(user(A,tx=>tx.query('select public.procesar_recurrencias()'),role),e=>e.code==='42501');
    await assert.rejects(user(A,tx=>tx.query('select finance_private.preparar($1)',[B]),role),e=>e.code==='42501');
    await assert.rejects(user(A,tx=>tx.query("update public.ocurrencias_recurrentes set estado='confirmada' where id_ocurrencia=$1",[o.id_ocurrencia]),role),e=>e.code==='42501');
    await assert.rejects(user(A,tx=>tx.query('delete from public.historial_recurrencias'),role),e=>e.code==='42501');
    await assert.rejects(user(A,tx=>tx.query('delete from public.config_recurrencias'),role),e=>e.code==='42501');
  }
  await assert.rejects(user(null,tx=>tx.query('select public.actualizar_pendientes()'),'anon'),e=>e.code==='42501');
  await assert.rejects(user(null,tx=>tx.query('select public.actualizar_pendientes()')),e=>e.code==='42501');
  await assert.rejects(rule({category:CAT}),e=>e.code==='23514');
});

test('vínculo protegido incluso si el cliente intenta editar, borrar o falsificar id_ocurrencia',async()=>{
  const [o]=await prepare(await rule());
  await confirm(o.id_ocurrencia);
  for (const statement of [
    'delete from public.movimientos where id_ocurrencia=$1',
    'update public.movimientos set monto_transaccion=99 where id_ocurrencia=$1',
    'update public.movimientos set id_ocurrencia=null where id_ocurrencia=$1',
    `insert into public.movimientos(id_usuario,id_tipo,monto_transaccion,id_ocurrencia) values('${A}',2,1,$1)`,
  ]) await assert.rejects(user(A,tx=>tx.query(statement,[o.id_ocurrencia])),e=>e.code==='42501');
});

test('deshacer conserva copia contable y no se vuelve a confirmar automáticamente',async()=>{
  const [o]=await prepare(await rule({auto:true}));
  await confirm(o.id_ocurrencia);
  await change(o.id_ocurrencia,'deshacer'); await change(o.id_ocurrencia,'deshacer');
  await db.query('select public.procesar_recurrencias()');
  assert.deepEqual((await db.query('select estado,automatica from public.ocurrencias_recurrentes where id_ocurrencia=$1',[o.id_ocurrencia])).rows,[{estado:'pendiente',automatica:false}]);
  const audit=(await db.query("select detalle from public.historial_recurrencias where id_ocurrencia=$1 and accion='deshacer'",[o.id_ocurrencia])).rows;
  assert.equal(audit.length,1); assert.equal(audit[0].detalle.monto_transaccion,10.15);
  assert.equal((await db.query('select count(*)::int n from public.movimientos where id_ocurrencia=$1',[o.id_ocurrencia])).rows[0].n,0);
  await confirm(o.id_ocurrencia,'11.10');
});

test('reprogramar y omitir son manuales; omitir no destruye la regla ni admite confirmación accidental',async()=>{
  const id=await rule({auto:true}); const [o]=await prepare(id);
  const tomorrow=(await db.query('select (finance_private.hoy()+1)::text d')).rows[0].d;
  await change(o.id_ocurrencia,'reprogramar',tomorrow);
  const updated=(await db.query('select fecha_programada::text original,fecha_prevista::text d,automatica from public.ocurrencias_recurrentes where id_ocurrencia=$1',[o.id_ocurrencia])).rows[0];
  assert.deepEqual(updated,{original:today,d:tomorrow,automatica:false});
  await change(o.id_ocurrencia,'omitir'); await assert.rejects(confirm(o.id_ocurrencia));
  await db.query('select public.procesar_recurrencias()');
  assert.equal((await db.query('select estado from public.ocurrencias_recurrentes where id_ocurrencia=$1',[o.id_ocurrencia])).rows[0].estado,'omitida');
  await change(o.id_ocurrencia,'reabrir');
  assert.equal((await db.query('select estado_activo from public.config_recurrencias where id_recurrencia=$1',[id])).rows[0].estado_activo,true);
});

test('programador confirma solo las automáticas activas, con fecha/importe previstos, y tolera reintentos',async()=>{
  const auto=await rule({auto:true}); const manual=await rule(); const paused=await rule({auto:true});
  await user(A,tx=>tx.query("select public.cambiar_recurrencia($1,'pausar')",[paused]));
  await db.query('select public.procesar_recurrencias()'); await db.query('select public.procesar_recurrencias()');
  const states=(await db.query('select id_recurrencia,estado from public.ocurrencias_recurrentes where id_recurrencia=any($1::uuid[])',[ [auto,manual,paused] ])).rows;
  assert.equal(states.find(r=>r.id_recurrencia===auto).estado,'confirmada');
  assert.equal(states.find(r=>r.id_recurrencia===manual).estado,'pendiente');
  assert.equal(states.find(r=>r.id_recurrencia===paused).estado,'pendiente');
  assert.deepEqual((await db.query('select monto_transaccion::text amount,es_automatico from public.movimientos m join public.ocurrencias_recurrentes o using(id_ocurrencia) where o.id_recurrencia=$1',[auto])).rows,[{amount:'12.30',es_automatico:true}]);
});

test('editar preserva las instantáneas pendientes; archivar conserva el historial y bloquea edición',async()=>{
  const id=await rule(); const [o]=await prepare(id);
  await user(A,tx=>tx.query("select public.guardar_recurrencia($1,'Otro nombre',1,null,99,'Mensual',31,$2,null,true)",[id,today]));
  assert.deepEqual((await db.query('select nombre,monto_previsto::text amount,id_tipo,automatica from public.ocurrencias_recurrentes where id_ocurrencia=$1',[o.id_ocurrencia])).rows,[{nombre:'Prueba',amount:'12.30',id_tipo:2,automatica:false}]);
  await user(A,tx=>tx.query("select public.cambiar_recurrencia($1,'archivar')",[id]));
  await confirm(o.id_ocurrencia);
  assert.equal((await db.query('select archivada from public.config_recurrencias where id_recurrencia=$1',[id])).rows[0].archivada,true);
  await assert.rejects(user(A,tx=>tx.query("select public.guardar_recurrencia($1,'Cambio',2,null,10,'Diario',null,$2,null,false)",[id,today])),/archivada/);
});

test('reactivar salta el intervalo pausado y no borra pendientes anteriores',async()=>{
  const id=await rule(); const [o]=await prepare(id);
  await user(A,tx=>tx.query("select public.cambiar_recurrencia($1,'pausar')",[id]));
  // Simulate elapsed paused time without changing the clock or user records.
  await db.query('update public.config_recurrencias set generar_desde=finance_private.hoy()-30 where id_recurrencia=$1',[id]);
  await user(A,tx=>tx.query("select public.cambiar_recurrencia($1,'reactivar')",[id]));
  await prepare(id);
  assert.equal((await db.query('select count(*)::int n from public.ocurrencias_recurrentes where id_recurrencia=$1',[id])).rows[0].n,1);
  assert.equal((await db.query('select estado from public.ocurrencias_recurrentes where id_ocurrencia=$1',[o.id_ocurrencia])).rows[0].estado,'pendiente');
});

test('migrar reglas existentes conserva movimientos, pausa e importes y no genera cobros del pasado',async()=>{
  const isolated=new PGlite();
  try {
    await isolated.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
    const directory=new URL('../supabase/migrations/',import.meta.url);
    for (const name of ['20261020000100_baseline.sql','20261020000200_private_finance.sql']) await isolated.exec(await readFile(new URL(name,directory),'utf8'));
    await isolated.query('insert into auth.users values($1)',[A]);
    await isolated.query("insert into public.usuarios(id_usuario,nombre_completo,username) values($1,'Persona A','persona_a')",[A]);
    await isolated.query("insert into public.movimientos(id_usuario,id_tipo,monto_transaccion,fecha_operacion) values($1,2,12.30,'2026-03-27T00:00:00Z')",[A]);
    await isolated.query("insert into public.config_recurrencias(id_usuario,id_tipo,monto_recurrente,frecuencia,dia_ejecucion,fecha_inicio,estado_activo) values($1,2,12.30,'Mensual',27,'2026-03-27',false),($1,2,12.30,'Diario',null,'2026-03-27',true)",[A]);
    const original=(await isolated.query('select * from public.movimientos')).rows;
    await isolated.exec(await readFile(new URL('20261022000100_recurrence_occurrences.sql',directory),'utf8'));
    assert.deepEqual((await isolated.query('select * from public.movimientos')).rows,original.map(m=>({...m,id_ocurrencia:null})));
    const paused=(await isolated.query("select estado_activo,dia_ejecucion,monto_recurrente::text amount,confirmacion_automatica from public.config_recurrencias where frecuencia='Mensual'")).rows;
    assert.deepEqual(paused,[{estado_activo:false,dia_ejecucion:27,amount:'12.30',confirmacion_automatica:false}]);
    await isolated.query('select finance_private.preparar($1)',[A]);
    assert.equal((await isolated.query('select count(*)::int n from public.ocurrencias_recurrentes where fecha_programada<finance_private.hoy()')).rows[0].n,0);
    assert.equal((await isolated.query('select count(*)::int n from public.movimientos')).rows[0].n,1);
  } finally {await isolated.close();}
});

test('recuperación de un período largo se limita por llamada y continúa sin perder ni duplicar fechas',async()=>{
  const id=await rule();
  await db.query('update public.config_recurrencias set fecha_inicio=finance_private.hoy()-400,generar_desde=finance_private.hoy()-400 where id_recurrencia=$1',[id]);
  let rows=await prepare(id); assert.equal(rows.length,366);
  rows=await prepare(id); assert.equal(rows.length,401);
  rows=await prepare(id); assert.equal(rows.length,401);
  assert.equal(new Set(rows.map(r=>r.fecha_programada)).size,401);
});

test('contrato de fechas SQL y calendario coincide en mes corto, semanal, anual bisiesto y límites',async()=>{
  for (const [frequency,start,day,year,month,end] of [
    ['Mensual','2024-01-31',31,2024,1,null],['Mensual','2025-01-31',31,2025,1,null],
    ['Anual','2024-02-29',null,2025,1,null],['Anual','2024-02-29',null,2028,1,null],
    ['Semanal','2026-12-29',null,2027,0,'2027-01-12'],['Diario','2026-10-20',null,2026,9,'2026-10-22'],
  ]) {
    const r={id_usuario:A,nombre:'Fechas',id_tipo:2,monto_recurrente:'1',frecuencia:frequency,fecha_inicio:start,fecha_fin:end,dia_ejecucion:day,estado_activo:true};
    const sql=(await db.query(`select d::date::text d from generate_series(make_date($2,$3,1)::timestamp,(make_date($2,$3,1)+interval '1 month - 1 day')::timestamp,interval '1 day') d
      where finance_private.corresponde(jsonb_populate_record(null::public.config_recurrencias,$1::jsonb),d::date)`,[JSON.stringify(r),year,month+1])).rows.map(r=>r.d);
    assert.deepEqual(sql,recurrenceDates({...r,categorias:null},year,month));
  }
});

test('calendario concilia por identidad, respeta omisiones y muestra reprogramación sin duplicar',()=>{
  const r={id_recurrencia:'r',id_tipo:2,monto_recurrente:'20',frecuencia:'Mensual',dia_ejecucion:20,fecha_inicio:'2026-10-01',fecha_fin:null,estado_activo:true,categorias:null};
  const o={id_ocurrencia:'o',id_recurrencia:'r',id_tipo:2,monto_previsto:'20',fecha_programada:'2026-10-20',fecha_prevista:'2026-10-22',estado:'pendiente',nombre:'Arriendo',categorias:null};
  let events=calendarEvents([], [r],2026,9,[o]);
  assert.equal(events[20].length,0); assert.equal(events[22].length,1);
  events=calendarEvents([], [r],2026,9,[{...o,estado:'omitida'}]); assert.equal(Object.values(events).flat().length,0);
  const m={id_movimiento:'m',id_ocurrencia:'o',id_tipo:2,monto_transaccion:'18',fecha_operacion:'2026-10-23',es_automatico:false,categorias:null};
  events=calendarEvents([m,{...m,id_movimiento:'independiente',id_ocurrencia:null}],[r],2026,9,[{...o,estado:'confirmada'}]);
  assert.deepEqual(calendarTotals(events),{realIncome:0,realExpense:3600,forecastIncome:0,forecastExpense:0});
  assert.equal(occurrenceStatus(o,'2026-10-23'),'vencida');
  assert.equal(occurrenceStatus(o,'2026-10-22'),'pendiente');
  assert.equal(occurrenceStatus({...o,estado:'confirmada'},'2026-10-23'),'confirmada');
});
