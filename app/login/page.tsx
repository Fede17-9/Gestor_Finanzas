"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCaptcha, { useAuthCaptcha } from '@/components/AuthCaptcha';
import AuthPanel from '@/components/AuthPanel';
import { initializeMetadataProfile, signInAccount } from '@/lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const captcha = useAuthCaptcha();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    if (!captcha.ready) return;
    lock.current = true; setLoading(true); setError('');
    try {
      await signInAccount(supabase, email, password, captcha.token);
      router.replace(await initializeMetadataProfile(supabase));
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.'); }
    finally { captcha.reset(); lock.current = false; setLoading(false); }
  };

  return <AuthPanel title="Inicia sesión"><p className="form-hint">Tu espacio para llevar tus finanzas con claridad.</p><form onSubmit={handleLogin} className="form-stack"><label className="field-label">Correo electrónico<input className="field" required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com"/></label><label className="field-label">Contraseña<input className="field" required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><AuthCaptcha key={captcha.revision} onToken={captcha.setToken}/><button type="submit" className="button-primary w-full" disabled={loading || !captcha.ready}>{loading?'Entrando…':'Iniciar sesión'}</button></form>{error&&<p role="alert" className="feedback error">{error}</p>}<Link href="/recuperar-clave" className="text-sm text-accent underline">Olvidé mi contraseña</Link><p className="text-sm text-muted">¿Aún no tienes cuenta? <Link href="/registro" className="text-accent underline">Crear cuenta</Link></p></AuthPanel>;
}
