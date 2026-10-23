'use client';
import Link from 'next/link';
import {useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
import {LayoutDashboard,ArrowLeftRight,Target,Wallet,CalendarDays,Settings2,LogOut,Repeat2,ShieldCheck} from 'lucide-react';
const items=[
  {name:'Resumen',icon:LayoutDashboard,href:'/dashboard'},
  {name:'Movimientos',icon:ArrowLeftRight,href:'/dashboard/movimientos'},
  {name:'Presupuestos',icon:Wallet,href:'/dashboard/presupuestos'},
  {name:'Metas de ahorro',icon:Target,href:'/dashboard/metas'},
  {name:'Recurrencias',icon:Repeat2,href:'/dashboard/recurrencias'},
  {name:'Calendario',icon:CalendarDays,href:'/dashboard/calendario'},
  {name:'Configuración',icon:Settings2,href:'/dashboard/configuracion'},
];
export default function Sidebar({mobile=false,onNavigate}:{mobile?:boolean;onNavigate?:()=>void}){
  const pathname=usePathname(),router=useRouter();
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function logout(){if(busy)return;setBusy(true);setError('');try{const {error}=await supabase.auth.signOut();if(error)throw error;onNavigate?.();router.replace('/login');}catch{setError('No se pudo cerrar la sesión. Intenta de nuevo.');}finally{setBusy(false);}}
  return <aside className={mobile?'app-sidebar mobile-sidebar':'app-sidebar'} aria-label="Menú de Flux">
    {!mobile&&<Link className="app-brand" href="/dashboard"><span aria-hidden="true">f.</span>flux</Link>}
    <p className="nav-caption">TU ESPACIO PERSONAL</p><nav className="app-navigation" aria-label="Navegación principal">{items.map(item=><Link key={item.href} href={item.href} onClick={onNavigate} aria-current={pathname===item.href?'page':undefined}><item.icon size={19} strokeWidth={1.7}/><span>{item.name}</span>{pathname===item.href&&<span className="nav-dot"/>}</Link>)}</nav>
    <div className="sidebar-footer">{!mobile&&<div className="sidebar-note"><ShieldCheck size={19}/><strong>A tu ritmo</strong><p>Un poco de claridad hoy.<br/>Más tranquilidad mañana.</p></div>}
      <button type="button" className="logout-button" disabled={busy} onClick={()=>void logout()}><LogOut size={18}/>{busy?'Cerrando sesión…':'Cerrar sesión'}</button>{error&&<p role="alert" className="feedback error">{error}</p>}
    </div>
  </aside>;
}
