import test from 'node:test';
import assert from 'node:assert/strict';
import { accountDestination, authRedirect, completeAuthLink, confirmedSignupDestination, createOwnProfile, initializeMetadataProfile, registerAccount, requestPasswordRecovery, resendSignupConfirmation, validatePassword, validateProfile, verifiedUser } from '../lib/auth.ts';
import { createClient } from '@supabase/supabase-js';
import { updateRecoveryPassword } from '../lib/auth.ts';

const profile = { nombre_completo: 'Persona ficticia', username: 'persona', codigo_moneda: 'COP', url_avatar: null };

test('guardar contraseña distingue reutilización, debilidad y sesión vencida', async () => {
  for (const [error, expected] of [
    [{ code: 'same_password' }, /diferente/], [{ code: 'weak_password' }, /política/],
    [{ status: 401 }, /sesión/], [{ code: 'session_expired' }, /sesión/],
    [{ status: 429 }, /límite/], [{ code: 'unexpected_failure', message: 'sensitive text' }, /unexpected_failure/],
  ]) {
    const client = { auth: { async updateUser() { return { error }; } } };
    await assert.rejects(updateRecoveryPassword(client, 'ClaveFicticia123!'), expected);
  }
});

test('guardar contraseña valida antes de enviar y solo actualiza la contraseña', async () => {
  const calls = [];
  const client = { auth: { async updateUser(input) { calls.push(input); return { error: null }; } } };
  await assert.rejects(updateRecoveryPassword(client, 'corta'), /8/);
  assert.equal(calls.length, 0);
  await updateRecoveryPassword(client, 'ClaveFicticia123!');
  assert.deepEqual(calls, [{ password: 'ClaveFicticia123!' }]);
});
function clientFor(options = {}) {
  const calls = [];
  let existing = options.existing ?? false;
  const user = { id: 'verified-user', email: options.email ?? 'persona@example.test', email_confirmed_at: options.unconfirmed ? null : '2026-10-22T12:00:00Z', user_metadata: options.metadata ?? profile };
  return {
    calls,
    auth: {
      async getUser() { calls.push(['getUser']); return { data: { user: options.anonymous ? null : user }, error: options.authError ?? null }; },
      async signUp(input) { calls.push(['signUp', input]); return { data: { user, session: options.confirmed ? { user } : null }, error: null }; },
      async resend(input) { calls.push(['resend', input]); return { data: {}, error: options.resendError ?? null }; },
      async resetPasswordForEmail(email, input) { calls.push(['recover', email, input]); return { data: {}, error: options.recoveryError ?? null }; },
      async exchangeCodeForSession(code) { calls.push(['exchange', code]); return { data: { redirectType: options.recovery ? 'PASSWORD_RECOVERY' : null }, error: options.linkError ?? null }; },
      async setSession(tokens) { calls.push(['setSession', tokens]); return { error: null }; },
    },
    from(table) {
      assert.equal(table, 'usuarios');
      const query = {
        select() { return this; },
        eq(field, id) { calls.push(['owner', field, id]); assert.equal(field, 'id_usuario'); assert.equal(id, user.id); return this; },
        async maybeSingle() { return { data: existing ? { id_usuario: user.id } : null, error: options.readError ?? null }; },
      };
      return {
        ...query,
        async insert(value) {
          calls.push(['insert', value]);
          if (options.insertError) return { error: options.insertError };
          existing = true;
          return { error: null };
        },
      };
    },
  };
}

test('registro con confirmación de correo no inserta perfil sin una sesión', async () => {
  const client = clientFor();
  const result = await registerAccount(client, ' persona@example.test ', 'UnaClave123', profile, 'http://localhost:3000');
  assert.deepEqual(result, { confirmationRequired: true, destination: null });
  assert.equal(client.calls.some(([operation]) => operation === 'insert'), false);
  const request = client.calls.find(([operation]) => operation === 'signUp')[1];
  assert.equal(request.email, 'persona@example.test');
  assert.deepEqual(request.options.data, profile);
  assert.equal(request.options.emailRedirectTo, 'http://localhost:3000/auth/callback?next=%2Fdashboard');
});

