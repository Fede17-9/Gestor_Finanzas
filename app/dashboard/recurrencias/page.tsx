"use client";

import Dialog from '@/components/ui/Dialog';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { createFinanceReader } from '@/lib/finance-data';
import { amountToCents, centsToDecimal, civilToday, formatAmount, isCivilDate, occurrenceStatus, readAllPages } from '@/lib/finance';
import type { Category, Movement, Occurrence, Recurrence } from '@/lib/finance';
import type { Row } from '@/lib/database.types';
import { Plus, RefreshCw, Repeat } from 'lucide-react';

const reader = createFinanceReader(supabase);
const input='field mt-1';
const button='button-secondary';
const blank = () => ({ id: '', nombre: '', tipo: '2', categoria: '', monto: '', frecuencia: 'Mensual', dia: String(Number(civilToday().slice(8))), inicio: civilToday(), fin: '', automatica: false });
type Form = ReturnType<typeof blank>;
type Action = { occurrence: Occurrence; kind: 'confirmar' | 'reprogramar' | 'omitir' | 'reabrir' | 'deshacer' } | { rule: Recurrence; kind: 'pausar' | 'reactivar' | 'archivar' };
const labels: Record<string, string> = { pendiente: 'Pendiente', vencida: 'Vencida', confirmada: 'Confirmada', omitida: 'Omitida', regla_creada: 'Regla creada', regla_editada: 'Regla editada', confirmacion_manual: 'Confirmación manual', confirmacion_automatica: 'Confirmación automática', deshacer: 'Confirmación deshecha', reprogramar: 'Fecha reprogramada', omitir: 'Vencimiento omitido', reabrir: 'Devuelto a pendiente', pausar: 'Regla pausada', reactivar: 'Regla reactivada', archivar: 'Regla archivada' };

function activityDetail(event: Row<'historial_recurrencias'>, currency: string) {
  const detail = event.detalle;
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return '';
  const amount = detail.monto ?? detail.monto_transaccion;
  const date = detail.fecha ?? detail.fecha_operacion;
  const parts: string[] = [];
  if (typeof amount === 'number' || typeof amount === 'string') parts.push(formatAmount(amount, currency));
  if (typeof date === 'string') parts.push(date.slice(0, 10));
  if (typeof detail.fecha_anterior === 'string' && typeof detail.fecha_nueva === 'string') parts.push(detail.fecha_anterior + ' a ' + detail.fecha_nueva);
  return parts.length ? ' · ' + parts.join(' · ') : '';
}

