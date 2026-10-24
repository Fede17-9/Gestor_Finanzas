"use client";

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY } from '@/lib/captcha';

interface TurnstileAPI {
  render(container: HTMLElement, options: {
    sitekey: string; theme: 'light'; size: 'flexible'; language: 'es';
    'response-field': boolean;
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }): string;
  remove(id: string): void;
}

declare global { interface Window { turnstile?: TurnstileAPI } }

// Every Auth attempt consumes its token, even if the password or email is wrong.
// Remounting creates a fresh widget for the next attempt; tokens are never stored.
export function useAuthCaptcha() {
  const [token, setToken] = useState('');
  const [revision, setRevision] = useState(0);
  return {
    token, setToken, revision,
    ready: !TURNSTILE_SITE_KEY || Boolean(token),
    reset() { setToken(''); setRevision(value => value + 1); },
  };
}

export default function AuthCaptcha({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!scriptReady || !container.current || !TURNSTILE_SITE_KEY) return;
    const api = window.turnstile;
    if (!api) return;
    let active = true;
    let id: string | undefined;
    try {
      id = api.render(container.current, {
        sitekey: TURNSTILE_SITE_KEY, theme: 'light', size: 'flexible', language: 'es',
        'response-field': false,
        callback(token) { if (active) { setError(''); onToken(token); } },
        'expired-callback'() { if (active) onToken(''); },
        'error-callback'() {
          if (active) { onToken(''); setError('No se pudo completar la comprobación de seguridad. Revisa tu conexión o recarga la página.'); }
        },
      });
    } catch {
      onToken('');
      // Defer state updates from setup; effect cleanup cancels them on navigation.
      queueMicrotask(() => { if (active) setError('No se pudo cargar la comprobación de seguridad. Recarga la página para volver a intentar.'); });
    }
    return () => { active = false; if (id !== undefined) api.remove(id); };
  }, [scriptReady, onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div className="min-w-0 space-y-2">
    <p className="form-hint">Comprobación de seguridad contra registros e intentos automáticos.</p>
    <Script id="flux-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      strategy="afterInteractive" onReady={() => setScriptReady(true)}
      onError={() => { onToken(''); setError('No se pudo cargar la comprobación de seguridad. Revisa tu conexión o los bloqueadores del navegador.'); }} />
    <div ref={container} />
    {error && <div role="alert" className="feedback error"><p>{error}</p>
      <button type="button" className="underline" onClick={() => window.location.reload()}>Recargar página</button>
    </div>}
  </div>;
}
