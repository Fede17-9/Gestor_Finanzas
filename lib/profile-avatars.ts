export const PROFILE_AVATARS = [
  { src: '/avatars/persona.svg', label: 'Persona' },
  { src: '/avatars/portafolio.svg', label: 'Portafolio' },
  { src: '/avatars/brujula.svg', label: 'Brújula' },
  { src: '/avatars/montana.svg', label: 'Montaña' },
  { src: '/avatars/hoja.svg', label: 'Hoja' },
  { src: '/avatars/libro.svg', label: 'Libro' },
] as const;

export const DEFAULT_PROFILE_AVATAR = PROFILE_AVATARS[0].src;

export function isProfileAvatar(value: string): boolean {
  return PROFILE_AVATARS.some(avatar => avatar.src === value);
}

// Existing profiles and pending email confirmations can still contain old URLs.
// Display only our local icons; changing stored preferences requires saving the profile.
export function profileAvatarSource(value: string | null | undefined): string {
  return value && isProfileAvatar(value) ? value : DEFAULT_PROFILE_AVATAR;
}
