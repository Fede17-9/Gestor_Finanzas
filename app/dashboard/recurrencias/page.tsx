"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { createFinanceReader } from '@/lib/finance-data';
import { amountToCents, centsToDecimal, formatAmount, isCivilDate, readAllPages } from '@/lib/finance';
import {
  Repeat, Search, X, Pencil, Trash2, Pause, Play,
  TrendingUp, TrendingDown, AlertTriangle,
  Loader2, Zap
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Recurrencia {
  id_recurrencia: string;
  id_usuario: string;
  id_tipo: number;
  id_categoria: string | null;
  monto_recurrente: number | string;
  frecuencia: string;
  dia_ejecucion: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado_activo: boolean;
  categorias?: { nombre_categoria: string } | null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm " +
  "focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] " +
  "transition-all placeholder-zinc-600 [color-scheme:dark]";
const labelCls =
  "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1";

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecurrenciasPage() {
  const router = useRouter();
  const toastId = useRef(0);

  const [userId, setUserId]               = useState<string | null>(null);
  const [recurrencias, setRecurrencias]   = useState<Recurrencia[]>([]);
  const [loading, setLoading]             = useState(true);
  const [currency, setCurrency]           = useState('COP');
  const [loadError, setLoadError]         = useState('');
  const [searchTerm, setSearchTerm]       = useState("");
  const [toasts, setToasts]               = useState<{ id: number; msg: string; type: "ok" | "err" }[]>([]);

  // ── Modal Editar ──────────────────────────────────────────────────────────
  const [editRec, setEditRec]             = useState<Recurrencia | null>(null);
  const [eMonto, setEMonto]               = useState("");
  const [eFrecuencia, setEFrecuencia]     = useState("Mensual");
  const [eFechaInicio, setEFechaInicio]   = useState("");
  const [eFechaFin, setEFechaFin]         = useState("");
  const [isSaving, setIsSaving]           = useState(false);

  // ── Modal Confirmar ───────────────────────────────────────────────────────
  const [confirmOpen, setConfirmOpen]     = useState(false);
  const [confirmMsg, setConfirmMsg]       = useState({ title: "", message: "", variant: "danger" as "danger" | "success" });
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  // ── Toast ─────────────────────────────────────────────────────────────────
  function toast(msg: string, type: "ok" | "err" = "ok") {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadData = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const [profile, rules] = await Promise.all([
        createFinanceReader(supabase).profile(uid),
        readAllPages(async (from, to) => {
          const { data, error } = await supabase.from('config_recurrencias').select('*, categorias(nombre_categoria)')
            .eq('id_usuario', uid).order('fecha_inicio', { ascending: false })
            .order('id_recurrencia', { ascending: true }).range(from, to).returns<Recurrencia[]>();
          if (error || !data) throw new Error('No se pudieron cargar las reglas.');
          return data;
        }),
      ]);
      setCurrency(profile.codigo_moneda);
      setRecurrencias(rules);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar las reglas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);
      loadData(session.user.id);
    });
  }, [router, loadData]);

  // ── Confirm helper ────────────────────────────────────────────────────────
  function askConfirm(title: string, message: string, variant: "danger" | "success", action: () => Promise<void>) {
    setConfirmMsg({ title, message, variant });
    setPendingAction(() => action);
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    setConfirmOpen(false);
    if (pendingAction) await pendingAction();
    setPendingAction(null);
  }

  // ── Pausar / Reactivar ────────────────────────────────────────────────────
  function toggleEstado(rec: Recurrencia) {
    const next = !rec.estado_activo;
    askConfirm(
      next ? "Reactivar recurrencia" : "Pausar recurrencia",
      next
        ? `¿Reactivar "${rec.categorias?.nombre_categoria ?? "Sin categoría"}"? Volverá a aparecer en las proyecciones.`
        : `¿Pausar "${rec.categorias?.nombre_categoria ?? "Sin categoría"}"? Se ocultará de las proyecciones mientras esté inactiva.`,
      next ? "success" : "danger",
      async () => {
        const { error } = await supabase
          .from("config_recurrencias")
          .update({ estado_activo: next })
          .eq("id_recurrencia", rec.id_recurrencia)
          .eq("id_usuario", rec.id_usuario);
        if (error) {
          toast("No se pudo cambiar el estado.", "err");
        } else {
          toast(next ? "Recurrencia reactivada." : "Recurrencia pausada.");
          if (userId) loadData(userId);
        }
      }
    );
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  function eliminarRec(rec: Recurrencia) {
    askConfirm(
      "Eliminar regla recurrente",
      `Se eliminará la regla "${rec.categorias?.nombre_categoria ?? "Sin categoría"}". Los movimientos históricos generados por esta regla NO serán eliminados.`,
      "danger",
      async () => {
        const { data, error } = await supabase
          .from("config_recurrencias")
          .delete()
          .eq("id_recurrencia", rec.id_recurrencia)
          .eq("id_usuario", rec.id_usuario)
          .select();

        if (error) {
          toast("No se pudo eliminar la regla.", "err");
        } else if (!data || data.length === 0) {
          toast("No se encontró la regla o no tienes permiso para eliminarla.", "err");
        } else {
          toast("Regla eliminada. Historial de movimientos intacto.");
          if (userId) loadData(userId);
        }
      }
    );
  }

  // ── Abrir editar ──────────────────────────────────────────────────────────
  function abrirEditar(rec: Recurrencia) {
    setEditRec(rec);
    setEMonto(String(rec.monto_recurrente));
    setEFrecuencia(rec.frecuencia);
    setEFechaInicio(rec.fecha_inicio);
    setEFechaFin(rec.fecha_fin ?? "");
  }

  // ── Guardar edición ───────────────────────────────────────────────────────
  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    if (!editRec) return;
    let monto: string;
    try {
      monto = centsToDecimal(amountToCents(eMonto));
      if (!isCivilDate(eFechaInicio)) throw new Error('La fecha de inicio no es válida.');
      if (eFechaFin && (!isCivilDate(eFechaFin) || eFechaFin < eFechaInicio)) throw new Error('La fecha final no puede ser anterior al inicio.');
      if (!['Diario', 'Semanal', 'Mensual', 'Anual'].includes(eFrecuencia)) throw new Error('Frecuencia inválida.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Datos inválidos.', 'err');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from("config_recurrencias")
      .update({
        monto_recurrente: monto,
        frecuencia: eFrecuencia,
        fecha_inicio: eFechaInicio,
        fecha_fin: eFechaFin || null,
      })
      .eq("id_recurrencia", editRec.id_recurrencia)
      .eq("id_usuario", editRec.id_usuario);

    if (error) {
      toast("No se pudo actualizar la regla.", "err");
    } else {
      toast("Regla actualizada correctamente.");
      setEditRec(null);
      if (userId) loadData(userId);
    }
    setIsSaving(false);
  }

  // ── Filtrado en memoria ───────────────────────────────────────────────────
  const q = searchTerm.toLowerCase().trim();
  const filtered = q
    ? recurrencias.filter(r => {
        const cat = r.categorias?.nombre_categoria ?? "Sin categoría";
        const tipo = r.id_tipo === 1 ? "ingreso" : "egreso";
        return (
          cat.toLowerCase().includes(q) ||
          r.frecuencia.toLowerCase().includes(q) ||
          tipo.includes(q) ||
          String(r.monto_recurrente).includes(q)
        );
      })
    : recurrencias;

  // ── Helpers visuales ──────────────────────────────────────────────────────
  function fmtMoney(n: number | string) {
    return formatAmount(n, currency);
  }
  function fmtFecha(f: string | null) {
    if (!f) return "—";
    const [y, m, d] = f.split("-");
    return `${d}/${m}/${y}`;
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loadError) return <div role="alert" className="text-red-300 p-6">
    {loadError}
    <button className="block mt-4 underline" onClick={() => { if (userId) void loadData(userId); }}>Volver a cargar</button>
  </div>;
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-[#39FF14] font-mono tracking-widest animate-pulse">
        <Loader2 size={40} className="animate-spin" />
        <span>CARGANDO REGLAS...</span>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto pb-12 relative">

      {/* Toasts */}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest shadow-2xl border pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300 ${
            t.type === "ok"
              ? "bg-[#09090b] border-[#39FF14]/40 text-[#39FF14]"
              : "bg-[#09090b] border-[#ff3939]/40 text-[#ff3939]"
          }`}>{t.msg}</div>
        ))}
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-widest uppercase flex items-center gap-3">
          <Repeat className="text-[#39FF14]" size={30} strokeWidth={2.5} />
          Recurrencias
        </h1>
        <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest mt-2 border-l-2 border-[#39FF14] pl-3 py-0.5">
          Reglas de automatización del motor de sincronización
        </p>
      </div>

      {/* Advertencia motor */}
      <div className="flex items-start gap-3 bg-yellow-400/5 border border-yellow-400/20 rounded-2xl p-4 mb-6">
        <Zap size={16} className="text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-yellow-400/80 font-mono leading-relaxed">
          Estas reglas se usan para las proyecciones del calendario. El registro automático está temporalmente desactivado.
          Registra cada pago o cobro cuando ocurra; editar una regla no modifica los movimientos históricos.
        </p>
      </div>

      {/* Buscador */}
      <div className="bg-[#09090b] border border-zinc-800/50 p-4 rounded-2xl mb-6 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800 group-hover:bg-[#39FF14] transition-colors duration-500" />
        <div className="relative flex items-center gap-3 pl-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="BUSCAR REGLA..."
              className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-xs font-mono tracking-wider px-10 py-3.5 rounded-xl focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] outline-none transition-all placeholder-zinc-600"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest whitespace-nowrap shrink-0">
            {searchTerm ? `${filtered.length} resultado(s)` : `${recurrencias.length} regla(s)`}
          </span>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-[#09090b] border border-zinc-800/50 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/30 to-transparent" />

        {recurrencias.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 gap-3 text-zinc-600">
            <Repeat size={32} className="text-zinc-800" />
            <p className="font-mono text-sm uppercase tracking-widest">Sin reglas activas</p>
            <p className="font-mono text-[9px] tracking-widest">Crea una desde Movimientos activando el toggle de recurrencia.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 gap-3 text-zinc-600">
            <Search size={28} className="text-zinc-800" />
            <p className="font-mono text-sm uppercase tracking-widest text-zinc-600">Sin resultados</p>
            <button onClick={() => setSearchTerm("")} className="text-[10px] font-bold text-[#39FF14] uppercase tracking-widest hover:text-white transition-colors mt-2">
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase font-bold tracking-widest bg-zinc-900/30">
                  <th className="p-4 pl-6">Categoría / Tipo</th>
                  <th className="p-4">Frecuencia</th>
                  <th className="p-4 text-right">Monto</th>
                  <th className="p-4">Inicio → Fin</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center w-36">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rec => {
                  const isIngreso = rec.id_tipo === 1;
                  const cat = rec.categorias?.nombre_categoria ?? "Sin categoría";
                  return (
                    <tr key={rec.id_recurrencia} className="border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors group">
                      {/* Cat / Tipo */}
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-2">
                          {isIngreso
                            ? <TrendingUp size={14} className="text-[#39FF14] shrink-0" />
                            : <TrendingDown size={14} className="text-[#ff3939] shrink-0" />}
                          <div>
                            <p className="text-sm font-bold text-zinc-200">{cat}</p>
                            <p className={`text-[9px] font-mono tracking-widest uppercase ${isIngreso ? "text-[#39FF14]" : "text-[#ff3939]"}`}>
                              {isIngreso ? "Ingreso" : "Egreso"}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Frecuencia */}
                      <td className="p-4 font-mono text-xs text-zinc-400">
                        {rec.frecuencia}
                        {rec.frecuencia === "Mensual" && (
                          <span className="text-zinc-600 text-[9px] ml-1">día {rec.dia_ejecucion}</span>
                        )}
                      </td>
                      {/* Monto */}
                      <td className={`p-4 text-right font-mono font-bold text-base ${isIngreso ? "text-[#39FF14]" : "text-white"}`}>
                        {isIngreso ? "+" : "-"}{fmtMoney(rec.monto_recurrente)}
                      </td>
                      {/* Fechas */}
                      <td className="p-4 font-mono text-[10px] text-zinc-500">
                        {fmtFecha(rec.fecha_inicio)} → {fmtFecha(rec.fecha_fin)}
                      </td>
                      {/* Estado */}
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border ${
                          rec.estado_activo
                            ? "bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/20"
                            : "bg-zinc-800/50 text-zinc-500 border-zinc-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${rec.estado_activo ? "bg-[#39FF14] shadow-[0_0_6px_rgba(57,255,20,0.8)]" : "bg-zinc-600"}`} />
                          {rec.estado_activo ? "Activa" : "Pausada"}
                        </span>
                      </td>
                      {/* Acciones */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {/* Editar */}
                          <button
                            onClick={() => abrirEditar(rec)}
                            title="Editar regla"
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
                          >
                            <Pencil size={12} />
                          </button>
                          {/* Pausar / Reactivar */}
                          <button
                            onClick={() => toggleEstado(rec)}
                            title={rec.estado_activo ? "Pausar" : "Reactivar"}
                            className={`p-1.5 rounded-lg transition-all ${
                              rec.estado_activo
                                ? "bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 border border-yellow-400/20"
                                : "bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14]/20 border border-[#39FF14]/20"
                            }`}
                          >
                            {rec.estado_activo ? <Pause size={12} /> : <Play size={12} />}
                          </button>
                          {/* Eliminar */}
                          <button
                            onClick={() => eliminarRec(rec)}
                            title="Eliminar regla"
                            className="p-1.5 rounded-lg bg-[#ff3939]/10 hover:bg-[#ff3939]/20 text-[#ff3939] border border-[#ff3939]/20 hover:border-[#ff3939]/40 transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ Modal Editar ══ */}
      {editRec && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={e => { if (e.target === e.currentTarget) setEditRec(null); }}>
          <div className="bg-[#09090b] border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(57,255,20,0.08)] relative">
            <div className="absolute top-0 left-0 w-full h-[1px] rounded-t-3xl bg-gradient-to-r from-transparent via-[#39FF14]/30 to-transparent" />
            <button onClick={() => setEditRec(null)} className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors">
              <X size={18} />
            </button>

            <h2 className="text-base font-black text-white uppercase tracking-widest mb-1 border-b border-zinc-800 pb-4 flex items-center gap-2">
              <Pencil size={14} className="text-[#39FF14]" /> Editar Regla
            </h2>

            {/* Info no editable */}
            <div className="mt-4 mb-4 p-3 bg-zinc-900/60 border border-zinc-800/60 rounded-xl">
              <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest mb-2">Campos protegidos (motor)</p>
              <div className="flex items-center gap-2">
                {editRec.id_tipo === 1
                  ? <TrendingUp size={12} className="text-[#39FF14]" />
                  : <TrendingDown size={12} className="text-[#ff3939]" />}
                <span className="text-xs text-zinc-400 font-bold">
                  {editRec.categorias?.nombre_categoria ?? "Sin categoría"} · {editRec.id_tipo === 1 ? "Ingreso" : "Egreso"} · Día {editRec.dia_ejecucion}
                </span>
              </div>
            </div>

            {/* Advertencia */}
            <div className="flex items-start gap-2 bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-3 mb-4">
              <AlertTriangle size={12} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-[9px] text-yellow-400/70 font-mono leading-relaxed">
                Cambiar frecuencia o fechas modifica la proyección, sin crear ni borrar movimientos registrados.
              </p>
            </div>

            <form onSubmit={handleGuardar} className="flex flex-col gap-4">
              {/* Monto */}
              <div>
                <label className={labelCls}>Monto *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">$</span>
                  <input type="number" step="0.01" required value={eMonto} onChange={e => setEMonto(e.target.value)}
                    className={inputCls + " pl-8"} placeholder="0" />
                </div>
              </div>

              {/* Frecuencia */}
              <div>
                <label className={labelCls}>Frecuencia *</label>
                <select value={eFrecuencia} onChange={e => setEFrecuencia(e.target.value)} className={inputCls}>
                  <option value="Diario">Diario</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Mensual">Mensual</option>
                  <option value="Anual">Anual</option>
                </select>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fecha inicio *</label>
                  <input type="date" required value={eFechaInicio} onChange={e => setEFechaInicio(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Fecha fin</label>
                  <input type="date" value={eFechaFin} onChange={e => setEFechaFin(e.target.value)} className={inputCls} />
                </div>
              </div>

              <button type="submit" disabled={isSaving}
                className="w-full bg-[#39FF14] text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl hover:bg-[#a3e635] hover:shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isSaving ? <><Loader2 size={14} className="animate-spin" /> GUARDANDO...</> : "GUARDAR CAMBIOS"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══ ConfirmModal ══ */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmMsg.title}
        message={confirmMsg.message}
        confirmText="Confirmar"
        cancelText="Cancelar"
        confirmVariant={confirmMsg.variant}
        onConfirm={handleConfirm}
        onCancel={() => { setConfirmOpen(false); setPendingAction(null); }}
      />

    </div>
  );
}
