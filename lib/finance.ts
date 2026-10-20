// Pure financial rules. Amounts are accumulated as integer cents; dates are civil days.
export const FINANCE_TIME_ZONE = 'America/Bogota';
export const MAX_AMOUNT_CENTS = 999_999_999_999_999; // numeric(15, 2)

export interface Category {
  id_categoria: string;
  nombre_categoria: string;
}

export interface Movement {
  id_movimiento: string;
  id_categoria: string | null;
  id_tipo: number;
  monto_transaccion: number | string;
  fecha_operacion: string;
  descripcion_detalle: string | null;
  metodo_pago: string | null;
  es_automatico: boolean;
  categorias: { nombre_categoria: string } | null;
}

export interface Recurrence {
  id_recurrencia: string;
  id_usuario: string;
  id_categoria: string | null;
  id_tipo: number;
  monto_recurrente: number | string;
  frecuencia: string;
  dia_ejecucion: number | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado_activo: boolean;
  categorias: { nombre_categoria: string } | null;
}

export interface Profile {
  nombre_completo: string;
  username: string;
  codigo_moneda: string;
  url_avatar: string | null;
}

export function amountToCents(amount: string | number, allowZero = false): number {
  const value = String(amount).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error('Ingresa un monto válido con un máximo de dos decimales.');
  }
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS || cents < (allowZero ? 0 : 1)) {
    throw new Error('El monto debe ser positivo y no superar 9.999.999.999.999,99.');
  }
  return cents;
}

export function addCents(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || Math.abs(result) > MAX_AMOUNT_CENTS) throw new Error('El total supera el rango de cálculo seguro.');
  return result;
}

export function centsToDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('Importe inválido.');
  const absolute = Math.abs(cents);
  return (cents < 0 ? '-' : '') + Math.trunc(absolute / 100) + '.' + String(absolute % 100).padStart(2, '0');
}

export function formatAmount(amount: number | string, currency = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function civilToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FINANCE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return part('year') + '-' + part('month') + '-' + part('day');
}

export function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function movementDate(value: string): string {
  // Legacy rows store a chosen calendar date in a timestamptz. Preserve that date,
  // including midnight UTC, instead of reinterpreting historic entries in local time.
  const date = value.split('T')[0];
  if (!isCivilDate(date)) throw new Error('Hay un movimiento con una fecha inválida.');
  return date;
}

