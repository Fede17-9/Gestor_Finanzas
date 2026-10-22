import type { AppSupabaseClient } from './supabase.ts';
import { amountToCents, movementDate, movementSign, readAllPages } from './finance.ts';
import type { Movement, Profile, Recurrence } from './finance.ts';
import type { Row } from './database.types.ts';

const MOVEMENT_FIELDS = 'id_movimiento, id_categoria, id_tipo, monto_transaccion, fecha_operacion, descripcion_detalle, metodo_pago, es_automatico, categorias(nombre_categoria)';

export function normalizeRecurrence(row: Row<'config_recurrencias'> & { categorias: Recurrence['categorias'] }): Recurrence {
  const frequency = row.frecuencia;
  if (!frequency || !['Diario', 'Semanal', 'Mensual', 'Anual'].includes(frequency)) {
    throw new Error('Hay una recurrencia con una frecuencia inválida. Revisa la regla antes de continuar.');
  }
  amountToCents(row.monto_recurrente);
  return { ...row, frecuencia: frequency, estado_activo: row.estado_activo ?? false };
}

// Read-only gateway: mounting a report must never change financial records.
export function createFinanceReader(client: AppSupabaseClient) {
  return {
    async movements(userId: string): Promise<Movement[]> {
      const movements = await readAllPages(async (from, to) => {
        const { data, error } = await client.from('movimientos').select(MOVEMENT_FIELDS)
          .eq('id_usuario', userId).order('fecha_operacion', { ascending: false })
          .order('id_movimiento', { ascending: false }).range(from, to);
        if (error) throw new Error('No se pudieron cargar todos los movimientos. Intenta de nuevo.');
        if (!data) throw new Error('La respuesta de movimientos está incompleta.');
        return data;
      });
      const ids = new Set<string>();
      return movements.map((movement): Movement => {
        if (ids.has(movement.id_movimiento)) throw new Error('El historial cambió durante la carga. Vuelve a cargarlo.');
        ids.add(movement.id_movimiento);
        if (!movement.fecha_operacion) throw new Error('Hay un movimiento con una fecha inválida.');
        amountToCents(movement.monto_transaccion);
        movementDate(movement.fecha_operacion);
        movementSign(movement.id_tipo);
        return { ...movement, fecha_operacion: movement.fecha_operacion, es_automatico: movement.es_automatico ?? false };
      });
    },
    async profile(userId: string): Promise<Profile> {
      const { data, error } = await client.from('usuarios')
        .select('nombre_completo, username, codigo_moneda, url_avatar')
        .eq('id_usuario', userId).single();
      if (error || !data) throw new Error('No se pudo cargar tu perfil. Vuelve a iniciar sesión.');
      const currency = data.codigo_moneda;
      if (!currency || !['COP', 'USD', 'EUR'].includes(currency)) {
        throw new Error('Tu perfil no tiene una moneda válida. Revisa la configuración antes de consultar importes.');
      }
      return { ...data, codigo_moneda: currency };
    },
    async recurrences(userId: string): Promise<Recurrence[]> {
      return readAllPages(async (from, to) => {
        const { data, error } = await client.from('config_recurrencias').select('*, categorias(nombre_categoria)')
          .eq('id_usuario', userId).eq('estado_activo', true)
          .order('id_recurrencia', { ascending: true }).range(from, to);
        if (error || !data) throw new Error('No se pudieron cargar las proyecciones.');
        return data.map(normalizeRecurrence);
      });
    },
  };
}
