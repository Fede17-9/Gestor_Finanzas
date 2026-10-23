import Link from 'next/link';

export default function SiteFooter({ compact = false }: { compact?: boolean }) {
  return <footer className={compact
    ? 'mt-6 space-y-3 border-t border-line pt-4 text-center text-xs text-muted'
    : 'app-footer flex-wrap items-center'}>
    <p>Desarrollado por{' '}
      <a href="https://github.com/Fede17-9" target="_blank" rel="noopener noreferrer"
        className="underline underline-offset-2" aria-label="Ver el GitHub de Juan Federico Pulido Betancur (abre otra pestaña)">
        Juan Federico Pulido Betancur
      </a>
    </p>
    <nav aria-label="Autor y recursos" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
      <a className="underline underline-offset-2" href="mailto:jufepube@gmail.com">Contacto</a>
      <Link className="underline underline-offset-2" href="/creditos">Créditos de recursos</Link>
    </nav>
  </footer>;
}
