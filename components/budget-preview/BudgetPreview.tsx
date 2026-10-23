'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BellRing,
  CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Coffee, Home, LayoutDashboard, Menu, Pencil, Plus, Repeat2,
  Settings2, ShieldCheck, ShoppingBasket, SlidersHorizontal, Sparkles,
  Target, Trash2, TriangleAlert, Wallet, X,
} from 'lucide-react';
import { amountToCents, centsToDecimal, civilToday } from '@/lib/finance';
import styles from './BudgetPreview.module.css';

type Budget = { id: string; category: string; limit: number; alert: number; period: string };
type Form = { id: string; category: string; amount: string; alert: string };
const categories = [
  { id: 'general', name: 'General del mes', icon: Wallet, color: 'teal' },
  { id: 'casa', name: 'Hogar', icon: Home, color: 'blue' },
  { id: 'mercado', name: 'Mercado', icon: ShoppingBasket, color: 'olive' },
  { id: 'transporte', name: 'Transporte', icon: ArrowLeftRight, color: 'violet' },
  { id: 'restaurantes', name: 'Restaurantes', icon: Coffee, color: 'orange' },
  { id: 'ocio', name: 'Ocio', icon: Sparkles, color: 'violet' },
  { id: 'otros', name: 'Otros gastos', icon: Wallet, color: 'blue' },
];
const navigation = [
  { name: 'Resumen', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Movimientos', icon: ArrowLeftRight, path: '/dashboard/movimientos' },
  { name: 'Presupuestos', icon: Wallet, path: '/vista-previa/presupuestos' },
  { name: 'Metas de ahorro', icon: Target, path: '/dashboard/metas' },
  { name: 'Recurrencias', icon: Repeat2, path: '/dashboard/recurrencias' },
  { name: 'Calendario', icon: CalendarDays, path: '/dashboard/calendario' },
];
const formatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const money = (cents: number) => '$ ' + formatter.format(cents / 100);
const monthTitle = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 15)));
};

