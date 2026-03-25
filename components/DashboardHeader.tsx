"use client";
import { Bell, UserCircle } from 'lucide-react';

interface HeaderProps {
  nickname: string;
  saldo: number;
  moneda: string;
}

export default function DashboardHeader({ nickname, saldo, moneda }: HeaderProps) {
  return (
    <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          ¡Hola, <span className="text-blue-600">{nickname}</span>! 👋
        </h1>
        <p className="text-slate-500 text-sm">Aquí tienes el resumen de tus finanzas hoy.</p>
      </div>

      <div className="flex items-center gap-6">
        {/* Visualización del Saldo */}
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Saldo Total</p>
          <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {saldo.toLocaleString()} <span className="text-sm font-normal">{moneda}</span>
          </p>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-3 border-l pl-6 border-slate-200">
          <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
            <Bell size={20} />
          </button>
          <div className="flex items-center gap-2 bg-slate-50 p-1 pr-3 rounded-full border border-slate-200">
            <UserCircle size={28} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-700">{nickname}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