export function civilToDate(value: string): Date {
  if (!isCivilDate(value)) throw new Error('Selecciona una fecha válida.');
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function monthKey(year: number, month: number): string {
  return String(year).padStart(4, '0') + '-' + String(month + 1).padStart(2, '0');
}

export function movementSign(type: number): number {
  if (type === 1) return 1;
  if (type === 2 || type === 3) return -1;
  if (type === 4) return 0;
  throw new Error('Hay un tipo de movimiento desconocido.');
}

export interface CategoryTotal { name: string; value: number; pct: number }

export function summarizeMovements(movements: readonly Movement[], year: number, month: number) {
  const key = monthKey(year, month);
  const daily = Array.from({ length: new Date(Date.UTC(year, month + 1, 0)).getUTCDate() }, (_, index) => ({
    date: index + 1, incomeCents: 0, expenseCents: 0,
  }));
  const incomes = new Map<string, number>();
  const expenses = new Map<string, number>();
  let balanceCents = 0;
  let incomeCents = 0;
  let expenseCents = 0;
  for (const movement of movements) {
    const amount = amountToCents(movement.monto_transaccion);
    const sign = movementSign(movement.id_tipo);
    const date = movementDate(movement.fecha_operacion);
    balanceCents = addCents(balanceCents, sign * amount);
    if (!date.startsWith(key + '-') || sign === 0) continue;
    const day = Number(date.slice(8, 10)) - 1;
    const category = movement.categorias?.nombre_categoria ?? 'Sin categoría';
    const groups = sign > 0 ? incomes : expenses;
    groups.set(category, addCents(groups.get(category) ?? 0, amount));
    if (sign > 0) {
      incomeCents = addCents(incomeCents, amount);
      daily[day].incomeCents = addCents(daily[day].incomeCents, amount);
    } else {
      expenseCents = addCents(expenseCents, amount);
      daily[day].expenseCents = addCents(daily[day].expenseCents, amount);
    }
  }
  const categories = (groups: Map<string, number>, total: number): CategoryTotal[] =>
    Array.from(groups, ([name, cents]) => ({ name, value: cents / 100, pct: total ? Math.round(cents / total * 100) : 0 }))
      .sort((left, right) => right.value - left.value);
  return {
    balanceCents, incomeCents, expenseCents,
    chartData: daily.map(day => ({ date: day.date, Ingresos: day.incomeCents / 100, Egresos: day.expenseCents / 100 })),
    incomeCategories: categories(incomes, incomeCents), expenseCategories: categories(expenses, expenseCents),
  };
}

export function recurrenceDates(rule: Recurrence, year: number, month: number): string[] {
  if (!rule.estado_activo) return [];
  if (!isCivilDate(rule.fecha_inicio) || (rule.fecha_fin && (!isCivilDate(rule.fecha_fin) || rule.fecha_fin < rule.fecha_inicio))) {
    throw new Error('Hay una recurrencia con fechas inválidas.');
  }
  amountToCents(rule.monto_recurrente);
  movementSign(rule.id_tipo);
  if (!['Diario', 'Semanal', 'Mensual', 'Anual'].includes(rule.frecuencia)) throw new Error('Frecuencia desconocida.');
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startDay = Number(rule.fecha_inicio.slice(8, 10));
  const targetDay = rule.frecuencia === 'Mensual' ? rule.dia_ejecucion : startDay;
  if ((rule.frecuencia === 'Mensual') && (!Number.isInteger(targetDay) || !targetDay || targetDay < 1 || targetDay > 31)) {
    throw new Error('El día mensual debe estar entre 1 y 31.');
  }
  const start = Date.parse(rule.fecha_inicio + 'T00:00:00Z');
  const dates: string[] = [];
  for (let day = 1; day <= days; day++) {
    const date = monthKey(year, month) + '-' + String(day).padStart(2, '0');
    if (date < rule.fecha_inicio || (rule.fecha_fin && date > rule.fecha_fin)) continue;
    const elapsed = Math.round((Date.parse(date + 'T00:00:00Z') - start) / 86_400_000);
    if (rule.frecuencia === 'Diario' ||
      (rule.frecuencia === 'Semanal' && elapsed % 7 === 0) ||
      (rule.frecuencia === 'Mensual' && day === Math.min(targetDay!, days)) ||
      (rule.frecuencia === 'Anual' && Number(rule.fecha_inicio.slice(5, 7)) === month + 1 && day === Math.min(startDay, days))) {
      dates.push(date);
    }
  }
  return dates;
}

export interface CalendarEvent {
  key: string;
  id_tipo: number;
  monto_recurrente: number | string;
  categorias: { nombre_categoria: string } | null;
  isReal: boolean;
  isAutoDB: boolean;
}

export function calendarEvents(movements: readonly Movement[], rules: readonly Recurrence[], year: number, month: number) {
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const events: Record<number, CalendarEvent[]> = Object.fromEntries(Array.from({ length: days }, (_, i) => [i + 1, []]));
  for (const rule of rules) {
    for (const date of recurrenceDates(rule, year, month)) {
      events[Number(date.slice(8, 10))].push({
        key: 'forecast:' + rule.id_recurrencia + ':' + date, id_tipo: rule.id_tipo,
        monto_recurrente: rule.monto_recurrente, categorias: rule.categorias, isReal: false, isAutoDB: false,
      });
    }
  }
  for (const movement of movements) {
    const date = movementDate(movement.fecha_operacion);
    amountToCents(movement.monto_transaccion);
    movementSign(movement.id_tipo);
    if (!date.startsWith(monthKey(year, month) + '-')) continue;
    events[Number(date.slice(8, 10))].push({
      key: 'movement:' + movement.id_movimiento, id_tipo: movement.id_tipo,
      monto_recurrente: movement.monto_transaccion, categorias: movement.categorias,
      isReal: true, isAutoDB: movement.es_automatico,
    });
  }
  // Never infer identity from category, amount or date. Legacy rows cannot be
  // matched reliably to a rule; actuals and forecasts remain separate.
  return events;
}

export function calendarTotals(events: Record<number, CalendarEvent[]>) {
  let realIncome = 0, realExpense = 0, forecastIncome = 0, forecastExpense = 0;
  for (const event of Object.values(events).flat()) {
    const cents = amountToCents(event.monto_recurrente);
    const sign = movementSign(event.id_tipo);
    if (event.isReal) {
      if (sign > 0) realIncome = addCents(realIncome, cents);
      if (sign < 0) realExpense = addCents(realExpense, cents);
    } else {
      if (sign > 0) forecastIncome = addCents(forecastIncome, cents);
      if (sign < 0) forecastExpense = addCents(forecastExpense, cents);
    }
  }
  return { realIncome, realExpense, forecastIncome, forecastExpense };
}

export async function readAllPages<T>(
  readPage: (from: number, to: number) => Promise<T[]>, pageSize = 500,
): Promise<T[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error('Tamaño de página inválido.');
  const result: T[] = [];
  for (;;) {
    const page = await readPage(result.length, result.length + pageSize - 1);
    if (page.length === 0) return result;
    result.push(...page);
  }
}
