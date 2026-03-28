"use client";

import { useEffect, useState } from 'react';
import DashboardHeader from '@/components/DashboardHeader';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Activity, Plus, TrendingUp, TrendingDown, CreditCard, ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [userData, setUserData] = useState({
    nickname: "Cargando...",
    saldo: 0,
    moneda: "...",
    avatarUrl: ""
  });
  
  const [stats, setStats] = useState({
    ingresoMensual: 0,
    gastoMensual: 0,
  });
  const [recentMoves, setRecentMoves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) return router.push("/login");

      // Consultar el Perfil
      const { data: profileData, error: profileError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id_usuario', session.user.id)
        .single();

      // Consultar TODOS los movimientos del usuario para calcular el saldo global y estadísticas
      const { data: movData } = await supabase
        .from('movimientos')
        .select('id_movimiento, monto_transaccion, fecha_operacion, id_tipo, descripcion_detalle')
        .eq('id_usuario', session.user.id)
        .order('fecha_operacion', { ascending: false });

      if (profileData && !profileError) {
        let saldoCalculado = 0;
        let ingMes = 0;
        let gasMes = 0;
        const recent = movData ? movData.slice(0, 4) : []; // Tomar los 4 más recientes

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        if (movData) {
          movData.forEach((mov) => {
            const date = new Date(mov.fecha_operacion);
            const isThisMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            
            if (mov.id_tipo === 1) { // 1 = Ingreso
              saldoCalculado += Number(mov.monto_transaccion);
              if (isThisMonth) ingMes += Number(mov.monto_transaccion);
            } else if (mov.id_tipo === 2) { // 2 = Egreso
              saldoCalculado -= Number(mov.monto_transaccion);
              if (isThisMonth) gasMes += Number(mov.monto_transaccion);
            }
          });
        }

        setStats({ ingresoMensual: ingMes, gastoMensual: gasMes });
        setRecentMoves(recent);

        setUserData({
          nickname: profileData.username || profileData.nombre_completo,
          saldo: saldoCalculado, 
          moneda: profileData.codigo_moneda,
          avatarUrl: profileData.url_avatar
        });
      }
      setLoading(false);
    };
    fetchDashboardData();
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
      
      {/* Cards de Métricas Rápidas conectadas a Supabase */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { title: "INGRESO MENSUAL", amount: `+$${stats.ingresoMensual.toLocaleString()}`, icon: TrendingUp, color: "text-[#39FF14]" },
          { title: "GASTO MENSUAL", amount: `-$${stats.gastoMensual.toLocaleString()}`, icon: TrendingDown, color: "text-[#ff3939]" },
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

        {/* Panel lateral derecho (Movimientos Recientes Reales) */}
        <div className="bg-[#09090b] rounded-3xl border border-zinc-800/50 p-6 flex flex-col min-h-[400px] shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Recientes</h2>
            <Link href="/dashboard/movimientos" className="text-[#39FF14] hover:bg-[#39FF14]/10 p-2 rounded-xl transition-colors">
              <Plus size={20} />
            </Link>
          </div>
          
          <div className="flex-1 flex flex-col gap-3">
            {recentMoves.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <ArrowLeftRight size={24} className="text-zinc-600" />
                </div>
                <div>
                  <p className="text-zinc-300 font-medium text-sm">Sin movimientos</p>
                  <p className="text-zinc-600 text-[10px] mt-1 uppercase tracking-widest">Aún no hay actividad monetaria</p>
                </div>
                <Link href="/dashboard/movimientos" className="mt-4 px-6 py-3 bg-[#39FF14] text-black font-bold uppercase tracking-widest text-[11px] rounded-xl hover:bg-[#a3e635] transition-all hover:shadow-[0_0_20px_rgba(57,255,20,0.3)] hover:-translate-y-0.5 inline-block text-center">
                  Añadir Transacción
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recentMoves.map((mov) => {
                  const isIngreso = mov.id_tipo === 1;
                  return (
                    <div key={mov.id_movimiento} className="flex justify-between items-center p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isIngreso ? 'bg-[#39FF14]/10 text-[#39FF14]' : 'bg-[#ff3939]/10 text-[#ff3939]'}`}>
                          {isIngreso ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-300">{mov.descripcion_detalle || 'Operación'}</p>
                          <p className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase mt-0.5">
                            {new Date(mov.fecha_operacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                      </div>
                      <span className={`text-sm font-black font-mono tracking-tight ${isIngreso ? 'text-[#39FF14]' : 'text-white'}`}>
                        {isIngreso ? '+' : '-'}${mov.monto_transaccion.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            
            {recentMoves.length > 0 && (
              <Link href="/dashboard/movimientos" className="mt-auto pt-4 border-t border-zinc-800/50 text-center block text-[10px] font-bold text-[#39FF14] uppercase tracking-widest hover:text-white transition-colors">
                Ver todos los movimientos &rarr;
              </Link>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
