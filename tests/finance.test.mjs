import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_AMOUNT_CENTS, addCents, amountToCents, calendarEvents, calendarTotals, centsToDecimal,
  civilToday, isCivilDate, movementDate, readAllPages, recurrenceDates, summarizeMovements,
} from '../lib/finance.ts';
import { createFinanceReader } from '../lib/finance-data.ts';
import { createClient } from '@supabase/supabase-js';

const movement = (overrides = {}) => ({
  id_movimiento: 'm1', id_categoria: 'food', id_tipo: 2, monto_transaccion: '20.00',
  fecha_operacion: '2026-10-20T00:00:00+00:00', descripcion_detalle: 'Compra',
  metodo_pago: 'Efectivo', es_automatico: false, categorias: { nombre_categoria: 'Comida' }, ...overrides,
});
const recurrence = (overrides = {}) => ({
  id_recurrencia: 'r1', id_usuario: 'owner', id_categoria: 'food', id_tipo: 2,
  monto_recurrente: '20.00', frecuencia: 'Mensual', dia_ejecucion: 20,
  fecha_inicio: '2026-10-01', fecha_fin: null, estado_activo: true,
  categorias: { nombre_categoria: 'Comida' }, ...overrides,
});

test('centavos exactos: 0,10 + 0,20 no introduce errores de punto flotante', () => {
  assert.equal(addCents(amountToCents('0.10'), amountToCents(0.2)), 30);
  assert.equal(centsToDecimal(30), '0.30');
  assert.equal(centsToDecimal(-1), '-0.01');
  assert.equal(amountToCents('9999999999999.99'), MAX_AMOUNT_CENTS);
});

test('rechaza montos inválidos, negativos, infinitos, con exceso de decimales o fuera de numeric(15,2)', () => {
  for (const value of ['', '0', '-1', '1.001', '1e3', '12abc', '1,20', NaN, Infinity, '10000000000000']) {
    assert.throws(() => amountToCents(value), Error, String(value));
  }
  assert.equal(amountToCents('0', true), 0);
  assert.throws(() => addCents(MAX_AMOUNT_CENTS, 1), /rango/);
});

test('fecha civil de Bogotá se mantiene hasta medianoche local, incluso después de las 19:00', () => {
  assert.equal(civilToday(new Date('2026-10-21T00:30:00Z')), '2026-10-20');
  assert.equal(civilToday(new Date('2026-10-21T04:59:59Z')), '2026-10-20');
  assert.equal(civilToday(new Date('2026-10-21T05:00:00Z')), '2026-10-21');
  assert.equal(civilToday(new Date('2027-01-01T02:00:00Z')), '2026-12-31');
});

test('valida días reales y conserva fechas históricas sin desplazarlas por zona horaria', () => {
  assert.equal(isCivilDate('2024-02-29'), true);
  for (const value of ['2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-1-1', '0000-01-01']) {
    assert.equal(isCivilDate(value), false);
  }
  assert.equal(movementDate('2026-10-20T00:00:00+00:00'), '2026-10-20');
});

test('saldo y gráficos cuentan dos gastos idénticos legítimos y no mutan sus registros', () => {
  const rows = [movement(), movement({ id_movimiento: 'm2' }), movement({ id_movimiento: 'salary', id_tipo: 1, monto_transaccion: '100.00' })];
  const before = structuredClone(rows);
  const summary = summarizeMovements(rows, 2026, 9);
  assert.equal(summary.balanceCents, 6000);
  assert.equal(summary.expenseCents, 4000);
  assert.equal(summary.incomeCents, 10000);
  assert.equal(summary.chartData[19].Egresos, 40);
  assert.equal(summary.expenseCategories[0].value, 40);
  assert.deepEqual(rows, before);
});

test('ingreso y egreso en misma categoría/fecha no colisionan, tampoco los automáticos existentes', () => {
  const rows = [movement({ es_automatico: true }), movement({ id_movimiento: 'm2', id_tipo: 1, es_automatico: true })];
  const summary = summarizeMovements(rows, 2026, 9);
  const events = calendarEvents(rows, [], 2026, 9);
  assert.equal(summary.balanceCents, 0);
  assert.equal(events[20].length, 2);
  assert.deepEqual(calendarTotals(events), { realIncome: 2000, realExpense: 2000, forecastIncome: 0, forecastExpense: 0 });
});

