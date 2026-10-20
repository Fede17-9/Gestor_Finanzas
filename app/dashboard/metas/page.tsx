"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Target, Plus, X, TrendingUp, Trash2, Pencil,
  CheckCircle2, Clock, AlertTriangle, Zap
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { createFinanceReader } from '@/lib/finance-data';
import { addCents, amountToCents, centsToDecimal, formatAmount, isCivilDate, readAllPages } from '@/lib/finance';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Meta {
  id_meta: string;
  id_usuario: string;
  nombre_meta: string;
  monto_objetivo: number;
  monto_actual: number;
  fecha_proyectada: string | null;
  prioridad_nivel: string | null;
  estado_meta: string;
}

type Prioridad = "Bajo" | "Medio" | "Alto";

const PRIORIDADES: Prioridad[] = ["Bajo", "Medio", "Alto"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(actual: number, objetivo: number): number {
  if (objetivo <= 0) return 0;
  return Math.min(100, Math.round((actual / objetivo) * 100));
}

function estadoMeta(actual: number, objetivo: number): string {
  return actual >= objetivo ? "Completada" : "En Progreso";
}

function prioridadColor(p: string | null) {
  if (p === "Alto") return "text-[#ff3939] border-[#ff3939]/40 bg-[#ff3939]/10";
  if (p === "Medio") return "text-yellow-400 border-yellow-400/40 bg-yellow-400/10";
  return "text-zinc-400 border-zinc-700 bg-zinc-800/50";
}

function barColor(p: number) {
  if (p >= 100) return "bg-[#39FF14]";
  if (p >= 60) return "bg-emerald-400";
  if (p >= 30) return "bg-yellow-400";
  return "bg-[#ff3939]";
}

// ─── Toast ───────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  msg: string;
  type: "ok" | "err";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MetasPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currency, setCurrency] = useState('COP');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0); // useRef evita que se reinicie en cada render

  // Modal crear
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cNombre, setCNombre] = useState("");
  const [cObjetivo, setCObjetivo] = useState("");
  const [cActual, setCActual] = useState("0");
  const [cFecha, setCFecha] = useState("");
  const [cPrioridad, setCPrioridad] = useState<Prioridad>("Medio");

  // Modal actualizar
  const [editMeta, setEditMeta] = useState<Meta | null>(null);
  const [editActual, setEditActual] = useState("");
  const [updating, setUpdating] = useState(false);

  // ── Toast helper ────────────────────────────────────────────────────────────
  function toast(msg: string, type: "ok" | "err" = "ok") {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }

  // ── Load session & metas ────────────────────────────────────────────────────
  const loadMetas = useCallback(async (uid: string) => {
    try {
      const [profile, data] = await Promise.all([
        createFinanceReader(supabase).profile(uid),
        readAllPages(async (from, to) => {
          const { data, error } = await supabase.from('metas_ahorro').select('*').eq('id_usuario', uid)
            .order('id_meta', { ascending: true }).range(from, to).returns<Meta[]>();
          if (error || !data) throw new Error('No se pudieron cargar todas las metas.');
          return data;
        }),
      ]);
      for (const meta of data) {
        amountToCents(meta.monto_objetivo);
        amountToCents(meta.monto_actual, true);
      }
      setCurrency(profile.codigo_moneda);
      setMetas(data);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar las metas.');
    }
  }, []);

  function fmtMoney(value: number | string) { return formatAmount(value, currency); }

  useEffect(() => {
    (async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) { router.push("/login"); return; }
      setUserId(session.user.id);
      await loadMetas(session.user.id);
      setLoading(false);
    })();
  }, [router, loadMetas]);

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const nombre = cNombre.trim();
    let objetivo: number, actual: number;
    try {
      objetivo = amountToCents(cObjetivo) / 100;
      actual = amountToCents(cActual.trim() || '0', true) / 100;
      if (!nombre) throw new Error('El nombre es obligatorio.');
      if (cFecha && !isCivilDate(cFecha)) throw new Error('La fecha no es válida.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Importe inválido.', 'err');
      return;
    }

    setCreating(true);
    const { error } = await supabase.from("metas_ahorro").insert([{
      id_usuario: userId,
      nombre_meta: nombre,
      monto_objetivo: centsToDecimal(amountToCents(cObjetivo)),
      monto_actual: centsToDecimal(amountToCents(cActual.trim() || '0', true)),
      fecha_proyectada: cFecha || null,
      prioridad_nivel: cPrioridad,
      estado_meta: estadoMeta(actual, objetivo),
    }]);

    if (error) {
      toast("Error al crear meta: " + error.message, "err");
    } else {
      toast("Meta creada correctamente.");
      setShowCreate(false);
      setCNombre(""); setCObjetivo(""); setCActual("0"); setCFecha(""); setCPrioridad("Medio");
      await loadMetas(userId);
    }
    setCreating(false);
  }

  // ── Update avance ───────────────────────────────────────────────────────────
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editMeta || !userId) return;

    let actualCents: number;
    try { actualCents = amountToCents(editActual, true); }
    catch (error) { toast(error instanceof Error ? error.message : 'Importe inválido.', 'err'); return; }
    const actual = actualCents / 100;

    setUpdating(true);
    const { error } = await supabase
      .from("metas_ahorro")
      .update({ monto_actual: centsToDecimal(actualCents), estado_meta: estadoMeta(actual, editMeta.monto_objetivo) })
      .eq("id_meta", editMeta.id_meta).eq('id_usuario', userId);

    if (error) {
      toast("Error al actualizar: " + error.message, "err");
    } else {
      toast("Meta actualizada correctamente.");
      setEditMeta(null);
      await loadMetas(userId);
    }
    setUpdating(false);
  }

  // ── Estados modal de confirmación (reemplaza window.confirm) ─────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMeta, setPendingMeta] = useState<Meta | null>(null);

  // Paso 1: solicitar confirmación visual
  function handleDelete(meta: Meta) {
    setPendingMeta(meta);
    setConfirmOpen(true);
  }

  // Paso 2: usuario confirmó → ejecutar DELETE real
  async function confirmarEliminar() {
    setConfirmOpen(false);
    if (!pendingMeta || !userId) return;
    const meta = pendingMeta;
    setPendingMeta(null);

    const { error } = await supabase.from("metas_ahorro").delete().eq("id_meta", meta.id_meta).eq('id_usuario', userId);
    if (error) {
      toast("Error al eliminar: " + error.message, "err");
    } else {
      toast("Meta eliminada correctamente.");
      await loadMetas(userId);
    }
  }

  // Paso 3: usuario canceló
  function cancelarEliminar() {
    setConfirmOpen(false);
    setPendingMeta(null);
  }

  // ── Summary stats ───────────────────────────────────────────────────────────
  const totalMetas = metas.length;
  const completadas = metas.filter(m => m.estado_meta === "Completada").length;
  let totalObjetivo = 0, totalAhorrado = 0, totalsError = '';
  try {
    totalObjetivo = metas.reduce((total, meta) => addCents(total, amountToCents(meta.monto_objetivo)), 0) / 100;
    totalAhorrado = metas.reduce((total, meta) => addCents(total, amountToCents(meta.monto_actual, true)), 0) / 100;
  } catch (error) { totalsError = error instanceof Error ? error.message : 'No se pudieron calcular los totales.'; }
  if (loadError || totalsError) return <p role="alert" className="text-red-300 p-6">{loadError || totalsError}</p>;

  // ── Input styles ────────────────────────────────────────────────────────────
  const inputCls = "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] transition-all placeholder-zinc-600 [color-scheme:dark]";
  const labelCls = "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1";

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-[#39FF14] font-mono tracking-widest animate-pulse gap-4">
        <Target size={40} />
        <span>CARGANDO METAS...</span>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto pb-10 relative">

      {/* ── Toasts ── */}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest shadow-2xl border pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300 ${
            t.type === "ok"
              ? "bg-[#09090b] border-[#39FF14]/40 text-[#39FF14]"
              : "bg-[#09090b] border-[#ff3939]/40 text-[#ff3939]"
          }`}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-widest uppercase flex items-center gap-3">
            <Target className="text-[#39FF14]" size={30} strokeWidth={2.5} />
            Metas
          </h1>
          <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest mt-2 border-l-2 border-[#39FF14] pl-3 py-0.5">
            Objetivos de ahorro y progreso financiero
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#39FF14] text-black font-black uppercase tracking-widest text-[11px] px-6 py-3.5 rounded-xl hover:bg-[#a3e635] hover:shadow-[0_0_20px_rgba(57,255,20,0.3)] transition-all active:scale-95"
        >
          <Plus size={16} strokeWidth={3} />
          Nueva Meta
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Total Metas", value: totalMetas.toString(), icon: Target, color: "text-zinc-300" },
          { label: "Completadas", value: completadas.toString(), icon: CheckCircle2, color: "text-[#39FF14]" },
          { label: "Objetivo Total", value: `${fmtMoney(totalObjetivo)}`, icon: TrendingUp, color: "text-zinc-300" },
          { label: "Total Ahorrado", value: `${fmtMoney(totalAhorrado)}`, icon: Zap, color: "text-[#39FF14]" },
        ].map((s, i) => (
          <div key={i} className="bg-[#09090b] p-5 rounded-2xl border border-zinc-800/50 hover:border-zinc-700 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800 group-hover:bg-[#39FF14] transition-colors duration-300" />
            <div className="flex justify-between items-start mb-3 ml-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{s.label}</span>
              <s.icon size={16} className={s.color} />
            </div>
            <p className={`text-2xl font-black tracking-tight ml-2 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Empty state ── */}
      {metas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-6">
          <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Target size={32} className="text-zinc-600" />
          </div>
          <div className="text-center">
            <p className="text-zinc-300 font-semibold text-base">Aún no tienes metas de ahorro</p>
            <p className="text-zinc-600 text-xs mt-1 uppercase tracking-widest font-mono">
              Crea tu primera meta para empezar a construir tu objetivo financiero.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-8 py-3.5 bg-[#39FF14] text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-[#a3e635] hover:shadow-[0_0_20px_rgba(57,255,20,0.3)] transition-all active:scale-95"
          >
            Crear primera meta
          </button>
        </div>
      ) : (
        /* ── Grid de metas ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {metas.map(meta => {
            const p = pct(Number(meta.monto_actual), Number(meta.monto_objetivo));
            const restante = Math.max(0, amountToCents(meta.monto_objetivo) - amountToCents(meta.monto_actual, true)) / 100;
            const completada = meta.estado_meta === "Completada";

            return (
              <div
                key={meta.id_meta}
                className={`bg-[#09090b] border rounded-3xl p-6 flex flex-col gap-4 shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-zinc-600 ${
                  completada ? "border-[#39FF14]/30" : "border-zinc-800/60"
                }`}
              >
                {/* Neon line top */}
                {completada && (
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/60 to-transparent" />
                )}

                {/* Header fila */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-black text-base tracking-wide leading-tight truncate">
                      {meta.nombre_meta}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {/* Prioridad badge */}
                      {meta.prioridad_nivel && (
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${prioridadColor(meta.prioridad_nivel)}`}>
                          {meta.prioridad_nivel === "Alto" && <AlertTriangle size={8} className="inline mr-1" />}
                          {meta.prioridad_nivel}
                        </span>
                      )}
                      {/* Estado badge */}
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        completada
                          ? "text-[#39FF14] bg-[#39FF14]/10 border border-[#39FF14]/30"
                          : "text-zinc-400 bg-zinc-800 border border-zinc-700"
                      }`}>
                        {completada ? <CheckCircle2 size={8} /> : <Clock size={8} />}
                        {meta.estado_meta}
                      </span>
                    </div>
                  </div>
                  {/* % grande */}
                  <div className={`text-2xl font-black font-mono shrink-0 ${completada ? "text-[#39FF14]" : "text-white"}`}>
                    {p}%
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barColor(p)} ${completada ? "shadow-[0_0_8px_rgba(57,255,20,0.6)]" : ""}`}
                    style={{ width: `${p}%` }}
                  />
                </div>

                {/* Montos */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-zinc-900/60 rounded-xl p-2">
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Ahorrado</p>
                    <p className="text-xs font-black text-[#39FF14] font-mono">{fmtMoney(Number(meta.monto_actual))}</p>
                  </div>
                  <div className="bg-zinc-900/60 rounded-xl p-2">
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Objetivo</p>
                    <p className="text-xs font-black text-white font-mono">{fmtMoney(Number(meta.monto_objetivo))}</p>
                  </div>
                  <div className="bg-zinc-900/60 rounded-xl p-2">
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Restante</p>
                    <p className={`text-xs font-black font-mono ${restante === 0 ? "text-[#39FF14]" : "text-zinc-300"}`}>
                      {fmtMoney(restante)}
                    </p>
                  </div>
                </div>

                {/* Fecha proyectada */}
                {meta.fecha_proyectada && (
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                    📅 Proyectado: {(() => {
                      const [y, m, d] = meta.fecha_proyectada!.split("-");
                      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
                        .toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
                    })()}
                  </p>
                )}

                {/* Acciones */}
                <div className="flex gap-2 mt-auto pt-2 border-t border-zinc-800/50">
                  <button
                    onClick={() => { setEditMeta(meta); setEditActual(String(meta.monto_actual)); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all"
                  >
                    <Pencil size={12} /> Actualizar
                  </button>
                  <button
                    onClick={() => handleDelete(meta)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#ff3939]/10 hover:bg-[#ff3939]/20 text-[#ff3939] border border-[#ff3939]/20 hover:border-[#ff3939]/40 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════
          MODAL — Crear Meta
      ════════════════════════════════════════ */}
      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#09090b] border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(57,255,20,0.08)] relative">
            {/* Neon top line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/50 to-transparent" />

            <button onClick={() => setShowCreate(false)} className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
            </button>

            <h2 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-zinc-800 pb-4 flex items-center gap-2">
              <Target size={18} className="text-[#39FF14]" /> Nueva Meta
            </h2>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className={labelCls}>Nombre de la meta *</label>
                <input type="text" required value={cNombre} onChange={e => setCNombre(e.target.value)}
                  placeholder="Ej: Fondo de emergencia" className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Monto objetivo *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">$</span>
                    <input type="number" step="0.01" min="0.01" required value={cObjetivo}
                      onChange={e => setCObjetivo(e.target.value)}
                      placeholder="0.00"
                      className={`${inputCls} pl-8`} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Ya ahorrado</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">$</span>
                    <input type="number" step="0.01" min="0" value={cActual}
                      onChange={e => setCActual(e.target.value)}
                      placeholder="0.00"
                      className={`${inputCls} pl-8`} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Prioridad</label>
                  <select value={cPrioridad} onChange={e => setCPrioridad(e.target.value as Prioridad)} className={inputCls}>
                    {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Fecha proyectada</label>
                  <input type="date" value={cFecha} onChange={e => setCFecha(e.target.value)} className={inputCls} />
                </div>
              </div>

              <button type="submit" disabled={creating}
                className="w-full bg-[#39FF14] text-black font-black uppercase tracking-widest text-xs py-4 mt-2 rounded-xl hover:bg-[#a3e635] hover:shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                {creating ? "GUARDANDO..." : "CREAR META"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          MODAL — Actualizar Avance
      ════════════════════════════════════════ */}
      {editMeta && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#09090b] border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(57,255,20,0.08)] relative">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/50 to-transparent" />

            <button onClick={() => setEditMeta(null)} className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
            </button>

            <h2 className="text-lg font-black text-white uppercase tracking-widest mb-1 flex items-center gap-2">
              <Pencil size={18} className="text-[#39FF14]" /> Actualizar Avance
            </h2>
            <p className="text-zinc-500 text-xs font-mono tracking-widest mb-6 border-b border-zinc-800 pb-4 truncate">
              {editMeta.nombre_meta}
            </p>

            <form onSubmit={handleUpdate} className="flex flex-col gap-4">
              <div>
                <label className={labelCls}>Monto actual ahorrado</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">$</span>
                  <input type="number" step="0.01" min="0" required value={editActual}
                    onChange={e => setEditActual(e.target.value)}
                    className={`${inputCls} pl-8`} />
                </div>
                <p className="text-[10px] text-zinc-600 font-mono mt-2 ml-1">
                  Objetivo: {fmtMoney(Number(editMeta.monto_objetivo))}
                </p>
              </div>

              <button type="submit" disabled={updating}
                className="w-full bg-white text-black font-black uppercase tracking-widest text-xs py-4 mt-2 rounded-xl hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                {updating ? "ACTUALIZANDO..." : "GUARDAR PROGRESO"}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ══ Modal de Confirmación de Eliminación ══ */}
      <ConfirmModal
        open={confirmOpen}
        title="Eliminar meta"
        message={`¿Eliminar "${pendingMeta?.nombre_meta}"? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        confirmVariant="danger"
        onConfirm={confirmarEliminar}
        onCancel={cancelarEliminar}
      />

    </div>
  );
}
