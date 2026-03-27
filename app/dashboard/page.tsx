"use client";

import { useEffect, useState } from 'react';
import DashboardHeader from '@/components/DashboardHeader';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Activity, Plus, TrendingUp, TrendingDown, CreditCard, ArrowLeftRight } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [userData, setUserData] = useState({
    nickname: "Cargando...",
    saldo: 0,
    moneda: "...",
    avatarUrl: ""
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) return router.push("/login");

      const { data: profileData, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id_usuario', session.user.id)
        .single();

      if (profileData && !error) {
        setUserData({
          nickname: profileData.username || profileData.nombre_completo,
          saldo: 0, 
          moneda: profileData.codigo_moneda,
          avatarUrl: profileData.url_avatar
        });
      }
      setLoading(false);
    };
    fetchUserData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-[#39FF14] font-mono tracking-widest animate-pulse gap-4">
        <Activity size={40} />
        <span>SINCRONIZANDO SISTEMA...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <DashboardHeader 
        nickname={userData.nickname} 
        saldo={userData.saldo} 
        moneda={userData.moneda} 
        avatarUrl={userData.avatarUrl}
      />
      
      {/* Cards de Métricas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { title: "INGRESO MENSUAL", amount: "+$0.00", icon: TrendingUp, color: "text-[#39FF14]" },
          { title: "GASTO MENSUAL", amount: "-$0.00", icon: TrendingDown, color: "text-[#ff3939]" },
          { title: "TARJETAS", amount: "0 Activas", icon: CreditCard, color: "text-zinc-300" }
        ].map((stat, i) => (
          <div key={i} className="bg-[#09090b] p-6 rounded-3xl border border-zinc-800/50 hover:border-zinc-700 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800 group-hover:bg-[#39FF14] transition-colors duration-300"></div>
            <div className="flex justify-between items-start mb-4 ml-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{stat.title}</span>
              <div className="p-2 bg-zinc-900 rounded-xl group-hover:bg-zinc-800 transition-colors">
                <stat.icon size={18} className={stat.color} />
              </div>
            </div>
            <p className={`text-3xl font-black tracking-tight ml-2 ${stat.color}`}>{stat.amount}</p>
          </div>
        ))}
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Gráfico principal (Placeholder) */}
        <div className="lg:col-span-2 bg-[#09090b] rounded-3xl border border-zinc-800/50 p-8 relative overflow-hidden flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Activity size={18} className="text-[#39FF14]" />
              Flujo de Caja
            </h2>
            <select className="bg-zinc-900 text-zinc-400 border border-zinc-800 text-xs px-3 py-1.5 rounded-lg outline-none focus:border-[#39FF14]">
              <option>Este Mes</option>
              <option>Últimos 3 Meses</option>
            </select>
          </div>
          <div className="flex-1 border border-zinc-800/50 border-dashed rounded-xl flex items-center justify-center bg-zinc-900/20 backdrop-blur-sm relative group">
            <div className="absolute inset-0 bg-[#39FF14]/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
            <span className="text-zinc-600 font-mono text-sm tracking-widest uppercase">Gráfico Próximamente</span>
          </div>
        </div>

        {/* Panel lateral derecho (Movimientos Recientes) */}
        <div className="bg-[#09090b] rounded-3xl border border-zinc-800/50 p-6 flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Recientes</h2>
            <button className="text-[#39FF14] hover:bg-[#39FF14]/10 p-2 rounded-xl transition-colors">
              <Plus size={20} />
            </button>
          </div>
          
          <div className="flex-1 flex flex-col justify-center items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <ArrowLeftRight size={24} className="text-zinc-600" />
            </div>
            <div>
              <p className="text-zinc-300 font-medium">Sin movimientos</p>
              <p className="text-zinc-600 text-xs mt-1">Aún no hay actividad monetaria</p>
            </div>
            <button className="mt-4 px-6 py-3 bg-[#39FF14] text-black font-bold uppercase tracking-widest text-[11px] rounded-xl hover:bg-[#a3e635] transition-all hover:shadow-[0_0_20px_rgba(57,255,20,0.3)] hover:-translate-y-0.5">
              Añadir Transacción
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
