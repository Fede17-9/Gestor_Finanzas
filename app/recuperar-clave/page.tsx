"use client";

import { useRef, useState } from 'react';
import Link from 'next/link';
import AuthPanel, { authInput } from '@/components/AuthPanel';
import { supabase } from '@/lib/supabase';
import { authRedirect } from '@/lib/auth';

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setLoading(true); setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect(window.location.origin, '/actualizar-clave') });
      if (error) throw new Error('No se pudo enviar la solicitud. Espera unos minutos e intenta de nuevo.');
      setSent(true);
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.'); }
    finally { lock.current = false; setLoading(false); }
  }
  return <AuthPanel title="Recuperar contraseña">
    <p className="text-sm text-zinc-400">Te enviaremos un enlace si existe una cuenta asociada a ese correo. Ábrelo en este mismo navegador.</p>
    {sent ? <p role="status" className="text-emerald-300">Solicitud recibida. Revisa tu correo y la carpeta de spam.</p> :
      <form onSubmit={submit} className="space-y-4">
        <label htmlFor="recovery-email" className="block text-sm">Correo electrónico</label>
        <input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className={authInput} />
        <button disabled={loading} className="w-full bg-emerald-400 text-black rounded-xl py-3 font-semibold disabled:opacity-50">{loading ? 'Enviando…' : 'Enviar enlace'}</button>
      </form>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <Link href="/login" className="block text-sm underline">Volver al inicio de sesión</Link>
  </AuthPanel>;
}
