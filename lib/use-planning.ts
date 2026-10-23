'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { createFinanceReader } from './finance-data';
import { civilToday, readAllPages } from './finance';
import { budgetProgress, goalProgress } from './planning';

async function loadPlanning(view:'budgets'|'goals') {
  const {data:{session},error}=await supabase.auth.getSession();
  if(error || !session) throw new Error('No se pudo comprobar tu sesión. Vuelve a iniciar sesión.');
  const uid=session.user.id,reader=createFinanceReader(supabase);
  const [profile,movements,budgets,goals,entries,categories]=await Promise.all([
    reader.profile(uid),view==='budgets'?reader.movements(uid):Promise.resolve([]),
    view==='budgets'?readAllPages(async(from,to)=>{const {data,error}=await supabase.from('presupuestos_mensuales').select('*').eq('id_usuario',uid).order('id_presupuesto').range(from,to);if(error||!data)throw new Error('No se pudieron cargar los presupuestos.');return data;}):Promise.resolve([]),
    view==='goals'?readAllPages(async(from,to)=>{const {data,error}=await supabase.from('metas_ahorro').select('*').eq('id_usuario',uid).order('id_meta').range(from,to);if(error||!data)throw new Error('No se pudieron cargar las metas.');return data;}):Promise.resolve([]),
    view==='goals'?readAllPages(async(from,to)=>{const {data,error}=await supabase.from('aportes_metas').select('*').eq('id_usuario',uid).order('fecha',{ascending:false}).order('creado_en',{ascending:false}).order('id_aporte').range(from,to);if(error||!data)throw new Error('No se pudo cargar el historial de aportes. Comprueba que aplicaste la migración de fase 4.');return data;}):Promise.resolve([]),
    readAllPages(async(from,to)=>{const {data,error}=await supabase.from('categorias').select('id_categoria,nombre_categoria').or('id_usuario.eq.'+uid+',id_usuario.is.null').order('id_categoria').range(from,to);if(error||!data)throw new Error('No se pudieron cargar las categorías.');return data;}),
  ]);
  for(const goal of goals)goalProgress(goal,civilToday());
  for(const budget of budgets)budgetProgress(budget,[]);
  return {uid,profile,movements,budgets,goals,entries,categories};
}
export function usePlanning(view:'budgets'|'goals') {
  const [data,setData]=useState<Awaited<ReturnType<typeof loadPlanning>>|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[message,setMessage]=useState('');
  const lock=useRef(false);
  const reload=useCallback(async()=>{setData(await loadPlanning(view));},[view]);
  useEffect(()=>{let active=true;loadPlanning(view).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[view]);
  async function perform(work:()=>Promise<string>) {
    if(lock.current)return;
    lock.current=true;setBusy(true);setError('');setMessage('');
    try {setMessage(await work());try{await reload();}catch{setData(null);setError('La operación se guardó, pero no se pudo recargar la vista. Recarga antes de continuar; no repitas la operación.');}}
    catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}
    finally{lock.current=false;setBusy(false);}
  }
  return {data,loading,busy,error,message,perform};
}
