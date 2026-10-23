"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthPanel from '@/components/AuthPanel';
import { confirmedSignupDestination, resendSignupConfirmation } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function SignupConfirmation({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const router = useRouter();
  const [retryAt, setRetryAt] = useState(() => Date.now() + 60_000);
  const [remaining, setRemaining] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  useEffect(() => {
    let active = true;
    let checking = false;
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      if (checking) return;
      checking = true;
      try {
        const destination = await confirmedSignupDestination(supabase, email);
        if (active && destination) router.replace(destination);
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : 'No se pudo comprobar la confirmación.');
      } finally { checking = false; }
    }
    // Auth callbacks must release the SDK lock before making another Auth call.
    function schedule() { clearTimeout(timer); timer = setTimeout(() => { void check(); }, 0); }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') schedule();
    });
    window.addEventListener('focus', schedule);
    schedule();
    return () => { active = false; clearTimeout(timer); subscription.unsubscribe(); window.removeEventListener('focus', schedule); };
  }, [email, router]);

  async function resend() {
    if (lock.current || Date.now() < retryAt) return;
    lock.current = true; setLoading(true); setError(''); setMessage('');
    try {
      await resendSignupConfirmation(supabase, email, window.location.origin);
      setMessage('Solicitud de reenvío recibida. Revisa tu correo y la carpeta de spam.');
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo solicitar el reenvío.'); }
    finally {
      setRetryAt(Date.now() + 60_000); setRemaining(60);
      lock.current = false; setLoading(false);
    }
  }

  return <AuthPanel title="Confirma tu correo">
    <p className="text-sm text-muted">Revisa el correo de <strong className="break-all">{email}</strong> y la carpeta de spam.</p>
    <p className="text-sm text-muted">Abre el enlace en este mismo computador, navegador y perfil. Puede abrir otra pestaña. Al confirmar, esta pantalla también comprobará tu acceso.</p>
    <p className="text-sm text-muted">Si tu cuenta ya estaba confirmada, inicia sesión.</p>
    {message && <p role="status" className="text-accent text-sm">{message}</p>}
    {error && <p role="alert" className="text-danger text-sm">{error}</p>}
    <button type="button" onClick={() => void resend()} disabled={loading || remaining > 0}
      className="button-primary w-full">
      {loading ? 'Solicitando…' : remaining > 0 ? `Reenviar en ${remaining} s` : 'Reenviar confirmación'}
    </button>
    <p className="text-xs text-muted">Si el servicio de correo alcanzó su límite, puede ser necesario esperar más tiempo.</p>
    <button type="button" onClick={onChangeEmail} disabled={loading} className="block text-sm underline disabled:opacity-50">Usar otro correo</button>
    <Link href="/login" className="block text-sm underline">Iniciar sesión</Link>
  </AuthPanel>;
}
