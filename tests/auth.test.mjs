import test from 'node:test';
import assert from 'node:assert/strict';
import { accountDestination, authRedirect, completeAuthLink, createOwnProfile, initializeMetadataProfile, registerAccount, validatePassword, validateProfile, verifiedUser } from '../lib/auth.ts';

const profile = { nombre_completo: 'Persona ficticia', username: 'persona', codigo_moneda: 'COP', url_avatar: null };
function clientFor(options = {}) {
  const calls = [];
  let existing = options.existing ?? false;
  const user = { id: 'verified-user', user_metadata: options.metadata ?? profile };
  return {
    calls,
    auth: {
      async getUser() { calls.push(['getUser']); return { data: { user: options.anonymous ? null : user }, error: options.authError ?? null }; },
      async signUp(input) { calls.push(['signUp', input]); return { data: { user, session: options.confirmed ? { user } : null }, error: null }; },
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
