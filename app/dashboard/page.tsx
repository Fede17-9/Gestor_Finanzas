"use client";

import { useEffect, useMemo, useState } from 'react';
import DashboardHeader from '@/components/DashboardHeader';
import CategoryChart from '@/components/CategoryChart';
import { supabase } from '@/lib/supabase';
import { createFinanceReader } from '@/lib/finance-data';
import { civilToday, civilToDate, formatAmount, movementSign, readAllPages, summarizeMovements } from '@/lib/finance';
import { budgetProgress } from '@/lib/planning';
import type { Row } from '@/lib/database.types';
import type { Movement, Profile } from '@/lib/finance';
import { useRouter } from 'next/navigation';
import { Activity, Plus, TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const reader = createFinanceReader(supabase);

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allMovs, setAllMovs] = useState<Movement[]>([]);
  const [budgets, setBudgets] = useState<Row<'presupuestos_mensuales'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => civilToDate(civilToday()));

  const current = civilToDate(civilToday());
  const monthOptions = Array.from({ length: 6 }, (_, index) =>
    new Date(current.getFullYear(), current.getMonth() - index, 1));

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw new Error('No se pudo comprobar tu sesión.');
        if (!session) { router.replace('/login'); return; }
        const [userProfile, movements, budgets] = await Promise.all([
          reader.profile(session.user.id), reader.movements(session.user.id),
          readAllPages(async(from,to)=>{
            const {data,error}=await supabase.from('presupuestos_mensuales').select('*').eq('id_usuario',session.user.id).order('id_presupuesto').range(from,to);
            if(error||!data)throw new Error('No se pudieron cargar las alertas de presupuesto.');
            return data;
          }),
        ]);
        if (active) { setProfile(userProfile); setAllMovs(movements); setBudgets(budgets); }
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar tus datos.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  const computed = useMemo(() => {
    try {
      const alerts=budgets.filter(b=>b.anio_calendario===selectedDate.getFullYear()&&b.mes_calendario===selectedDate.getMonth()+1)
        .map(b=>budgetProgress(b,allMovs)).filter(p=>p.status!=='normal');
      return { summary: summarizeMovements(allMovs, selectedDate.getFullYear(), selectedDate.getMonth()), alerts, error: '' };
    } catch (error) {
      return { summary: null, alerts: [], error: error instanceof Error ? error.message : 'No se pudieron calcular los totales.' };
    }
  }, [allMovs, selectedDate, budgets]);
  const summary = computed.summary;
  if (!loading && (loadError || computed.error || !profile || !summary)) {
    return <div role="alert" className="text-danger p-6 border border-danger/30 rounded-2xl">
      {loadError || computed.error || 'No se pudo cargar el perfil.'}
      <button className="block mt-4 underline" onClick={() => window.location.reload()}>Volver a cargar</button>
    </div>;
  }
  const userData = {
    nickname: profile?.username || profile?.nombre_completo || '',
    saldo: (summary?.balanceCents ?? 0) / 100,
    moneda: profile?.codigo_moneda || 'COP',
    avatarUrl: profile?.url_avatar || '',
  };
  const stats = { ingresoMensual: (summary?.incomeCents ?? 0) / 100, gastoMensual: (summary?.expenseCents ?? 0) / 100 };
  const chartData = summary?.chartData ?? [];
  const recentMoves = allMovs.slice(0, 4);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-accent tabular-nums tracking-normal animate-pulse gap-4">
        <Activity size={40} />
        <span>Cargando tus finanzas...</span>
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
      
      <p className="text-sm text-muted mb-6">
        Tu saldo incluye solo movimientos confirmados. En Recurrencias puedes revisar pendientes, confirmar pagos o cobros y consultar su historial.
      </p>

      {/* Cards de Métricas Rápidas conectadas a Supabase */}
      {computed.alerts.length>0&&<p role="status" className="mb-6 rounded-xl border border-amber-600/40 p-4 text-warning">
        {computed.alerts.length} presupuesto(s) alcanzaron su umbral de alerta en {selectedDate.toLocaleDateString('es-CO',{month:'long',year:'numeric'})}.
        {' '}<Link className="underline" href={`/dashboard/presupuestos?mes=${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}`}>Revisar presupuestos</Link>
      </p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { title: "INGRESO MENSUAL", amount: formatAmount(stats.ingresoMensual, userData.moneda), icon: TrendingUp, color: "text-accent" },
          { title: "GASTO MENSUAL", amount: formatAmount(stats.gastoMensual, userData.moneda), icon: TrendingDown, color: "text-danger" },
          { title: "BALANCE DEL MES", amount: formatAmount(((summary?.incomeCents ?? 0) - (summary?.expenseCents ?? 0)) / 100, userData.moneda), icon: ArrowLeftRight, color: "text-muted" }
        ].map((stat, i) => (
          <div key={i} className="bg-surface p-6 rounded-3xl border border-line/50 hover:border-line transition-colors group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-soft group-hover:bg-accent transition-colors duration-300"></div>
            <div className="flex justify-between items-start mb-4 ml-2">
              <span className="text-xs text-muted font-bold  tracking-normal">{stat.title}</span>
              <div className="p-2 bg-paper rounded-xl group-hover:bg-soft transition-colors">
                <stat.icon size={18} className={stat.color} />
              </div>
            </div>
            <p className={`text-3xl font-semibold tracking-tight ml-2 ${stat.color}`}>{stat.amount}</p>
          </div>
        ))}
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Gráfico principal de Flujo */}
        <div className="lg:col-span-2 bg-surface rounded-3xl border border-line/50 p-8 relative overflow-hidden flex flex-col min-h-[400px] shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold text-ink  tracking-normal flex items-center gap-2">
              <Activity size={18} className="text-accent" />
              Rendimiento Operativo
            </h2>
            
            {/* Input de Fecha Retroactiva */}
            <select 
              value={`${selectedDate.getFullYear()}-${selectedDate.getMonth()}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-');
                setSelectedDate(new Date(parseInt(y), parseInt(m), 1));
              }}
              className="bg-paper text-muted border border-line text-xs font-bold  tracking-normal px-4 py-2 rounded-xl outline-none focus:border-accent transition-colors"
            >
              {monthOptions.map(m => {
                const text = m.getFullYear() === current.getFullYear() && m.getMonth() === current.getMonth() ? "Este Mes" :
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
                    <stop offset="5%" stopColor="#226c5d" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#226c5d" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorEgresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a44841" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#a44841" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e7dc" />
                <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#71717a', fontSize: 12, fontFamily: 'monospace' }}
                    tickFormatter={(value) => `${value}`}
                    dy={10}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#71717a', fontSize: 12, fontFamily: 'monospace' }}
                    tickFormatter={(value) => Number(value).toLocaleString('es-CO')}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e1e7dc', borderRadius: '12px', fontFamily: 'monospace', fontSize: '12px' }}
                  itemStyle={{ fontWeight: 'bold' }}
                  labelStyle={{ color: '#66765e', marginBottom: '8px' }}
                  formatter={value => formatAmount(Number(value), userData.moneda)}
                  labelFormatter={(label) => `Día ${label}`}
                  cursor={{ stroke: '#3f3f46', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="Ingresos" stroke="#226c5d" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" activeDot={{ r: 6, fill: '#226c5d', stroke: '#ffffff', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="Egresos" stroke="#a44841" strokeWidth={3} fillOpacity={1} fill="url(#colorEgresos)" activeDot={{ r: 6, fill: '#a44841', stroke: '#ffffff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Panel lateral derecho (Movimientos Recientes Reales) */}
        <div className="bg-surface rounded-3xl border border-line/50 p-6 flex flex-col min-h-[400px] shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold text-ink  tracking-normal">Recientes</h2>
            <Link href="/dashboard/movimientos" className="text-accent hover:bg-accent/10 p-2 rounded-xl transition-colors">
              <Plus size={20} />
            </Link>
          </div>
          
          <div className="flex-1 flex flex-col gap-3">
            {recentMoves.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-paper border border-line flex items-center justify-center">
                  <ArrowLeftRight size={24} className="text-muted" />
                </div>
                <div>
                  <p className="text-muted font-medium text-sm">Sin movimientos</p>
                  <p className="text-muted text-xs mt-1  tracking-normal">Aún no hay actividad monetaria</p>
                </div>
                <Link href="/dashboard/movimientos" className="mt-4 px-6 py-3 bg-accent text-white font-bold  tracking-normal text-xs rounded-xl hover:bg-accent transition-all  hover:-translate-y-0.5 inline-block text-center">
                  Añadir Transacción
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recentMoves.map((mov) => {
                  const sign = movementSign(mov.id_tipo);
                  const isIngreso = sign > 0;
                  return (
                    <div key={mov.id_movimiento} className="flex justify-between items-center p-3 rounded-xl bg-paper/50 border border-line/50 hover:bg-soft/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isIngreso ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger'}`}>
                          {isIngreso ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-muted">{mov.descripcion_detalle || 'Operación'}</p>
                          <p className="text-xs text-muted tabular-nums tracking-normal  mt-0.5">
                            {(() => {
                              const [y, m, d] = mov.fecha_operacion.split('T')[0].split('-');
                              return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                            })()}
                          </p>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums tracking-tight ${isIngreso ? 'text-accent' : 'text-ink'}`}>
                        {sign > 0 ? '+' : sign < 0 ? '-' : ''}{formatAmount(mov.monto_transaccion, userData.moneda)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            
            {recentMoves.length > 0 && (
              <Link href="/dashboard/movimientos" className="mt-auto pt-4 border-t border-line/50 text-center block text-xs font-bold text-accent  tracking-normal hover:text-ink transition-colors">
                Ver todos los movimientos &rarr;
              </Link>
            )}
          </div>
        </div>
        
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryChart title="Gastos por categoría" data={summary?.expenseCategories ?? []}
          color="#a44841" currency={userData.moneda} emptyMessage="Sin gastos en este mes." />
        <CategoryChart title="Ingresos por categoría" data={summary?.incomeCategories ?? []}
          color="#226c5d" currency={userData.moneda} emptyMessage="Sin ingresos en este mes." />
      </div>
    </div>
  );
}
