"use client";

import { useEffect, useState, useRef } from 'react';
import DashboardHeader from '@/components/DashboardHeader';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Activity, Plus, TrendingUp, TrendingDown, CreditCard, ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
  
  const [allMovs, setAllMovs] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentMoves, setRecentMoves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const syncLock = useRef(false);
  
  // Selector dinámico de Fechas
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Generador de meses pasados (ej. últimos 6 meses hasta el actual)
  const monthOptions = [];
  const start = new Date();
  for(let i=0; i<6; i++) {
     monthOptions.push(new Date(start.getFullYear(), start.getMonth() - i, 1));
  }

  // 1. Carga inicial gruesa desde Base de Datos
  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) return router.push("/login");

      const { data: profileData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id_usuario', session.user.id)
        .single();

      let { data: movData } = await supabase
        .from('movimientos')
        .select('id_movimiento, monto_transaccion, fecha_operacion, id_tipo, descripcion_detalle, id_categoria, es_automatico')
        .eq('id_usuario', session.user.id)
        .order('fecha_operacion', { ascending: false });

      // -- AUTO REPARACIÓN DE DUPLICADOS (Por Strict Mode) --
      if (movData) {
          const vistasFix = new Set();
          const toDelete: string[] = [];
          movData.forEach(m => {
              if (m.es_automatico) {
                  const key = m.fecha_operacion.split('T')[0] + '_' + m.id_categoria;
                  if (vistasFix.has(key)) {
                      toDelete.push(m.id_movimiento);
                  } else {
                      vistasFix.add(key);
                  }
              }
          });
          if (toDelete.length > 0) {
              await supabase.from('movimientos').delete().in('id_movimiento', toDelete);
              movData = movData.filter(m => !toDelete.includes(m.id_movimiento));
          }
      }

      // -- MOTOR DE SINCRONIZACIÓN AUTOMÁTICA (Opción B) --
      const { data: recData } = await supabase.from('config_recurrencias').select('*').eq('id_usuario', session.user.id).eq('estado_activo', true);
      
      let newMovs: any[] = [];
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (recData && movData && !syncLock.current) {
          syncLock.current = true;
          recData.forEach(rec => {
             const expectedDates: Date[] = [];
             const inicio = new Date(rec.fecha_inicio + "T00:00:00");
             
             if (rec.frecuencia === 'Mensual') {
                 let loopDate = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
                 while(loopDate <= today) {
                     let lastDayOfMonth = new Date(loopDate.getFullYear(), loopDate.getMonth() + 1, 0).getDate();
                     let targetDay = rec.dia_ejecucion > lastDayOfMonth ? lastDayOfMonth : rec.dia_ejecucion;
                     const tempDate = new Date(loopDate.getFullYear(), loopDate.getMonth(), targetDay);
                     
                     if (tempDate >= inicio && tempDate <= today) {
                         expectedDates.push(new Date(tempDate));
                     }
                     loopDate = new Date(loopDate.getFullYear(), loopDate.getMonth() + 1, 1);
                 }
             } else if (rec.frecuencia === 'Semanal') {
                 let current = new Date(inicio.getTime());
                 while(current <= today) {
                     expectedDates.push(new Date(current.getTime()));
                     current.setDate(current.getDate() + 7);
                 }
             } else if (rec.frecuencia === 'Diario') {
                 let current = new Date(inicio.getTime());
                 while(current <= today) {
                     expectedDates.push(new Date(current.getTime()));
                     current.setDate(current.getDate() + 1);
                 }
             }

             expectedDates.forEach(expDate => {
                 const expString = expDate.toISOString().split('T')[0];
                 const exists = movData!.some(mov => {
                     // Solo comparar si tienen categoría. (Prevenir falsos positivos con manuales sin cat.)
                     if (!mov.id_categoria || mov.id_categoria !== rec.id_categoria) return false;
                     const movDateString = mov.fecha_operacion.split('T')[0];
                     return movDateString === expString;
                 });

                 if (!exists) {
                     newMovs.push({
                         id_usuario: session.user.id,
                         id_tipo: rec.id_tipo,
                         id_categoria: rec.id_categoria,
                         monto_transaccion: rec.monto_recurrente,
                         metodo_pago: "Robot IA",
                         fecha_operacion: expString,
                         descripcion_detalle: "Automatización Sistema",
                         es_automatico: true
                     });
                 }
             });
          });

          if (newMovs.length > 0) {
              const { error: insErr } = await supabase.from('movimientos').insert(newMovs);
              if (!insErr) {
                  // Refrescar movimientos ya con el nuevo historial cargado
                  const { data: updatedMovData } = await supabase
                      .from('movimientos')
                      .select('id_movimiento, monto_transaccion, fecha_operacion, id_tipo, descripcion_detalle, id_categoria, es_automatico')
                      .eq('id_usuario', session.user.id)
                      .order('fecha_operacion', { ascending: false });
                  if (updatedMovData) movData = updatedMovData;
              }
          }
      }
      // -- FIN MOTOR SINC --

      if (profileData) {
        setUserData({
          nickname: profileData.username || profileData.nombre_completo,
          saldo: 0, // Se calcula después
          moneda: profileData.codigo_moneda,
          avatarUrl: profileData.url_avatar
        });
        setAllMovs(movData || []);
      }
      setLoading(false);
    };
    fetchDashboardData();
  }, [router]);

  // 2. Acumuladores Reactivos: Detectan el Mes Seleccionado
  useEffect(() => {
    if (allMovs.length === 0 && loading) return;

    let saldoCalculado = 0;
    let ingMes = 0;
    let gasMes = 0;

    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    let monthChart: any[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      monthChart.push({ date: i, Ingresos: 0, Egresos: 0 });
    }

    allMovs.forEach((mov) => {
      const [year, month, day] = mov.fecha_operacion.split('T')[0].split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const isSelectedMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      
      // Saldo Histórico Vitalicio (Siempre es la suma total de todo el historial del usuario)
      if (mov.id_tipo === 1) saldoCalculado += Number(mov.monto_transaccion);
      else if (mov.id_tipo === 2) saldoCalculado -= Number(mov.monto_transaccion);

      // Desglose Local del Mes Escogido en la UI
      if (isSelectedMonth) {
        if (mov.id_tipo === 1) { 
            ingMes += Number(mov.monto_transaccion);
            monthChart[date.getDate() - 1].Ingresos += Number(mov.monto_transaccion);
        } else if (mov.id_tipo === 2) { 
            gasMes += Number(mov.monto_transaccion);
            monthChart[date.getDate() - 1].Egresos += Number(mov.monto_transaccion);
        }
      }
    });

    setStats({ ingresoMensual: ingMes, gastoMensual: gasMes });
    setChartData(monthChart);
    // Para simplificar, recentMoves sigue siendo de manera absoluta los 4 más recientes
    setRecentMoves(allMovs.slice(0, 4));
    setUserData(prev => ({ ...prev, saldo: saldoCalculado }));

  }, [selectedDate, allMovs, loading]);

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
        
        {/* Gráfico principal de Flujo */}
        <div className="lg:col-span-2 bg-[#09090b] rounded-3xl border border-zinc-800/50 p-8 relative overflow-hidden flex flex-col min-h-[400px] shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Activity size={18} className="text-[#39FF14]" />
              Rendimiento Operativo
            </h2>
            
            {/* Input de Fecha Retroactiva */}
            <select 
              value={`${selectedDate.getFullYear()}-${selectedDate.getMonth()}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-');
                setSelectedDate(new Date(parseInt(y), parseInt(m), 1));
              }}
              className="bg-zinc-900 text-zinc-300 border border-zinc-800 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl outline-none focus:border-[#39FF14] transition-colors"
            >
              {monthOptions.map(m => {
                const text = m.getTime() === new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() ? "Este Mes" : 
                             new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(m);
                return (
                  <option key={m.getTime()} value={`${m.getFullYear()}-${m.getMonth()}`}>
                    {text}
                  </option>
                )
              })}
            </select>
          </div>
          
          <div className="flex-1 min-h-[250px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#39FF14" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#39FF14" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorEgresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff3939" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ff3939" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                    tickFormatter={(value) => `${value}`}
                    dy={10}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                    tickFormatter={(value) => `$${value >= 1000 ? (value/1000) + 'k' : value}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontFamily: 'monospace', fontSize: '12px' }}
                  itemStyle={{ fontWeight: 'bold' }}
                  labelStyle={{ color: '#a1a1aa', marginBottom: '8px' }}
                  labelFormatter={(label) => `Día ${label}`}
                  cursor={{ stroke: '#3f3f46', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="Ingresos" stroke="#39FF14" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" activeDot={{ r: 6, fill: '#39FF14', stroke: '#09090b', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="Egresos" stroke="#ff3939" strokeWidth={3} fillOpacity={1} fill="url(#colorEgresos)" activeDot={{ r: 6, fill: '#ff3939', stroke: '#09090b', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
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
                            {(() => {
                              const [y, m, d] = mov.fecha_operacion.split('T')[0].split('-');
                              return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                            })()}
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
