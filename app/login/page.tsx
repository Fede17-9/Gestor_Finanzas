"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Infinity } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Error al iniciar sesión: " + error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  const inputStyles = "w-full border border-zinc-800 px-4 py-3 text-sm text-white bg-zinc-900 rounded-xl focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] placeholder-zinc-600 transition-all";
  const labelStyles = "block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#000000] p-4 relative overflow-hidden font-sans selection:bg-[#39FF14] selection:text-black">
      {/* Decorative Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#39FF14]/5 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="flex flex-col gap-8 w-full max-w-sm bg-[#09090b]/80 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-2xl border border-zinc-800/50 relative z-10">
        
        {/* Línea decorativa neón */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/50 to-transparent"></div>

        <div className="flex flex-col items-center gap-3 text-center">
          <Infinity className="text-[#39FF14]" size={48} strokeWidth={2} />
          <div>
            <h1 className="text-2xl font-black text-white tracking-widest uppercase">Flux</h1>
            <p className="text-[10px] uppercase font-semibold tracking-widest text-[#39FF14] mt-1">Acceso al Sistema</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className={labelStyles}>Identificador (Email)</label>
            <input 
              type="email" 
              placeholder="agente@flux.net" 
              onChange={(e) => setEmail(e.target.value)} 
              className={inputStyles} 
              required 
            />
          </div>
          
          <div>
            <label className={labelStyles}>Clave de Acceso</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              onChange={(e) => setPassword(e.target.value)} 
              className={inputStyles} 
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#39FF14] text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl hover:bg-[#a3e635] hover:shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "VERIFICANDO..." : "INICIAR SESIÓN"}
          </button>
        </form>

        <p className="text-center text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          ¿NUEVO USUARIO? <Link href="/registro" className="text-[#39FF14] hover:text-white transition-colors">REGÍSTRATE</Link>
        </p>
      </div>
    </div>
  );
}
