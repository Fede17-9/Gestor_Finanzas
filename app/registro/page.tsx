"use client";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase"; 
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Infinity } from "lucide-react";
import Image from 'next/image';
import { registerAccount } from '@/lib/auth';
import SignupConfirmation from '@/components/SignupConfirmation';

// Lista de Avatares sencillos
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
  const [error, setError] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const lock = useRef(false);
  const router = useRouter();

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true; setLoading(true); setError('');
    try {
      const result = await registerAccount(supabase, email, password, {
        nombre_completo: nombre, username, codigo_moneda: moneda, url_avatar: avatar,
      }, window.location.origin);
      if (result.confirmationRequired) {
        setConfirmationEmail(email.trim());
        setPassword('');
      } else if (result.destination) router.replace(result.destination);
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo crear la cuenta.'); }
    finally { lock.current = false; setLoading(false); }
  };

  const inputStyles = "w-full border border-zinc-800 px-4 py-3 text-sm text-white bg-zinc-900 rounded-xl focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] placeholder-zinc-600 transition-all";
  const labelStyles = "block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1";

  if (confirmationEmail) return <SignupConfirmation email={confirmationEmail} onChangeEmail={() => setConfirmationEmail('')} />;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#000000] p-4 relative overflow-hidden font-sans selection:bg-[#39FF14] selection:text-black py-10">
      {/* Decorative Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#39FF14]/5 rounded-full blur-[150px] pointer-events-none"></div>

      <form onSubmit={handleRegistro} className="flex flex-col gap-6 w-full max-w-md bg-[#09090b]/80 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-2xl border border-zinc-800/50 relative z-10">
        
        {/* Línea decorativa neón */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/50 to-transparent"></div>

        <div className="flex flex-col items-center gap-3 text-center mb-2">
          <Infinity className="text-[#39FF14]" size={40} strokeWidth={2.5} />
          <div>
            <h1 className="text-2xl font-black text-white tracking-widest uppercase">Alta en Sistema</h1>
            <p className="text-[10px] uppercase font-semibold tracking-widest text-[#39FF14] mt-1">Configuración Inicial</p>
          </div>
        </div>
        
        {/* Selector de Avatar */}
        <div className="flex flex-col items-center mb-2">
          <label className={labelStyles}>Selecciona Identificador Visual</label>
          <div className="flex justify-center gap-3 flex-wrap mt-2">
            {AVATARS.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => setAvatar(url)}
                className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all duration-300 ${
                  avatar === url ? "border-[#39FF14] scale-110 shadow-[0_0_15px_rgba(57,255,20,0.5)] opacity-100" : "border-zinc-800 hover:border-zinc-600 opacity-50 hover:opacity-100"
                }`}
              >
                <Image src={url} alt="Avatar option" width={48} height={48} unoptimized className="w-full h-full object-cover bg-zinc-900" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelStyles}>Identidad Real (Nombre Completo)</label>
          <input type="text" value={nombre} maxLength={120} placeholder="Ej: John Doe"
                 onChange={(e) => setNombre(e.target.value)} className={inputStyles} required />
        </div>
        
        <div>
          <label className={labelStyles}>Alias Operativo (Apodo)</label>
          <input type="text" value={username} minLength={3} maxLength={32} placeholder="Ej: Neo"
                 onChange={(e) => setUsername(e.target.value)} className={inputStyles} required />
        </div>

        <div>
          <label className={labelStyles}>Moneda Base</label>
          <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className={inputStyles}>
            <option value="USD">USD - Dólar Estadounidense</option>
            <option value="COP">COP - Peso Colombiano</option>
            <option value="EUR">EUR - Euro</option>
          </select>
        </div>

        <div>
          <label className={labelStyles}>Correo Seguro</label>
          <input type="email" value={email} autoComplete="email" placeholder="agente@mail.com"
                 onChange={(e) => setEmail(e.target.value)} className={inputStyles} required />
        </div>

        <div>
          <label className={labelStyles}>Clave Encriptada</label>
          <input type="password" value={password} autoComplete="new-password" minLength={8} maxLength={128} placeholder="••••••••"
                 onChange={(e) => setPassword(e.target.value)} className={inputStyles} required />
        </div>

        <button type="submit" disabled={loading} className="w-full bg-[#39FF14] text-black font-black uppercase tracking-widest text-xs py-4 mt-2 rounded-xl hover:bg-[#a3e635] hover:shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
          {loading ? "CREANDO PERFIL..." : "REGISTRAR Y SINCRONIZAR"}
        </button>

        {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
        <p className="text-center text-xs font-semibold text-zinc-500 uppercase tracking-widest mt-2">
          ¿YA TIENES ACCESO? <Link href="/login" className="text-[#39FF14] hover:text-white transition-colors">INICIAR SESIÓN</Link>
        </p>
      </form>
    </div>
  );
}
