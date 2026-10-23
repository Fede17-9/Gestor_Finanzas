import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const CAT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CAT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GLOBAL = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const tables = ['usuarios','tipos_movimiento','categorias','movimientos','config_recurrencias','presupuestos_mensuales','metas_ahorro'];
const bootstrap = `
  create role anon;
  create role authenticated;
  create role service_role bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon,authenticated,service_role;
  grant execute on function auth.uid() to anon,authenticated,service_role;
`;
const baseline = await readFile(new URL('../supabase/migrations/20261020000100_baseline.sql', import.meta.url), 'utf8');
const hardening = await readFile(new URL('../supabase/migrations/20261020000200_private_finance.sql', import.meta.url), 'utf8');
let db;

before(async () => {
  db = new PGlite();
  await db.exec(bootstrap);
  await db.exec(baseline);
  await db.exec('create policy old_open_profile on public.usuarios for insert with check (true)');
  await db.exec(hardening);
  await db.query('insert into auth.users(id) values ($1),($2),($3)', [A,B,C]);
  await db.query(`insert into public.usuarios(id_usuario,nombre_completo,username,codigo_moneda)
    values ($1,'Persona A','persona_a','COP'),($2,'Persona B','persona_b','COP')`, [A,B]);
  await db.query(`insert into public.categorias(id_categoria,id_usuario,nombre_categoria)
    values ($1,$2,'Privada A'),($3,$4,'Privada B'),($5,null,'General')`, [CAT_A,A,CAT_B,B,GLOBAL]);
});
after(async () => { await db?.close(); });

test('verificador A/B demuestra aislamiento, detecta una política abierta y revierte todos los cambios', async () => {
  const verification = await readFile(new URL('../supabase/verify_isolation.sql', import.meta.url), 'utf8');
  for (const permissive of [false, true]) {
    const isolated = new PGlite();
    try {
      await isolated.exec(bootstrap);
      await isolated.exec(baseline);
      await isolated.exec(hardening);
      await isolated.query('insert into auth.users(id) values ($1),($2)', [A,B]);
      await isolated.query(`insert into public.usuarios(id_usuario,nombre_completo,username)
        values ($1,'Persona A','persona_a'),($2,'Persona B','persona_b')`, [A,B]);
      await isolated.query(`insert into public.movimientos(id_usuario,id_tipo,monto_transaccion,descripcion_detalle)
        values ($1,2,1,'PRUEBA_PRIVACIDAD_A'),($2,2,1,'PRUEBA_PRIVACIDAD_B')`, [A,B]);
      const before = (await isolated.query('select * from public.movimientos order by id_movimiento')).rows;
      if (permissive) {
        await isolated.exec('create policy insecure_test on public.movimientos for all to authenticated using(true) with check(true)');
        await assert.rejects(isolated.exec(verification), /Fallo de aislamiento/);
        await isolated.exec('rollback');
      } else {
        const results = (await isolated.exec(verification)).flatMap(result => result.rows).filter(row => 'cuenta' in row);
        assert.equal(results.length, 2);
        assert.ok(results.every(row => Object.entries(row).every(([key,value]) => key === 'cuenta' || value === true)));
      }
      assert.deepEqual((await isolated.query('select * from public.movimientos order by id_movimiento')).rows, before);
    } finally { await isolated.close(); }
  }
});

test('inspección de solo lectura enumera permisos, funciones y vistas sin consultar datos personales', async () => {
  const inspection = await readFile(new URL('../supabase/inspect.sql', import.meta.url), 'utf8');
  const results = await db.exec(inspection);
  const rows = results.flatMap(result => result.rows);
  assert.ok(rows.some(row => row.signature === 'check_finance_category_owner()' && row.anon_execute === false && row.authenticated_execute === false));
  assert.ok(rows.some(row => row.table_name === 'usuarios' && row.column_name === 'nombre_completo' && row.privilege_type === 'UPDATE'));
  assert.ok(!rows.some(row => 'id_usuario' in row || 'monto_transaccion' in row || 'username' in row));
  assert.equal((await db.query('select count(*)::int n from public.usuarios')).rows[0].n, 2);
});

function asUser(user, action, role = 'authenticated') {
  return db.transaction(async tx => {
    await tx.exec('set local role ' + role);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user ?? '']);
    return action(tx);
  });
}

