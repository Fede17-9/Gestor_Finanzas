"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wallet } from "lucide-react";

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

  // Clases reutilizables para mantener el diseño profesional, compacto y legible
  const inputStyles = "w-full border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-400 transition-all";
  const labelStyles = "block text-sm font-semibold text-slate-700 mb-1.5";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="flex flex-col gap-6 w-full max-w-sm bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col items-center gap-2 mb-2 text-center">
          <div className="bg-blue-600 p-2.5 rounded-lg text-white shadow-sm mb-1">
            <Wallet size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Bienvenido de nuevo</h1>
          <p className="text-sm text-slate-500">Ingresa tus credenciales para continuar</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className={labelStyles}>Correo electrónico</label>
            <input 
              type="email" 
              placeholder="tu@email.com" 
              onChange={(e) => setEmail(e.target.value)} 
              className={inputStyles} 
              required 
            />
          </div>
          
          <div>
            <label className={labelStyles}>Contraseña</label>
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
            className="w-full bg-blue-600 text-white font-medium py-2.5 mt-3 rounded-md hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? "Entrando..." : "Iniciar Sesión"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-600 mt-1">
          ¿No tienes una cuenta? <Link href="/registro" className="text-blue-600 font-medium hover:underline">Regístrate gratis</Link>
        </p>
      </div>
    </div>
  );
}
