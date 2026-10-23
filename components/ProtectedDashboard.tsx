"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { hasProfile, verifiedUser } from '@/lib/auth';

export default function ProtectedDashboard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const owner = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function check() {
      const current = ++revision.current;
      try {
        const user = await verifiedUser(supabase);
        const destination = !user ? '/login' : await hasProfile(supabase, user.id) ? '/dashboard' : '/completar-perfil';
        if (!active || current !== revision.current) return;
        owner.current = user?.id ?? null;
        setError('');
        setReady(destination === '/dashboard');
        if (destination !== '/dashboard') router.replace(destination);
      } catch (error) {
        if (active && current === revision.current) {
          setReady(false);
          setError(error instanceof Error ? error.message : 'No se pudo comprobar el acceso.');
        }
      }
    }
    void check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      if (!session) {
        revision.current++;
        owner.current = null;
        setReady(false);
        router.replace('/login');
        return;
      }
      if (session.user.id !== owner.current) { revision.current++; setReady(false); }
      // SDK callbacks must not await further Auth calls while holding its lock.
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void check(); }, 0);
    });
    return () => { active = false; subscription.unsubscribe(); if (timer) clearTimeout(timer); };
  }, [router]);

  if (error) return <div role="alert" className="min-h-screen bg-paper text-danger p-8">
    {error}<button onClick={() => window.location.reload()} className="block underline mt-4">Volver a intentar</button>
  </div>;
  if (!ready) return <div role="status" className="min-h-screen bg-paper text-muted grid place-items-center">Verificando tu sesión…</div>;
  return children;
}
