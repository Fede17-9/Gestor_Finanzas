"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AuthPanel, { authInput } from '@/components/AuthPanel';
import { supabase } from '@/lib/supabase';
import { requestPasswordRecovery } from '@/lib/auth';

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const retryAt = useRef(0);
  const lock = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || Date.now() < retryAt.current) return;
    lock.current = true; setLoading(true); setError(''); setSent(false);
    try {
      await requestPasswordRecovery(supabase, email, window.location.origin);
      setSent(true);
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.'); }
    finally {
      retryAt.current = Date.now() + 60_000; setRemaining(60);
      lock.current = false; setLoading(false);
    }
  }
  return <AuthPanel title="Recuperar contraseña">
    <p className="text-sm text-muted">Te enviaremos un enlace si existe una cuenta asociada a ese correo. Ábrelo en este mismo navegador.</p>
    {sent && <p role="status" className="text-accent">Solicitud aceptada. Si existe una cuenta asociada, revisa el correo y la carpeta de spam. Esta respuesta no confirma la entrega del mensaje.</p>}
    <form onSubmit={submit} className="space-y-4">
        <label htmlFor="recovery-email" className="block text-sm">Correo electrónico</label>
        <input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className={authInput} />
        <button disabled={loading || remaining > 0} className="button-primary w-full">{loading ? 'Solicitando…' : remaining > 0 ? `Volver a solicitar en ${remaining} s` : 'Enviar enlace'}</button>
    </form>
    {error && <p role="alert" className="text-danger">{error}</p>}
    <Link href="/login" className="block text-sm underline">Volver al inicio de sesión</Link>
  </AuthPanel>;
}
