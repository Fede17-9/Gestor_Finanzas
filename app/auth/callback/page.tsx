"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthPanel from '@/components/AuthPanel';
import { supabase } from '@/lib/supabase';
import { completeAuthLink } from '@/lib/auth';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const pending = useRef<ReturnType<typeof completeAuthLink> | null>(null);
  useEffect(() => {
    let active = true;
    if (!pending.current) {
      const href = window.location.href;
      // Codes and legacy tokens must not remain in the address bar or referrer.
      window.history.replaceState(null, '', '/auth/callback');
      pending.current = completeAuthLink(supabase, href);
    }
    pending.current.then(result => {
      if (!active) return;
      if (result.destination === '/actualizar-clave') {
        sessionStorage.setItem('flux-recovery', JSON.stringify({ userId: result.userId, expires: Date.now() + 15 * 60_000 }));
      }
      router.replace(result.destination);
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'No se pudo verificar el enlace.'); });
    return () => { active = false; };
  }, [router]);
  return <AuthPanel title="Verificar acceso">
    {error ? <><p role="alert" className="text-red-300">{error}</p>
      <Link href="/recuperar-clave" className="block underline">Solicitar recuperación</Link>
      <Link href="/login" className="block underline">Volver al inicio de sesión</Link></>
      : <p role="status" className="text-zinc-400">Verificando el enlace…</p>}
  </AuthPanel>;
}
