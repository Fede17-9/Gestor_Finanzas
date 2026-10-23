import { Check } from 'lucide-react';
import { PROFILE_AVATARS } from '@/lib/profile-avatars';
import ProfileAvatar from './ProfileAvatar';

export default function ProfileAvatarPicker({ value, onChange }: {
  value: string;
  onChange: (value: string) => void;
}) {
  return <fieldset>
    <legend className="field-label mb-3">Icono de perfil</legend>
    <div className="flex flex-wrap gap-2">
      {PROFILE_AVATARS.map(avatar => <button
        key={avatar.src}
        type="button"
        aria-label={`Usar icono: ${avatar.label}`}
        aria-pressed={value === avatar.src}
        onClick={() => onChange(avatar.src)}
        className={`relative flex w-20 flex-col items-center gap-2 rounded-xl border p-2 text-xs transition-colors ${value === avatar.src ? 'border-accent bg-soft text-accent' : 'border-line bg-surface text-muted hover:bg-paper'}`}
      >
        <ProfileAvatar value={avatar.src} />
        <span>{avatar.label}</span>
        {value === avatar.src && <Check size={13} aria-hidden="true" className="absolute right-1 top-1" />}
      </button>)}
    </div>
  </fieldset>;
}
