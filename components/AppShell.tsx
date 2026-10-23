'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, ShieldCheck } from 'lucide-react';
import Sidebar from './Sidebar';
import Dialog from './ui/Dialog';
import SiteFooter from './SiteFooter';
const names: Record<string, string> = { dashboard: 'Resumen', movimientos: 'Movimientos', presupuestos: 'Presupuestos', metas: 'Metas de ahorro', recurrencias: 'Recurrencias', calendario: 'Calendario', configuracion: 'Configuración' };
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(), [menu, setMenu] = useState(false);
  useEffect(() => { document.getElementById('main-content')?.focus({ preventScroll: true }); }, [pathname]);
  return <div className="app-shell"><a className="skip-link" href="#main-content">Ir al contenido</a>
    <div className="desktop-sidebar"><Sidebar /></div>
    <div className="app-workspace"><header className="app-topbar"><div className="breadcrumb">
      <button className="icon-button mobile-menu-button" type="button" aria-label="Abrir navegación" onClick={() => setMenu(true)}><Menu size={21} /></button>
      <Link href="/dashboard">Mi espacio</Link><span aria-hidden="true">/</span><strong>{names[pathname.split('/').at(-1) || 'dashboard'] || 'Flux'}</strong>
    </div><span className="privacy-label"><ShieldCheck size={16} />Finanzas personales</span></header>
      <main id="main-content" tabIndex={-1} className="app-main">{children}</main>
      <SiteFooter />
    </div>
    {menu && <Dialog title="Tu espacio" description="Organiza tus finanzas, a tu ritmo." onClose={() => setMenu(false)}><Sidebar mobile onNavigate={() => setMenu(false)} /></Dialog>}
  </div>;
}
