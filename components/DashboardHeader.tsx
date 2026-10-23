'use client';
import Link from 'next/link';
import Image from 'next/image';
import {UserCircle} from 'lucide-react';
import {formatAmount} from '@/lib/finance';
interface Props{nickname:string;saldo:number;moneda:string;avatarUrl?:string;}
export default function DashboardHeader({nickname,saldo,moneda,avatarUrl}:Props){
  return <header className="panel dashboard-overview"><div><h1>Hola, <span className="text-accent">{nickname}</span></h1><p className="mt-2 text-sm text-muted">Tus finanzas, con un poco más de claridad.</p></div><div className="dashboard-balance"><span className="text-xs text-muted">Saldo de tus movimientos</span><strong className={saldo<0?'text-danger money-value':'text-accent money-value'}>{formatAmount(saldo,moneda)}</strong></div><Link className="profile-link" href="/dashboard/configuracion" aria-label="Ver y editar tu perfil">{avatarUrl?<Image src={avatarUrl} alt="" width={40} height={40} unoptimized className="rounded-full"/>:<UserCircle size={40}/>}</Link></header>;
}
