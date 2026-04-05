"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Zap } from 'lucide-react';

export default function CalendarioPage() {
  const [loading, setLoading] = useState(true);
  const [recurrencias, setRecurrencias] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchRecurrencias = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Obtener las reglas de automatización activas (el futuro)
    const { data, error } = await supabase
      .from('config_recurrencias')
      .select('id_recurrencia, monto_recurrente, frecuencia, dia_ejecucion, fecha_inicio, id_tipo, categorias(nombre_categoria)')
      .eq('id_usuario', session.user.id)
      .eq('estado_activo', true);

    if (data && !error) setRecurrencias(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecurrencias();
  }, []);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0(Dom) a 6(Sab)

  // Mapear eventos (flujos automáticos) a los días de la cuadrícula
  const mapEventsToDays = () => {
    let dayEvents: Record<number, any[]> = {};
    for (let i = 1; i <= daysInMonth; i++) dayEvents[i] = [];

    recurrencias.forEach(rec => {
        // Mensual: cae un día fijo del mes
        if (rec.frecuencia === 'Mensual') {
            let targetDay = rec.dia_ejecucion;
            if (targetDay > daysInMonth) targetDay = daysInMonth; // Ej: Si es 31 y el mes trae 30
            if (dayEvents[targetDay]) {
                dayEvents[targetDay].push(rec);
            }
        }
        else if (rec.frecuencia === 'Diario') {
            for (let i = 1; i <= daysInMonth; i++) {
                dayEvents[i].push(rec);
            }
        }
        else if (rec.frecuencia === 'Semanal') {
            // Reparte el evento cada 7 días desde su inicio
            const inicio = new Date(rec.fecha_inicio + "T00:00:00");
            for (let i = 1; i <= daysInMonth; i++) {
                const diaEvaluado = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
                const diffTime = Math.abs(diaEvaluado.getTime() - inicio.getTime());
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays % 7 === 0 && diaEvaluado >= inicio) {
                    dayEvents[i].push(rec);
                }
            }
        }
    });
    return dayEvents;
  };

  const eventosPorDia = mapEventsToDays();

  // Calcular la proyección del total de flujos en ese periodo
  let proyeccionIngresos = 0;
  let proyeccionEgresos = 0;
  Object.values(eventosPorDia).forEach(eventList => {
      eventList.forEach(e => {
          if (e.id_tipo === 1) proyeccionIngresos += Number(e.monto_recurrente);
          else if (e.id_tipo === 2) proyeccionEgresos += Number(e.monto_recurrente);
      });
  });

  return (
    <div className="max-w-7xl mx-auto pb-10 animate-in fade-in duration-500 relative">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-widest uppercase flex items-center gap-3">
            <CalendarIcon className="text-[#39FF14]" size={30} strokeWidth={2.5} />
            Pronóstico
          </h1>
          <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest mt-2 border-l-2 border-[#39FF14] pl-3 py-0.5">
            Línea de tiempo para Automatizaciones
          </p>
        </div>

        {/* Cajas de estimaciones */}
        <div className="flex bg-[#09090b] border border-zinc-800 rounded-2xl overflow-hidden p-1 shadow-[0_0_20px_rgba(57,255,20,0.05)]">
            <div className="px-4 py-2 flex flex-col items-center border-r border-zinc-800">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1"><TrendingUp size={10}/> Flujo Automático IN</span>
                <span className="text-[#39FF14] font-black font-mono text-sm tracking-tight">+${proyeccionIngresos.toLocaleString()}</span>
            </div>
            <div className="px-4 py-2 flex flex-col items-center">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1"><TrendingDown size={10}/> Flujo Automático OUT</span>
                <span className="text-[#ff3939] font-black font-mono text-sm tracking-tight">-${proyeccionEgresos.toLocaleString()}</span>
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
            <span className="text-[10px] font-mono text-[#39FF14] tracking-widest animate-pulse">PROYECCIÓN DE MATRIZ</span>
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
               <div className="absolute inset-0 border-t-2 border-[#39FF14] rounded-full animate-spin" style={{ animationDuration: '1.2s'}}></div>
             </div>
             <span className="font-mono text-[10px] tracking-widest uppercase animate-pulse">Calculando Proyección...</span>
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
                  {/* Celdas fantasmas para alinear el primer día del mes al día de la semana correcto */}
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                      <div key={`empty-${i}`} className="min-h-[100px] border border-transparent rounded-2xl opacity-20 bg-zinc-900/10"></div>
                  ))}

                  {/* Celdas con los días del mes actuales */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const events = eventosPorDia[dayNum];
                      const isToday = new Date().getDate() === dayNum && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
                      
                      return (
                          <div key={dayNum} className={`min-h-[110px] flex flex-col p-2 border rounded-2xl transition-all duration-300 hover:border-zinc-500 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] ${
                              isToday ? 'border-[#39FF14]/50 bg-[#39FF14]/5 ring-1 ring-[#39FF14]/20' : 'border-zinc-800/60 bg-zinc-900/30'
                          }`}>
                              <span className={`text-xs font-mono font-bold mb-2 text-right w-full ${isToday ? 'text-[#39FF14]' : 'text-zinc-600'}`}>
                                  {dayNum.toString().padStart(2, '0')}
                              </span>
                              
                              <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar flex-1">
                                  {events.map((evt, idx) => {
                                      const isIngreso = evt.id_tipo === 1;
                                      return (
                                          <div key={idx} className={`w-full px-1.5 py-1.5 rounded-lg bg-zinc-900/80 border text-[9px] font-mono tracking-wider flex justify-between items-center ${
                                            isIngreso ? ' border-[#39FF14]/30' : ' border-[#ff3939]/30'
                                          }`}>
                                              <span className="truncate flex items-center gap-1 text-zinc-300" title={evt.categorias?.nombre_categoria || 'Automático'}>
                                                 <Zap size={8} className={isIngreso ? 'text-[#39FF14] fill-[#39FF14]' : 'text-[#ff3939] fill-[#ff3939]'} /> 
                                                 {evt.categorias?.nombre_categoria?.substring(0,8) || 'AUTO'}
                                              </span>
                                              <span className={`font-black ${isIngreso ? 'text-[#39FF14]' : 'text-[#ff3939]'}`}>
                                                 ${evt.monto_recurrente}
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
