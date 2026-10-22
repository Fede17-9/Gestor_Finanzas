// Compile-time checks: tsc must reject each marked invalid operation.
// These functions are never run and do not contact Supabase.
import type { AppSupabaseClient } from '../../lib/supabase';
import type { Row } from '../../lib/database.types';
import { centsToDecimal } from '../../lib/finance';

export async function checkQueryContract(client: AppSupabaseClient) {
  // @ts-expect-error Unknown tables must not be accepted.
  client.from('movimientoss');
  // @ts-expect-error Amount is required to create a movement.
  client.from('movimientos').insert({ id_usuario: 'owner', id_tipo: 2 });
  // @ts-expect-error Column names are checked on writes.
  client.from('movimientos').update({ monto_transaccionn: 10 });
  // @ts-expect-error Arbitrary text is not an exact decimal input.
  client.from('movimientos').update({ monto_transaccion: 'importe incorrecto' });
  // @ts-expect-error Movement type references an integer ID.
  client.from('movimientos').update({ id_tipo: 'Egreso' });
  // @ts-expect-error A category name is mandatory.
  client.from('categorias').insert({ id_usuario: 'owner' });
  // @ts-expect-error RPC names are checked against the migrated schema.
  client.rpc('confirmar_pago_inventado');
  // @ts-expect-error Confirmation must provide the amount, date and payment method.
  client.rpc('confirmar_ocurrencia', { p_id: 'occurrence' });
  // @ts-expect-error RPC numeric inputs do not accept arbitrary strings.
  client.rpc('confirmar_ocurrencia', { p_id: 'occurrence', p_monto: 'incorrecto', p_fecha: '2026-10-22', p_metodo: 'Efectivo' });
  client.rpc('confirmar_ocurrencia', { p_id: 'occurrence', p_monto: centsToDecimal(123), p_fecha: '2026-10-22', p_metodo: 'Efectivo' });
  client.rpc('actualizar_pendientes');

  client.from('movimientos').insert({
    id_usuario: 'owner', id_tipo: 2, monto_transaccion: centsToDecimal(123),
  });
  const { data } = await client.from('movimientos')
    .select('id_movimiento, categorias(nombre_categoria)').single();
  if (data?.categorias) data.categorias.nombre_categoria.toUpperCase();
  // @ts-expect-error The selected relationship is a category, not an untyped object.
  if (data?.categorias) data.categorias.campo_inexistente.toUpperCase();
}

export function checkNullableContract(movement: Row<'movimientos'>, goal: Row<'metas_ahorro'>) {
  // @ts-expect-error The physical schema permits null dates; the reader must validate them.
  movement.fecha_operacion.slice(0, 10);
  // @ts-expect-error An optional savings amount must be validated before calculations.
  goal.monto_actual.toFixed(2);
}
