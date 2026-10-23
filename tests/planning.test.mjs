import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {budgetProgress,goalProgress} from '../lib/planning.ts';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const CAT_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',CAT_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let db,today,oldGoal;
before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  const dir=new URL('../supabase/migrations/',import.meta.url);
  const names=(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();
  for(const name of names){
    if(name==='20261022000200_budgets_and_goal_ledger.sql'){
      await db.query('insert into auth.users values($1),($2)',[A,B]);
      await db.query("insert into public.usuarios(id_usuario,nombre_completo,username) values($1,'Persona A','persona_a'),($2,'Persona B','persona_b')",[A,B]);
      await db.query("insert into public.categorias(id_categoria,id_usuario,nombre_categoria) values($1,$2,'A'),($3,$4,'B')",[CAT_A,A,CAT_B,B]);
      oldGoal=(await db.query("insert into public.metas_ahorro(id_usuario,nombre_meta,monto_objetivo,monto_actual) values($1,'Anterior',100,42.35) returning id_meta",[A])).rows[0].id_meta;
    }
    await db.exec(await readFile(new URL(name,dir),'utf8'));
  }
  today=(await db.query('select finance_private.hoy()::text d')).rows[0].d;
});
after(async()=>{
  try {
    assert.equal((await db.query(`select count(*)::int n from public.metas_ahorro m where m.monto_actual is distinct from
      (select coalesce(sum(a.monto),0) from public.aportes_metas a where a.id_meta=m.id_meta)`)).rows[0].n,0,'Every goal balance equals its signed ledger');
    assert.equal((await db.query('select count(*)::int n from public.movimientos')).rows[0].n,0,'Goal operations never create financial movements');
  }finally{await db?.close();}
});
function user(id,work,role='authenticated'){return db.transaction(async tx=>{await tx.exec('set local role '+role);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);return work(tx);});}
async function goal(initial='0',target='100'){return (await user(A,tx=>tx.query("select public.guardar_meta(null,'Viaje',$1,$2,null,'Medio') id",[target,initial]))).rows[0].id;}
function entry(meta,amount='10.15',type='aporte',id=randomUUID(),date=today){return user(A,tx=>tx.query('select public.registrar_aporte_meta($1,$2,$3,$4,$5,$6) id',[id,meta,amount,type,date,'Reserva de prueba']));}
const reverse=id=>user(A,tx=>tx.query('select public.revertir_aporte_meta($1) id',[id]));
async function balance(id){return (await db.query('select monto_actual::text amount,estado_meta from public.metas_ahorro where id_meta=$1',[id])).rows[0];}

