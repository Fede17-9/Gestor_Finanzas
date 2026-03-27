"use client";
import { Bell, UserCircle } from 'lucide-react';

interface HeaderProps {
  nickname: string;
  saldo: number;
  moneda: string;
  avatarUrl?: string; 
}

export default function DashboardHeader({ nickname, saldo, moneda, avatarUrl }: HeaderProps) {
  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 bg-[#09090b]/80 backdrop-blur-xl p-8 rounded-3xl border border-zinc-800/50 shadow-2xl relative overflow-hidden group">
      
      {/* Línea decorativa neón que aparece en hover */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>

      <div className="z-10">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Sistema <span className="text-[#39FF14] drop-shadow-[0_0_10px_rgba(57,255,20,0.4)]">{nickname}</span>
        </h1>
        <p className="text-zinc-500 text-xs mt-2 uppercase tracking-widest font-semibold">
          Estado Financiero Sincronizado
        </p>
      </div>

      <div className="flex items-center gap-8 mt-6 md:mt-0 z-10 w-full md:w-auto">
        {/* Visualización del Saldo */}
        <div className="text-right flex-1 md:flex-none">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Capital Activo</p>
          <p className={`text-4xl font-black tracking-tighter ${saldo >= 0 ? 'text-white' : 'text-[#ff3939]'}`}>
            {saldo.toLocaleString()} <span className="text-lg font-medium text-[#39FF14]">{moneda}</span>
          </p>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-4 border-l pl-8 border-zinc-800">
          <button className="grid place-items-center w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-[#39FF14] hover:border-[#39FF14]/30 transition-all focus:outline-none hover:shadow-[0_0_15px_rgba(57,255,20,0.2)]">
            <Bell size={20} />
          </button>
          
          <div className="flex items-center gap-3 bg-zinc-900 p-1.5 pr-5 rounded-full border border-zinc-800">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full border border-zinc-700 bg-black" />
            ) : (
              <UserCircle size={40} className="text-zinc-500" />
            )}
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-0.5">ID User</span>
              <span className="text-xs text-[#39FF14] tracking-widest font-bold">{nickname.substring(0,8)}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
