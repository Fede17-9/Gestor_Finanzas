import Link from 'next/link';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Créditos de recursos' };
export default function CreditsPage() {
  return <main className="mx-auto max-w-2xl p-6 sm:p-10"><Link className="text-accent underline" href="/dashboard">Volver a Flux</Link>
    <section className="panel mt-6 space-y-5"><h1 className="text-3xl font-semibold">Créditos de recursos</h1><p className="form-hint">La interfaz utiliza estos recursos con sus respectivas licencias.</p>
      <p><strong>Iconos:</strong> Lucide y los iconos derivados de Feather, bajo licencias ISC y MIT. <a className="text-accent underline" href="https://lucide.dev/license">Licencias</a>.</p>
      <p><strong>Tipografía:</strong> Geist de Vercel, en colaboración con basement.studio, bajo SIL Open Font License 1.1. <a className="text-accent underline" href="https://github.com/vercel/geist-font/blob/main/LICENSE.txt">Licencia</a>.</p>
      <p><strong>Avatares:</strong> Fun Emoji, adaptación de DiceBear de <a className="text-accent underline" href="https://www.figma.com/community/file/968125295144990435">Fun Emoji Set</a> de Davis Uche, bajo <a className="text-accent underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Se generan mediante el estilo de DiceBear con las semillas elegidas.</p>
      <a className="text-accent underline" href="/third-party-notices.txt">Avisos y textos de licencia</a>
    </section>
  </main>;
}
