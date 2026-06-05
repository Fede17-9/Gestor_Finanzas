"use client";

import { useEffect, useCallback } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** "danger" = botón confirmar rojo  |  "success" = botón confirmar verde */
  confirmVariant?: "danger" | "success";
  onConfirm: () => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {

  // Cerrar con Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const isSuccess = confirmVariant === "success";

  return (
    // Overlay — click fuera = cancelar (comprobamos que el click sea directo en el overlay, no en el card)
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Card — sin stopPropagation, el target check del overlay ya lo maneja */}
      <div
        className="bg-[#09090b] border border-zinc-800 rounded-3xl p-7 w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.8)] relative animate-in zoom-in-95 duration-200"
      >
        {/* Línea de acento superior */}
        <div
          className={`absolute top-0 left-0 w-full h-[1px] rounded-t-3xl bg-gradient-to-r from-transparent via-current to-transparent ${
            isSuccess ? "text-[#39FF14]/50" : "text-[#ff3939]/50"
          }`}
        />

        {/* Icono */}
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${
            isSuccess
              ? "bg-[#39FF14]/10 border border-[#39FF14]/20"
              : "bg-[#ff3939]/10 border border-[#ff3939]/20"
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 size={22} className="text-[#39FF14]" />
          ) : (
            <AlertTriangle size={22} className="text-[#ff3939]" />
          )}
        </div>

        {/* Botón X para cerrar */}
        <button
          onClick={onCancel}
          className="absolute top-5 right-5 text-zinc-600 hover:text-white transition-colors"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        {/* Texto */}
        <h2 className="text-base font-black text-white uppercase tracking-widest mb-3">
          {title}
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-7">
          {message}
        </p>

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 font-bold uppercase tracking-widest text-[11px] transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 ${
              isSuccess
                ? "bg-[#39FF14] text-black hover:bg-[#a3e635] hover:shadow-[0_0_20px_rgba(57,255,20,0.4)]"
                : "bg-[#ff3939] text-white hover:bg-[#ff6b6b] hover:shadow-[0_0_20px_rgba(255,57,57,0.4)]"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