test('presupuesto cuenta egresos del mes y categoría, conserva duplicados y excluye ingresos/inversiones/transferencias',()=>{
  const budget={id_categoria:'food',monto_limite:'100.00',mes_calendario:10,anio_calendario:2026,porcentaje_alerta:80};
  const m={id_tipo:2,id_categoria:'food',monto_transaccion:'40',fecha_operacion:'2026-10-01T00:00:00Z'};
  const rows=[m,{...m},...[1,3,4].map(id_tipo=>({...m,id_tipo})),{...m,fecha_operacion:'2025-10-01'},{...m,fecha_operacion:'2026-09-30'},{...m,id_categoria:null}];
  const original=structuredClone(rows);
  assert.deepEqual(budgetProgress(budget,rows),{limitCents:10000,spentCents:8000,remainingCents:2000,percentage:80,status:'alerta'});
  const general=budgetProgress({...budget,id_categoria:null},rows);
  assert.equal(general.spentCents,12000);assert.equal(general.remainingCents,-2000);assert.equal(general.status,'excedido');
  assert.deepEqual(rows,original);
});
test('alertas usan centavos exactos y no adelantan el umbral por redondeo; cruzan año correctamente',()=>{
  const b={id_categoria:null,monto_limite:'100.01',mes_calendario:1,anio_calendario:2027,porcentaje_alerta:80};
  const m={id_tipo:2,id_categoria:null,monto_transaccion:'80.00',fecha_operacion:'2027-01-01'};
  assert.equal(budgetProgress(b,[m]).status,'normal');
  assert.equal(budgetProgress(b,[{...m,monto_transaccion:'80.01'}]).status,'alerta');
  assert.equal(budgetProgress(b,[{...m,fecha_operacion:'2026-12-31'}]).spentCents,0);
  assert.equal(budgetProgress({...b,monto_limite:'9999999999999.99'},[]).status,'normal');
  assert.throws(()=>budgetProgress({...b,mes_calendario:null},[]));
});
test('progreso de metas distingue completa, vencida, exceso y saldo inválido',()=>{
  const g={monto_actual:'25.10',monto_objetivo:'100',fecha_proyectada:'2026-10-01'};
  assert.equal(goalProgress(g,'2026-10-22').remainingCents,7490);assert.equal(goalProgress(g,'2026-10-22').overdue,true);
  const p=goalProgress({...g,monto_actual:'101'},'2026-10-22');assert.equal(p.completed,true);assert.equal(p.overdue,false);assert.equal(p.remainingCents,0);
  assert.throws(()=>goalProgress({...g,monto_actual:null},'2026-10-22'));
  assert.throws(()=>goalProgress({...g,fecha_proyectada:'2026-02-30'},'2026-10-22'));
});
test('migración conserva el ahorro existente y lo identifica como saldo inicial, sin inventar aportes pasados',async()=>{
  assert.equal((await balance(oldGoal)).amount,'42.35');
  assert.deepEqual((await db.query('select monto::text amount,tipo,fecha::text d from public.aportes_metas where id_meta=$1',[oldGoal])).rows,[{amount:'42.35',tipo:'saldo_inicial',d:today}]);
});
test('presupuestos por mes y categoría son únicos, incluidos los generales; RPC valida dueño y categoría',async()=>{
  const create=(category=null,month=10)=>user(A,tx=>tx.query('select public.guardar_presupuesto(null,$1,100,$2,2026,80) id',[category,month]));
  const id=(await create()).rows[0].id;
  await assert.rejects(create(),e=>e.code==='23505');await create(null,11);await create(CAT_A);
  await assert.rejects(create(CAT_B),e=>e.code==='23514');
  await assert.rejects(user(B,tx=>tx.query('select public.guardar_presupuesto($1,null,999,10,2026,80)',[id])),e=>e.code==='42501');
  assert.equal((await user(B,tx=>tx.query('delete from public.presupuestos_mensuales where id_presupuesto=$1 returning id_presupuesto',[id]))).rows.length,0);
  for(const [amount,month,alert] of [['1.001',12,80],['0',12,80],['10',13,80],['10',12,101]])await assert.rejects(user(A,tx=>tx.query('select public.guardar_presupuesto(null,null,$1,$2,2026,$3)',[amount,month,alert])));
});
test('aportes y retiros actualizan saldo y estado atómicamente, incluso al superar y dejar de cumplir el objetivo',async()=>{
  const id=await goal('25.10');await entry(id,'80.20');assert.deepEqual(await balance(id),{amount:'105.30',estado_meta:'Completada'});
  await entry(id,'10.05','retiro');assert.deepEqual(await balance(id),{amount:'95.25',estado_meta:'En Progreso'});
  await assert.rejects(entry(id,'95.26','retiro'));assert.equal((await balance(id)).amount,'95.25');
});
test('reintentar el mismo aporte no duplica dinero y rechaza reutilizar el identificador con datos distintos',async()=>{
  const id=await goal(),request=randomUUID();await Promise.all([entry(id,'10.15','aporte',request),entry(id,'10.15','aporte',request)]);
  assert.equal((await balance(id)).amount,'10.15');await assert.rejects(entry(id,'11','aporte',request),/otros datos/);
});
test('revertir conserva el original, compensa una sola vez y también admite corregir un retiro',async()=>{
  const id=await goal('50');const a=(await entry(id,'20')).rows[0].id;
  const first=await reverse(a),second=await reverse(a);assert.equal(first.rows[0].id,second.rows[0].id);assert.equal((await balance(id)).amount,'50.00');
  const withdrawal=(await entry(id,'15','retiro')).rows[0].id;await reverse(withdrawal);assert.equal((await balance(id)).amount,'50.00');
  assert.equal((await db.query('select count(*)::int n from public.aportes_metas where id_meta=$1',[id])).rows[0].n,5);
});
test('reversión que dejaría saldo negativo se rechaza sin perder historia; entradas inválidas revierten la transacción',async()=>{
  const id=await goal();const a=(await entry(id,'20')).rows[0].id;await entry(id,'15','retiro');await assert.rejects(reverse(a),/saldo resultante/);
  const tomorrow=(await db.query('select (finance_private.hoy()+1)::text d')).rows[0].d;
  for(const amount of ['0','-1','NaN','1.001','10000000000000'])await assert.rejects(entry(id,amount));
  await assert.rejects(entry(id,'1','aporte',randomUUID(),tomorrow));assert.equal((await balance(id)).amount,'5.00');
});
test('archivar conserva saldo e historial, impide nuevos aportes y permite reactivar; editar no sobrescribe el ahorro',async()=>{
  const id=await goal('40');await user(A,tx=>tx.query("select public.guardar_meta($1,'Otro objetivo',30,0,null,'Alto')",[id]));assert.deepEqual(await balance(id),{amount:'40.00',estado_meta:'Completada'});
  await user(A,tx=>tx.query('select public.archivar_meta($1,true)',[id]));await assert.rejects(entry(id),/Reactiva/);
  await assert.rejects(user(A,tx=>tx.query("select public.guardar_meta($1,'Otra',10,0,null,'Medio')",[id])),/Reactiva/);
  await user(A,tx=>tx.query('select public.archivar_meta($1,false)',[id]));await entry(id);assert.equal((await balance(id)).amount,'50.15');
});
test('RLS, RPC y privilegios aíslan metas/aportes y bloquean escritura directa o borrado de la historia',async()=>{
  const id=await goal('10');const a=(await entry(id)).rows[0].id;
  for(const table of ['metas_ahorro','aportes_metas'])assert.equal((await user(B,tx=>tx.query('select * from public.'+table))).rows.length,0);
  await assert.rejects(user(B,tx=>tx.query('select public.revertir_aporte_meta($1)',[a])),e=>e.code==='42501');
  await assert.rejects(user(B,tx=>tx.query('select public.archivar_meta($1,true)',[id])),e=>e.code==='42501');
  await assert.rejects(user(B,tx=>tx.query("select public.guardar_meta($1,'Ajena',100,0,null,'Medio')",[id])),e=>e.code==='42501');
  await assert.rejects(user(B,tx=>tx.query("select public.registrar_aporte_meta($1,$2,1,'aporte',$3,'Ajeno')",[randomUUID(),id,today])),e=>e.code==='42501');
  for(const sql of ['update public.metas_ahorro set monto_actual=999','delete from public.metas_ahorro','delete from public.aportes_metas','update public.aportes_metas set monto=999'])await assert.rejects(user(A,tx=>tx.exec(sql)),e=>e.code==='42501');
  await assert.rejects(user(null,tx=>tx.query("select public.guardar_meta(null,'Sin sesión',100,0,null,'Medio')")),e=>e.code==='42501');
  await assert.rejects(user(null,tx=>tx.query('select public.archivar_meta($1,true)',[id]),'anon'),e=>e.code==='42501');
  await assert.rejects(user(null,tx=>tx.query('select * from public.aportes_metas'),'anon'),e=>e.code==='42501');
});
