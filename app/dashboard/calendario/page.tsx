"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { createFinanceReader } from '@/lib/finance-data';
import { calendarEvents, calendarTotals, civilToday, civilToDate, formatAmount, movementSign } from '@/lib/finance';
import type { CalendarEvent, Movement, Profile, Recurrence } from '@/lib/finance';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Zap, CheckCircle2 } from 'lucide-react';

const reader = createFinanceReader(supabase);

export default function CalendarioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recurrencias, setRecurrencias] = useState<Recurrence[]>([]);
  const [movimientosReales, setMovimientosReales] = useState<Movement[]>([]);
  const [currentDate, setCurrentDate] = useState(() => civilToDate(civilToday()));

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw new Error('No se pudo comprobar tu sesión.');
        if (!session) { router.replace('/login'); return; }
        const [rules, movements, userProfile] = await Promise.all([
          reader.recurrences(session.user.id), reader.movements(session.user.id), reader.profile(session.user.id),
        ]);
        if (active) { setRecurrencias(rules); setMovimientosReales(movements); setProfile(userProfile); }
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el calendario.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1, 12));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1, 12));
  const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const computed = useMemo<{ events: Record<number, CalendarEvent[]>; totals: ReturnType<typeof calendarTotals> | null; error: string }>(() => {
    try {
      const events = calendarEvents(movimientosReales, recurrencias, currentDate.getFullYear(), currentDate.getMonth());
      return { events, totals: calendarTotals(events), error: '' };
    } catch (error) {
      return { events: {}, totals: null, error: error instanceof Error ? error.message : 'No se pudo calcular el calendario.' };
    }
  }, [movimientosReales, recurrencias, currentDate]);
  if (loadError || computed.error) {
    return <div role="alert" className="p-6 text-red-300">
      {loadError || computed.error}
      <button className="block mt-4 underline" onClick={() => window.location.reload()}>Volver a cargar</button>
    </div>;
  }
  const eventosPorDia = computed.events;
  const currency = profile?.codigo_moneda || 'COP';
  const manualIn = (computed.totals?.realIncome ?? 0) / 100;
  const manualOut = (computed.totals?.realExpense ?? 0) / 100;
  const proyecIn = (computed.totals?.forecastIncome ?? 0) / 100;
  const proyecOut = (computed.totals?.forecastExpense ?? 0) / 100;
  const today = civilToDate(civilToday());

  return (
    <div className="max-w-7xl mx-auto pb-10 animate-in fade-in duration-500 relative">

      <p className="text-sm text-zinc-400 mb-6">
        Las proyecciones no cambian tu saldo ni confirman un pago. Pueden incluir operaciones ya registradas; todavía no se concilian automáticamente. El registro automático está temporalmente desactivado.
      </p>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-widest uppercase flex items-center gap-3">
            <CalendarIcon className="text-[#39FF14]" size={30} strokeWidth={2.5} />
            Pronóstico
          </h1>
          <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest mt-2 border-l-2 border-[#39FF14] pl-3 py-0.5">
            Movimientos registrados y programación estimada
          </p>
        </div>

        {/* Cajas de estimaciones divididas */}
        <div className="flex bg-[#09090b] border border-zinc-800 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(57,255,20,0.05)]">
          {/* Reales (Históricos del Mes) */}
          <div className="px-5 py-3 flex flex-col justify-center border-r border-zinc-800 bg-zinc-900/50">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
              <CheckCircle2 size={10} /> Registrado
            </span>
            <div className="flex gap-4 mt-0.5">
              <span className="text-zinc-300 font-black font-mono text-xs">{formatAmount(manualIn, currency)}</span>
              <span className="text-red-300/80 font-black font-mono text-xs">{formatAmount(manualOut, currency)}</span>
            </div>
          </div>
          {/* Proyecciones Futuras */}
          <div className="px-5 py-3 flex flex-col justify-center">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
              <Zap size={10} className="text-[#39FF14]" /> Programado (estimación)
            </span>
            <div className="flex gap-4 mt-0.5">
              <span className="text-[#39FF14] font-black font-mono text-xs">{formatAmount(proyecIn, currency)}</span>
              <span className="text-[#ff3939] font-black font-mono text-xs">{formatAmount(proyecOut, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controles del Mes */}
      <div className="bg-[#09090b] border border-zinc-800/50 p-4 rounded-t-3xl flex items-center justify-between shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/30 to-transparent"></div>
        <button onClick={prevMonth} className="p-2 text-zinc-400 hover:text-[#39FF14] hover:bg-[#39FF14]/10 rounded-xl transition-all">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <span className="text-[10px] font-mono text-zinc-500 tracking-widest">MAPA DEL MES</span>
        </div>
        <button onClick={nextMonth} className="p-2 text-zinc-400 hover:text-[#39FF14] hover:bg-[#39FF14]/10 rounded-xl transition-all">
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Cuadrícula del Calendario */}
      <div className="bg-[#09090b]/80 backdrop-blur-sm border-x border-b border-zinc-800/50 rounded-b-3xl shadow-2xl p-6">

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4 text-[#39FF14]">
            <div className="relative">
              <CalendarIcon size={32} className="animate-spin text-zinc-800" />
              <div className="absolute inset-0 border-t-2 border-[#39FF14] rounded-full animate-spin" style={{ animationDuration: '1.2s' }}></div>
            </div>
            <span className="font-mono text-[10px] tracking-widest uppercase animate-pulse">Sincronizando DB...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-4 mb-4">
              {['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'].map(day => (
                <div key={day} className="text-center font-bold text-[10px] tracking-widest text-zinc-500 uppercase border-b border-zinc-800/50 pb-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2 sm:gap-4">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[100px] border border-transparent rounded-2xl opacity-20 bg-zinc-900/10"></div>
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const events = eventosPorDia[dayNum] ?? [];
                const isToday = today.getDate() === dayNum && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();

                return (
                  <div key={dayNum} className={`min-h-[110px] flex flex-col p-2 border rounded-2xl transition-all duration-300 hover:border-zinc-500 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] ${isToday ? 'border-[#39FF14]/50 bg-[#39FF14]/5 ring-1 ring-[#39FF14]/20' : 'border-zinc-800/60 bg-zinc-900/30'
                    }`}>
                    <span className={`text-xs font-mono font-bold mb-2 text-right w-full ${isToday ? 'text-[#39FF14]' : 'text-zinc-600'}`}>
                      {dayNum.toString().padStart(2, '0')}
                    </span>

                    <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar flex-1">
                      {events.map((evt) => {
                        const sign = movementSign(evt.id_tipo);
                        const isIngreso = sign > 0;
                        return (
                          <div key={evt.key} className={`w-full px-1.5 py-1.5 rounded-lg bg-zinc-900/80 border text-[9px] font-mono tracking-wider flex justify-between items-center ${isIngreso ? ' border-[#39FF14]/30' : ' border-[#ff3939]/30'
                            }`}>
                            <span className="truncate flex items-center gap-1 text-zinc-300" title={evt.categorias?.nombre_categoria || 'Desc'}>
                              {evt.isReal ? (
                                evt.isAutoDB ?
                                  <Zap size={8} className={isIngreso ? 'text-emerald-500 fill-emerald-500' : 'text-rose-500 fill-rose-500'} />
                                  : <CheckCircle2 size={8} className="text-zinc-500" />
                              ) : (
                                <Zap size={8} className={isIngreso ? 'text-[#39FF14] fill-[#39FF14] opacity-50' : 'text-[#ff3939] fill-[#ff3939] opacity-50'} />
                              )}
                              {evt.categorias?.nombre_categoria?.substring(0, 8) || (evt.isReal ? 'REAL' : 'PROYECTO')}
                            </span>
                            <span className={`font-black ${isIngreso ? 'text-[#39FF14]' : 'text-[#ff3939]'}`}>
                              {sign > 0 ? '+' : sign < 0 ? '-' : ''}{formatAmount(evt.monto_recurrente, currency)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