test('mes seleccionado filtra métricas por año y mes sin alterar saldo histórico', () => {
  const rows = [movement(), movement({ id_movimiento: 'old', fecha_operacion: '2025-10-01', id_tipo: 1, monto_transaccion: '100.10' }),
    movement({ id_movimiento: 'previous', fecha_operacion: '2026-09-30', monto_transaccion: '0.20' })];
  const summary = summarizeMovements(rows, 2026, 9);
  assert.equal(summary.balanceCents, 7990);
  assert.equal(summary.incomeCents, 0);
  assert.equal(summary.expenseCents, 2000);
  assert.equal(summary.chartData.length, 31);
  assert.equal(summarizeMovements([], 2024, 1).chartData.length, 29);
});

test('inversión usa signo negativo y traspaso es neutro, según catálogo existente', () => {
  const rows = [movement({ id_tipo: 3 }), movement({ id_movimiento: 'transfer', id_tipo: 4 })];
  const summary = summarizeMovements(rows, 2026, 9);
  assert.equal(summary.balanceCents, -2000);
  assert.equal(summary.expenseCents, 2000);
  assert.throws(() => summarizeMovements([movement({ id_tipo: 99 })], 2026, 9), /desconocido/);
});

test('calendario separa lo registrado de lo programado, sin inferir una conciliación', () => {
  const rows = [movement(), movement({ id_movimiento: 'second' })];
  const rules = [recurrence(), recurrence({ id_recurrencia: 'other' })];
  const before = structuredClone({ rows, rules });
  const events = calendarEvents(rows, rules, 2026, 9);
  assert.equal(events[20].length, 4);
  assert.equal(new Set(events[20].map(event => event.key)).size, 4);
  assert.deepEqual(calendarTotals(events), { realIncome: 0, realExpense: 4000, forecastIncome: 0, forecastExpense: 4000 });
  assert.deepEqual({ rows, rules }, before);
});

test('reglas diarias respetan inicio y fin inclusivos, también al consultar otro mes', () => {
  const rule = recurrence({ frecuencia: 'Diario', fecha_inicio: '2026-10-20', fecha_fin: '2026-10-22' });
  assert.deepEqual(recurrenceDates(rule, 2026, 9), ['2026-10-20', '2026-10-21', '2026-10-22']);
  assert.deepEqual(recurrenceDates(rule, 2026, 8), []);
  assert.deepEqual(recurrenceDates(rule, 2026, 10), []);
});

test('reglas mensuales no aparecen antes del inicio y usan el último día válido', () => {
  const rule = recurrence({ dia_ejecucion: 1, fecha_inicio: '2026-10-20' });
  assert.deepEqual(recurrenceDates(rule, 2026, 9), []);
  assert.deepEqual(recurrenceDates(rule, 2026, 10), ['2026-11-01']);
  assert.deepEqual(recurrenceDates(recurrence({ dia_ejecucion: 31, fecha_inicio: '2024-01-31' }), 2024, 1), ['2024-02-29']);
  assert.deepEqual(recurrenceDates(recurrence({ dia_ejecucion: 31, fecha_inicio: '2025-01-31' }), 2025, 1), ['2025-02-28']);
  assert.deepEqual(recurrenceDates(recurrence({ fecha_fin: '2026-10-19' }), 2026, 9), []);
});

test('semanal conserva el anclaje elegido y cruza mes y año sin usar hora local', () => {
  const rule = recurrence({ frecuencia: 'Semanal', fecha_inicio: '2026-12-29', fecha_fin: '2027-01-12' });
  assert.deepEqual(recurrenceDates(rule, 2027, 0), ['2027-01-05', '2027-01-12']);
});

