import type { User } from '@supabase/supabase-js';
import type { AppSupabaseClient } from './supabase.ts';
import { isProfileAvatar } from './profile-avatars.ts';

export interface ProfileInput {
  nombre_completo: string;
  username: string;
  codigo_moneda: string;
  url_avatar: string | null;
}

export function validateProfile(input: ProfileInput): ProfileInput {
  const nombre = input.nombre_completo.trim();
  const username = input.username.trim();
  if (!nombre || nombre.length > 120) throw new Error('Escribe tu nombre, con un máximo de 120 caracteres.');
  if (username.length < 3 || username.length > 32) throw new Error('El alias debe tener entre 3 y 32 caracteres.');
  if (!['COP','USD','EUR'].includes(input.codigo_moneda)) throw new Error('Selecciona una moneda válida.');
  if (input.url_avatar && !isProfileAvatar(input.url_avatar) && !/^https:\/\/api\.dicebear\.com\/9\.x\/fun-emoji\/svg\?seed=[A-Za-z]+$/.test(input.url_avatar)) {
    throw new Error('Selecciona uno de los avatares disponibles.');
  }
  return { nombre_completo: nombre, username, codigo_moneda: input.codigo_moneda, url_avatar: input.url_avatar };
}

export function validatePassword(password: string): void {
  if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  if (password.length > 128) throw new Error('La contraseña no puede superar 128 caracteres.');
}

export function authRedirect(origin: string, next: '/dashboard' | '/actualizar-clave' = '/dashboard'): string {
  const url = new URL('/auth/callback', origin);
  url.searchParams.set('next', next);
  return url.href;
}

export async function verifiedUser(client: AppSupabaseClient): Promise<User | null> {
  const { data, error } = await client.auth.getUser();
  if (error) {
    if (error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403) return null;
    throw new Error('No se pudo comprobar tu sesión. Revisa la conexión e intenta de nuevo.');
  }
  return data.user;
}

export async function hasProfile(client: AppSupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await client.from('usuarios').select('id_usuario').eq('id_usuario', userId).maybeSingle();
  if (error) throw new Error('No se pudo consultar tu perfil. Revisa la conexión y los permisos de Supabase.');
  return Boolean(data);
}

export async function createOwnProfile(client: AppSupabaseClient, input: ProfileInput): Promise<void> {
  const profile = validateProfile(input);
  const user = await verifiedUser(client);
  if (!user) throw new Error('Inicia sesión antes de completar tu perfil.');
  // An existing profile is never overwritten using mutable Auth metadata.
  if (await hasProfile(client, user.id)) return;
  const { error } = await client.from('usuarios').insert({ ...profile, id_usuario: user.id });
  if (error) {
    if (error.code === '23505') {
      if (await hasProfile(client, user.id)) return; // Same-user concurrent completion.
      throw new Error('Ese alias ya está en uso. Elige otro.');
    }
    throw new Error('No se pudo guardar tu perfil. Intenta de nuevo; tu cuenta se conserva.');
  }
}

export async function accountDestination(client: AppSupabaseClient): Promise<'/dashboard' | '/completar-perfil' | '/login'> {
  const user = await verifiedUser(client);
  if (!user) return '/login';
  return await hasProfile(client, user.id) ? '/dashboard' : '/completar-perfil';
}

export async function initializeMetadataProfile(client: AppSupabaseClient): Promise<string> {
  const user = await verifiedUser(client);
  if (!user) return '/login';
  if (await hasProfile(client, user.id)) return '/dashboard';
  const metadata = user.user_metadata;
  let input: ProfileInput;
  try {
    input = validateProfile({
      nombre_completo: String(metadata.nombre_completo ?? ''), username: String(metadata.username ?? ''),
      codigo_moneda: String(metadata.codigo_moneda ?? ''), url_avatar: typeof metadata.url_avatar === 'string' ? metadata.url_avatar : null,
    });
  } catch { return '/completar-perfil'; }
  try { await createOwnProfile(client, input); return '/dashboard'; }
  catch { return '/completar-perfil'; }
}

export async function registerAccount(client: AppSupabaseClient, email: string, password: string, input: ProfileInput, origin: string) {
  const profile = validateProfile(input);
  validatePassword(password);
  const { data, error } = await client.auth.signUp({
    email: email.trim(), password,
    options: { data: profile, emailRedirectTo: authRedirect(origin) },
  });
  if (error) throw new Error(error.message);
  // With Confirm email enabled there is no session yet: no public table INSERT.
  if (!data.session) return { confirmationRequired: true, destination: null };
  return { confirmationRequired: false, destination: await initializeMetadataProfile(client) };
}

