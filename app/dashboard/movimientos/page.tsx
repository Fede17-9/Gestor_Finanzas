"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { createFinanceReader } from '@/lib/finance-data';
import { amountToCents, centsToDecimal, civilToday, formatAmount, isCivilDate, movementSign, readAllPages } from '@/lib/finance';
import type { Category, Movement } from '@/lib/finance';
import { ArrowLeftRight, Plus, Calendar, Search, X, TrendingUp, TrendingDown, Layers, CreditCard, Repeat, Zap, Pencil, Trash2, AlertTriangle } from 'lucide-react';
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
  const [isRecurrente, setIsRecurrente] = useState(false);
  const [frecuencia, setFrecuencia] = useState('Mensual');
  const [diaEjecucion, setDiaEjecucion] = useState('1');
  const [fechaFin, setFechaFin] = useState('');
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
          .order('id_categoria', { ascending: true }).range(from, to).returns<Category[]>();
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
      toast(error instanceof Error ? error.message : 'No se pudo actualizar el movimiento.', 'err');
    } finally {
      submitLock.current = false;
      setIsEditSubmitting(false);
    }
  }

  function handleEliminar(movement: Movement) {
    setPendingMov(movement);
    setConfirmOpen(true);
  }

  async function confirmarEliminar() {
    setConfirmOpen(false);
    if (!pendingMov || submitLock.current) return;
    const movement = pendingMov;
    submitLock.current = true;
    setPendingMov(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data, error } = await supabase.from('movimientos').delete()
        .eq('id_movimiento', movement.id_movimiento).eq('id_usuario', session.user.id).select('id_movimiento');
      if (error || !data?.length) throw new Error('No se pudo eliminar el movimiento. Comprueba tus permisos.');
      toast('Movimiento eliminado.');
      await refreshData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo eliminar el movimiento.', 'err');
    } finally {
      submitLock.current = false;
    }
  }

  function cancelarEliminar() { setConfirmOpen(false); setPendingMov(null); }

  async function handleGuardar(event: React.FormEvent) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setIsSubmitting(true);
    try {
      const cents = amountToCents(monto);
      validateDate(fechaOperacion);
      if (!descripcion.trim()) throw new Error('La descripción es obligatoria.');
      if (!['1', '2'].includes(tipoMovimiento)) throw new Error('Tipo de movimiento inválido.');
      if (isRecurrente) {
        if (!['Diario', 'Semanal', 'Mensual', 'Anual'].includes(frecuencia)) throw new Error('Frecuencia inválida.');
        if (fechaFin && (!isCivilDate(fechaFin) || fechaFin < fechaOperacion)) throw new Error('La fecha final no puede ser anterior al inicio.');
        if (frecuencia === 'Mensual' && (!Number.isInteger(Number(diaEjecucion)) || Number(diaEjecucion) < 1 || Number(diaEjecucion) > 31)) {
          throw new Error('El día mensual debe estar entre 1 y 31.');
        }
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const categoryId = await resolveCategory(categoria, session.user.id);
      const { error } = await supabase.from('movimientos').insert([{
        id_usuario: session.user.id, id_tipo: Number(tipoMovimiento), id_categoria: categoryId,
        monto_transaccion: centsToDecimal(cents), metodo_pago: metodoPago, fecha_operacion: fechaOperacion,
        descripcion_detalle: descripcion.trim(), es_automatico: false,
      }]);
      if (error) throw new Error('No se pudo guardar el movimiento.');
      let recurrenceFailed = false;
      if (isRecurrente) {
        const { error: recurrenceError } = await supabase.from('config_recurrencias').insert([{
          id_usuario: session.user.id, id_tipo: Number(tipoMovimiento), id_categoria: categoryId,
          monto_recurrente: centsToDecimal(cents), frecuencia,
          dia_ejecucion: frecuencia === 'Mensual' ? Number(diaEjecucion) : Number(fechaOperacion.slice(8, 10)),
          fecha_inicio: fechaOperacion, fecha_fin: fechaFin || null,
        }]);
        recurrenceFailed = Boolean(recurrenceError);
      }
      setIsModalOpen(false);
      setMonto(''); setDescripcion(''); setCategoria(''); setMetodoPago('Efectivo');
      setFechaOperacion(civilToday()); setIsRecurrente(false); setFrecuencia('Mensual');
      setDiaEjecucion('1'); setFechaFin('');
      toast(recurrenceFailed ? 'El movimiento se guardó, pero la regla no pudo crearse. No repitas el movimiento.' : 'Movimiento guardado.',
        recurrenceFailed ? 'err' : 'ok');
      await refreshData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo guardar el movimiento.', 'err');
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto pb-10 animate-in fade-in duration-500 relative">

      {loadError && <div role="alert" className="mb-4 p-4 text-red-300 border border-red-400/30 rounded-xl">
        {loadError}<button className="block underline mt-2" onClick={() => void refreshData()}>Volver a cargar</button>
      </div>}
      {/* Header de Interfaz */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-widest uppercase flex items-center gap-3">
            <ArrowLeftRight className="text-[#39FF14]" size={30} strokeWidth={2.5} />
            Transacciones
          </h1>
          <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest mt-2 border-l-2 border-[#39FF14] pl-3 py-0.5">
            Registro cifrado del Flujo de Caja
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#39FF14] text-black font-black uppercase tracking-widest text-[11px] px-6 py-3.5 rounded-xl hover:bg-[#a3e635] hover:shadow-[0_0_20px_rgba(57,255,20,0.3)] transition-all active:scale-95"
        >
          <Plus size={16} strokeWidth={3} />
          Nuevo Registro
        </button>
      </div>

      {/* Panel de Comandos */}
      <div className="bg-[#09090b] border border-zinc-800/50 p-4 rounded-2xl flex flex-col xl:flex-row gap-4 mb-6 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800 group-hover:bg-[#39FF14] transition-colors duration-500"></div>
        <div className="flex-1 relative pl-2 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="BUSCAR OPERACIÓN..."
              className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-xs font-mono tracking-wider px-12 py-3.5 rounded-xl focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] outline-none transition-all placeholder-zinc-600 shadow-inner"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                title="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            )}
          </div>
          {/* Contador de resultados */}
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest whitespace-nowrap shrink-0">
            {searchTerm
              ? `${movimientos.filter((mov) => {
                const q = searchTerm.toLowerCase().trim();
                const categoria = mov.categorias?.nombre_categoria ?? "";
                const descripcion = mov.descripcion_detalle ?? "";
                const metodo = mov.metodo_pago ?? "";
                const monto = String(mov.monto_transaccion ?? "");
                const fecha = mov.fecha_operacion ?? "";
                const tipo = mov.id_tipo === 1 ? "ingreso" : "egreso";
                return (
                  categoria.toLowerCase().includes(q) ||
                  descripcion.toLowerCase().includes(q) ||
                  metodo.toLowerCase().includes(q) ||
                  monto.includes(q) ||
                  fecha.includes(q) ||
                  tipo.includes(q)
                );
              }).length} resultado(s)`
              : `${movimientos.length} registro(s)`}
          </span>
        </div>
      </div>

      {/* Tabla de Base de Datos */}
      <div className="bg-[#09090b] border border-zinc-800/50 rounded-2xl overflow-hidden shadow-2xl relative min-h-[300px] flex flex-col">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/30 to-transparent"></div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4 text-[#39FF14]">
            <div className="relative">
              <ArrowLeftRight size={32} className="animate-spin text-zinc-800" />
              <div className="absolute inset-0 border-t-2 border-[#39FF14] rounded-full animate-spin" style={{ animationDuration: '0.8s' }}></div>
            </div>
            <span className="font-mono text-[10px] tracking-widest uppercase animate-pulse">Desencriptando Módulo...</span>
          </div>
        ) : loadError ? <p className="p-8 text-zinc-400">No se muestran cifras incompletas. Vuelve a cargar los datos.</p> : movimientos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20 gap-2 text-zinc-500 bg-zinc-900/10">
            <span className="font-mono text-sm tracking-widest uppercase text-zinc-600">No hay registros activos</span>
            <span className="font-mono text-[9px] tracking-widest">Inyecta un nuevo registro para iniciar estadística</span>
          </div>
        ) : (() => {
          // Filtrado en memoria — no genera nuevas consultas a Supabase
          const q = searchTerm.toLowerCase().trim();
          const filteredMovimientos = q
            ? movimientos.filter((mov) => {
              const categoria = mov.categorias?.nombre_categoria ?? "";
              const descripcion = mov.descripcion_detalle ?? "";
              const metodo = mov.metodo_pago ?? "";
              const monto = String(mov.monto_transaccion ?? "");
              const fecha = mov.fecha_operacion ?? "";
              const tipo = mov.id_tipo === 1 ? "ingreso" : "egreso";
              return (
                categoria.toLowerCase().includes(q) ||
                descripcion.toLowerCase().includes(q) ||
                metodo.toLowerCase().includes(q) ||
                monto.includes(q) ||
                fecha.includes(q) ||
                tipo.includes(q)
              );
            })
            : movimientos;

          if (filteredMovimientos.length === 0) {
            return (
              <div className="flex-1 flex flex-col items-center justify-center p-20 gap-2 text-zinc-500 bg-zinc-900/10">
                <Search size={28} className="text-zinc-700 mb-2" />
                <span className="font-mono text-sm tracking-widest uppercase text-zinc-600">Sin resultados</span>
                <span className="font-mono text-[9px] tracking-widest">No se encontraron operaciones para esta búsqueda.</span>
                <button
                  onClick={() => setSearchTerm("")}
                  className="mt-4 text-[10px] font-bold text-[#39FF14] uppercase tracking-widest hover:text-white transition-colors"
                >
                  Limpiar búsqueda
                </button>
              </div>
            );
          }

          return (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase font-bold tracking-widest bg-zinc-900/30">
                    <th className="p-4 pl-6 w-32">Fecha</th>
                    <th className="p-4 min-w-[200px]">Detalle / Categoría</th>
                    <th className="p-4 w-40">Método / Ref</th>
                    <th className="p-4 text-right w-40">Monto</th>
                    <th className="p-4 text-center w-28">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovimientos.map((mov) => {
                    const [year, month, day] = mov.fecha_operacion.split('T')[0].split('-');
                    const fechaOp = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                    const fecha = fechaOp.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                    const sign = movementSign(mov.id_tipo);
                    const isIngreso = sign > 0;
                    const catNombre = mov.categorias?.nombre_categoria || "Sin categoría";

                    return (
                      <tr key={mov.id_movimiento} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors group">
                        <td className="p-4 pl-6 font-mono text-xs text-zinc-500 uppercase">{fecha}</td>
                        <td className="p-4 text-sm text-zinc-300 font-medium">
                          <div className="flex items-center gap-3">
                            {isIngreso ? <TrendingUp size={16} className="text-[#39FF14] shrink-0" /> : <TrendingDown size={16} className="text-[#ff3939] shrink-0" />}
                            <div className="flex flex-col">
                              <span className="flex items-center gap-2">
                                {mov.descripcion_detalle || 'Operación'}
                                {/* ⚡ Rayo si el registro nació de la máquina automática */}
                                {mov.es_automatico && (
                                  <span title="Generado por el sistema de forma automática" className="flex items-center">
                                    <Zap size={12} className="text-[#39FF14] fill-[#39FF14]" />
                                  </span>
                                )}
                              </span>
                              <span className="text-[9px] text-zinc-500 font-mono tracking-widest">{catNombre}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-[10px] text-zinc-400">
                          {mov.metodo_pago || 'Desconocido'}
                        </td>
                        <td className={`p-4 text-right font-mono font-bold tracking-tight text-lg ${isIngreso ? 'text-[#39FF14]' : 'text-white'}`}>
                          {sign > 0 ? '+' : sign < 0 ? '-' : ''}{formatAmount(mov.monto_transaccion, currency)}
                        </td>
                        {/* Columna Acciones */}
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() => abrirEditar(mov)}
                              title="Editar movimiento"
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleEliminar(mov)}
                              title="Eliminar movimiento"
                              className="p-1.5 rounded-lg bg-[#ff3939]/10 hover:bg-[#ff3939]/20 text-[#ff3939] border border-[#ff3939]/20 hover:border-[#ff3939]/40 transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* 🚀 Modal / Ventana Flotante Avanzada para Nuevo Registro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#09090b] border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(57,255,20,0.1)] relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-zinc-800 pb-4">
              NUEVA OPERACIÓN
            </h2>

            <form onSubmit={handleGuardar} className="flex flex-col gap-4">

              {/* Selector de Tipo */}
              <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800 gap-1">
                <button type="button" onClick={() => setTipoMovimiento("1")}
                  className={`flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase rounded-lg transition-all ${tipoMovimiento === "1" ? "bg-[#39FF14] text-black shadow-[0_0_15px_rgba(57,255,20,0.2)]" : "text-zinc-500 hover:text-zinc-300"}`}>
                  Ingreso (+)
                </button>
                <button type="button" onClick={() => setTipoMovimiento("2")}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${tipoMovimiento === "2" ? "bg-[#ff3939] text-white shadow-[0_0_15px_rgba(255,57,57,0.2)]" : "text-zinc-500 hover:text-zinc-300"}`}>
                  Egreso (-)
                </button>
              </div>

              {/* Monto */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Monto Transado</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                  <input type="number" min="0.01" max="9999999999999.99" step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-10 py-3 text-white focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] outline-none transition-all font-mono font-bold"
                    placeholder="0.00" />
                </div>
              </div>

              {/* Método de Pago y Categoría */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1">
                    <CreditCard size={12} /> Método
                  </label>
                  <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-white focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] outline-none transition-all text-xs">
                    <option value="Efectivo">Efectivo 💵</option>
                    <option value="Transferencia">Transferencia 🏦</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1">
                    <Layers size={12} /> Categoría
                  </label>
                  <input
                    type="text"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    list="categorias-list"
                    placeholder="Ej: Mesada"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-white focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] outline-none transition-all text-xs"
                  />
                  <datalist id="categorias-list">
                    {categoriasLista.map(cat => (
                      <option key={cat.id_categoria} value={cat.nombre_categoria} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Fecha y Descripción */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Fecha Operación</label>
                  <input type="date" required max={civilToday()} value={fechaOperacion} onChange={(e) => setFechaOperacion(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-[#39FF14] transition-all font-medium text-xs [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Descripción Breve</label>
                  <input type="text" required value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-[#39FF14] transition-all font-medium text-sm placeholder-zinc-600"
                    placeholder="Ej: Salario Quincena" />
                </div>
              </div>

              {/* Automátización / Recurrencia */}
              <div className="mt-2 border border-zinc-800 rounded-xl p-4 bg-zinc-900/50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={isRecurrente} onChange={(e) => setIsRecurrente(e.target.checked)} className="peer sr-only" />
                  <div className="w-10 h-5 bg-zinc-800 rounded-full peer-checked:bg-[#39FF14] relative transition-colors">
                    <div className="absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                  </div>
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <Repeat size={14} className={isRecurrente ? "text-[#39FF14]" : "text-zinc-600"} />
                    ¿Programar repetición?
                  </span>
                </label>

                {isRecurrente && (
                  <div className="mt-4 pt-4 border-t border-zinc-800/50 animate-in fade-in slide-in-from-top-2 flex flex-col gap-3">

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Frecuencia de Repetición</label>
                      <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none transition-all text-xs">
                        <option value="Diario">Diario</option>
                        <option value="Semanal">Semanal</option>
                        <option value="Mensual">Mensual</option>
                        <option value="Anual">Anual</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Calendar size={12} /> Día del mes (mensual)
                        </label>
                        <input type="number" min="1" max="31" disabled={frecuencia !== "Mensual"} required={frecuencia === "Mensual"} value={diaEjecucion} onChange={(e) => setDiaEjecucion(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none text-xs"
                          placeholder="1-31" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Fecha Fin (Opcional)</label>
                        <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-400 outline-none text-xs [color-scheme:dark]" />
                      </div>
                    </div>

                    <p className="text-[9px] text-zinc-500 font-mono mt-1 tracking-widest leading-relaxed">
                      La regla aparecerá en el calendario como proyección. El registro automático está temporalmente desactivado; registra cada pago o cobro cuando ocurra.
                    </p>
                  </div>
                )}
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-white text-black font-black uppercase tracking-widest text-[11px] py-4 mt-2 rounded-xl hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                {isSubmitting ? "PROCESANDO..." : "GRABAR EN BITÁCORA"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest shadow-2xl border pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300 ${t.type === 'ok'
              ? 'bg-[#09090b] border-[#39FF14]/40 text-[#39FF14]'
              : 'bg-[#09090b] border-[#ff3939]/40 text-[#ff3939]'
            }`}>{t.msg}</div>
        ))}
      </div>

      {/* ════════════════════════════════════════
          MODAL — Editar Movimiento
      ════════════════════════════════════════ */}
      {editMov && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#09090b] border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(57,255,20,0.1)] relative max-h-[90vh] overflow-y-auto">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/40 to-transparent" />
            <button onClick={() => setEditMov(null)} className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
            </button>

            <h2 className="text-lg font-black text-white uppercase tracking-widest mb-1 border-b border-zinc-800 pb-4 flex items-center gap-2">
              <Pencil size={16} className="text-[#39FF14]" /> Editar Operación
            </h2>

            {/* Advertencia movimiento automático */}
            {editMov.es_automatico && (
              <div className="flex items-start gap-2 bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-3 mb-4 mt-4">
                <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-yellow-400/80 font-mono tracking-widest leading-relaxed">
                  Movimiento automático: este cambio no modifica la regla recurrente.
                </p>
              </div>
            )}

            <form onSubmit={handleActualizar} className="flex flex-col gap-4 mt-4">
              {/* Tipo */}
              <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800 gap-1">
                <button type="button" onClick={() => setEditTipo("1")}
                  className={`flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase rounded-lg transition-all ${editTipo === "1" ? "bg-[#39FF14] text-black shadow-[0_0_15px_rgba(57,255,20,0.2)]" : "text-zinc-500 hover:text-zinc-300"
                    }`}>
                  Ingreso (+)
                </button>
                <button type="button" onClick={() => setEditTipo("2")}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${editTipo === "2" ? "bg-[#ff3939] text-white shadow-[0_0_15px_rgba(255,57,57,0.2)]" : "text-zinc-500 hover:text-zinc-300"
                    }`}>
                  Egreso (-)
                </button>
              </div>

              {/* Monto */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Monto *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                  <input type="number" min="0.01" max="9999999999999.99" step="0.01" required value={editMonto} onChange={e => setEditMonto(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-10 py-3 text-white focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] outline-none transition-all font-mono font-bold"
                    placeholder="0.00" />
                </div>
              </div>

              {/* Método y Categoría */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1"><CreditCard size={12} /> Método</label>
                  <select value={editMetodo} onChange={e => setEditMetodo(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-white focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] outline-none transition-all text-xs">
                    <option value="Efectivo">Efectivo 💵</option>
                    <option value="Transferencia">Transferencia 🏦</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1"><Layers size={12} /> Categoría</label>
                  <input type="text" value={editCategoria} onChange={e => setEditCategoria(e.target.value)}
                    list="edit-categorias-list" placeholder="Ej: Mesada"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-white focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] outline-none transition-all text-xs" />
                  <datalist id="edit-categorias-list">
                    {categoriasLista.map(cat => (
                      <option key={cat.id_categoria} value={cat.nombre_categoria} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Fecha y Descripción */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Fecha *</label>
                  <input type="date" required max={civilToday()} value={editFecha} onChange={e => setEditFecha(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-[#39FF14] transition-all font-medium text-xs [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Descripción *</label>
                  <input type="text" required value={editDescripcion} onChange={e => setEditDescripcion(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-[#39FF14] transition-all font-medium text-sm placeholder-zinc-600"
                    placeholder="Ej: Salario" />
                </div>
              </div>

              <button type="submit" disabled={isEditSubmitting}
                className="w-full bg-[#39FF14] text-black font-black uppercase tracking-widest text-xs py-4 mt-2 rounded-xl hover:bg-[#a3e635] hover:shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                {isEditSubmitting ? "ACTUALIZANDO..." : "GUARDAR CAMBIOS"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══ Modal de Confirmación de Eliminación ══ */}
      <ConfirmModal
        open={confirmOpen}
        title={pendingMov?.es_automatico ? "Eliminar movimiento automático" : "Eliminar movimiento"}
        message={
          pendingMov?.es_automatico
            ? "Este movimiento fue generado automáticamente. Si lo eliminas, solo se eliminará este registro puntual. La regla recurrente seguirá activa."
            : "¿Seguro que deseas eliminar este movimiento? Esta acción no se puede deshacer."
        }
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        confirmVariant="danger"
        onConfirm={confirmarEliminar}
        onCancel={cancelarEliminar}
      />

    </div>
  );
}
