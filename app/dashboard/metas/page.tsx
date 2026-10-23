'use client';
import {useState} from 'react';
import {Plus} from 'lucide-react';
import Dialog from '@/components/ui/Dialog';
import ConfirmModal from '@/components/ConfirmModal';
import {supabase} from '@/lib/supabase';
import {usePlanning} from '@/lib/use-planning';
import {goalProgress} from '@/lib/planning';
import {amountToCents,centsToDecimal,civilToday,formatAmount} from '@/lib/finance';
import type {Row} from '@/lib/database.types';

const input='field mt-1';
const button='button-secondary';
type GoalForm={id:string;name:string;target:string;initial:string;date:string;priority:string};
type EntryForm={id:string;goal:Row<'metas_ahorro'>;amount:string;type:string;date:string;description:string};
const kinds:Record<string,string>={saldo_inicial:'Saldo inicial',aporte:'Aporte',retiro:'Retiro',reversion:'Reversión'};
export default function MetasPage(){
  const {data,loading,busy,error,message,perform}=usePlanning('goals');
  const [form,setForm]=useState<GoalForm|null>(null);
  const [entry,setEntry]=useState<EntryForm|null>(null);
  const [reversing,setReversing]=useState<Row<'aportes_metas'>|null>(null);
  const [showArchived,setShowArchived]=useState(false);
  const [historyGoal,setHistoryGoal]=useState('');
  const [limit,setLimit]=useState(50);
  function open(goal?:Row<'metas_ahorro'>){setForm({id:goal?.id_meta||'',name:goal?.nombre_meta||'',target:String(goal?.monto_objetivo||''),initial:'0',date:goal?.fecha_proyectada||'',priority:goal?.prioridad_nivel||'Medio'});}
  async function save(e:React.FormEvent){e.preventDefault();if(!form)return;await perform(async()=>{
    const {error}=await supabase.rpc('guardar_meta',{p_id:form.id||null,p_nombre:form.name.trim(),p_objetivo:centsToDecimal(amountToCents(form.target)),p_inicial:form.id?'0.00':centsToDecimal(amountToCents(form.initial,true)),p_fecha:form.date||null,p_prioridad:form.priority});
    if(error)throw new Error(error.code==='23514'?'Revisa el nombre, objetivo y fecha de la meta.':error.message);
    setForm(null);return 'Meta guardada.';
  });}
  async function saveEntry(e:React.FormEvent){e.preventDefault();if(!entry)return;await perform(async()=>{
    const {error}=await supabase.rpc('registrar_aporte_meta',{p_id:entry.id,p_meta:entry.goal.id_meta,p_monto:centsToDecimal(amountToCents(entry.amount)),p_tipo:entry.type,p_fecha:entry.date,p_concepto:entry.description.trim()});
    if(error)throw new Error(error.message);
    setHistoryGoal(entry.goal.id_meta);setEntry(null);return 'Registro guardado en la meta. El saldo general no cambia.';
  });}
  async function reverse(){if(!reversing)return;await perform(async()=>{const {error}=await supabase.rpc('revertir_aporte_meta',{p_id:reversing.id_aporte});if(error)throw new Error(error.message);setReversing(null);return 'Registro revertido. El historial conserva el original y su corrección.';});}
  const goals=data?.goals.filter(g=>showArchived||!g.archivada)||[];
  const entries=data?.entries.filter(a=>!historyGoal||a.id_meta===historyGoal)||[];
  const reversed=new Set(data?.entries.map(a=>a.id_origen).filter(Boolean));
  const currency=data?.profile.codigo_moneda||'COP';
  return <div className="mx-auto max-w-5xl space-y-6 pb-12 text-ink">
    <header className="page-heading"><div><h1 className="text-3xl font-bold">Metas de ahorro</h1><p className="mt-2 text-muted">Reserva dinero para tus objetivos y conserva el historial de cada aporte.</p></div><button className="button-primary" disabled={!data||busy} onClick={()=>open()}><Plus size={18}/>Nueva meta</button></header>
    <p className="rounded-xl border border-line p-4 text-sm text-muted">Un aporte aumenta lo reservado para esta meta; un retiro lo reduce. Son anotaciones de ahorro: no crean movimientos, no cambian tu saldo general ni consumen presupuestos. Los saldos anteriores se conservan como saldo inicial.</p>
    {error&&<p role="alert" className="text-danger">{error}<button className="ml-3 underline" onClick={()=>window.location.reload()}>Recargar</button></p>}{message&&<p role="status" className="text-accent">{message}</p>}
    <label className="flex items-center gap-2"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>Mostrar metas archivadas</label>
    {loading?<p>Cargando metas…</p>:data&&!goals.length?<p className="text-muted">Aún no tienes metas en esta vista.</p>:null}
    {data&&goals.map(goal=>{const p=goalProgress(goal,civilToday());return <article key={goal.id_meta} className="space-y-3 rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">{goal.nombre_meta}</h2><span className={p.completed?'text-accent':p.overdue?'text-warning':'text-muted'}>{goal.archivada?'Archivada':p.completed?'Completada':p.overdue?'Fecha objetivo vencida':'En progreso'}</span></div>
      <p>{formatAmount(centsToDecimal(p.currentCents),currency)} reservados de {formatAmount(goal.monto_objetivo,currency)}</p>
      <progress className="h-3 w-full accent-emerald-500" aria-label="Porcentaje de meta alcanzado" value={Math.min(100,p.percentage)} max={100}/>
      <p className="text-sm text-muted">{p.percentage.toFixed(1)}% · Faltan {formatAmount(centsToDecimal(p.remainingCents),currency)} · Prioridad {goal.prioridad_nivel}{goal.fecha_proyectada?` · Fecha objetivo: ${goal.fecha_proyectada}`:''}</p>
      <div className="flex flex-wrap gap-2">{!goal.archivada&&<><button className={button+' text-accent'} disabled={busy} onClick={()=>setEntry({id:crypto.randomUUID(),goal,amount:'',type:'aporte',date:civilToday(),description:''})}>Aportar o retirar</button><button className={button} disabled={busy} onClick={()=>open(goal)}>Editar objetivo</button></>}
        <button className={button} onClick={()=>{setHistoryGoal(goal.id_meta);setLimit(50);document.getElementById('goal-history')?.scrollIntoView({behavior:'smooth'});}}>Ver historial</button>
        <button className={button} disabled={busy} onClick={()=>void perform(async()=>{const {error}=await supabase.rpc('archivar_meta',{p_id:goal.id_meta,p_archivada:!goal.archivada});if(error)throw new Error(error.message);return goal.archivada?'Meta reactivada.':'Meta archivada. Sus aportes e historial se conservan.';})}>{goal.archivada?'Reactivar':'Archivar'}</button>
      </div>
    </article>;})}
    <section id="goal-history" className="space-y-3"><h2 className="text-xl font-semibold">Historial de ahorro</h2><label className="block max-w-sm">Meta<select className={input} value={historyGoal} onChange={e=>{setHistoryGoal(e.target.value);setLimit(50);}}><option value="">Todas las metas</option>{data?.goals.map(g=><option key={g.id_meta} value={g.id_meta}>{g.nombre_meta}{g.archivada?' (archivada)':''}</option>)}</select></label>
      {data&&!entries.length&&<p className="text-muted">No hay aportes o retiros para esta selección.</p>}
      <ul className="space-y-3">{entries.slice(0,limit).map(a=>{const goal=data?.goals.find(g=>g.id_meta===a.id_meta);return <li key={a.id_aporte} className="rounded-xl border border-line p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{kinds[a.tipo]} · {formatAmount(a.monto,currency)}{reversed.has(a.id_aporte)?' · Revertido':''}</p><p className="mt-1 text-sm text-muted">{a.fecha} · {goal?.nombre_meta} · {a.concepto}</p></div>{!goal?.archivada&&['aporte','retiro'].includes(a.tipo)&&!reversed.has(a.id_aporte)&&<button disabled={busy} className={button} onClick={()=>setReversing(a)}>Revertir</button>}</div></li>;})}</ul>
      {entries.length>limit&&<button className={button} onClick={()=>setLimit(limit+50)}>Mostrar 50 más</button>}
    </section>
    {(form||entry)&&<Dialog title={form?(form.id?'Editar objetivo':'Nueva meta'):'Aporte o retiro'} onClose={()=>{setForm(null);setEntry(null);}} busy={busy}>{error&&<p role="alert" className="text-danger">{error}</p>}
      {form&&<form onSubmit={save}><fieldset disabled={busy} className="space-y-4"><label className="block">Nombre<input className={input} required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label className="block">Importe objetivo<input className={input} required type="number" min="0.01" max="9999999999999.99" step="0.01" value={form.target} onChange={e=>setForm({...form,target:e.target.value})}/></label>
        {!form.id&&<label className="block">Ahorro inicial<input className={input} required type="number" min="0" max="9999999999999.99" step="0.01" value={form.initial} onChange={e=>setForm({...form,initial:e.target.value})}/><span className="text-xs text-muted">Lo que ya tienes reservado para esta meta.</span></label>}
        <label className="block">Fecha objetivo opcional<input className={input} type="date" min="1000-01-01" max="9999-12-31" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label className="block">Prioridad<select className={input} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{['Bajo','Medio','Alto'].map(p=><option key={p}>{p}</option>)}</select></label><button className="button-primary w-full" type="submit">{busy?'Guardando…':'Guardar meta'}</button></fieldset></form>}
      {entry&&<form onSubmit={saveEntry}><fieldset disabled={busy} className="space-y-4"><p>{entry.goal.nombre_meta}</p><label className="block">Operación<select className={input} value={entry.type} onChange={e=>setEntry({...entry,type:e.target.value})}><option value="aporte">Aportar a la meta</option><option value="retiro">Retirar de la meta</option></select></label><label className="block">Importe<input className={input} required type="number" min="0.01" max="9999999999999.99" step="0.01" value={entry.amount} onChange={e=>setEntry({...entry,amount:e.target.value})}/></label><label className="block">Fecha<input className={input} required type="date" min="1000-01-01" max={civilToday()} value={entry.date} onChange={e=>setEntry({...entry,date:e.target.value})}/></label><label className="block">Concepto<input className={input} required maxLength={160} value={entry.description} onChange={e=>setEntry({...entry,description:e.target.value})} placeholder="Ej.: Ahorro de octubre"/></label><p className="text-xs text-muted">Si te equivocas, podrás revertir el registro desde el historial. El ahorro de la meta no puede quedar negativo.</p><button className="button-primary w-full" type="submit">{busy?'Guardando…':'Guardar registro'}</button></fieldset></form>}
    </Dialog>}
    <ConfirmModal open={!!reversing} title="¿Revertir este registro?" message="Se conservará el original y se añadirá una corrección por el importe contrario. El saldo de tu meta se actualizará." confirmText="Revertir registro" busy={busy} error={error} onCancel={()=>setReversing(null)} onConfirm={()=>void reverse()}/>
  </div>;
}
