"use client";

import { useEffect, useState, useRef } from "react";
import ProfileAvatar from '@/components/ProfileAvatar';
import ProfileAvatarPicker from '@/components/ProfileAvatarPicker';
import { DEFAULT_PROFILE_AVATAR, profileAvatarSource } from '@/lib/profile-avatars';
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Settings, User, Wallet, ImageIcon, ShieldCheck,
  Save, CheckCircle2, AlertCircle, Loader2
} from "lucide-react";

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
  "w-full bg-paper border border-line rounded-xl px-4 py-3 text-ink text-sm " +
  "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent " +
  "transition-all placeholder-muted [color-scheme:light]";
const labelCls =
  "block text-xs font-bold text-muted  tracking-normal mb-2 ml-1";
const readonlyCls =
  "w-full bg-paper/40 border border-line/50 rounded-xl px-4 py-3 text-muted " +
  "text-sm tabular-nums cursor-not-allowed select-all";

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
  const [avatar, setAvatar]     = useState<string>(DEFAULT_PROFILE_AVATAR);

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
        const profileCurrency = MONEDAS.find(value => value === perfil.codigo_moneda);
        if (!profileCurrency) {
          toast('Tu perfil no tiene una moneda válida. Revisa su configuración en Supabase.', 'err');
          setLoading(false);
          return;
        }
        setNombre(perfil.nombre_completo ?? "");
        setUsername(perfil.username ?? "");
        setMoneda(profileCurrency);
        setAvatar(profileAvatarSource(perfil.url_avatar));
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
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-accent tabular-nums tracking-normal animate-pulse">
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
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold  tracking-normal shadow-sm border pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300 ${
              t.type === "ok"
                ? "bg-surface border-accent/40 text-accent"
                : "bg-surface border-danger/40 text-danger"
            }`}
          >
            {t.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {t.msg}
          </div>
        ))}
      </div>

      {/* ── Page header ── */}
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-ink tracking-normal  flex items-center gap-3">
          <Settings className="text-accent" size={30} strokeWidth={2.5} />
          Configuración
        </h1>
        <p className="text-muted tabular-nums text-xs  tracking-normal mt-2 border-l-2 border-accent pl-3 py-0.5">
          Perfil, moneda y preferencias del sistema
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">

        {/* ══════════════════════════════════════
            A. PERFIL DEL USUARIO
        ══════════════════════════════════════ */}
        <section className="bg-surface border border-line/60 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
          <div className="flex items-center gap-2 mb-6">
            <User size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink  tracking-normal">Perfil del usuario</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-name" className={labelCls}>Nombre completo *</label>
              <input
                id="settings-name"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre real"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="settings-alias" className={labelCls}>Alias *</label>
              <input
                id="settings-alias"
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
        <section className="bg-surface border border-line/60 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
          <div className="flex items-center gap-2 mb-6">
            <Wallet size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink  tracking-normal">Preferencias financieras</h2>
          </div>

          <div className="max-w-xs">
            <label htmlFor="settings-currency" className={labelCls}>Moneda base *</label>
            <select
              id="settings-currency"
              value={moneda}
              disabled
              aria-describedby="settings-currency-help"
              className={inputCls}
            >
              <option value="USD">USD — Dólar Estadounidense</option>
              <option value="COP">COP — Peso Colombiano</option>
              <option value="EUR">EUR — Euro</option>
            </select>
            <p id="settings-currency-help" className="text-xs text-muted mt-3">
              Tu historial está registrado en {moneda}. La moneda base se elige al crear la cuenta
              y permanece fija: cambiar solo el símbolo no convierte el dinero ni los importes anteriores.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════
            C. AVATAR
        ══════════════════════════════════════ */}
        <section className="bg-surface border border-line/60 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
          <div className="flex items-center gap-2 mb-6">
            <ImageIcon size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink  tracking-normal">Imagen de perfil</h2>
          </div>

          {/* Preview del avatar actual */}
          <div className="flex items-center gap-4 mb-6">
            <ProfileAvatar value={avatar} size={64} />
            <div>
              <p className="text-ink text-sm font-bold">{username || "Tu alias"}</p>
              <p className="text-xs text-accent tracking-normal mt-0.5">Vista previa</p>
            </div>
          </div>

          {/* Selector de avatares */}
          <ProfileAvatarPicker value={avatar} onChange={setAvatar} />
          <p className="text-xs text-muted mt-3">Elige un icono y pulsa Guardar cambios para aplicarlo a tu perfil.</p>
        </section>

        {/* ══════════════════════════════════════
            Botón guardar
        ══════════════════════════════════════ */}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full bg-accent text-white font-semibold  tracking-normal text-xs py-4 rounded-xl hover:bg-accent  transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving
            ? <><Loader2 size={16} className="animate-spin" /> GUARDANDO...</>
            : <><Save size={16} /> Guardar cambios</>}
        </button>

        {/* ══════════════════════════════════════
            D. INFORMACIÓN DE CUENTA (solo lectura)
        ══════════════════════════════════════ */}
        <section className="bg-surface border border-line/40 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck size={16} className="text-muted" />
            <h2 className="text-sm font-semibold text-muted  tracking-normal">Información de cuenta</h2>
            <span className="text-xs font-bold text-muted bg-soft px-2 py-0.5 rounded-full  tracking-normal ml-auto">
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
