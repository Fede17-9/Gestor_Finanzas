"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Target, 
  Calendar, 
  Settings, 
  LogOut 
} from 'lucide-react';

const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { name: 'Movimientos', icon: ArrowLeftRight, href: '/movimientos' },
  { name: 'Calendario', icon: Calendar, href: '/calendario' },
  { name: 'Metas de Ahorro', icon: Target, href: '/metas' },
  { name: 'Configuración', icon: Settings, href: '/configuracion' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen bg-slate-900 text-white flex flex-col fixed left-0 top-0 z-50">
      {/* Header del Sidebar */}
      <div className="p-6 text-2xl font-bold border-b border-slate-800 text-blue-400">
        FinanzaPro
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Usuario */}
      <div className="p-4 border-t border-slate-800">
        <button className="flex items-center gap-3 p-3 w-full text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors">
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
