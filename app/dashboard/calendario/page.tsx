"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { createFinanceReader } from '@/lib/finance-data';
import { calendarEvents, calendarTotals, civilToday, civilToDate, formatAmount, movementSign } from '@/lib/finance';
import type { CalendarEvent, Movement, Occurrence, Profile, Recurrence } from '@/lib/finance';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Zap, CheckCircle2 } from 'lucide-react';

const reader = createFinanceReader(supabase);

export default function CalendarioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recurrencias, setRecurrencias] = useState<Recurrence[]>([]);
  const [ocurrencias, setOcurrencias] = useState<Occurrence[]>([]);
  const [movimientosReales, setMovimientosReales] = useState<Movement[]>([]);
  const [currentDate, setCurrentDate] = useState(() => civilToDate(civilToday()));

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw new Error('No se pudo comprobar tu sesión.');
        if (!session) { router.replace('/login'); return; }
        const [rules, movements, userProfile, occurrences] = await Promise.all([
          reader.recurrences(session.user.id), reader.movements(session.user.id), reader.profile(session.user.id),
          reader.occurrences(session.user.id),
        ]);
        if (active) { setRecurrencias(rules); setMovimientosReales(movements); setProfile(userProfile); setOcurrencias(occurrences); }
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
      const events = calendarEvents(movimientosReales, recurrencias, currentDate.getFullYear(), currentDate.getMonth(), ocurrencias);
      return { events, totals: calendarTotals(events), error: '' };
    } catch (error) {
      return { events: {}, totals: null, error: error instanceof Error ? error.message : 'No se pudo calcular el calendario.' };
    }
  }, [movimientosReales, recurrencias, currentDate, ocurrencias]);
  if (loadError || computed.error) {
    return <div role="alert" className="p-6 text-danger">
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

      <p className="text-sm text-muted mb-6">
        Las previsiones y los pendientes no cambian tu saldo. Al confirmar un vencimiento, aparece su movimiento real una sola vez.
        Gestiona los vencimientos en <a className="underline text-accent" href="/dashboard/recurrencias">Recurrencias</a>. Los movimientos antiguos sin vínculo permanecen independientes.
      </p>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-ink tracking-normal  flex items-center gap-3">
            <CalendarIcon className="text-accent" size={30} strokeWidth={2.5} />
            Pronóstico
          </h1>
          <p className="text-muted tabular-nums text-xs  tracking-normal mt-2 border-l-2 border-accent pl-3 py-0.5">
            Movimientos registrados y programación estimada
          </p>
        </div>

        {/* Cajas de estimaciones divididas */}
        <div className="flex max-w-full flex-wrap bg-surface border border-line rounded-2xl overflow-hidden">
          {/* Reales (Históricos del Mes) */}
          <div className="px-5 py-3 flex flex-col justify-center border-r border-line bg-paper/50">
            <span className="text-xs text-muted font-bold  tracking-normal mb-1 flex items-center gap-1">
              <CheckCircle2 size={10} /> Registrado
            </span>
            <div className="flex gap-4 mt-0.5">
              <span className="text-muted font-semibold tabular-nums text-xs">{formatAmount(manualIn, currency)}</span>
              <span className="text-danger font-semibold tabular-nums text-xs">{formatAmount(manualOut, currency)}</span>
            </div>
          </div>
          {/* Proyecciones Futuras */}
          <div className="px-5 py-3 flex flex-col justify-center">
            <span className="text-xs text-muted font-bold  tracking-normal mb-1 flex items-center gap-1">
              <Zap size={10} className="text-accent" /> Programado (estimación)
            </span>
            <div className="flex gap-4 mt-0.5">
              <span className="text-accent font-semibold tabular-nums text-xs">{formatAmount(proyecIn, currency)}</span>
              <span className="text-danger font-semibold tabular-nums text-xs">{formatAmount(proyecOut, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controles del Mes */}
      <div className="bg-surface border border-line/50 p-4 rounded-t-3xl flex items-center justify-between shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/30 to-transparent"></div>
        <button aria-label="Mes anterior" onClick={prevMonth} className="p-2 text-muted hover:text-accent hover:bg-accent/10 rounded-xl transition-all">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col items-center">
          <h2 className="text-xl font-semibold text-ink  tracking-normal">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <span className="text-xs tabular-nums text-muted tracking-normal">MAPA DEL MES</span>
        </div>
        <button aria-label="Mes siguiente" onClick={nextMonth} className="p-2 text-muted hover:text-accent hover:bg-accent/10 rounded-xl transition-all">
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Cuadrícula del Calendario */}
      <div className="calendar-scroll bg-surface border border-line rounded-2xl p-4 sm:p-6">

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4 text-accent">
            <div className="relative">
              <CalendarIcon size={32} className="animate-spin text-zinc-800" />
              <div className="absolute inset-0 border-t-2 border-accent rounded-full animate-spin" style={{ animationDuration: '1.2s' }}></div>
            </div>
            <span className="tabular-nums text-xs tracking-normal  animate-pulse">Cargando tu calendario...</span>
          </div>
        ) : (
          <div className="calendar-grid">
            <div className="grid grid-cols-7 gap-4 mb-4">
              {['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'].map(day => (
                <div key={day} className="text-center font-bold text-xs tracking-normal text-muted  border-b border-line/50 pb-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2 sm:gap-4">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="calendar-day border border-transparent rounded-2xl opacity-20 bg-paper/10"></div>
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const events = eventosPorDia[dayNum] ?? [];
                const isToday = today.getDate() === dayNum && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();

                return (
                  <div key={dayNum} className={`calendar-day flex flex-col p-2 border rounded-2xl transition-all duration-300 hover:border-zinc-500  ${isToday ? 'border-accent/50 bg-accent/5 ring-1 ring-accent/20' : 'border-line/60 bg-paper/30'
                    }`}>
                    <span className={`text-xs tabular-nums font-bold mb-2 text-right w-full ${isToday ? 'text-accent' : 'text-muted'}`}>
                      {dayNum.toString().padStart(2, '0')}
                    </span>

                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      {events.map((evt) => {
                        const sign = movementSign(evt.id_tipo);
                        const isIngreso = sign > 0;
                        return (
                          <div key={evt.key} className={`calendar-event ${sign > 0 ? 'income' : sign < 0 ? 'expense' : ''}`}>
                            <span className="calendar-event-label">
                              {evt.isReal ? (
                                evt.isAutoDB ?
                                  <Zap size={12} />
                                  : <CheckCircle2 size={12} />
                              ) : (
                                <Zap size={12} />
                              )}
                              <span className="calendar-event-title" title={evt.categorias?.nombre_categoria || 'Sin categoría'}>{evt.categorias?.nombre_categoria || 'Sin categoría'}</span>
                            </span>
                            <strong className={`calendar-event-amount ${isIngreso ? 'text-accent' : sign < 0 ? 'text-danger' : 'text-muted'}`}>
                              {sign > 0 ? '+' : sign < 0 ? '-' : ''}{formatAmount(evt.monto_recurrente, currency)}
                            </strong>
                            <span className="calendar-event-status">{evt.isReal ? 'Confirmado' : evt.key.startsWith('pending:') ? 'Pendiente' : 'Previsto'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
      {!loading && <section className="mt-6 space-y-3 md:hidden" aria-label="Agenda del mes">
        <h2 className="text-xl font-semibold">Tu agenda del mes</h2>
        {Object.values(eventosPorDia).every(events=>events.length===0)&&<p className="panel text-sm text-muted">No hay movimientos ni previsiones este mes.</p>}
        {Object.entries(eventosPorDia).flatMap(([day,events])=>events.map(event=><article key={event.key} className="panel flex flex-wrap justify-between gap-3">
          <div><strong className="text-sm">Día {day} · {event.categorias?.nombre_categoria||'Sin categoría'}</strong><p className="mt-1 text-xs text-muted">{event.isReal?'Confirmado':event.key.startsWith('pending:')?'Pendiente':'Previsto'}</p></div><span className="text-sm money-value">{formatAmount(event.monto_recurrente,currency)}</span>
        </article>))}
      </section>}
    </div>
  );
}
