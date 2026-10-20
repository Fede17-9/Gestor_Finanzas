"use client";

import { useEffect, useState, useRef } from "react";
import Image from 'next/image';
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Settings, User, Wallet, ImageIcon, ShieldCheck,
  Save, CheckCircle2, AlertCircle, Loader2
} from "lucide-react";

// ─── Avatares (mismos que en /registro) ──────────────────────────────────────
const AVATARS = [
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Felix",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Aneka",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Molly",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Oliver",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Jack",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Sadie",
];

const MONEDAS = ["USD", "COP", "EUR"] as const;
type Moneda = (typeof MONEDAS)[number];

// ─── Toast ────────────────────────────────────────────────────────────────────
interface ToastItem {
  id: number;
  msg: string;
  type: "ok" | "err";
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const inputCls =
  "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm " +
  "focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] " +
  "transition-all placeholder-zinc-600 [color-scheme:dark]";
const labelCls =
  "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1";
const readonlyCls =
  "w-full bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-4 py-3 text-zinc-400 " +
  "text-sm font-mono cursor-not-allowed select-all";

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ConfiguracionPage() {
  const router = useRouter();
  const toastId = useRef(0);

  // ── Auth / profile ──────────────────────────────────────────────────────────
  const [userId, setUserId]             = useState<string | null>(null);
  const [userEmail, setUserEmail]       = useState("");
  const [fechaRegistro, setFechaRegistro] = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);

  // ── Form fields ─────────────────────────────────────────────────────────────
  const [nombre, setNombre]     = useState("");
  const [username, setUsername] = useState("");
  const [moneda, setMoneda]     = useState<Moneda>("USD");
  const [avatar, setAvatar]     = useState(AVATARS[0]);

