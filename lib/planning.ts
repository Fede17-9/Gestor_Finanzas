import type { Movement } from './finance.ts';
import { addCents, amountToCents, isCivilDate, monthKey, movementDate } from './finance.ts';
import type { Row } from './database.types.ts';

export function budgetProgress(budget: Pick<Row<'presupuestos_mensuales'>, 'id_categoria' | 'monto_limite' | 'mes_calendario' | 'anio_calendario' | 'porcentaje_alerta'>, movements: readonly Movement[]) {
  const { mes_calendario: month, anio_calendario: year, porcentaje_alerta: threshold } = budget;
  if (!month || !year || !threshold || month<1 || month>12 || year<1000 || year>9999 || threshold<1 || threshold>100) throw new Error('Presupuesto con período o alerta inválidos.');
  const limitCents = amountToCents(budget.monto_limite);
  let spentCents = 0;
  for (const movement of movements) {
    if (movement.id_tipo !== 2 || !movementDate(movement.fecha_operacion).startsWith(monthKey(year,month-1)+'-')) continue;
    if (budget.id_categoria !== null && movement.id_categoria !== budget.id_categoria) continue;
    spentCents=addCents(spentCents,amountToCents(movement.monto_transaccion));
  }
  // Compare integer ratios without rounding a 79.999% use into an 80% alert.
  const alertAt = Number((BigInt(limitCents) * BigInt(threshold) + BigInt(99)) / BigInt(100));
  return { limitCents,spentCents,remainingCents:limitCents-spentCents,percentage:spentCents/limitCents*100,
    status:spentCents>=limitCents ? 'excedido' : spentCents>=alertAt ? 'alerta' : 'normal' };
}

export function goalProgress(goal: Pick<Row<'metas_ahorro'>,'monto_actual'|'monto_objetivo'|'fecha_proyectada'>, today: string) {
  if (!isCivilDate(today) || (goal.fecha_proyectada && !isCivilDate(goal.fecha_proyectada))) throw new Error('La meta tiene una fecha fuera del rango permitido.');
  if (goal.monto_actual === null) throw new Error('La meta no tiene saldo válido.');
  const currentCents=amountToCents(goal.monto_actual,true),targetCents=amountToCents(goal.monto_objetivo);
  return {currentCents,targetCents,remainingCents:Math.max(0,targetCents-currentCents),percentage:currentCents/targetCents*100,
    completed:currentCents>=targetCents,overdue:currentCents<targetCents && !!goal.fecha_proyectada && goal.fecha_proyectada<today};
}