function Dialog({ title, description, children, onClose, danger = false }: {
  title: string; description: string; children: React.ReactNode; onClose: () => void; danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={id} aria-describedby={id + '-description'}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className={styles.dialogHeader}>
      <span className={danger ? styles.dangerIcon : styles.dialogIcon}>{danger ? <Trash2 size={22} /> : <Wallet size={22} />}</span>
      <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Cerrar ventana"><X size={20} /></button>
    </div>
    <h2 id={id}>{title}</h2>
    <p id={id + '-description'} className={styles.dialogDescription}>{description}</p>
    {children}
  </dialog>;
}

export default function BudgetPreview() {
  const [initialPeriod] = useState(() => civilToday().slice(0, 7));
  const [period, setPeriod] = useState(initialPeriod);
  const [budgets, setBudgets] = useState<Budget[]>(() => [
    { id: 'general', category: 'general', limit: 250000000, alert: 80, period: initialPeriod },
    { id: 'casa', category: 'casa', limit: 100000000, alert: 80, period: initialPeriod },
    { id: 'mercado', category: 'mercado', limit: 60000000, alert: 80, period: initialPeriod },
    { id: 'transporte', category: 'transporte', limit: 25000000, alert: 80, period: initialPeriod },
    { id: 'restaurantes', category: 'restaurantes', limit: 25000000, alert: 80, period: initialPeriod },
  ]);
  const [form, setForm] = useState<Form | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [filter, setFilter] = useState('all');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const monthBudgets = budgets.filter(budget => budget.period === period);
  const general = monthBudgets.find(budget => budget.category === 'general');
  const spentByCategory: Record<string, number> = period === initialPeriod
    ? { casa: 85000000, mercado: 35000000, transporte: 15000000, restaurantes: 24000000, ocio: 5000000 }
    : {};
  const spent = Object.values(spentByCategory).reduce((sum, amount) => sum + amount, 0);
  const usage = (budget: Budget) => budget.category === 'general' ? spent : spentByCategory[budget.category] || 0;
  const ratio = (budget: Budget) => usage(budget) / budget.limit * 100;
  const warnings = monthBudgets.filter(budget => ratio(budget) >= budget.alert);
  const categoryBudgets = monthBudgets.filter(budget => budget.category !== 'general');
  const filtered = categoryBudgets.filter(budget => filter === 'all' || ratio(budget) >= budget.alert);
  const available = general ? general.limit - spent : null;

  function changeMonth(direction: number) {
    const [year, month] = period.split('-').map(Number);
    if ((year === 1000 && month === 1 && direction < 0) || (year === 9999 && month === 12 && direction > 0)) return;
    const date = new Date(Date.UTC(year, month - 1 + direction, 15));
    const next = date.toISOString().slice(0, 7);
    setPeriod(next); setFilter('all'); setNotice('');
  }
  function open(budget?: Budget) {
    const category = budget?.category || categories.find(item => !monthBudgets.some(b => b.category === item.id))?.id || 'general';
    setError('');
    setForm({ id: budget?.id || '', category, amount: budget ? centsToDecimal(budget.limit) : '', alert: String(budget?.alert || 80) });
  }
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    try {
      const amount = amountToCents(form.amount);
      const alert = Number(form.alert);
      if (!Number.isInteger(alert) || alert < 1 || alert > 100) throw new Error('Elige una alerta entre 1 y 100 %.');
      if (monthBudgets.some(budget => budget.category === form.category && budget.id !== form.id)) {
        throw new Error('Ya tienes un presupuesto para esta categoría. Puedes editarlo desde su tarjeta.');
      }
      setBudgets(previous => form.id
        ? previous.map(budget => budget.id === form.id ? { ...budget, category: form.category, limit: amount, alert } : budget)
        : [...previous, { id: crypto.randomUUID(), category: form.category, limit: amount, alert, period }]);
      setNotice(form.id ? 'Cambios guardados en esta vista previa.' : 'Presupuesto de ejemplo creado.');
      setForm(null); setError('');
    } catch (error) { setError(error instanceof Error ? error.message : 'Revisa los datos.'); }
  }
  function menuContent() {
    return <>
      <Link href="/vista-previa/presupuestos" className={styles.brand} aria-label="Flux, vista previa"><span>f<span className={styles.brandDot}>.</span></span>flux</Link>
      <div className={styles.spaceLabel}>TU ESPACIO PERSONAL</div>
      <nav aria-label="Navegación principal" className={styles.navigation}>
        {navigation.map(item => <Link key={item.name} href={item.path} className={item.name === 'Presupuestos' ? styles.activeNav : ''}
          aria-current={item.name === 'Presupuestos' ? 'page' : undefined} onClick={() => setMobileMenu(false)}>
          <item.icon size={19} strokeWidth={1.7} /><span>{item.name}</span>{item.name === 'Presupuestos' && <span className={styles.activeDot} />}
        </Link>)}
      </nav>
      <div className={styles.sidebarBottom}>
        <div className={styles.tip}><span><ShieldCheck size={18} />A tu ritmo</span><p>Un poco de claridad hoy.<br />Más tranquilidad mañana.</p></div>
        <Link href="/dashboard/configuracion" className={styles.settings}><Settings2 size={18} />Configuración</Link>
        <div className={styles.profile}><span className={styles.avatar}>U</span><div><strong>Tu espacio</strong><span>Finanzas personales</span></div><span className={styles.currency}>COP</span></div>
      </div>
    </>;
  }

  return <div className={styles.preview}>
    <a href="#budget-content" className={styles.skipLink}>Ir al contenido</a>
    <aside className={styles.sidebar}>{menuContent()}</aside>
    <div className={styles.workspace}>
      <div className={styles.previewBar}><span><span className={styles.previewDot} />Propuesta de diseño <span className={styles.previewDivider}>/</span> <strong>Datos de ejemplo</strong></span><Link href="/dashboard/presupuestos">Volver a la aplicación <ArrowUpRight size={14} /></Link></div>
      <header className={styles.topbar}>
        <div className={styles.breadcrumb}><button className={styles.menuButton} aria-label="Abrir navegación" onClick={() => setMobileMenu(true)}><Menu size={21} /></button><span>Mi espacio</span><ChevronRight size={14} /><strong>Presupuestos</strong></div>
        <div className={styles.topbarRight}><span className={styles.privateLabel}><ShieldCheck size={15} />Finanzas personales</span><span className={styles.topAvatar}>U</span></div>
      </header>
      <main id="budget-content" className={styles.content}>
        <div className={styles.headingRow}><div><div className={styles.eyebrow}>MENOS IMPROVISAR, MÁS PLANIFICAR</div><h1>Presupuestos<span>.</span></h1><p>Dale un lugar a cada gasto y disfruta tu mes con más calma.</p></div><button className={styles.primaryButton} onClick={() => open()}><Plus size={18} />Nuevo presupuesto</button></div>

        <div className={styles.periodRow}>
          <div className={styles.monthPicker}><button aria-label="Mes anterior" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /></button><label><CalendarDays size={17} /><span>{monthTitle(period)}</span><ChevronDown size={14} /><input type="month" min="1000-01" max="9999-12" aria-label="Mes de los presupuestos" value={period} onChange={e => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) { setPeriod(e.target.value); setFilter('all'); setNotice(''); } }} /></label><button aria-label="Mes siguiente" onClick={() => changeMonth(1)}><ChevronRight size={17} /></button></div>
          <span className={styles.monthNote}>Un mes. Un plan que se adapta a ti.</span>
        </div>
        {notice && <div className={styles.notice} role="status"><CheckCircle2 size={18} />{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice('')}><X size={16} /></button></div>}

        <section aria-label="Resumen del presupuesto mensual" className={styles.summary}>
          <div className={styles.summaryMain}><div className={styles.summaryLabel}><span className={styles.summaryIcon}><Wallet size={20} /></span>Presupuesto general<span className={styles.summaryCurrency}>COP</span></div><div className={styles.heroAmount}>{general ? money(general.limit) : 'Tu mes empieza aquí'}</div><p>{general ? 'El límite que elegiste para todos tus gastos del mes.' : 'Crea un presupuesto general para tener una visión completa.'}</p><button className={styles.textButton} onClick={() => open(general)}>{general ? 'Ajustar presupuesto' : 'Definir presupuesto'}<ArrowUpRight size={15} /></button></div>
          <div className={styles.summaryDetails}>
            <div className={styles.balanceColumns}><div><span><ArrowDownLeft size={15} />Ya gastaste</span><strong>{money(spent)}</strong></div><div><span><span className={styles.smallDot} />{available !== null && available < 0 ? 'Sobre el límite' : 'Te queda disponible'}</span><strong className={available !== null && available < 0 ? styles.negativeAmount : styles.availableAmount}>{available === null ? '—' : money(Math.abs(available))}</strong></div></div>
            <div className={styles.summaryTrack}><div style={{ width: `${general ? Math.min(100, ratio(general)) : 0}%` }} /></div>
            <div className={styles.trackLabels}><span>{general ? `${ratio(general).toFixed(1).replace('.', ',')} % de tu presupuesto` : 'Sin límite general definido'}</span><span>{general ? (ratio(general) >= general.alert ? <><TriangleAlert size={13} />Revisa tu consumo</> : <><Check size={14} />Vas bien</>) : 'A tu medida'}</span></div>
          </div>
        </section>

        {warnings.length > 0 && <div className={styles.warning}><span className={styles.warningIcon}><BellRing size={19} /></span><div><strong>{warnings.length === 1 ? 'Un presupuesto necesita tu atención' : `${warnings.length} presupuestos necesitan tu atención`}</strong><p>{warnings.map(budget => categories.find(c => c.id === budget.category)?.name).join(' y ')} {warnings.length === 1 ? 'alcanzó' : 'alcanzaron'} el umbral que configuraste.</p></div><button onClick={() => { if (warnings.every(budget => budget.category === 'general')) { open(general); return; } setFilter('attention'); document.getElementById('category-budgets')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }}>Revisar <ArrowUpRight size={15} /></button></div>}

        <section id="category-budgets" className={styles.categorySection} aria-labelledby="categories-title">
          <div className={styles.sectionHeader}><div><h2 id="categories-title">Cada categoría, a su ritmo</h2><p>Pequeños límites para las cosas que importan.</p></div><div className={styles.filters} role="group" aria-label="Filtrar presupuestos"><button aria-pressed={filter === 'all'} className={filter === 'all' ? styles.selectedFilter : ''} onClick={() => setFilter('all')}>Todos <span>{categoryBudgets.length}</span></button><button aria-pressed={filter === 'attention'} className={filter === 'attention' ? styles.selectedFilter : ''} onClick={() => setFilter('attention')}><SlidersHorizontal size={14} />Por revisar</button></div></div>
          <div className={styles.cardGrid}>
            {filtered.map(budget => {
              const category = categories.find(item => item.id === budget.category)!;
              const Icon = category.icon;
              const percentage = ratio(budget);
              const warning = percentage >= budget.alert;
              const excess = usage(budget) > budget.limit;
              return <article key={budget.id} className={styles.budgetCard}>
                <div className={styles.cardHeader}><span className={`${styles.categoryIcon} ${styles[category.color]}`}><Icon size={21} strokeWidth={1.7} /></span><span className={warning ? styles.warningBadge : styles.healthyBadge}>{warning ? <TriangleAlert size={12} /> : <span className={styles.badgeDot} />}{excess ? 'Límite superado' : warning ? 'Por revisar' : 'En orden'}</span></div>
                <h3>{category.name}</h3><div className={styles.cardAmount}>{money(usage(budget))}<span>de {money(budget.limit)}</span></div>
                <div className={warning ? styles.warningTrack : styles.cardTrack} role="progressbar" aria-label={`Consumo de ${category.name}`} aria-valuenow={Math.min(100, Math.round(percentage))} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${percentage.toFixed(1)} % consumido`}><div style={{ width: `${Math.min(100, percentage)}%` }} /></div>
                <div className={styles.cardTrackLabels}><span>{percentage.toFixed(0)} % utilizado</span><strong className={excess ? styles.negativeAmount : ''}>{excess ? 'Exceso ' : 'Disponible '}{money(Math.abs(budget.limit - usage(budget)))}</strong></div>
                <div className={styles.cardFooter}><span><BellRing size={13} />Aviso al {budget.alert} %</span><div><button aria-label={`Editar presupuesto de ${category.name}`} onClick={() => open(budget)}><Pencil size={15} /></button><button aria-label={`Eliminar presupuesto de ${category.name}`} onClick={() => setDeleting(budget)}><Trash2 size={15} /></button></div></div>
              </article>;
            })}
            {filter === 'all' && <button className={styles.addCard} onClick={() => open()}><span><Plus size={24} /></span><strong>Un nuevo propósito</strong><p>Asigna un límite a otra categoría.</p><span className={styles.addCardLink}>Crear presupuesto <ArrowUpRight size={14} /></span></button>}
          </div>
          {filter === 'attention' && !filtered.length && <div className={styles.emptyState}><CheckCircle2 size={28} /><h3>Todo en orden por aquí</h3><p>Ninguna categoría ha alcanzado su umbral de alerta este mes.</p><button className={styles.secondaryButton} onClick={() => setFilter('all')}>Ver todos los presupuestos</button></div>}
        </section>
        <div className={styles.explainer}><CircleHelp size={18} /><p>Solo cuentan los gastos confirmados. Las categorías te ayudan a distribuir tu límite general; sus presupuestos no se suman a él.</p></div>
        <footer className={styles.pageFooter}><span>Con claridad, un mes a la vez.</span><span>Vista previa · Los cambios se reinician al recargar.</span></footer>
      </main>
    </div>

    {form && <Dialog title={form.id ? 'Ajusta tu presupuesto' : 'Dale un límite a tu categoría'} description={`Define tu plan para ${monthTitle(period)}. Puedes ajustarlo cuando lo necesites.`} onClose={() => setForm(null)}>
      <form onSubmit={save} className={styles.form}>
        <label>Categoría<select autoFocus value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Límite mensual<span className={styles.amountInput}><span>COP</span><input type="number" required min="0.01" max="9999999999999.99" step="0.01" placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></span></label>
        <label>Avisarme cuando llegue al<span className={styles.percentInput}><input type="number" min="1" max="100" step="1" required value={form.alert} onChange={e => setForm({ ...form, alert: e.target.value })} /><span>% del presupuesto</span></span></label>
        <p className={styles.formHint}><BellRing size={15} />Verás un aviso en tus presupuestos al alcanzar este porcentaje.</p>
        {error && <p role="alert" className={styles.formError}><TriangleAlert size={16} />{error}</p>}
        {form.id && <button type="button" className={styles.deleteLink} onClick={() => { setDeleting(budgets.find(budget => budget.id === form.id) || null); setForm(null); }}>Eliminar este presupuesto</button>}
        <div className={styles.dialogFooter}><button type="button" className={styles.secondaryButton} onClick={() => setForm(null)}>Cancelar</button><button type="submit" className={styles.primaryButton}>{form.id ? 'Guardar cambios' : 'Crear presupuesto'}<Check size={16} /></button></div>
      </form>
    </Dialog>}
    {deleting && <Dialog danger title="¿Eliminar este presupuesto?" description={`Se quitará el límite de ${categories.find(c => c.id === deleting.category)?.name} para ${monthTitle(period)}. Tus gastos se conservan.`} onClose={() => setDeleting(null)}>
      <div className={styles.deleteSummary}><span>Límite mensual</span><strong>{money(deleting.limit)} COP</strong></div><p className={styles.formHint}>Puedes crear otro presupuesto para esta categoría cuando quieras.</p>
      <div className={styles.dialogFooter}><button autoFocus className={styles.secondaryButton} onClick={() => setDeleting(null)}>Conservar presupuesto</button><button className={styles.dangerButton} onClick={() => { setBudgets(previous => previous.filter(budget => budget.id !== deleting.id)); setDeleting(null); setNotice('Presupuesto de ejemplo eliminado. Sus gastos se conservan.'); }}>Sí, eliminar</button></div>
    </Dialog>}
    {mobileMenu && <Dialog title="Tu espacio" description="Elige una sección de tu aplicación." onClose={() => setMobileMenu(false)}><div className={styles.mobileNavigation}>{menuContent()}</div></Dialog>}
  </div>;
}
