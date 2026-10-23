'use client';
import {Suspense,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {supabase} from '@/lib/supabase';
import {usePlanning} from '@/lib/use-planning';
import {budgetProgress} from '@/lib/planning';
import {amountToCents,centsToDecimal,civilToday,formatAmount} from '@/lib/finance';
import type {Row} from '@/lib/database.types';

const input='mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-white [color-scheme:dark]';
const button='rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-40';
export default function PresupuestosPage(){
  return <Suspense fallback={<p className="p-6 text-zinc-400">Cargando presupuestos…</p>}><PresupuestosContent/></Suspense>;
}
function PresupuestosContent(){
  const params=useSearchParams();
  const {data,loading,busy,error,message,perform}=usePlanning('budgets');
  const [period,setPeriod]=useState(()=>{const value=params.get('mes')||'';return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&Number(value.slice(0,4))>=1000?value:civilToday().slice(0,7);});
  const [form,setForm]=useState<{id:string;category:string;amount:string;alert:string;period:string}|null>(null);
  function open(b?:Row<'presupuestos_mensuales'>){setForm({id:b?.id_presupuesto||'',category:b?.id_categoria||'',amount:String(b?.monto_limite||''),alert:String(b?.porcentaje_alerta||80),period});}
  async function save(e:React.FormEvent){e.preventDefault();if(!form)return;await perform(async()=>{
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(form.period))throw new Error('Selecciona un mes válido.');
    const [year,month]=form.period.split('-').map(Number);
    const {error}=await supabase.rpc('guardar_presupuesto',{p_id:form.id||null,p_categoria:form.category||null,p_monto:centsToDecimal(amountToCents(form.amount)),p_mes:month,p_anio:year,p_alerta:Number(form.alert)});
    if(error)throw new Error(error.code==='23505'?'Ya existe un presupuesto para esa categoría y mes. Edita el existente.':error.code==='23514'?'Revisa el importe, mes y porcentaje de alerta.':error.message);
    setPeriod(form.period);setForm(null);return 'Presupuesto guardado.';
  });}
  const budgets=data?.budgets.filter(b=>`${b.anio_calendario}-${String(b.mes_calendario).padStart(2,'0')}`===period)||[];
  return <div className="mx-auto max-w-5xl space-y-6 pb-12 text-zinc-100">
    <header className="flex flex-wrap justify-between gap-3"><div><h1 className="text-3xl font-bold">Presupuestos</h1><p className="mt-2 text-zinc-400">Define cuánto puedes gastar cada mes y revisa lo que llevas consumido.</p></div><button className={button} disabled={!data||busy} onClick={()=>open()}>Nuevo presupuesto</button></header>
    <p className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-400">Se cuentan los egresos confirmados del mes, incluidos los pagos recurrentes confirmados. Las previsiones, inversiones, transferencias y aportes a metas no consumen el presupuesto. El presupuesto general incluye todas las categorías; no se suma a los límites por categoría.</p>
    <label className="block max-w-xs">Mes<input className={input} type="month" min="1000-01" max="9999-12" value={period} onChange={e=>setPeriod(e.target.value)}/></label>
    {error&&<p role="alert" className="text-red-300">{error}<button className="ml-3 underline" onClick={()=>window.location.reload()}>Recargar</button></p>}{message&&<p role="status" className="text-emerald-300">{message}</p>}
    {loading?<p>Cargando presupuestos…</p>:data&&!budgets.length?<p className="text-zinc-400">No tienes presupuestos para este mes.</p>:null}
    {data&&budgets.map(b=>{const p=budgetProgress(b,data.movements);return <article key={b.id_presupuesto} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-semibold">{b.id_categoria?data.categories.find(c=>c.id_categoria===b.id_categoria)?.nombre_categoria||'Categoría':'General del mes'}</h2><span className={p.status==='normal'?'text-emerald-300':'text-amber-300'}>{p.status==='normal'?'Dentro del presupuesto':p.spentCents===p.limitCents?'Límite alcanzado':p.status==='excedido'?'Presupuesto superado':`Alerta: consumo desde ${b.porcentaje_alerta}%`}</span></div>
      <p>Gastado: {formatAmount(centsToDecimal(p.spentCents),data.profile.codigo_moneda)} de {formatAmount(b.monto_limite,data.profile.codigo_moneda)}</p>
      <progress className="h-3 w-full accent-emerald-500" aria-label="Porcentaje de presupuesto consumido" max={100} value={Math.min(100,p.percentage)}/>
      <p className="text-sm text-zinc-400">{p.percentage.toFixed(1)}% consumido · {p.remainingCents<0?'Exceso':'Disponible'}: {formatAmount(centsToDecimal(Math.abs(p.remainingCents)),data.profile.codigo_moneda)}</p>
      <div className="flex gap-2"><button className={button} disabled={busy} onClick={()=>open(b)}>Editar</button><button className={button} disabled={busy} onClick={()=>{if(window.confirm('¿Eliminar este límite? Los movimientos se conservan.'))void perform(async()=>{const {data:deleted,error}=await supabase.from('presupuestos_mensuales').delete().eq('id_presupuesto',b.id_presupuesto).eq('id_usuario',data.uid).select('id_presupuesto');if(error||!deleted?.length)throw new Error('No se pudo eliminar el presupuesto.');return 'Presupuesto eliminado.';});}}>Eliminar</button></div>
    </article>;})}
    {form&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"><section role="dialog" aria-modal="true" aria-labelledby="budget-title" className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-6"><div className="mb-4 flex justify-between"><h2 id="budget-title" className="text-xl font-semibold">{form.id?'Editar presupuesto':'Nuevo presupuesto'}</h2><button disabled={busy} onClick={()=>setForm(null)}>Cerrar</button></div>{error&&<p role="alert" className="text-red-300">{error}</p>}<form onSubmit={save}><fieldset disabled={busy} className="space-y-4">
      <label className="block">Mes<input className={input} required type="month" min="1000-01" max="9999-12" value={form.period} onChange={e=>setForm({...form,period:e.target.value})}/></label>
      <label className="block">Categoría<select className={input} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="">General del mes</option>{data?.categories.map(c=><option key={c.id_categoria} value={c.id_categoria}>{c.nombre_categoria}</option>)}</select></label>
      <label className="block">Límite mensual<input className={input} type="number" min="0.01" max="9999999999999.99" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label>
      <label className="block">Avisar desde este porcentaje<input className={input} required type="number" min="1" max="100" step="1" value={form.alert} onChange={e=>setForm({...form,alert:e.target.value})}/></label>
      <p className="text-xs text-zinc-400">La alerta aparece aquí al alcanzar ese consumo. No se envían correos ni notificaciones externas.</p><button className={button+' w-full bg-emerald-900'} type="submit">{busy?'Guardando…':'Guardar presupuesto'}</button>
    </fieldset></form></section></div>}
  </div>;
}
