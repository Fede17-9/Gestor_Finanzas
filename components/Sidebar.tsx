"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Target, 
  Calendar, 
  Settings, 
  LogOut,
  Infinity
} from 'lucide-react';

const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { name: 'Movimientos', icon: ArrowLeftRight, href: '/dashboard/movimientos' },
  { name: 'Calendario', icon: Calendar, href: '/dashboard/calendario' },
  { name: 'Metas', icon: Target, href: '/dashboard/metas' },
  { name: 'Configuración', icon: Settings, href: '/dashboard/configuracion' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="w-64 h-screen bg-[#09090b] text-zinc-300 flex flex-col fixed left-0 top-0 z-50 border-r border-zinc-800/50 shadow-2xl">
      {/* Header del Sidebar */}
      <div className="p-8 flex items-center gap-3">
        <Infinity className="text-[#39FF14]" size={36} strokeWidth={2.5} />
        <span className="text-xl font-black text-white tracking-widest uppercase">
          Flux
        </span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto mt-4">
        {menuItems.map((item) => {
          const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(item.href);
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'bg-[#39FF14]/10 text-[#39FF14] font-semibold border border-[#39FF14]/20 shadow-[0_0_15px_rgba(57,255,20,0.1)]' 
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
              }`}
            >
              <item.icon size={20} className={isActive ? 'drop-shadow-[0_0_8px_rgba(57,255,20,0.8)]' : ''} />
              <span className="tracking-wide text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Usuario */}
      <div className="p-4">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full text-zinc-500 hover:text-[#ff3939] hover:bg-[#ff3939]/10 rounded-xl transition-all duration-300 group"
        >
          <LogOut size={20} className="group-hover:scale-110 transition-transform" />
          <span className="font-medium text-sm">Desconectar</span>
        </button>
      </div>
    </aside>
  );
}
