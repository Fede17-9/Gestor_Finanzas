"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

const AVATARS = [
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Felix",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Aneka",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Molly",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Oliver",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Jack",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Sadie"
];

export default function RegistroPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [username, setUsername] = useState("");
  const [moneda, setMoneda] = useState("USD");
  const [avatar, setAvatar] = useState(AVATARS[0]);

  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setLoading(false);
      return alert(authError.message);
    }

    if (authData.user) {
      const { error: dbError } = await supabase.from("usuarios").insert([
        {
          id_usuario: authData.user.id,
          nombre_completo: nombre, // Nombre Completo
          username: username,     // Apodo
          codigo_moneda: moneda,
          url_avatar: avatar      // Avatar URL
        },
      ]);

      if (dbError) {
        alert("Error al guardar perfil: " + dbError.message);
      } else {
        router.push("/dashboard");
      }
    }
    setLoading(false);
  };

  // Clases reutilizables para mantener el diseño profesional, compacto y legible
  const inputStyles = "w-full border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-400 transition-all";
  const labelStyles = "block text-sm font-semibold text-slate-700 mb-1.5";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50">
      <form onSubmit={handleRegistro} className="flex flex-col gap-4 w-full max-w-sm bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="text-center mb-1">
          <h1 className="text-2xl font-bold text-slate-900">Crear Cuenta</h1>
          <p className="text-sm text-slate-500 mt-1">Regístrate para continuar a FinanzaPro</p>
        </div>

        {/* Selector de Avatar */}
        <div className="flex flex-col items-center mb-1">
          <label className={labelStyles}>Selecciona tu Avatar</label>
          <div className="flex justify-center gap-3 flex-wrap mt-1">
            {AVATARS.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => setAvatar(url)}
                className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-transform ${avatar === url ? "border-blue-600 scale-110 shadow-sm" : "border-slate-200 hover:border-blue-400"
                  }`}
              >
                <img src={url} alt="Avatar option" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelStyles}>Nombre Completo</label>
          <input type="text" placeholder="Ej: Juan Pérez"
            onChange={(e) => setNombre(e.target.value)} className={inputStyles} required />
        </div>

        <div>
          <label className={labelStyles}>Apodo (Para el Dashboard)</label>
          <input type="text" placeholder="Ej: JuanP"
            onChange={(e) => setUsername(e.target.value)} className={inputStyles} required />
        </div>

        <div>
          <label className={labelStyles}>Moneda Principal</label>
          <select onChange={(e) => setMoneda(e.target.value)} className={inputStyles}>
            <option value="USD">USD - Dólares</option>
            <option value="COP">COP - Pesos Colombianos</option>
            <option value="EUR">EUR - Euros</option>
          </select>
        </div>

        <div>
          <label className={labelStyles}>Correo Electrónico</label>
          <input type="email" placeholder="tu@email.com"
            onChange={(e) => setEmail(e.target.value)} className={inputStyles} required />
        </div>

        <div>
          <label className={labelStyles}>Contraseña</label>
          <input type="password" placeholder="••••••••"
            onChange={(e) => setPassword(e.target.value)} className={inputStyles} required />
        </div>

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-medium py-2.5 mt-3 rounded-md hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed">
          {loading ? "Creando cuenta..." : "Registrarse"}
        </button>

        <p className="text-center text-sm text-slate-600 mt-1">
          ¿Ya tienes una cuenta? <Link href="/login" className="text-blue-600 font-medium hover:underline">Iniciar Sesión</Link>
        </p>
      </form>
    </div>
  );
}
