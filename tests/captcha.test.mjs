import test from 'node:test';
import assert from 'node:assert/strict';
import { captchaOptions, authRequestError } from '../lib/captcha.ts';
import { registerAccount, requestPasswordRecovery, resendSignupConfirmation, signInAccount } from '../lib/auth.ts';
import { createClient } from '@supabase/supabase-js';

const profile = { nombre_completo: 'Persona ficticia', username: 'persona', codigo_moneda: 'COP', url_avatar: null };
const origin = 'http://localhost:3000';

test('comprobación obligatoria rechaza tokens ausentes y valida el tamaño antes de solicitar acceso', () => {
  for (const value of [undefined, '', '   ']) assert.throws(() => captchaOptions(value, true), /seguridad/);
  assert.deepEqual(captchaOptions(undefined, false), {});
  assert.deepEqual(captchaOptions(' token-ficticio ', true), { captchaToken: 'token-ficticio' });
  assert.throws(() => captchaOptions('x'.repeat(2049), true), /seguridad/);
});

test('registro, acceso, recuperación y reenvío entregan el token a Supabase para validación en el servidor', async () => {
  const calls = [];
  const client = { auth: {
    async signUp(input) { calls.push(input.options); return { data: { session: null }, error: null }; },
    async signInWithPassword(input) { calls.push(input.options); return { error: null }; },
    async resetPasswordForEmail(_email, options) { calls.push(options); return { error: null }; },
    async resend(input) { calls.push(input.options); return { error: null }; },
  } };
  await registerAccount(client, 'persona@example.test', 'ClaveFicticia123!', profile, origin, 'token-registro');
  await signInAccount(client, 'persona@example.test', 'ClaveFicticia123!', 'token-acceso');
  await requestPasswordRecovery(client, 'persona@example.test', origin, 'token-recuperacion');
  await resendSignupConfirmation(client, 'persona@example.test', origin, 'token-reenvio');
  assert.deepEqual(calls.map(value => value.captchaToken), ['token-registro', 'token-acceso', 'token-recuperacion', 'token-reenvio']);
  assert.match(calls[0].emailRedirectTo, /next=%2Fdashboard$/);
  assert.match(calls[2].redirectTo, /next=%2Factualizar-clave$/);
});

test('un fallo CAPTCHA del servidor no se presenta como correo enviado ni acceso correcto', async () => {
  const error = { code: 'captcha_failed', message: 'Vendor internal detail' };
  const client = { auth: {
    async signUp() { return { error }; },
    async signInWithPassword() { return { error }; },
    async resetPasswordForEmail() { return { error }; },
    async resend() { return { error }; },
  } };
  for (const request of [
    () => registerAccount(client, 'persona@example.test', 'ClaveFicticia123!', profile, origin, 'token'),
    () => signInAccount(client, 'persona@example.test', 'ClaveFicticia123!', 'token'),
    () => requestPasswordRecovery(client, 'persona@example.test', origin, 'token'),
    () => resendSignupConfirmation(client, 'persona@example.test', origin, 'token'),
  ]) await assert.rejects(request(), /comprobación de seguridad/);
});

test('los mensajes traducen límites y no exponen detalles internos del proveedor', () => {
  assert.match(authRequestError({ code: 'over_email_send_rate_limit' }, 'Fallo'), /límite/);
  assert.match(authRequestError({ status: 429 }, 'Fallo'), /límite/);
  assert.match(authRequestError({ code: 'email_not_confirmed' }, 'Fallo'), /Confirma/);
  assert.equal(authRequestError({ code: 'unexpected_failure', message: 'internal detail' }, 'No se pudo completar.'), 'No se pudo completar.');
});

test('SDK Supabase real envía los cuatro tokens en el cuerpo HTTP y propaga el rechazo del servidor', async () => {
  const requests = [];
  const client = createClient('https://auth-ficticio.invalid', 'public-key-ficticia', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce' },
    global: { fetch: async (url, options) => {
      requests.push({ url: new URL(String(url)), body: JSON.parse(options.body) });
      return new Response(JSON.stringify({ code: 'captcha_failed', msg: 'Internal provider detail' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
      });
    } },
  });
  const attempts = [
    () => registerAccount(client, 'persona@example.test', 'ClaveFicticia123!', profile, origin, 'token-registro'),
    () => signInAccount(client, 'persona@example.test', 'ClaveFicticia123!', 'token-acceso'),
    () => requestPasswordRecovery(client, 'persona@example.test', origin, 'token-recuperacion'),
    () => resendSignupConfirmation(client, 'persona@example.test', origin, 'token-reenvio'),
  ];
  for (const attempt of attempts) await assert.rejects(attempt(), /comprobación de seguridad/);
  assert.deepEqual(requests.map(request => request.url.pathname), ['/auth/v1/signup', '/auth/v1/token', '/auth/v1/recover', '/auth/v1/resend']);
  assert.deepEqual(requests.map(request => request.body.gotrue_meta_security.captcha_token), ['token-registro', 'token-acceso', 'token-recuperacion', 'token-reenvio']);
});