test('anual conserva mes/día y ajusta el 29 de febrero al 28 en un año común', () => {
  const rule = recurrence({ frecuencia: 'Anual', fecha_inicio: '2024-02-29' });
  assert.deepEqual(recurrenceDates(rule, 2025, 1), ['2025-02-28']);
  assert.deepEqual(recurrenceDates(rule, 2028, 1), ['2028-02-29']);
  assert.deepEqual(recurrenceDates(rule, 2025, 2), []);
});

test('pausadas no proyectan; reglas sin categoría mantienen identidad independiente', () => {
  assert.deepEqual(recurrenceDates(recurrence({ estado_activo: false }), 2026, 9), []);
  const rules = [recurrence({ id_categoria: null, categorias: null }), recurrence({ id_recurrencia: 'r2', id_categoria: null, categorias: null })];
  assert.equal(calendarEvents([], rules, 2026, 9)[20].length, 2);
});

test('reglas inválidas se informan como error, no como proyección cero', () => {
  for (const override of [{ fecha_inicio: '2026-02-30' }, { fecha_fin: '2026-09-01' }, { dia_ejecucion: 0 }, { frecuencia: 'Otro' }, { monto_recurrente: '-1' }]) {
    assert.throws(() => recurrenceDates(recurrence(override), 2026, 9));
  }
});

test('lee un historial mayor al límite por página, incluso si el servidor devuelve páginas menores', async () => {
  const rows = Array.from({ length: 1205 }, (_, id) => id);
  const pages = [];
  const all = await readAllPages(async (from, to) => {
    pages.push([from, to]);
    return rows.slice(from, Math.min(to + 1, from + 200));
  });
  assert.deepEqual(all, rows);
  assert.equal(pages.at(-1)[0], 1205);
});

test('un fallo en una página rechaza la lectura completa y no entrega un saldo parcial', async () => {
  await assert.rejects(readAllPages(async from => {
    if (from === 0) return [1, 2];
    throw new Error('Sin conexión');
  }), /Sin conexión/);
});

function fakeClient(rows, { failAfter = Infinity } = {}) {
  const calls = [];
  const writes = [];
  const stored = structuredClone(rows);
  return {
    calls, writes, stored,
    from(table) {
      const query = { table, owner: null, from: 0, to: 499 };
      const builder = {
        select() { return this; },
        eq(key, value) { if (key === 'id_usuario') query.owner = value; return this; },
        order() { return this; },
        range(from, to) { query.from = from; query.to = to; return this; },
        returns() { return this; },
        async then(resolve, reject) {
          calls.push({ ...query });
          try {
            const data = stored.filter(row => row.id_usuario === query.owner).slice(query.from, query.to + 1);
            return resolve(query.from >= failAfter ? { data: null, error: new Error('Falló la página') } : { data, error: null });
          } catch (error) { return reject(error); }
        },
      };
      for (const operation of ['insert', 'update', 'delete', 'upsert']) {
        builder[operation] = () => { writes.push(operation); throw new Error('Un informe intentó escribir datos'); };
      }
      return builder;
    },
  };
}

test('lector de reportes conserva operaciones iguales, filtra propietario y no escribe en Supabase', async () => {
  const rows = [movement({ id_usuario: 'A', es_automatico: true }),
    movement({ id_movimiento: 'm2', id_usuario: 'A', es_automatico: true }),
    movement({ id_movimiento: 'private', id_usuario: 'B' })];
  const client = fakeClient(rows);
  const result = await createFinanceReader(client).movements('A');
  assert.equal(result.length, 2);
  assert.equal(summarizeMovements(result, 2026, 9).balanceCents, -4000);
  assert.ok(client.calls.every(query => query.owner === 'A' && query.table === 'movimientos'));
  assert.deepEqual(client.writes, []);
  assert.deepEqual(client.stored, rows);
});

test('lector rechaza fallo de página o datos inválidos en vez de mostrar totales incompletos', async () => {
  const rows = Array.from({ length: 505 }, (_, id) => movement({ id_movimiento: String(id), id_usuario: 'A' }));
  await assert.rejects(createFinanceReader(fakeClient(rows, { failAfter: 500 })).movements('A'), /todos los movimientos/);
  await assert.rejects(createFinanceReader(fakeClient([movement({ id_usuario: 'A', monto_transaccion: -20 })])).movements('A'), /monto válido/);
});