export default function RecurrenciasPage() {
  const router = useRouter();
  const [rules, setRules] = useState<Recurrence[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [history, setHistory] = useState<Row<'historial_recurrencias'>[]>([]);
  const [currency, setCurrency] = useState('COP');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [form, setForm] = useState<Form | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [realAmount, setRealAmount] = useState('');
  const [date, setDate] = useState(civilToday);
  const [method, setMethod] = useState('Transferencia');
  const [filter, setFilter] = useState('pendiente');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);

  const fetchData = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) { router.replace('/login'); throw new Error('Vuelve a iniciar sesión.'); }
    const uid = session.user.id;
    const [rules, occurrences, movements, profile, categories, events] = await Promise.all([
      reader.recurrences(uid, false), reader.occurrences(uid), reader.movements(uid), reader.profile(uid),
      readAllPages(async (from, to) => {
        const { data, error } = await supabase.from('categorias').select('id_categoria,nombre_categoria')
          .or('id_usuario.eq.' + uid + ',id_usuario.is.null').order('id_categoria').range(from, to);
        if (error || !data) throw new Error('No se pudieron cargar las categorías.');
        return data;
      }),
      supabase.from('historial_recurrencias').select('*').eq('id_usuario', uid).order('creado_en', { ascending: false }).order('id_evento').limit(30),
    ]);
    if (events.error || !events.data) throw new Error('No se pudo cargar el historial de recurrencias.');
    return { rules, occurrences, movements, profile, categories, events: events.data };
  }, [router]);
  const apply = useCallback((snapshot: Awaited<ReturnType<typeof fetchData>>) => {
    setRules(snapshot.rules); setOccurrences(snapshot.occurrences); setMovements(snapshot.movements);
    setCurrency(snapshot.profile.codigo_moneda); setCategories(snapshot.categories); setHistory(snapshot.events); setLoadError('');
  }, []);
  useEffect(() => {
    let active = true;
    fetchData().then(snapshot => { if (active) apply(snapshot); })
      .catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar los datos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchData, apply]);

  async function run(work: () => Promise<string>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      setMessage(await work());
      try { apply(await fetchData()); }
      catch { setLoadError('La operación se guardó, pero no se pudo actualizar la vista. Pulsa Recargar; no repitas la operación.'); }
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo guardar. Intenta de nuevo.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function edit(rule?: Recurrence) {
    setError('');
    setForm(rule ? { id: rule.id_recurrencia, nombre: rule.nombre, tipo: String(rule.id_tipo), categoria: rule.id_categoria || '', monto: String(rule.monto_recurrente), frecuencia: rule.frecuencia, dia: String(rule.dia_ejecucion || 1), inicio: rule.fecha_inicio, fin: rule.fecha_fin || '', automatica: rule.confirmacion_automatica } : blank());
  }
  function choose(occurrence: Occurrence, kind: Extract<Action, { occurrence: Occurrence }>['kind']) {
    setError(''); setRealAmount(String(occurrence.monto_previsto)); setDate(kind === 'reprogramar' ? occurrence.fecha_prevista : civilToday()); setMethod('Transferencia'); setAction({ occurrence, kind });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    await run(async () => {
      const amount = centsToDecimal(amountToCents(form.monto));
      if (!isCivilDate(form.inicio) || (form.fin && (!isCivilDate(form.fin) || form.fin < form.inicio))) throw new Error('Revisa las fechas de inicio y fin.');
      const { error } = await supabase.rpc('guardar_recurrencia', { p_id: form.id || null, p_nombre: form.nombre.trim(), p_tipo: Number(form.tipo), p_categoria: form.categoria || null, p_monto: amount, p_frecuencia: form.frecuencia, p_dia: form.frecuencia === 'Mensual' ? Number(form.dia) : null, p_inicio: form.inicio, p_fin: form.fin || null, p_automatica: form.automatica });
      if (error) throw new Error(error.code === '23514' ? 'Revisa el importe, la frecuencia y las fechas de la regla.' : error.message);
      setForm(null);
      return 'Regla guardada. Los cambios se aplican a vencimientos futuros. Pulsa Actualizar pendientes para preparar los que ya vencen.';
    });
  }
  async function execute(event: React.FormEvent) {
    event.preventDefault();
    if (!action) return;
    await run(async () => {
      if ('rule' in action) {
        const { error } = await supabase.rpc('cambiar_recurrencia', { p_id: action.rule.id_recurrencia, p_accion: action.kind });
        if (error) throw new Error(error.message);
      } else if (action.kind === 'confirmar') {
        if (!isCivilDate(date) || date > civilToday()) throw new Error('Selecciona la fecha real, hasta hoy.');
        const { error } = await supabase.rpc('confirmar_ocurrencia', { p_id: action.occurrence.id_ocurrencia, p_monto: centsToDecimal(amountToCents(realAmount)), p_fecha: date, p_metodo: method });
        if (error) throw new Error(error.message);
      } else {
        if (action.kind === 'reprogramar' && !isCivilDate(date)) throw new Error('Selecciona una fecha válida.');
        const { error } = await supabase.rpc('cambiar_ocurrencia', { p_id: action.occurrence.id_ocurrencia, p_accion: action.kind, p_fecha: action.kind === 'reprogramar' ? date : null });
        if (error) throw new Error(error.message);
      }
      setAction(null);
      return 'Cambio guardado. El saldo solo cambia al confirmar o deshacer una confirmación.';
    });
  }
  const visible = occurrences.filter(o => (filter === 'todas' || (filter === 'pendiente' ? o.estado === 'pendiente' : occurrenceStatus(o) === filter)) && o.nombre.toLowerCase().includes(search.toLowerCase()));
  const pending = occurrences.filter(o => o.estado === 'pendiente');
  const overdue = pending.filter(o => occurrenceStatus(o) === 'vencida');

  return <div className="mx-auto max-w-6xl space-y-6 pb-12 text-ink">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="flex items-center gap-3 text-3xl font-bold"><Repeat className="text-accent" />Recurrencias</h1><p className="mt-2 text-sm text-muted">Planifica tus pagos y cobros. Confirma lo que ocurrió y deja pendiente lo que se demore.</p></div>
      <button className={button} disabled={busy || loading || !!loadError} onClick={() => edit()}><Plus className="mr-2 inline" size={16} />Nueva regla</button>
    </header>
    <p className="rounded-xl border border-line p-4 text-sm text-muted">Las reglas nuevas empiezan hoy o en el futuro. Actualizar pendientes prepara vencimientos hasta hoy, sin confirmar pagos. El modo automático por regla requiere activar la tarea programada en Supabase; funciona con la aplicación cerrada una vez configurada.</p>
    {loadError && <div role="alert" className="rounded-xl border border-red-800 p-4 text-danger">{loadError}</div>}
    {message && <p role="status" className="text-accent">{message}</p>}
    {error && !form && !action && <p role="alert" className="text-danger">{error}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <button className={button} disabled={busy || loading} onClick={() => void run(async () => { const { data, error } = await supabase.rpc('actualizar_pendientes'); if (error) throw new Error(error.message); return `${data ?? 0} vencimientos nuevos preparados. Los pendientes anteriores se conservan.`; })}><RefreshCw size={14} className="mr-2 inline" />{busy ? 'Procesando…' : 'Actualizar pendientes'}</button>
      <button className={button} disabled={busy} onClick={() => void run(async () => 'Vista recargada.')}>Recargar</button>
      <span className="text-sm text-muted">{pending.length} pendientes · {overdue.length} vencidos</span>
    </div>
    {loading ? <p role="status">Cargando recurrencias…</p> : !loadError && <>
      <section className="space-y-4" aria-labelledby="pending-title">
        <h2 id="pending-title" className="text-xl font-semibold">Vencimientos</h2>
        <div className="flex flex-wrap gap-3">
          <label className="sr-only" htmlFor="occurrence-filter">Estado de vencimientos</label><select id="occurrence-filter" className={input + ' sm:!w-auto'} value={filter} onChange={e => { setFilter(e.target.value); setLimit(50); }}><option value="pendiente">Pendientes y vencidos</option><option value="vencida">Solo vencidos</option><option value="confirmada">Confirmados</option><option value="omitida">Omitidos</option><option value="todas">Todos</option></select>
          <label className="sr-only" htmlFor="occurrence-search">Buscar vencimiento</label><input id="occurrence-search" className={input + ' sm:!w-auto'} placeholder="Buscar por nombre" value={search} onChange={e => { setSearch(e.target.value); setLimit(50); }} />
        </div>
        {!visible.length && <p className="text-muted">No hay vencimientos en este filtro. Crea una regla y prepara sus pendientes cuando llegue la fecha.</p>}
        {visible.slice(0, limit).map(o => {
          const movement = movements.find(m => m.id_ocurrencia === o.id_ocurrencia);
          return <article key={o.id_ocurrencia} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{o.nombre}</h3><p className="mt-1 text-sm text-muted">{{ 1: 'Ingreso', 2: 'Egreso', 3: 'Inversión', 4: 'Transferencia' }[o.id_tipo]} · Previsto: {formatAmount(o.monto_previsto, currency)} · Fecha: {o.fecha_prevista}</p>{o.fecha_programada !== o.fecha_prevista && <p className="text-xs text-muted">Fecha original: {o.fecha_programada}</p>}{movement && <p className="mt-1 text-sm text-accent">Real: {formatAmount(movement.monto_transaccion, currency)} · {movement.fecha_operacion.slice(0, 10)} · {movement.metodo_pago}</p>}</div><span className={occurrenceStatus(o) === 'vencida' ? 'text-warning' : 'text-muted'}>{labels[occurrenceStatus(o)]}{o.automatica && o.estado === 'pendiente' ? ' · Automática' : ''}</span></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {o.estado === 'pendiente' && <><button disabled={busy} className={button + ' text-accent'} onClick={() => choose(o, 'confirmar')}>Confirmar pago o cobro</button><button disabled={busy} className={button} onClick={() => choose(o, 'reprogramar')}>Reprogramar</button><button disabled={busy} className={button} onClick={() => choose(o, 'omitir')}>Omitir</button></>}
              {o.estado === 'confirmada' && <button disabled={busy} className={button} onClick={() => choose(o, 'deshacer')}>Deshacer confirmación</button>}
              {o.estado === 'omitida' && <button disabled={busy} className={button} onClick={() => choose(o, 'reabrir')}>Volver a pendiente</button>}
            </div>
          </article>;
        })}
        {visible.length > limit && <button className={button} onClick={() => setLimit(limit + 50)}>Mostrar 50 más ({visible.length - limit} restantes)</button>}
      </section>
      <section className="space-y-3" aria-labelledby="rules-title"><h2 id="rules-title" className="text-xl font-semibold">Reglas</h2>
        {!rules.length && <p className="text-muted">Aún no tienes reglas recurrentes.</p>}
        {rules.map(rule => <article key={rule.id_recurrencia} className="rounded-xl border border-line p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{rule.nombre}</h3><p className="text-sm text-muted">{formatAmount(rule.monto_recurrente, currency)} · {rule.frecuencia}{rule.frecuencia === 'Mensual' ? ` · Día ${rule.dia_ejecucion}` : ''} · {rule.confirmacion_automatica ? 'Confirmación automática' : 'Confirmación manual'}</p><p className="mt-1 text-xs text-muted">Desde {rule.fecha_inicio}{rule.fecha_fin ? ` hasta ${rule.fecha_fin}` : ''} · {rule.categorias?.nombre_categoria || 'Sin categoría'}</p></div><span className="text-sm text-muted">{rule.archivada ? 'Archivada' : !rule.estado_activo ? 'Pausada' : rule.fecha_fin && rule.fecha_fin < civilToday() ? 'Finalizada' : 'Activa'}</span></div>
          {!rule.archivada && <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} className={button} onClick={() => edit(rule)}>Editar</button><button disabled={busy} className={button} onClick={() => { setError(''); setAction({ rule, kind: rule.estado_activo ? 'pausar' : 'reactivar' }); }}>{rule.estado_activo ? 'Pausar' : 'Reactivar'}</button><button disabled={busy} className={button} onClick={() => { setError(''); setAction({ rule, kind: 'archivar' }); }}>Archivar</button></div>}
        </article>)}
      </section>
      <section aria-labelledby="history-title"><h2 id="history-title" className="mb-3 text-xl font-semibold">Actividad reciente</h2><p className="mb-3 text-sm text-muted">Últimos 30 cambios. Deshacer conserva una copia del movimiento en el historial.</p><ul className="space-y-2 text-sm text-muted">{history.map(event => <li key={event.id_evento}>{new Date(event.creado_en).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · {labels[event.accion] || event.accion} · {rules.find(r => r.id_recurrencia === event.id_recurrencia)?.nombre || 'Recurrencia'}{activityDetail(event, currency)}</li>)}</ul></section>
    </>}
    {(form || action) && <Dialog title={form ? (form.id ? 'Editar regla' : 'Nueva regla') : action?.kind === 'confirmar' ? 'Confirmar pago o cobro' : (action && labels[action.kind]) || 'Recurrencias'} busy={busy} onClose={() => { setForm(null); setAction(null); setError(''); }}>
      {error && <p role="alert" className="mb-4 text-danger">{error}</p>}
      {form && <form onSubmit={save}><fieldset disabled={busy} className="space-y-4">
        <label className="block">Nombre<input autoFocus className={input} required maxLength={120} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej.: Arriendo" /></label>
        <div className="grid grid-cols-2 gap-3"><label>Tipo<select className={input} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option value="1">Ingreso</option><option value="2">Egreso</option><option value="3">Inversión</option><option value="4">Transferencia</option></select></label><label>Importe<input className={input} required type="number" min="0.01" max="9999999999999.99" step="0.01" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} /></label></div>
        <label className="block">Categoría<select className={input} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}><option value="">Sin categoría</option>{categories.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre_categoria}</option>)}</select><span className="text-xs text-muted">Puedes crear categorías al registrar un movimiento.</span></label>
        <div className="grid grid-cols-2 gap-3"><label>Frecuencia<select className={input} value={form.frecuencia} onChange={e => setForm({ ...form, frecuencia: e.target.value })}>{['Diario','Semanal','Mensual','Anual'].map(f => <option key={f}>{f}</option>)}</select></label>{form.frecuencia === 'Mensual' && <label>Día del mes<input className={input} required type="number" min="1" max="31" value={form.dia} onChange={e => setForm({ ...form, dia: e.target.value })} /></label>}</div>
        <div className="grid grid-cols-2 gap-3"><label>Inicio<input className={input} required type="date" min={form.id ? undefined : civilToday()} max="9999-12-31" value={form.inicio} onChange={e => setForm({ ...form, inicio: e.target.value })} /></label><label>Fin opcional<input className={input} type="date" min={form.inicio} max="9999-12-31" value={form.fin} onChange={e => setForm({ ...form, fin: e.target.value })} /></label></div>
        <p className="text-xs text-muted">Día 31: se usa el último día en meses cortos. Semanal: mismo día de la semana que el inicio. Anual: misma fecha, ajustando el 29 de febrero al 28 cuando corresponda. Editar no cambia vencimientos ya preparados.</p>
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={form.automatica} onChange={e => setForm({ ...form, automatica: e.target.checked })} /><span>Confirmar automáticamente al vencer<span className="mt-1 block text-xs text-warning">Registrará el importe previsto como movimiento real sin preguntarte. Déjalo desactivado si el pago puede demorarse. Cambiar esta opción afecta a vencimientos futuros.</span></span></label>
        <button className="button-primary w-full" type="submit">{busy ? 'Guardando…' : 'Guardar regla'}</button>
      </fieldset></form>}
      {action && <form onSubmit={execute}><fieldset disabled={busy} className="space-y-4">
        <p>{'occurrence' in action ? action.occurrence.nombre : action.rule.nombre}</p>
        {action.kind === 'confirmar' && <><label className="block">Importe real<input autoFocus className={input} type="number" min="0.01" max="9999999999999.99" step="0.01" required value={realAmount} onChange={e => setRealAmount(e.target.value)} /></label><label className="block">Fecha real<input className={input} required type="date" max={civilToday()} value={date} onChange={e => setDate(e.target.value)} /></label><label className="block">Método de pago<input className={input} required maxLength={80} value={method} onChange={e => setMethod(e.target.value)} /></label><p className="text-sm text-muted">Esto creará un movimiento real y cambiará tu saldo. Comprueba que no lo hayas registrado antes por separado.</p></>}
        {action.kind === 'reprogramar' && <><label className="block">Nueva fecha prevista<input autoFocus className={input} required type="date" max="9999-12-31" value={date} onChange={e => setDate(e.target.value)} /></label><p className="text-sm text-muted">Conserva la fecha original y deja este vencimiento en confirmación manual.</p></>}
        {action.kind === 'deshacer' && <p className="text-warning">Retirará el movimiento del saldo y devolverá este vencimiento a pendiente manual. Se conserva una copia en el historial. Después puedes confirmarlo con los datos correctos.</p>}
        {action.kind === 'omitir' && <p className="text-muted">No se registrará un movimiento para este vencimiento. La regla seguirá activa.</p>}
        {action.kind === 'reabrir' && <p className="text-muted">Volverá a pendiente con confirmación manual.</p>}
        {'rule' in action && <p className="text-muted">{action.kind === 'reactivar' ? 'Reanuda desde hoy sin recuperar las fechas del período pausado.' : action.kind === 'pausar' ? 'Conserva los vencimientos hasta hoy y detiene los nuevos. Los pendientes existentes pasan a confirmación manual.' : 'Detiene nuevos vencimientos y conserva los pendientes en modo manual y el historial. Archivar es definitivo.'}</p>}
        <button type="submit" className="button-primary w-full">{busy ? 'Guardando…' : action.kind === 'confirmar' ? 'Confirmar y registrar movimiento' : 'Confirmar cambio'}</button>
      </fieldset></form>}
    </Dialog>}
  </div>;
}
