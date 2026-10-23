import Image from 'next/image';
import { profileAvatarSource } from '@/lib/profile-avatars';

export default function ProfileAvatar({ value, size = 40 }: {
  value?: string | null;
  size?: number;
}) {
  return <Image src={profileAvatarSource(value)} alt="" width={size} height={size} unoptimized className="shrink-0 rounded-full" />;
}
