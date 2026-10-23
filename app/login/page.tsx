"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthPanel from '@/components/AuthPanel';
import { initializeMetadataProfile } from '@/lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true; setLoading(true); setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(error.code === 'email_not_confirmed' ? 'Confirma tu correo antes de entrar.' : 'No se pudo iniciar sesión. Revisa el correo y la contraseña.');
      router.replace(await initializeMetadataProfile(supabase));
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.'); }
    finally { lock.current = false; setLoading(false); }
  };

  return <AuthPanel title="Inicia sesión"><p className="form-hint">Tu espacio para llevar tus finanzas con claridad.</p><form onSubmit={handleLogin} className="form-stack"><label className="field-label">Correo electrónico<input className="field" required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com"/></label><label className="field-label">Contraseña<input className="field" required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button type="submit" className="button-primary w-full" disabled={loading}>{loading?'Entrando…':'Iniciar sesión'}</button></form>{error&&<p role="alert" className="feedback error">{error}</p>}<Link href="/recuperar-clave" className="text-sm text-accent underline">Olvidé mi contraseña</Link><p className="text-sm text-muted">¿Aún no tienes cuenta? <Link href="/registro" className="text-accent underline">Crear cuenta</Link></p></AuthPanel>;
}