  // ── Toasts ──────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function toast(msg: string, type: "ok" | "err" = "ok") {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800);
  }

  // ── Load session + profile ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) { router.push("/login"); return; }

      setUserId(session.user.id);
      setUserEmail(session.user.email ?? "");

      const { data: perfil, error: pErr } = await supabase
        .from("usuarios")
        .select("nombre_completo, username, codigo_moneda, url_avatar, fecha_registro")
        .eq("id_usuario", session.user.id)
        .single();

      if (pErr || !perfil) {
        toast("No se pudo cargar el perfil.", "err");
      } else {
        setNombre(perfil.nombre_completo ?? "");
        setUsername(perfil.username ?? "");
        setMoneda((perfil.codigo_moneda as Moneda) ?? "USD");
        setAvatar(perfil.url_avatar ?? AVATARS[0]);
        setFechaRegistro(perfil.fecha_registro ?? null);
      }
      setLoading(false);
    })();
  }, [router]);

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const nombreTrim   = nombre.trim();
    const usernameTrim = username.trim();

    if (!nombreTrim || !usernameTrim) {
      toast("Complete los campos obligatorios.", "err");
      return;
    }
    if (!MONEDAS.includes(moneda)) {
      toast("Selecciona una moneda válida.", "err");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("usuarios")
      .update({
        nombre_completo: nombreTrim,
        username: usernameTrim,
        url_avatar: avatar,
      })
      .eq("id_usuario", userId);

    if (error) {
      if (error.message.toLowerCase().includes("unique") ||
          error.code === "23505") {
        toast("Ese username ya está en uso.", "err");
      } else {
        toast("No se pudo actualizar el perfil.", "err");
      }
    } else {
      toast("Perfil actualizado correctamente.");
    }
    setSaving(false);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function fmtFecha(ts: string | null): string {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("es-ES", {
      day: "2-digit", month: "long", year: "numeric",
    });
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-[#39FF14] font-mono tracking-widest animate-pulse">
        <Loader2 size={40} className="animate-spin" />
        <span>CARGANDO CONFIGURACIÓN...</span>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto pb-12 relative">

      {/* ── Toasts ── */}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest shadow-2xl border pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300 ${
              t.type === "ok"
                ? "bg-[#09090b] border-[#39FF14]/40 text-[#39FF14]"
                : "bg-[#09090b] border-[#ff3939]/40 text-[#ff3939]"
            }`}
          >
            {t.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {t.msg}
          </div>
        ))}
      </div>

      {/* ── Page header ── */}
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white tracking-widest uppercase flex items-center gap-3">
          <Settings className="text-[#39FF14]" size={30} strokeWidth={2.5} />
          Configuración
        </h1>
        <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest mt-2 border-l-2 border-[#39FF14] pl-3 py-0.5">
          Perfil, moneda y preferencias del sistema
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">

        {/* ══════════════════════════════════════
            A. PERFIL DEL USUARIO
        ══════════════════════════════════════ */}
        <section className="bg-[#09090b] border border-zinc-800/60 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/30 to-transparent" />
          <div className="flex items-center gap-2 mb-6">
            <User size={16} className="text-[#39FF14]" />
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Perfil del usuario</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nombre completo *</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre real"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Username / Alias *</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu alias en el sistema"
                className={inputCls}
              />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            B. PREFERENCIAS FINANCIERAS
        ══════════════════════════════════════ */}
        <section className="bg-[#09090b] border border-zinc-800/60 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/30 to-transparent" />
          <div className="flex items-center gap-2 mb-6">
            <Wallet size={16} className="text-[#39FF14]" />
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Preferencias financieras</h2>
          </div>

          <div className="max-w-xs">
            <label className={labelCls}>Moneda base *</label>
            <select
              value={moneda}
              disabled
              className={inputCls}
            >
              <option value="USD">USD — Dólar Estadounidense</option>
              <option value="COP">COP — Peso Colombiano</option>
              <option value="EUR">EUR — Euro</option>
            </select>
            <p className="text-xs text-zinc-500 mt-3">
              La moneda se elige al registrarte. Cambiarla no convierte los importes del historial.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════
            C. AVATAR
        ══════════════════════════════════════ */}
        <section className="bg-[#09090b] border border-zinc-800/60 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/30 to-transparent" />
          <div className="flex items-center gap-2 mb-6">
            <ImageIcon size={16} className="text-[#39FF14]" />
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Identificador visual</h2>
          </div>

          {/* Preview del avatar actual */}
          <div className="flex items-center gap-4 mb-6">
            <Image
              src={avatar}
              alt="Avatar actual"
              width={64}
              height={64}
              unoptimized
              className="w-16 h-16 rounded-full border-2 border-[#39FF14] shadow-[0_0_16px_rgba(57,255,20,0.4)] bg-zinc-900 object-cover"
            />
            <div>
              <p className="text-white text-sm font-bold">{username || "Tu alias"}</p>
              <p className="text-[10px] text-[#39FF14] font-mono uppercase tracking-widest mt-0.5">Avatar activo</p>
            </div>
          </div>

          {/* Selector de avatares */}
          <label className={labelCls}>Selecciona un avatar</label>
          <div className="flex gap-3 flex-wrap mt-2">
            {AVATARS.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => setAvatar(url)}
                className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all duration-300 ${
                  avatar === url
                    ? "border-[#39FF14] scale-110 shadow-[0_0_16px_rgba(57,255,20,0.5)] opacity-100"
                    : "border-zinc-800 hover:border-zinc-600 opacity-50 hover:opacity-100"
                }`}
              >
                <Image src={url} alt="Avatar opción" width={56} height={56} unoptimized className="w-full h-full object-cover bg-zinc-900" />
              </button>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════
            Botón guardar
        ══════════════════════════════════════ */}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full bg-[#39FF14] text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl hover:bg-[#a3e635] hover:shadow-[0_0_24px_rgba(57,255,20,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving
            ? <><Loader2 size={16} className="animate-spin" /> GUARDANDO...</>
            : <><Save size={16} /> Guardar cambios</>}
        </button>

        {/* ══════════════════════════════════════
            D. INFORMACIÓN DE CUENTA (solo lectura)
        ══════════════════════════════════════ */}
        <section className="bg-[#09090b] border border-zinc-800/40 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck size={16} className="text-zinc-500" />
            <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest">Información de cuenta</h2>
            <span className="text-[9px] font-bold text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full uppercase tracking-widest ml-auto">
              Solo lectura
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Email</label>
              <input type="text" readOnly value={userEmail} className={readonlyCls} />
            </div>
            <div>
              <label className={labelCls}>Moneda activa</label>
              <input type="text" readOnly value={moneda} className={readonlyCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de registro</label>
              <input type="text" readOnly value={fmtFecha(fechaRegistro)} className={readonlyCls} />
            </div>
            <div>
              <label className={labelCls}>ID de usuario</label>
              <input type="text" readOnly value={userId ?? "—"} className={readonlyCls} title={userId ?? ""} />
            </div>
          </div>
        </section>

      </form>
    </div>
  );
}
