// This is a PUBLIC widget key. The secret belongs only in Supabase Auth settings.
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';

export function captchaOptions(token?: string, required = Boolean(TURNSTILE_SITE_KEY)): { captchaToken?: string } {
  const value = token?.trim();
  if (!value) {
    if (required) throw new Error('Completa la comprobación de seguridad antes de continuar.');
    return {};
  }
  if (value.length > 2048) throw new Error('La comprobación de seguridad no es válida. Vuelve a intentarlo.');
  return { captchaToken: value };
}

export function authRequestError(error: { code?: string; status?: number }, fallback: string): string {
  if (error.code === 'captcha_failed') return 'No se pudo verificar la comprobación de seguridad. Complétala de nuevo e intenta otra vez.';
  if (error.status === 429 || error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') {
    return 'Se alcanzó el límite de solicitudes. Espera un tiempo antes de volver a intentar.';
  }
  if (error.code === 'email_not_confirmed') return 'Confirma tu correo antes de entrar.';
  return fallback;
}