test('migraciones reconstruyen las siete tablas con RLS y retiran la política permisiva anterior', async () => {
  const result = await db.query(`select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace
    where n.nspname='public' and relname=any($1::text[])`, [tables]);
  assert.equal(result.rows.length, 7);
  assert.ok(result.rows.every(row => row.relrowsecurity));
  assert.equal((await db.query("select count(*)::int n from pg_policies where policyname='old_open_profile'")).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int n from pg_constraint where connamespace='public'::regnamespace and not convalidated")).rows[0].n, 0);
});

test('invitado no lee ni escribe las tablas de la aplicación', async () => {
  for (const table of tables) {
    await assert.rejects(asUser(null, tx => tx.query('select * from public.' + table), 'anon'), error => error.code === '42501');
  }
  await assert.rejects(asUser(null, tx => tx.query(`insert into public.usuarios(id_usuario,nombre_completo,username)
    values ($1,'Impostor','impostor')`, [C]), 'anon'), error => error.code === '42501');
});

test('cada usuario solo ve su perfil; puede completar su propio perfil tras confirmar el correo', async () => {
  assert.deepEqual((await asUser(A, tx => tx.query('select id_usuario from public.usuarios'))).rows, [{ id_usuario: A }]);
  await asUser(C, tx => tx.query(`insert into public.usuarios(id_usuario,nombre_completo,username,codigo_moneda)
    values ($1,'Persona C','persona_c','COP')`, [C]));
  await assert.rejects(asUser(A, tx => tx.query(`insert into public.usuarios(id_usuario,nombre_completo,username)
    values ($1,'Impostor','otro_alias')`, [B])), error => error.code === '42501');
});

test('privilegios de perfil protegen propietario, moneda y fecha; el nombre sigue editable', async () => {
  await asUser(A, tx => tx.query("update public.usuarios set nombre_completo='Nombre actualizado' where id_usuario=$1", [A]));
  for (const field of ["codigo_moneda='USD'", "fecha_registro=now()", "id_usuario='" + C + "'"]) {
    await assert.rejects(asUser(A, tx => tx.query('update public.usuarios set ' + field + ' where id_usuario=$1', [A])), error => error.code === '42501');
  }
  await assert.rejects(asUser(A, tx => tx.query("update public.usuarios set username='PERSONA_B' where id_usuario=$1", [A])), error => error.code === '23505');
});

test('A crea un movimiento propio; B no lo lee, edita ni elimina por ID conocido', async () => {
  const result = await asUser(A, tx => tx.query(`insert into public.movimientos(id_usuario,id_tipo,id_categoria,monto_transaccion)
    values ($1,2,$2,0.30) returning id_movimiento`, [A,CAT_A]));
  const id = result.rows[0].id_movimiento;
  assert.equal((await asUser(B, tx => tx.query('select * from public.movimientos where id_movimiento=$1', [id]))).rows.length, 0);
  assert.equal((await asUser(B, tx => tx.query('update public.movimientos set monto_transaccion=100 where id_movimiento=$1 returning id_movimiento', [id]))).rows.length, 0);
  assert.equal((await asUser(B, tx => tx.query('delete from public.movimientos where id_movimiento=$1 returning id_movimiento', [id]))).rows.length, 0);
  assert.equal((await asUser(A, tx => tx.query('select monto_transaccion::text amount from public.movimientos where id_movimiento=$1', [id]))).rows[0].amount, '0.30');
  await assert.rejects(asUser(A, tx => tx.query('update public.movimientos set id_usuario=$1 where id_movimiento=$2', [B,id])));
});

test('una petición directa no puede insertar un movimiento a nombre de otro usuario', async () => {
  await assert.rejects(asUser(A, tx => tx.query(`insert into public.movimientos(id_usuario,id_tipo,monto_transaccion)
    values ($1,2,10)`, [B])), error => error.code === '42501');
});

test('movimientos, recurrencias y presupuestos rechazan una categoría privada de otro usuario', async () => {
  const inserts = [
    ['movimientos', 'id_usuario,id_categoria,id_tipo,monto_transaccion', '$1,$2,2,10'],
    ['config_recurrencias', 'id_usuario,id_categoria,id_tipo,monto_recurrente,frecuencia,dia_ejecucion,fecha_inicio', "$1,$2,2,10,'Mensual',1,'2026-10-01'"],
    ['presupuestos_mensuales', 'id_usuario,id_categoria,monto_limite,mes_calendario,anio_calendario', '$1,$2,100,10,2026'],
  ];
  for (const [table, columns, values] of inserts) {
    await assert.rejects(asUser(A, tx => tx.query('insert into public.' + table + '(' + columns + ') values (' + values + ')', [A,CAT_B])), error => error.code === '23514');
    await asUser(A, tx => tx.query('insert into public.' + table + '(' + columns + ') values (' + values + ')', [A,GLOBAL]));
  }
});

test('categorías globales son legibles, pero el usuario no puede crearlas, editarlas ni eliminarlas', async () => {
  const categories = await asUser(A, tx => tx.query('select id_categoria from public.categorias order by id_categoria'));
  assert.deepEqual(categories.rows.map(row => row.id_categoria), [CAT_A,GLOBAL]);
  await assert.rejects(asUser(A, tx => tx.query("insert into public.categorias(nombre_categoria) values ('Global falsa')")), error => error.code === '42501');
  assert.equal((await asUser(A, tx => tx.query("update public.categorias set nombre_categoria='Cambiada' where id_categoria=$1 returning id_categoria", [GLOBAL]))).rows.length, 0);
  assert.equal((await asUser(A, tx => tx.query('delete from public.categorias where id_categoria=$1 returning id_categoria', [GLOBAL]))).rows.length, 0);
});

test('catálogo contable es de solo lectura para usuarios', async () => {
  assert.equal((await asUser(A, tx => tx.query('select * from public.tipos_movimiento'))).rows.length, 4);
  await assert.rejects(asUser(A, tx => tx.query("update public.tipos_movimiento set signo_contable=1 where id_tipo=2")), error => error.code === '42501');
});

test('PostgreSQL rechaza negativos, cero, NaN y exceso de rango aunque se omita el formulario', async () => {
  for (const amount of ['-1','0','NaN','10000000000000']) {
    await assert.rejects(asUser(A, tx => tx.query('insert into public.movimientos(id_usuario,id_tipo,monto_transaccion) values ($1,2,$2::numeric)', [A,amount])));
  }
  await assert.rejects(asUser(A, tx => tx.query(`insert into public.metas_ahorro(id_usuario,nombre_meta,monto_objetivo,monto_actual)
    values ($1,'Ahorro',100,-1)`, [A])), error => error.code === '23514');
});

test('vigencia y día mensual inválidos se rechazan en la base', async () => {
  for (const [day, start, end] of [[0,'2026-10-01',null],[null,'2026-10-01',null],[1,'2026-10-20','2026-10-01']]) {
    await assert.rejects(asUser(A, tx => tx.query(`insert into public.config_recurrencias
      (id_usuario,id_tipo,monto_recurrente,frecuencia,dia_ejecucion,fecha_inicio,fecha_fin)
      values ($1,2,10,'Mensual',$2,$3,$4)`, [A,day,start,end])), error => error.code === '23514');
  }
});

test('presupuesto único por usuario/categoría/período, incluido el presupuesto total', async () => {
  for (const category of [CAT_A,null]) {
    const query = 'insert into public.presupuestos_mensuales(id_usuario,id_categoria,monto_limite,mes_calendario,anio_calendario) values ($1,$2,100,11,2026)';
    await asUser(A, tx => tx.query(query, [A,category]));
    await assert.rejects(asUser(A, tx => tx.query(query, [A,category])), error => error.code === '23505');
  }
});

test('aislamiento A/B también cubre metas, presupuestos y reglas', async () => {
  const result = await asUser(A, tx => tx.query("insert into public.metas_ahorro(id_usuario,nombre_meta,monto_objetivo) values ($1,'Viaje',100) returning id_meta", [A]));
  for (const [table, column] of [['metas_ahorro','id_meta'],['presupuestos_mensuales','id_presupuesto'],['config_recurrencias','id_recurrencia']]) {
    assert.equal((await asUser(B, tx => tx.query('select * from public.' + table + ' where id_usuario=$1', [A]))).rows.length, 0);
    assert.equal((await asUser(B, tx => tx.query('delete from public.' + table + ' where id_usuario=$1 returning ' + column, [A]))).rows.length, 0);
  }
  assert.equal((await asUser(A, tx => tx.query('select * from public.metas_ahorro where id_meta=$1', [result.rows[0].id_meta]))).rows.length, 1);
});

test('migración falla y revierte completamente si el historial contiene importes inválidos', async () => {
  const legacy = new PGlite();
  try {
    await legacy.exec(bootstrap);
    await legacy.exec(baseline);
    await legacy.query('insert into auth.users(id) values ($1)', [A]);
    await legacy.query("insert into public.usuarios(id_usuario,nombre_completo,username) values ($1,'Prueba','prueba')", [A]);
    await legacy.query('insert into public.movimientos(id_usuario,id_tipo,monto_transaccion) values ($1,2,-10)', [A]);
    await assert.rejects(legacy.exec(hardening), error => error.code === '23514');
    await legacy.exec('rollback');
    assert.equal((await legacy.query('select monto_transaccion::text amount from public.movimientos')).rows[0].amount, '-10.00');
    assert.equal((await legacy.query("select count(*)::int n from pg_constraint where conname='movimientos_monto_valido'")).rows[0].n, 0);
    await assert.rejects(legacy.exec(baseline), /empty application schema/);
    await legacy.exec('rollback');
    assert.equal((await legacy.query('select count(*)::int n from public.movimientos')).rows[0].n, 1);
  } finally { await legacy.close(); }
});