export async function resendSignupConfirmation(client: AppSupabaseClient, email: string, origin: string): Promise<void> {
  const { error } = await client.auth.resend({
    type: 'signup', email: email.trim(), options: { emailRedirectTo: authRedirect(origin) },
  });
  if (error) {
    if (error.status === 429 || error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') {
      throw new Error('Se alcanzó el límite de solicitudes de correo. Espera un tiempo antes de volver a intentar.');
    }
    throw new Error('No se pudo solicitar el reenvío. Revisa la conexión e intenta de nuevo más tarde.');
  }
}

export async function requestPasswordRecovery(client: AppSupabaseClient, email: string, origin: string): Promise<void> {
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: authRedirect(origin, '/actualizar-clave'),
  });
  if (!error) return; // Acceptance does not prove account existence or inbox delivery.
  if (error.status === 429 || error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') {
    throw new Error('El servicio alcanzó su límite de envío de correos. Espera antes de volver a intentar. Los correos de registro y recuperación comparten ese límite.');
  }
  if (error.code === 'email_address_not_authorized') {
    throw new Error('El servicio de correo del proyecto no permite enviar a esta dirección. Es necesario configurar el envío de correos en Supabase.');
  }
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    throw new Error('No se pudo conectar con el servicio de recuperación. Revisa tu conexión antes de volver a intentar.');
  }
  if ((error.status ?? 0) >= 500) {
    throw new Error('El servidor no pudo procesar el envío. Hay que revisar los registros de autenticación y la configuración del servicio de correo.');
  }
  throw new Error('La solicitud de recuperación fue rechazada. Revisa la configuración de autenticación del proyecto antes de volver a intentar.');
}

export async function confirmedSignupDestination(client: AppSupabaseClient, email: string): Promise<string | null> {
  const user = await verifiedUser(client);
  if (!user?.email_confirmed_at || user.email?.trim().toLowerCase() !== email.trim().toLowerCase()) return null;
  return await hasProfile(client, user.id) ? '/dashboard' : '/completar-perfil';
}

export async function updateRecoveryPassword(client: AppSupabaseClient, password: string): Promise<void> {
  validatePassword(password);
  const { error } = await client.auth.updateUser({ password });
  if (!error) return;
  if (error.code === 'same_password') throw new Error('La contraseña nueva debe ser diferente de la anterior. Elige otra e intenta guardar de nuevo.');
  if (error.code === 'weak_password') throw new Error('La contraseña no cumple la política de seguridad de tu cuenta. Usa una contraseña más larga que combine mayúsculas, minúsculas, números y símbolos.');
  if (error.status === 401 || ['session_not_found', 'session_expired', 'bad_jwt', 'refresh_token_not_found'].includes(error.code ?? '')) {
    throw new Error('La sesión de recuperación ya no es válida. Solicita un enlace nuevo y ábrelo en este navegador.');
  }
  if (error.code === 'reauthentication_needed' || error.code === 'reauthentication_not_valid') throw new Error('El servicio requiere verificar nuevamente tu identidad. Solicita y abre un enlace de recuperación nuevo.');
  if (error.status === 429) throw new Error('Se alcanzó el límite de intentos. Espera antes de volver a guardar.');
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) throw new Error('No se pudo comprobar el cambio por un problema de conexión. Revisa la conexión y prueba iniciar sesión antes de repetirlo.');
  const reference = error.code && /^[a-z_]+$/.test(error.code) ? error.code : String(error.status ?? 'sin_codigo');
  throw new Error(`No se pudo guardar la contraseña. Comparte esta referencia para revisar la causa: ${reference}.`);
}

export async function completeAuthLink(client: AppSupabaseClient, href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.has('error') || hash.has('error')) throw new Error('El enlace venció o no es válido. Solicita uno nuevo.');
  let recovery = hash.get('type') === 'recovery';
  const code = url.searchParams.get('code');
  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw new Error('No se pudo verificar el enlace. Ábrelo en el navegador donde lo solicitaste o pide otro.');
    const redirectType = 'redirectType' in data ? data.redirectType : null;
    recovery = redirectType === 'PASSWORD_RECOVERY' || redirectType === 'recovery';
  } else {
    // Accept old implicit-flow links while newly issued links use PKCE.
    const access_token = hash.get('access_token'), refresh_token = hash.get('refresh_token');
    if (!access_token || !refresh_token) throw new Error('Falta el código del enlace. Solicita uno nuevo.');
    const { error } = await client.auth.setSession({ access_token, refresh_token });
    if (error) throw new Error('El enlace no es válido o ya venció.');
  }
  const user = await verifiedUser(client);
  if (!user) throw new Error('No se pudo verificar la identidad del enlace.');
  return { userId: user.id, destination: recovery ? '/actualizar-clave' : await initializeMetadataProfile(client) };
}
