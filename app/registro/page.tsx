"use client";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase"; 
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCaptcha, { useAuthCaptcha } from '@/components/AuthCaptcha';
import AuthPanel from '@/components/AuthPanel';
import ProfileAvatarPicker from '@/components/ProfileAvatarPicker';
import { DEFAULT_PROFILE_AVATAR } from '@/lib/profile-avatars';
import { registerAccount } from '@/lib/auth';
import SignupConfirmation from '@/components/SignupConfirmation';

export default function RegistroPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [username, setUsername] = useState("");
  const [moneda, setMoneda] = useState("USD");
  const [avatar, setAvatar] = useState<string>(DEFAULT_PROFILE_AVATAR);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const lock = useRef(false);
  const captcha = useAuthCaptcha();
  const router = useRouter();

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    if (!captcha.ready) return;
    lock.current = true; setLoading(true); setError('');
    try {
      const result = await registerAccount(supabase, email, password, {
        nombre_completo: nombre, username, codigo_moneda: moneda, url_avatar: avatar,
      }, window.location.origin, captcha.token);
      if (result.confirmationRequired) {
        setConfirmationEmail(email.trim());
        setPassword('');
      } else if (result.destination) router.replace(result.destination);
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo crear la cuenta.'); }
    finally { captcha.reset(); lock.current = false; setLoading(false); }
  };

  if(confirmationEmail)return <SignupConfirmation email={confirmationEmail} onChangeEmail={()=>setConfirmationEmail('')}/>;
  return <AuthPanel title="Crea tu cuenta"><p className="form-hint">Empieza tu espacio personal de finanzas.</p><form onSubmit={handleRegistro} className="form-stack"><fieldset disabled={loading} className="form-stack">
    <ProfileAvatarPicker value={avatar} onChange={setAvatar} />
    <label className="field-label">Nombre completo<input className="field" required maxLength={120} autoComplete="name" value={nombre} onChange={e=>setNombre(e.target.value)}/></label><label className="field-label">Alias<input className="field" required minLength={3} maxLength={32} autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label>
    <label className="field-label">Moneda de tu registro<select className="field" value={moneda} onChange={e=>setMoneda(e.target.value)}><option value="COP">COP — Peso colombiano</option><option value="USD">USD — Dólar estadounidense</option><option value="EUR">EUR — Euro</option></select><span className="form-hint">Elige con cuidado: será la moneda de todos tus movimientos y no podrás cambiarla después desde Configuración.</span></label>
    <label className="field-label">Correo electrónico<input className="field" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="field-label">Contraseña<input className="field" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/><span className="form-hint">Usa al menos 8 caracteres.</span></label><AuthCaptcha key={captcha.revision} onToken={captcha.setToken}/><button className="button-primary w-full" type="submit" disabled={!captcha.ready}>{loading?'Creando cuenta…':'Crear cuenta'}</button>
  </fieldset></form>{error&&<p role="alert" className="feedback error">{error}</p>}<p className="text-sm text-muted">¿Ya tienes cuenta? <Link href="/login" className="text-accent underline">Iniciar sesión</Link></p></AuthPanel>;
}