test('lector detecta una página inestable que repite un ID; no borra ni oculta filas para repararla', async () => {
  const row = movement({ id_usuario: 'A' });
  const client = fakeClient([row, { ...row }]);
  await assert.rejects(createFinanceReader(client).movements('A'), /historial cambió/);
  assert.deepEqual(client.writes, []);
  assert.equal(client.stored.length, 2);
});

test('cliente Supabase real: informes paginados emiten solo GET con filtro de propietario', async () => {
  const rows = Array.from({ length: 501 }, (_, id) => movement({ id_movimiento: String(id) }));
  const requests = [];
  const client = createClient('https://finance-tests.invalid', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, options) => {
      const url = new URL(String(input));
      const method = options?.method ?? 'GET';
      requests.push({ url, method });
      assert.equal(method, 'GET', 'Un informe intentó modificar la base de datos');
      assert.equal(url.searchParams.get('id_usuario'), 'eq.owner');
      let data;
      if (url.pathname.endsWith('/usuarios')) {
        data = { nombre_completo: 'Usuario ficticio', username: 'test', codigo_moneda: 'COP', url_avatar: null };
      } else if (url.pathname.endsWith('/config_recurrencias')) {
        assert.equal(url.searchParams.get('estado_activo'), 'eq.true');
        data = Number(url.searchParams.get('offset')) === 0 ? [recurrence()] : [];
      } else {
        assert.match(url.searchParams.get('order'), /fecha_operacion.desc,id_movimiento.desc/);
        const offset = Number(url.searchParams.get('offset'));
        const limit = Number(url.searchParams.get('limit'));
        data = rows.slice(offset, offset + limit);
      }
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const reader = createFinanceReader(client);
  const [all, profile, rules] = await Promise.all([reader.movements('owner'), reader.profile('owner'), reader.recurrences('owner')]);
  assert.equal(all.length, 501);
  assert.equal(profile.codigo_moneda, 'COP');
  assert.equal(rules.length, 1);
  assert.equal(requests.length, 6);
  assert.ok(requests.every(request => request.method === 'GET'));
});

test('un perfil sin moneda reconocida no permite presentar importes bajo una moneda supuesta', async () => {
  const client = createClient('https://finance-tests.invalid', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async () => new Response(JSON.stringify({
      nombre_completo: 'Prueba', username: 'test', codigo_moneda: null, url_avatar: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }) },
  });
  await assert.rejects(createFinanceReader(client).profile('owner'), /moneda válida/);
});

test('lector tipado rechaza fechas nulas y normaliza indicadores opcionales sin alterar importes', async () => {
  let invalidDate = true;
  const client = createClient('https://finance-tests.invalid', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async input => {
      const url = new URL(String(input));
      const firstPage = !Number(url.searchParams.get('offset'));
      const rows = firstPage ? [movement({ fecha_operacion: invalidDate ? null : '2026-03-27', es_automatico: null })] : [];
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  await assert.rejects(createFinanceReader(client).movements('owner'), /fecha inválida/);
  invalidDate = false;
  const [row] = await createFinanceReader(client).movements('owner');
  assert.equal(row.es_automatico, false);
  assert.equal(row.monto_transaccion, movement().monto_transaccion);
});

test('lector tipado conserva reglas con día opcional y rechaza una frecuencia nula', async () => {
  let invalidFrequency = false;
  const client = createClient('https://finance-tests.invalid', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async input => {
      const firstPage = !Number(new URL(String(input)).searchParams.get('offset'));
      return new Response(JSON.stringify(firstPage ? [recurrence({ frecuencia: invalidFrequency ? null : 'Semanal', dia_ejecucion: null })] : []), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } },
  });
  assert.equal((await createFinanceReader(client).recurrences('owner'))[0].dia_ejecucion, null);
  invalidFrequency = true;
  await assert.rejects(createFinanceReader(client).recurrences('owner'), /frecuencia inválida/);
});
