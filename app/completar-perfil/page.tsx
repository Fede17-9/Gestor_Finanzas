"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthPanel, { authInput } from '@/components/AuthPanel';
import { supabase } from '@/lib/supabase';
import { createOwnProfile, hasProfile, verifiedUser } from '@/lib/auth';

export default function CompleteProfilePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [currency, setCurrency] = useState('COP');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const user = await verifiedUser(supabase);
        if (!active) return;
        if (!user) { router.replace('/login'); return; }
        if (await hasProfile(supabase, user.id)) { if (active) router.replace('/dashboard'); return; }
        if (!active) return;
        setName(String(user.user_metadata.nombre_completo ?? ''));
        setUsername(String(user.user_metadata.username ?? ''));
        const requested = user.user_metadata.codigo_moneda;
        setCurrency(['COP','USD','EUR'].includes(requested) ? requested : 'COP');
        setReady(true);
      } catch (error) { if (active) setError(error instanceof Error ? error.message : 'No se pudo cargar tu cuenta.'); }
    }
    void load();
    return () => { active = false; };
  }, [router]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setSaving(true); setError('');
    try {
      await createOwnProfile(supabase, { nombre_completo: name, username, codigo_moneda: currency, url_avatar: null });
      router.replace('/dashboard');
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo guardar el perfil.'); }
    finally { lock.current = false; setSaving(false); }
  }
  return <AuthPanel title="Completa tu perfil">
    <p className="text-sm text-zinc-400">Tu cuenta está creada. Define cómo aparecerás y la moneda de tu registro personal.</p>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {ready && <form onSubmit={submit} className="space-y-4">
      <label htmlFor="profile-name" className="block text-sm">Nombre</label>
      <input id="profile-name" required maxLength={120} value={name} onChange={event => setName(event.target.value)} className={authInput} />
      <label htmlFor="profile-alias" className="block text-sm">Alias</label>
      <input id="profile-alias" required minLength={3} maxLength={32} value={username} onChange={event => setUsername(event.target.value)} className={authInput} />
      <label htmlFor="profile-currency" className="block text-sm">Moneda</label>
      <select id="profile-currency" value={currency} onChange={event => setCurrency(event.target.value)} className={authInput}>
        <option value="COP">COP — Peso colombiano</option><option value="USD">USD — Dólar</option><option value="EUR">EUR — Euro</option>
      </select>
      <button disabled={saving} className="w-full bg-emerald-400 text-black rounded-xl py-3 font-semibold disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar perfil'}</button>
    </form>}
  </AuthPanel>;
}
