"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthPanel, { authInput } from '@/components/AuthPanel';
import { supabase } from '@/lib/supabase';
import { updateRecoveryPassword, validatePassword, verifiedUser } from '@/lib/auth';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  async function checkRecovery() {
    const grant = JSON.parse(sessionStorage.getItem('flux-recovery') ?? 'null');
    const user = await verifiedUser(supabase);
    if (!user || !grant || grant.userId !== user.id || !Number.isFinite(grant.expires) || grant.expires < Date.now()) {
      throw new Error('Solicita un enlace de recuperación nuevo para cambiar la contraseña.');
    }
  }
  useEffect(() => {
    let active = true;
    checkRecovery().then(() => { if (active) setReady(true); }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : 'El enlace no es válido.');
    });
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setSaving(true); setError('');
    try {
      validatePassword(password);
      if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
      await checkRecovery();
      await updateRecoveryPassword(supabase, password);
      sessionStorage.removeItem('flux-recovery');
      setReady(false); setPassword(''); setConfirmation('');
      const { error: logoutError } = await supabase.auth.signOut();
      if (logoutError) throw new Error('Tu contraseña se actualizó, pero no se pudo cerrar la sesión. Vuelve al acceso para continuar.');
      router.replace('/login?password=updated');
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.'); }
    finally { lock.current = false; setSaving(false); }
  }
  return <AuthPanel title="Nueva contraseña">
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {ready && <form onSubmit={submit} className="space-y-4">
      <label htmlFor="new-password" className="block text-sm">Contraseña nueva</label>
      <input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} className={authInput} />
      <label htmlFor="confirm-password" className="block text-sm">Repetir contraseña</label>
      <input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} className={authInput} />
      <button disabled={saving} className="w-full bg-emerald-400 text-black rounded-xl py-3 font-semibold disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar contraseña'}</button>
    </form>}
    <Link href="/recuperar-clave" className="block text-sm underline">Solicitar otro enlace</Link>
    <Link href="/login" className="block text-sm underline">Volver al acceso</Link>
  </AuthPanel>;
}
