"use client";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase"; 
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthPanel from '@/components/AuthPanel';
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

  if(confirmationEmail)return <SignupConfirmation email={confirmationEmail} onChangeEmail={()=>setConfirmationEmail('')}/>;
  return <AuthPanel title="Crea tu cuenta"><p className="form-hint">Empieza tu espacio personal de finanzas.</p><form onSubmit={handleRegistro} className="form-stack"><fieldset disabled={loading} className="form-stack">
    <fieldset><legend className="field-label mb-3">Elige tu avatar</legend><div className="flex flex-wrap justify-center gap-3">{AVATARS.map((url,index)=><button key={url} type="button" onClick={()=>setAvatar(url)} aria-label={`Avatar ${index+1}`} aria-pressed={avatar===url} className={`rounded-full border-2 p-1 ${avatar===url?'border-accent bg-soft':'border-transparent'}`}><Image src={url} alt="" width={40} height={40} unoptimized className="rounded-full"/></button>)}</div></fieldset>
    <label className="field-label">Nombre completo<input className="field" required maxLength={120} autoComplete="name" value={nombre} onChange={e=>setNombre(e.target.value)}/></label><label className="field-label">Alias<input className="field" required minLength={3} maxLength={32} autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label>
    <label className="field-label">Moneda de tu registro<select className="field" value={moneda} onChange={e=>setMoneda(e.target.value)}><option value="COP">COP — Peso colombiano</option><option value="USD">USD — Dólar estadounidense</option><option value="EUR">EUR — Euro</option></select></label>
    <label className="field-label">Correo electrónico<input className="field" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="field-label">Contraseña<input className="field" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/><span className="form-hint">Usa al menos 8 caracteres.</span></label><button className="button-primary w-full" type="submit">{loading?'Creando cuenta…':'Crear cuenta'}</button>
  </fieldset></form>{error&&<p role="alert" className="feedback error">{error}</p>}<p className="text-sm text-muted">¿Ya tienes cuenta? <Link href="/login" className="text-accent underline">Iniciar sesión</Link></p></AuthPanel>;
}
