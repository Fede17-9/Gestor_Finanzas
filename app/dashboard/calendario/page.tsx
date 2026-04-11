"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Zap, CheckCircle2 } from 'lucide-react';

export default function CalendarioPage() {
  const [loading, setLoading] = useState(true);
  const [recurrencias, setRecurrencias] = useState<any[]>([]);
  const [movimientosReales, setMovimientosReales] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Obtener las reglas activas (flujo proyectado)
    const { data: recData, error: recError } = await supabase
      .from('config_recurrencias')
      .select('id_recurrencia, monto_recurrente, frecuencia, dia_ejecucion, fecha_inicio, id_tipo, categorias(nombre_categoria)')
      .eq('id_usuario', session.user.id)
      .eq('estado_activo', true);

    // Obtener movimientos reales grabados en el pasado (historial duro)
    // Extraemos todos los de este usuario y los filtramos matemáticamente por rendimiento.
    const { data: movData, error: movError } = await supabase
      .from('movimientos')
      .select('id_movimiento, monto_transaccion, fecha_operacion, id_tipo, es_automatico, categorias(nombre_categoria)')
      .eq('id_usuario', session.user.id); 

    if (recData && !recError) setRecurrencias(recData);
    if (movData && !movError) setMovimientosReales(movData);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); 

  const mapEventsToDays = () => {
    let dayEvents: Record<number, any[]> = {};
    for (let i = 1; i <= daysInMonth; i++) dayEvents[i] = [];

    // 1. Inyectar Automáticos (Proyecciones de Máquina)
    recurrencias.forEach(rec => {
        const evt = { ...rec, isReal: false };
        if (rec.frecuencia === 'Mensual') {
            let targetDay = rec.dia_ejecucion;
            if (targetDay > daysInMonth) targetDay = daysInMonth; 
            if (dayEvents[targetDay]) dayEvents[targetDay].push(evt);
        }
        else if (rec.frecuencia === 'Diario') {
            for (let i = 1; i <= daysInMonth; i++) dayEvents[i].push(evt);
        }
        else if (rec.frecuencia === 'Semanal') {
            const inicio = new Date(rec.fecha_inicio + "T00:00:00");
            for (let i = 1; i <= daysInMonth; i++) {
                const diaEvaluado = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
                const diffTime = Math.abs(diaEvaluado.getTime() - inicio.getTime());
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays % 7 === 0 && diaEvaluado >= inicio) dayEvents[i].push(evt);
            }
        }
    });

    // 2. Inyectar Movimientos Estáticos (Historial Real Humano)
    movimientosReales.forEach(mov => {
        // Asegurar zona horaria y evitar desfases separando el string manualmente
        const [year, month, day] = mov.fecha_operacion.split('T')[0].split('-');
        const fechaOp = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        // Si operó en el año y mes exacto que estamos viendo
        if (fechaOp.getFullYear() === currentDate.getFullYear() && fechaOp.getMonth() === currentDate.getMonth()) {
            const diaDelMovimiento = fechaOp.getDate();
            if (dayEvents[diaDelMovimiento]) {
                dayEvents[diaDelMovimiento].push({
                    id_tipo: mov.id_tipo,
                    monto_recurrente: mov.monto_transaccion, // mapeado para reutilizar interfaz
                    categorias: mov.categorias,
                    isReal: true, // FLAG ESTÁTICO MANUAL/EJECUTADO
                    isAutoDB: mov.es_automatico, // FLAG si provino del motor
                    id_recurrencia: mov.id_movimiento
                });
            }
        }
    });

    // 3. Fusión Inteligente y Deduplicación Extrema (Reduce/Merge)
    for (let i = 1; i <= daysInMonth; i++) {
        const merged = [];
        
        // Separar reales y proyecciones
        const reales = dayEvents[i].filter(e => e.isReal);
        const proyecciones = dayEvents[i].filter(e => !e.isReal);

        // Limpiar Reales de duplicados directos (Bug del Múltiple Insert por modo estricto de React)
        const realesUnicos: typeof reales = [];
        const vistasReal = new Set();
        reales.forEach(r => {
             const key = `${r.categorias?.nombre_categoria}_${r.monto_recurrente}`;
             if (!vistasReal.has(key)) {
                 vistasReal.add(key);
                 realesUnicos.push(r);
             }
        });

        // Revisar las proyecciones. Si hay un real que le coincida, hereda AutoDB y la proyección muere.
        proyecciones.forEach(p => {
             const key = `${p.categorias?.nombre_categoria}_${p.monto_recurrente}`;
             const match = realesUnicos.find(r => `${r.categorias?.nombre_categoria}_${r.monto_recurrente}` === key);
             if (match) {
                 // Transferencia de Alma
                 match.isAutoDB = true; 
             } else {
                 // Sobrevive la proyección pura
                 merged.push(p);
             }
        });

        // Reconstruimos el listado del día combinando de forma segura
        dayEvents[i] = [...realesUnicos, ...merged];
    }

    return dayEvents;
  };

  const eventosPorDia = mapEventsToDays();

  // Calcular las sumas globales separando Proyectado vs Histórico
  let proyecIn = 0; let proyecOut = 0;
  let manualIn = 0; let manualOut = 0;

  Object.values(eventosPorDia).forEach(eventList => {
      eventList.forEach(e => {
          if (e.isAutoDB || !e.isReal) {
             if (e.id_tipo === 1) proyecIn += Number(e.monto_recurrente);
             else if (e.id_tipo === 2) proyecOut += Number(e.monto_recurrente);
          } else {
             if (e.id_tipo === 1) manualIn += Number(e.monto_recurrente);
             else if (e.id_tipo === 2) manualOut += Number(e.monto_recurrente);
          }
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
            Mapeo de Flujo Estático + Automático
          </p>
        </div>

        {/* Cajas de estimaciones divididas */}
        <div className="flex bg-[#09090b] border border-zinc-800 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(57,255,20,0.05)]">
            {/* Reales (Históricos del Mes) */}
            <div className="px-5 py-3 flex flex-col justify-center border-r border-zinc-800 bg-zinc-900/50">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                  <CheckCircle2 size={10}/> Caja Estática
                </span>
                <div className="flex gap-4 mt-0.5">
                  <span className="text-zinc-300 font-black font-mono text-xs">+${manualIn.toLocaleString()}</span>
                  <span className="text-red-300/80 font-black font-mono text-xs">-${manualOut.toLocaleString()}</span>
                </div>
            </div>
            {/* Proyecciones Futuras */}
            <div className="px-5 py-3 flex flex-col justify-center">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                   <Zap size={10} className="text-[#39FF14]"/> Flujo Máquina
                </span>
                <div className="flex gap-4 mt-0.5">
                  <span className="text-[#39FF14] font-black font-mono text-xs">+${proyecIn.toLocaleString()}</span>
                  <span className="text-[#ff3939] font-black font-mono text-xs">-${proyecOut.toLocaleString()}</span>
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
               <div className="absolute inset-0 border-t-2 border-[#39FF14] rounded-full animate-spin" style={{ animationDuration: '1.2s'}}></div>
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
                                              <span className="truncate flex items-center gap-1 text-zinc-300" title={evt.categorias?.nombre_categoria || 'Desc'}>
                                                 {evt.isReal ? (
                                                    evt.isAutoDB ? 
                                                    <Zap size={8} className={isIngreso ? 'text-emerald-500 fill-emerald-500' : 'text-rose-500 fill-rose-500'} /> 
                                                    : <CheckCircle2 size={8} className="text-zinc-500" />
                                                 ) : (
                                                    <Zap size={8} className={isIngreso ? 'text-[#39FF14] fill-[#39FF14] opacity-50' : 'text-[#ff3939] fill-[#ff3939] opacity-50'} />
                                                 )}
                                                 {evt.categorias?.nombre_categoria?.substring(0,8) || (evt.isReal ? 'REAL' : 'PROYECTO')}
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
