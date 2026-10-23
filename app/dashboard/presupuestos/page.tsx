'use client';
import {Suspense,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {BellRing,CalendarDays,Check,CheckCircle2,ChevronLeft,ChevronRight,Plus,Pencil,Trash2,TriangleAlert,Wallet} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {usePlanning} from '@/lib/use-planning';
import {budgetProgress} from '@/lib/planning';
import {amountToCents,centsToDecimal,civilToday,monthKey} from '@/lib/finance';
import type {Row} from '@/lib/database.types';
import Dialog from '@/components/ui/Dialog';
import ConfirmModal from '@/components/ConfirmModal';
import s from '@/components/budget-preview/BudgetPreview.module.css';

type Budget=Row<'presupuestos_mensuales'>;
export default function PresupuestosPage(){return <Suspense fallback={<p className="p-6 text-muted">Cargando presupuestos…</p>}><Content/></Suspense>;}
function Content(){
  const params=useSearchParams(),{data,loading,busy,error,message,perform}=usePlanning('budgets');
  const [period,setPeriod]=useState(()=>{const value=params.get('mes')||'';return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&Number(value.slice(0,4))>=1000?value:civilToday().slice(0,7);});
  const [form,setForm]=useState<{id:string;category:string;amount:string;alert:string;period:string}|null>(null);
  const [deleting,setDeleting]=useState<Budget|null>(null),[filter,setFilter]=useState('all');
  const budgets=data?.budgets.filter(b=>`${b.anio_calendario}-${String(b.mes_calendario).padStart(2,'0')}`===period)||[];
  const general=budgets.find(b=>b.id_categoria===null);
  const stats=budgets.map(b=>({budget:b,progress:budgetProgress(b,data?.movements||[])}));
  const cards=stats.filter(item=>item.budget.id_categoria!==null&&(filter==='all'||item.progress.status!=='normal'));
  const alerts=stats.filter(item=>item.progress.status!=='normal');
  const spent=general?budgetProgress(general,data?.movements||[]).spentCents:budgetProgress({id_categoria:null,monto_limite:1,anio_calendario:Number(period.slice(0,4)),mes_calendario:Number(period.slice(5)),porcentaje_alerta:100},data?.movements||[]).spentCents;
  const remaining=general?amountToCents(general.monto_limite)-spent:null;
  const usage=general?spent/amountToCents(general.monto_limite)*100:0;
  const currency=data?.profile.codigo_moneda||'COP';
  const money=(cents:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency,currencyDisplay:'narrowSymbol',minimumFractionDigits:0,maximumFractionDigits:2}).format(cents/100);
  const title=new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(period+'-15T12:00:00Z'));
  const name=(b:Budget)=>b.id_categoria?data?.categories.find(c=>c.id_categoria===b.id_categoria)?.nombre_categoria||'Categoría':'General del mes';
  function open(b?:Budget){setForm({id:b?.id_presupuesto||'',category:b?.id_categoria||'',amount:b?centsToDecimal(amountToCents(b.monto_limite)):'',alert:String(b?.porcentaje_alerta||80),period});}
  function changeMonth(direction:number){const [year,month]=period.split('-').map(Number);if((year===1000&&month===1&&direction<0)||(year===9999&&month===12&&direction>0))return;const date=new Date(Date.UTC(year,month-1+direction,15));setPeriod(monthKey(date.getUTCFullYear(),date.getUTCMonth()));setFilter('all');}
  async function save(e:React.FormEvent){e.preventDefault();if(!form)return;await perform(async()=>{
    const [year,month]=form.period.split('-').map(Number);
    const {error}=await supabase.rpc('guardar_presupuesto',{p_id:form.id||null,p_categoria:form.category||null,p_monto:centsToDecimal(amountToCents(form.amount)),p_mes:month,p_anio:year,p_alerta:Number(form.alert)});
    if(error)throw new Error(error.code==='23505'?'Ya existe un presupuesto para esa categoría y mes. Edita el existente.':error.code==='23514'?'Revisa el importe, mes y porcentaje de alerta.':error.message);
    setPeriod(form.period);setForm(null);return 'Presupuesto guardado.';
  });}
  async function remove(){if(!deleting||!data)return;await perform(async()=>{const {data:deleted,error}=await supabase.from('presupuestos_mensuales').delete().eq('id_presupuesto',deleting.id_presupuesto).eq('id_usuario',data.uid).select('id_presupuesto');if(error||!deleted?.length)throw new Error('No se pudo eliminar el presupuesto.');setDeleting(null);return 'Presupuesto eliminado. Tus movimientos se conservan.';});}
  return <div>
    <div className={s.headingRow}><div><div className={s.eyebrow}>MENOS IMPROVISAR, MÁS PLANIFICAR</div><h1>Presupuestos<span>.</span></h1><p>Dale un lugar a cada gasto y disfruta tu mes con más calma.</p></div><button className="button-primary" disabled={!data||busy} onClick={()=>open()}><Plus size={18}/>Nuevo presupuesto</button></div>
    <div className={s.periodRow}><div className={s.monthPicker}><button aria-label="Mes anterior" onClick={()=>changeMonth(-1)}><ChevronLeft size={17}/></button><label><CalendarDays size={17}/><span>{title}</span><input type="month" aria-label="Mes de los presupuestos" min="1000-01" max="9999-12" value={period} onChange={e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)&&Number(e.target.value.slice(0,4))>=1000){setPeriod(e.target.value);setFilter('all');}}}/></label><button aria-label="Mes siguiente" onClick={()=>changeMonth(1)}><ChevronRight size={17}/></button></div><span className={s.monthNote}>Un mes. Un plan que se adapta a ti.</span></div>
    {error&&<p role="alert" className="feedback error mb-4">{error}<button className="ml-3 underline" onClick={()=>window.location.reload()}>Recargar</button></p>}{message&&<p role="status" className="feedback mb-4">{message}</p>}
    {loading?<p role="status" className="panel">Cargando tus presupuestos…</p>:data&&<>
      <section aria-label="Resumen mensual" className={s.summary}>
        <div className={s.summaryMain}><div className={s.summaryLabel}><Wallet size={20}/>Presupuesto general<span className={s.summaryCurrency}>{currency}</span></div><div className={s.heroAmount}>{general?money(amountToCents(general.monto_limite)):'Tu mes empieza aquí'}</div><p>{general?'El límite que elegiste para todos tus gastos del mes.':'Define un límite general para tener una visión completa.'}</p><button className={s.textButton} disabled={busy} onClick={()=>open(general)}>{general?'Ajustar presupuesto':'Definir presupuesto'}</button></div>
        <div className={s.summaryDetails}><div className={s.balanceColumns}><div><span>Ya gastaste</span><strong>{money(spent)}</strong></div><div><span>{remaining!==null&&remaining<0?'Sobre el límite':'Te queda disponible'}</span><strong className={remaining!==null&&remaining<0?s.negativeAmount:s.availableAmount}>{remaining===null?'—':money(Math.abs(remaining))}</strong></div></div><div className={s.summaryTrack}><div style={{width:`${Math.min(100,usage)}%`}}/></div><div className={s.trackLabels}><span>{general?`${usage.toFixed(1)} % de tu presupuesto`:'Sin límite general definido'}</span><span>{general&&usage>=(general.porcentaje_alerta||80)?'Revisa tu consumo':general?'Vas bien':'A tu medida'}</span></div></div>
      </section>
      {alerts.length>0&&<div className={s.warning} role="status"><BellRing size={20}/><div><strong>{alerts.length} presupuesto(s) necesitan tu atención</strong><p>Alcanzaste el umbral de {alerts.map(item=>name(item.budget)).join(', ')}.</p></div></div>}
      <section className={s.categorySection}><div className={s.sectionHeader}><div><h2>Cada categoría, a su ritmo</h2><p>Pequeños límites para las cosas que importan.</p></div><div className={s.filters} role="group" aria-label="Filtrar presupuestos"><button aria-pressed={filter==='all'} className={filter==='all'?s.selectedFilter:''} onClick={()=>setFilter('all')}>Todos</button><button aria-pressed={filter==='attention'} className={filter==='attention'?s.selectedFilter:''} onClick={()=>setFilter('attention')}>Por revisar</button></div></div>
        <div className={s.cardGrid}>{cards.map(({budget:b,progress:p})=><article className={s.budgetCard} key={b.id_presupuesto}>
          <div className={s.cardHeader}><span className={`${s.categoryIcon} ${s.olive}`}><Wallet size={21}/></span><span className={p.status==='normal'?s.healthyBadge:s.warningBadge}>{p.status==='normal'?<Check size={12}/>:<TriangleAlert size={12}/>}{p.status==='normal'?'En orden':p.spentCents>p.limitCents?'Límite superado':'Por revisar'}</span></div><h3>{name(b)}</h3><div className={s.cardAmount}>{money(p.spentCents)}<span>de {money(p.limitCents)}</span></div>
          <div className={p.status==='normal'?s.cardTrack:s.warningTrack} role="progressbar" aria-label={`Consumo de ${name(b)}`} aria-valuenow={Math.min(100,p.percentage)} aria-valuemin={0} aria-valuemax={100}><div style={{width:`${Math.min(100,p.percentage)}%`}}/></div><div className={s.cardTrackLabels}><span>{p.percentage.toFixed(1)} % utilizado</span><strong>{p.remainingCents<0?'Exceso ':'Disponible '}{money(Math.abs(p.remainingCents))}</strong></div><div className={s.cardFooter}><span><BellRing size={13}/>Aviso al {b.porcentaje_alerta} %</span><div><button disabled={busy} aria-label={`Editar presupuesto de ${name(b)}`} onClick={()=>open(b)}><Pencil size={16}/></button><button disabled={busy} aria-label={`Eliminar presupuesto de ${name(b)}`} onClick={()=>setDeleting(b)}><Trash2 size={16}/></button></div></div>
        </article>)}{filter==='all'&&<button className={s.addCard} disabled={busy} onClick={()=>open()}><span><Plus size={24}/></span><strong>Un nuevo propósito</strong><p>Asigna un límite a otra categoría.</p><span className={s.addCardLink}>Crear presupuesto</span></button>}</div>
        {filter==='attention'&&!cards.length&&<div className={s.emptyState}><CheckCircle2 size={28}/><h3>Todo en orden por aquí</h3><p>Ninguna categoría ha alcanzado su umbral de alerta.</p></div>}
      </section><p className={s.explainer}>Solo cuentan los egresos confirmados del mes. Las previsiones, inversiones, transferencias y aportes a metas no consumen el presupuesto. Los límites por categoría no se suman al general.</p>
    </>}
    {form&&<Dialog title={form.id?'Ajusta tu presupuesto':'Dale un límite a tu categoría'} description="Define tu plan mensual. Puedes ajustarlo cuando lo necesites." onClose={()=>setForm(null)} busy={busy}>
      {error&&<p role="alert" className="feedback error mb-4">{error}</p>}<form onSubmit={save}><fieldset disabled={busy} className={s.form}>
        <label>Mes<input type="month" required min="1000-01" max="9999-12" value={form.period} onChange={e=>setForm({...form,period:e.target.value})}/></label><label>Categoría<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="">General del mes</option>{data?.categories.map(c=><option key={c.id_categoria} value={c.id_categoria}>{c.nombre_categoria}</option>)}</select></label>
        <label>Límite mensual<span className={s.amountInput}><span>{currency}</span><input type="number" required min="0.01" max="9999999999999.99" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></span></label><label>Avisarme cuando llegue al<span className={s.percentInput}><input type="number" required min="1" max="100" step="1" value={form.alert} onChange={e=>setForm({...form,alert:e.target.value})}/><span>% del presupuesto</span></span></label><p className={s.formHint}>La alerta aparece en la aplicación al alcanzar ese porcentaje.</p>
        <div className="dialog-actions"><button type="button" className="button-secondary" onClick={()=>setForm(null)}>Cancelar</button><button type="submit" className="button-primary">{busy?'Guardando…':'Guardar presupuesto'}</button></div>
      </fieldset></form>
    </Dialog>}
    <ConfirmModal open={!!deleting} title="¿Eliminar este presupuesto?" message={deleting?`Se quitará el límite de ${name(deleting)}. Tus gastos se conservan.`:''} busy={busy} error={error} confirmText="Sí, eliminar" cancelText="Conservar presupuesto" onCancel={()=>setDeleting(null)} onConfirm={()=>void remove()}/>
  </div>;
}