test('reenvío solicita confirmación existente sin repetir signUp ni insertar un perfil', async () => {
  const client = clientFor({ anonymous: true });
  await resendSignupConfirmation(client, ' persona@example.test ', 'http://localhost:3000');
  assert.deepEqual(client.calls, [['resend', {
    type: 'signup', email: 'persona@example.test',
    options: { emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2Fdashboard' },
  }]]);
});

test('recuperación solicita correo con callback propio sin consultar perfiles ni crear cuentas', async () => {
  const client = clientFor({ anonymous: true });
  await requestPasswordRecovery(client, ' persona@example.test ', 'http://localhost:3000');
  assert.deepEqual(client.calls, [['recover', 'persona@example.test', {
    redirectTo: 'http://localhost:3000/auth/callback?next=%2Factualizar-clave',
  }]]);
});

test('recuperación distingue límite de envío, dirección no autorizada y fallo del servidor', async () => {
  for (const error of [{ status: 429 }, { code: 'over_email_send_rate_limit' }, { code: 'over_request_rate_limit' }]) {
    await assert.rejects(requestPasswordRecovery(clientFor({ recoveryError: error }), 'persona@example.test', 'http://localhost:3000'), /límite/);
  }
  await assert.rejects(requestPasswordRecovery(clientFor({ recoveryError: { code: 'email_address_not_authorized' } }), 'persona@example.test', 'http://localhost:3000'), /no permite enviar/);
  await assert.rejects(requestPasswordRecovery(clientFor({ recoveryError: { status: 500 } }), 'persona@example.test', 'http://localhost:3000'), /servidor no pudo/);
  await assert.rejects(requestPasswordRecovery(clientFor({ recoveryError: { name: 'AuthRetryableFetchError', status: 0 } }), 'persona@example.test', 'http://localhost:3000'), /conexión/);
  await assert.rejects(requestPasswordRecovery(clientFor({ recoveryError: { status: 400, message: 'Private data' } }), 'persona@example.test', 'http://localhost:3000'), /rechazada/);
});

test('cliente Supabase real: recuperación transmite PKCE y callback; rechazos 429 y 500 no se ocultan', async () => {
  for (const status of [200, 429, 500]) {
    const requests = [];
    const client = createClient('https://finance.invalid', 'public-test-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce' },
      global: { fetch: async (url, init) => {
        requests.push({ url: String(url), method: init.method, body: JSON.parse(init.body) });
        return new Response(JSON.stringify(status === 200 ? {} : { code: status === 429 ? 'over_email_send_rate_limit' : 'unexpected_failure', msg: 'Test failure' }), {
          status, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
        });
      } },
    });
    const result = requestPasswordRecovery(client, 'persona@example.test', 'http://localhost:3000');
    if (status === 200) await result;
    else await assert.rejects(result, status === 429 ? /límite/ : /servidor no pudo/);
    assert.equal(requests.length, 1);
    assert.equal(new URL(requests[0].url).pathname, '/auth/v1/recover');
    assert.equal(new URL(requests[0].url).searchParams.get('redirect_to'), 'http://localhost:3000/auth/callback?next=%2Factualizar-clave');
    assert.equal(requests[0].method, 'POST');
    assert.equal(requests[0].body.email, 'persona@example.test');
    assert.equal(requests[0].body.code_challenge_method, 's256');
    assert.ok(requests[0].body.code_challenge.length > 0);
  }
});

test('reenvío informa límites y rechazos sin anunciar un correo enviado', async () => {
  for (const error of [{ status: 429 }, { code: 'over_email_send_rate_limit' }, { code: 'over_request_rate_limit' }]) {
    await assert.rejects(resendSignupConfirmation(clientFor({ resendError: error }), 'persona@example.test', 'http://localhost:3000'), /límite/);
  }
  await assert.rejects(resendSignupConfirmation(clientFor({ resendError: { status: 500 } }), 'persona@example.test', 'http://localhost:3000'), /No se pudo solicitar/);
});

test('pestaña de registro solo continúa para la misma cuenta verificada, incluyendo perfil pendiente', async () => {
  assert.equal(await confirmedSignupDestination(clientFor({ existing: true }), ' PERSONA@example.test '), '/dashboard');
  assert.equal(await confirmedSignupDestination(clientFor(), 'persona@example.test'), '/completar-perfil');
  for (const options of [{ anonymous: true }, { unconfirmed: true }, { email: 'otra@example.test' }]) {
    const client = clientFor(options);
    assert.equal(await confirmedSignupDestination(client, 'persona@example.test'), null);
    assert.equal(client.calls.some(([operation]) => operation === 'owner'), false);
  }
});

