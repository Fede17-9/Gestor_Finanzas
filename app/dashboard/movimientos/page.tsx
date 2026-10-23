"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { createFinanceReader } from '@/lib/finance-data';
import { amountToCents, centsToDecimal, civilToday, formatAmount, isCivilDate, movementSign, readAllPages } from '@/lib/finance';
import type { Category, Movement } from '@/lib/finance';
import { ArrowLeftRight, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Dialog from '@/components/ui/Dialog';
import ConfirmModal from '@/components/ConfirmModal';

const reader = createFinanceReader(supabase);

export default function MovimientosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currency, setCurrency] = useState('COP');
  const [movimientos, setMovimientos] = useState<Movement[]>([]);
  const [categoriasLista, setCategoriasLista] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState('2');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [categoria, setCategoria] = useState('');
  const [fechaOperacion, setFechaOperacion] = useState(civilToday);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'ok' | 'err' }[]>([]);
  const toastId = useRef(0);
  const submitLock = useRef(false);
  const [editMov, setEditMov] = useState<Movement | null>(null);
  const [editTipo, setEditTipo] = useState('2');
  const [editMonto, setEditMonto] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editMetodo, setEditMetodo] = useState('Efectivo');
  const [editCategoria, setEditCategoria] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMov, setPendingMov] = useState<Movement | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  function toast(msg: string, type: 'ok' | 'err' = 'ok') {
    const id = ++toastId.current;
    setToasts(previous => [...previous, { id, msg, type }]);
    setTimeout(() => setToasts(previous => previous.filter(item => item.id !== id)), 3500);
  }

  const fetchData = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw new Error('No se pudo comprobar tu sesión. Vuelve a iniciar sesión.');
    const [movements, profile, categories] = await Promise.all([
      reader.movements(session.user.id), reader.profile(session.user.id),
      readAllPages(async (from, to) => {
        const { data, error } = await supabase.from('categorias').select('id_categoria, nombre_categoria')
          .or('id_usuario.eq.' + session.user.id + ',id_usuario.is.null')
          .order('id_categoria', { ascending: true }).range(from, to);
        if (error || !data) throw new Error('No se pudieron cargar las categorías.');
        return data;
      }),
    ]);
    return { movements, profile, categories };
  }, []);

  const applyData = useCallback((snapshot: Awaited<ReturnType<typeof fetchData>>) => {
    setMovimientos(snapshot.movements);
    setCurrency(snapshot.profile.codigo_moneda);
    setCategoriasLista(snapshot.categories);
    setLoadError('');
  }, []);

  async function refreshData() {
    setLoading(true);
    try { applyData(await fetchData()); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar los movimientos.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    fetchData().then(snapshot => { if (active) applyData(snapshot); })
      .catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar los movimientos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchData, applyData]);

  async function resolveCategory(name: string, userId: string): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = categoriasLista.find(item => item.nombre_categoria.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id_categoria;
    const { data, error } = await supabase.from('categorias')
      .insert([{ id_usuario: userId, nombre_categoria: trimmed }]).select('id_categoria').single();
    if (error || !data) throw new Error('No se pudo guardar la categoría. Revisa los datos e intenta de nuevo.');
    return data.id_categoria;
  }

  function validateDate(date: string) {
    if (!isCivilDate(date)) throw new Error('Selecciona una fecha válida.');
    if (date > civilToday()) throw new Error('Registra la operación cuando ocurra. Usa una recurrencia para planificarla.');
  }

  function abrirEditar(movement: Movement) {
    setFormError('');
    if (movement.id_ocurrencia) { router.push('/dashboard/recurrencias'); return; }
    setEditMov(movement);
    setEditTipo(String(movement.id_tipo));
    setEditMonto(String(movement.monto_transaccion));
    setEditDescripcion(movement.descripcion_detalle ?? '');
    setEditMetodo(movement.metodo_pago ?? 'Efectivo');
    setEditCategoria(movement.categorias?.nombre_categoria ?? '');
    setEditFecha(movement.fecha_operacion.split('T')[0]);
  }

  async function handleActualizar(event: React.FormEvent) {
    event.preventDefault();
    if (!editMov || submitLock.current) return;
    submitLock.current = true;
    setIsEditSubmitting(true);
    setFormError('');
    try {
      const cents = amountToCents(editMonto);
      validateDate(editFecha);
      if (!editDescripcion.trim()) throw new Error('La descripción es obligatoria.');
      if (![1, 2, 3, 4].includes(Number(editTipo))) throw new Error('Tipo de movimiento inválido.');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const categoryId = await resolveCategory(editCategoria, session.user.id);
      const { data, error } = await supabase.from('movimientos').update({
        id_tipo: Number(editTipo), monto_transaccion: centsToDecimal(cents),
        metodo_pago: editMetodo, id_categoria: categoryId, fecha_operacion: editFecha,
        descripcion_detalle: editDescripcion.trim(),
      }).eq('id_movimiento', editMov.id_movimiento).eq('id_usuario', session.user.id).select('id_movimiento').single();
      if (error || !data) throw new Error('No se pudo actualizar el movimiento. Comprueba tus permisos.');
      setEditMov(null);
      toast('Movimiento actualizado.');
      await refreshData();
    } catch (error) {
      const message=error instanceof Error ? error.message : 'No se pudo actualizar el movimiento.';
      setFormError(message); toast(message, 'err');
    } finally {
      submitLock.current = false;
      setIsEditSubmitting(false);
    }
  }

  function handleEliminar(movement: Movement) {
    setDeleteError('');
    if (movement.id_ocurrencia) { router.push('/dashboard/recurrencias'); return; }
    setPendingMov(movement);
    setConfirmOpen(true);
  }

  async function confirmarEliminar() {
    if (!pendingMov || submitLock.current) return;
    const movement = pendingMov;
    submitLock.current = true;
    setDeleteBusy(true); setDeleteError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data, error } = await supabase.from('movimientos').delete()
        .eq('id_movimiento', movement.id_movimiento).eq('id_usuario', session.user.id).select('id_movimiento');
      if (error || !data?.length) throw new Error('No se pudo eliminar el movimiento. Comprueba tus permisos.');
      setConfirmOpen(false); setPendingMov(null);
      toast('Movimiento eliminado.');
      await refreshData();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'No se pudo eliminar el movimiento.');
    } finally {
      submitLock.current = false;
      setDeleteBusy(false);
    }
  }

  function cancelarEliminar() { setConfirmOpen(false); setPendingMov(null); }

  async function handleGuardar(event: React.FormEvent) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setIsSubmitting(true);
    setFormError('');
    try {
      const cents = amountToCents(monto);
      validateDate(fechaOperacion);
      if (!descripcion.trim()) throw new Error('La descripción es obligatoria.');
      if (!['1', '2'].includes(tipoMovimiento)) throw new Error('Tipo de movimiento inválido.');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const categoryId = await resolveCategory(categoria, session.user.id);
      const { error } = await supabase.from('movimientos').insert([{
        id_usuario: session.user.id, id_tipo: Number(tipoMovimiento), id_categoria: categoryId,
        monto_transaccion: centsToDecimal(cents), metodo_pago: metodoPago, fecha_operacion: fechaOperacion,
        descripcion_detalle: descripcion.trim(), es_automatico: false,
      }]);
      if (error) throw new Error('No se pudo guardar el movimiento.');
      setIsModalOpen(false);
      setMonto(''); setDescripcion(''); setCategoria(''); setMetodoPago('Efectivo');
      setFechaOperacion(civilToday());
      toast('Movimiento guardado.');
      await refreshData();
    } catch (error) {
      const message=error instanceof Error ? error.message : 'No se pudo guardar el movimiento.';
      setFormError(message); toast(message, 'err');
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  function fields(editing:boolean){
    const type=editing?editTipo:tipoMovimiento,amount=editing?editMonto:monto,detail=editing?editDescripcion:descripcion;
    const payment=editing?editMetodo:metodoPago,category=editing?editCategoria:categoria,date=editing?editFecha:fechaOperacion;
    return <>
      <div className="form-grid"><label className="field-label">Tipo<select className="field" value={type} onChange={e=>(editing?setEditTipo:setTipoMovimiento)(e.target.value)}><option value="1">Ingreso</option><option value="2">Egreso</option>{editing&&<><option value="3">Inversión</option><option value="4">Transferencia</option></>}</select></label><label className="field-label">Importe ({currency})<input autoFocus className="field" type="number" min="0.01" max="9999999999999.99" step="0.01" required value={amount} onChange={e=>(editing?setEditMonto:setMonto)(e.target.value)}/></label></div>
      <div className="form-grid"><label className="field-label">Método de pago<select className="field" value={payment} onChange={e=>(editing?setEditMetodo:setMetodoPago)(e.target.value)}><option>Efectivo</option><option>Transferencia</option>{!['Efectivo','Transferencia'].includes(payment)&&<option>{payment}</option>}</select></label><label className="field-label">Categoría<input className="field" list="movement-categories" value={category} onChange={e=>(editing?setEditCategoria:setCategoria)(e.target.value)} placeholder="Elige o escribe una categoría"/><datalist id="movement-categories">{categoriasLista.map(c=><option key={c.id_categoria} value={c.nombre_categoria}/>)}</datalist></label></div>
      <label className="field-label">Fecha de la operación<input className="field" type="date" min="1000-01-01" max={civilToday()} required value={date} onChange={e=>(editing?setEditFecha:setFechaOperacion)(e.target.value)}/></label>
      <label className="field-label">Descripción<input className="field" required value={detail} onChange={e=>(editing?setEditDescripcion:setDescripcion)(e.target.value)} placeholder="Ej.: compra de mercado"/></label>
      {!editing&&<p className="form-hint">Para planificar un pago futuro, crea una regla en <Link className="underline text-accent" href="/dashboard/recurrencias">Recurrencias</Link>.</p>}
    </>;
  }
  const visible=movimientos.filter(m=>`${m.descripcion_detalle||''} ${m.categorias?.nombre_categoria||''} ${m.metodo_pago||''}`.toLowerCase().includes(searchTerm.toLowerCase()));
  return <div className="space-y-6">
    <header className="page-heading"><div><h1>Movimientos</h1><p>Lo que entra, lo que sale y la historia detrás de cada movimiento.</p></div><button className="button-primary" disabled={loading||!!loadError} onClick={()=>{setFormError('');setIsModalOpen(true);}}><Plus size={18}/>Nuevo movimiento</button></header>
    {loadError&&<p role="alert" className="feedback error">{loadError}<button className="ml-3 underline" onClick={()=>void refreshData()}>Volver a cargar</button></p>}
    <div className="panel flex flex-wrap items-center justify-between gap-4"><label className="flex w-full max-w-md items-center gap-3"><Search size={18} className="text-muted"/><span className="sr-only">Buscar movimientos</span><input className="field" type="search" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Buscar por descripción, categoría o método"/></label><span className="text-sm text-muted">{visible.length} movimiento(s)</span></div>
    {loading?<p role="status" className="panel">Cargando tus movimientos…</p>:!loadError&&<div className="movement-list">
      {!visible.length&&<div className="panel text-center"><ArrowLeftRight className="mx-auto mb-4 text-accent" size={28}/><h2 className="text-lg font-semibold">Tu historial empieza aquí</h2><p className="mt-2 text-sm text-muted">{searchTerm?'No hay resultados para esta búsqueda.':'Registra un ingreso o gasto para empezar a ver tus finanzas con claridad.'}</p></div>}
      {visible.map(m=>{const sign=movementSign(m.id_tipo);return <article key={m.id_movimiento} className="movement-row"><time className="movement-date" dateTime={m.fecha_operacion.slice(0,10)}>{m.fecha_operacion.slice(0,10)}</time><div className="movement-detail"><strong>{m.descripcion_detalle||'Sin descripción'}</strong><p>{m.categorias?.nombre_categoria||'Sin categoría'} · {m.metodo_pago||'Sin método'}{m.id_ocurrencia?' · Recurrente':''}</p></div><span className={`movement-amount ${sign>0?'text-accent':sign<0?'text-danger':'text-muted'}`}>{sign>0?'+ ':sign<0?'− ':''}{formatAmount(m.monto_transaccion,currency)}</span><div className="movement-actions">{m.id_ocurrencia?<Link className="button-secondary" href="/dashboard/recurrencias">Gestionar</Link>:<><button className="icon-button" aria-label={`Editar ${m.descripcion_detalle||'movimiento'}`} onClick={()=>abrirEditar(m)}><Pencil size={17}/></button><button className="icon-button text-danger" aria-label={`Eliminar ${m.descripcion_detalle||'movimiento'}`} onClick={()=>handleEliminar(m)}><Trash2 size={17}/></button></>}</div></article>;})}
    </div>}
    {isModalOpen&&<Dialog title="Nuevo movimiento" description="Registra una operación que ya ocurrió." onClose={()=>setIsModalOpen(false)} busy={isSubmitting}>{formError&&<p role="alert" className="feedback error mb-4">{formError}</p>}<form onSubmit={handleGuardar}><fieldset disabled={isSubmitting} className="form-stack">{fields(false)}<div className="dialog-actions"><button className="button-secondary" type="button" onClick={()=>setIsModalOpen(false)}>Cancelar</button><button className="button-primary" type="submit">{isSubmitting?'Guardando…':'Guardar movimiento'}</button></div></fieldset></form></Dialog>}
    {editMov&&<Dialog title="Editar movimiento" onClose={()=>setEditMov(null)} busy={isEditSubmitting}>{formError&&<p role="alert" className="feedback error mb-4">{formError}</p>}<form onSubmit={handleActualizar}><fieldset disabled={isEditSubmitting} className="form-stack">{fields(true)}<div className="dialog-actions"><button className="button-secondary" type="button" onClick={()=>setEditMov(null)}>Cancelar</button><button className="button-primary" type="submit">{isEditSubmitting?'Guardando…':'Guardar cambios'}</button></div></fieldset></form></Dialog>}
    <ConfirmModal open={confirmOpen} busy={deleteBusy} error={deleteError} title="¿Eliminar este movimiento?" message="Se retirará de tu historial y se actualizará el saldo. Esta acción no se puede deshacer." confirmText="Sí, eliminar" onConfirm={confirmarEliminar} onCancel={cancelarEliminar}/>
    <div className="fixed bottom-5 right-5 left-5 z-[400] ml-auto flex max-w-md flex-col gap-2">{toasts.map(t=><p key={t.id} role={t.type==='err'?'alert':'status'} className={t.type==='err'?'feedback error':'feedback'}>{t.msg}</p>)}</div>
  </div>;
}