test('cliente Supabase real: reenvío emite POST resend con callback, sin tráfico externo', async () => {
  const requests = [];
  const client = createClient('https://finance.invalid', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce' },
    global: { fetch: async (url, init) => {
      requests.push({ url: String(url), method: init.method, body: JSON.parse(init.body) });
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  await resendSignupConfirmation(client, 'persona@example.test', 'http://localhost:3000');
  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.equal(request.method, 'POST');
  assert.equal(new URL(request.url).pathname, '/auth/v1/resend');
  assert.equal(new URL(request.url).searchParams.get('redirect_to'), 'http://localhost:3000/auth/callback?next=%2Fdashboard');
  assert.equal(request.body.email, 'persona@example.test');
  assert.equal(request.body.type, 'signup');
  assert.equal('password' in request.body, false);
});

test('si el servicio entrega sesión válida, completa el perfil con la identidad verificada', async () => {
  const client = clientFor({ confirmed: true });
  assert.equal((await registerAccount(client, 'persona@example.test', 'UnaClave123', profile, 'http://localhost:3000')).destination, '/dashboard');
  assert.equal(client.calls.find(([operation]) => operation === 'insert')[1].id_usuario, 'verified-user');
});

test('metadata modificable no puede sobrescribir un perfil existente', async () => {
  const client = clientFor({ existing: true, metadata: { ...profile, codigo_moneda: 'USD', id_usuario: 'foreign' } });
  assert.equal(await initializeMetadataProfile(client), '/dashboard');
  assert.equal(client.calls.some(([operation]) => operation === 'insert'), false);
});

test('completar perfil ignora un propietario proporcionado por el formulario', async () => {
  const client = clientFor();
  await createOwnProfile(client, { ...profile, id_usuario: 'someone-else', role: 'admin' });
  const inserted = client.calls.find(([operation]) => operation === 'insert')[1];
  assert.equal(inserted.id_usuario, 'verified-user');
  assert.equal('role' in inserted, false);
});

test('alias ocupado o metadata incompleta lleva a completar perfil sin perder la cuenta', async () => {
  assert.equal(await initializeMetadataProfile(clientFor({ insertError: { code: '23505' } })), '/completar-perfil');
  assert.equal(await initializeMetadataProfile(clientFor({ metadata: {} })), '/completar-perfil');
});

test('guardia central distingue sesión ausente, perfil pendiente y cuenta lista', async () => {
  assert.equal(await accountDestination(clientFor({ anonymous: true })), '/login');
  assert.equal(await accountDestination(clientFor()), '/completar-perfil');
  assert.equal(await accountDestination(clientFor({ existing: true })), '/dashboard');
});

test('un error de conexión o permisos se informa; no se interpreta como ausencia de perfil', async () => {
  await assert.rejects(accountDestination(clientFor({ readError: { message: 'Sin red' } })), /consultar tu perfil/);
  await assert.rejects(verifiedUser(clientFor({ authError: { name: 'AuthRetryableFetchError', status: 0 } })), /comprobar tu sesión/);
  assert.equal(await verifiedUser(clientFor({ authError: { name: 'AuthSessionMissingError' } })), null);
});

test('enlaces de autenticación no aceptan un redirect externo aunque su next esté manipulado', async () => {
  const client = clientFor({ existing: true });
  const result = await completeAuthLink(client, 'http://localhost:3000/auth/callback?code=valid&next=https://evil.invalid');
  assert.equal(result.destination, '/dashboard');
  assert.deepEqual(client.calls.find(([operation]) => operation === 'exchange'), ['exchange', 'valid']);
});

test('recuperación se reconoce por el intercambio PKCE, no solo por un next de la URL', async () => {
  assert.equal((await completeAuthLink(clientFor({ recovery: true }), 'http://localhost:3000/auth/callback?code=valid')).destination, '/actualizar-clave');
  assert.equal((await completeAuthLink(clientFor({ existing: true }), 'http://localhost:3000/auth/callback?code=valid&next=/actualizar-clave')).destination, '/dashboard');
});

test('enlace vencido o sin código no reutiliza una sesión anterior como prueba de recuperación', async () => {
  await assert.rejects(completeAuthLink(clientFor({ existing: true }), 'http://localhost:3000/auth/callback?next=/actualizar-clave'), /Falta el código/);
  await assert.rejects(completeAuthLink(clientFor({ existing: true, linkError: new Error('Expired') }), 'http://localhost:3000/auth/callback?code=expired'), /verificar el enlace/);
});

test('acepta enlaces implícitos antiguos después de verificar la identidad', async () => {
  const client = clientFor();
  assert.equal((await completeAuthLink(client, 'http://localhost:3000/auth/callback#access_token=test-access&refresh_token=test-refresh&type=recovery')).destination, '/actualizar-clave');
  assert.deepEqual(client.calls.find(([operation]) => operation === 'setSession')[1], { access_token: 'test-access', refresh_token: 'test-refresh' });
});

test('contraseñas y perfiles se validan antes de solicitar registro', async () => {
  assert.throws(() => validatePassword('corta'), /al menos 8/);
  assert.throws(() => validatePassword('x'.repeat(129)), /128/);
  assert.throws(() => validateProfile({ ...profile, username: ' a ' }), /entre 3 y 32/);
  assert.throws(() => validateProfile({ ...profile, codigo_moneda: 'BAD' }), /moneda/);
  assert.throws(() => validateProfile({ ...profile, url_avatar: 'https://untrusted.invalid/image' }), /avatares/);
  assert.equal(authRedirect('https://example.test', '/actualizar-clave'), 'https://example.test/auth/callback?next=%2Factualizar-clave');
});
