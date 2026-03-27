"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeftRight, Plus, Calendar, Search, X, TrendingUp, TrendingDown, Layers, CreditCard, Repeat, Zap } from "lucide-react";

export default function MovimientosPage() {
  const [loading, setLoading] = useState(true);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [categoriasLista, setCategoriasLista] = useState<any[]>([]);

  // Estados del Formulario Flotante (Modal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipoMovimiento, setTipoMovimiento] = useState("2"); // 2 = Egreso por defecto
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [categoria, setCategoria] = useState(""); 
  
  // Recurrencia
  const [isRecurrente, setIsRecurrente] = useState(false);
  const [frecuencia, setFrecuencia] = useState("Mensual");
  const [diaEjecucion, setDiaEjecucion] = useState("1");
  const [fechaFin, setFechaFin] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Funciones de carga
  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // 1. Cargar Movimientos (ahora incluimos es_automatico para mostrar el ⚡)
    const { data: movData, error: movError } = await supabase
      .from('movimientos')
      .select('id_movimiento, monto_transaccion, descripcion_detalle, fecha_operacion, id_tipo, metodo_pago, es_automatico, categorias(nombre_categoria)')
      .order('fecha_operacion', { ascending: false });

    // 2. Cargar Categorías
    const { data: catData, error: catError } = await supabase
      .from('categorias')
      .select('id_categoria, nombre_categoria')
      .or(`id_usuario.eq.${session.user.id},id_usuario.is.null`);

    if (movData && !movError) setMovimientos(movData);
    if (catData && !catError) setCategoriasLista(catData);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  // Función para guardar el registro 
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let finalCategoriaId = null;

    if (categoria.trim() !== "") {
      const nombreCat = categoria.trim();
      const catExistente = categoriasLista.find(
        (c) => c.nombre_categoria.toLowerCase() === nombreCat.toLowerCase()
      );

      if (catExistente) {
        finalCategoriaId = catExistente.id_categoria;
      } else {
        const { data: newCat, error: catError } = await supabase
          .from('categorias')
          .insert([{ 
            id_usuario: session.user.id, 
            nombre_categoria: nombreCat 
          }])
          .select('id_categoria')
          .single();

        if (newCat && !catError) {
          finalCategoriaId = newCat.id_categoria;
        }
      }
    }

    // 1. Insertar el Movimiento Base
    // Al ser una inserción manual humana, el DB default para es_automatico es FALSE, lo cual es perfecto.
    const { error: movError } = await supabase.from('movimientos').insert([
      {
        id_usuario: session.user.id,
        id_tipo: parseInt(tipoMovimiento),
        id_categoria: finalCategoriaId,
        monto_transaccion: parseFloat(monto),
        metodo_pago: metodoPago,
        descripcion_detalle: descripcion,
        es_automatico: false 
      }
    ]);

    if (movError) {
      alert("Error en módulo Movimientos: " + movError.message);
      setIsSubmitting(false);
      return;
    }

    // 2. Insertar Recurrencia si está activada
    if (isRecurrente) {
      const { error: recError } = await supabase.from('config_recurrencias').insert([
        {
          id_usuario: session.user.id,
          id_tipo: parseInt(tipoMovimiento),
          id_categoria: finalCategoriaId,
          monto_recurrente: parseFloat(monto),
          frecuencia: frecuencia,
          dia_ejecucion: parseInt(diaEjecucion) || 1,
          fecha_inicio: new Date().toISOString().split('T')[0],
          fecha_fin: fechaFin ? fechaFin : null
        }
      ]);
      if (recError) alert("El movimiento se guardó pero falló la recurrencia: " + recError.message);
    }

    // Limpiar modal y recargar tabla
    setIsModalOpen(false);
    setMonto("");
    setDescripcion("");
    setCategoria("");
    setMetodoPago("Efectivo");
    setIsRecurrente(false);
    setFrecuencia("Mensual");
    setDiaEjecucion("1");
    setFechaFin("");
    fetchData(); 
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-7xl mx-auto pb-10 animate-in fade-in duration-500 relative">
      
      {/* Header de Interfaz */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-widest uppercase flex items-center gap-3">
            <ArrowLeftRight className="text-[#39FF14]" size={30} strokeWidth={2.5} />
            Transacciones
          </h1>
          <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest mt-2 border-l-2 border-[#39FF14] pl-3 py-0.5">
            Registro cifrado del Flujo de Caja
          </p>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#39FF14] text-black font-black uppercase tracking-widest text-[11px] px-6 py-3.5 rounded-xl hover:bg-[#a3e635] hover:shadow-[0_0_20px_rgba(57,255,20,0.3)] transition-all active:scale-95"
        >
          <Plus size={16} strokeWidth={3} />
          Nuevo Registro
        </button>
      </div>

      {/* Panel de Comandos */}
      <div className="bg-[#09090b] border border-zinc-800/50 p-4 rounded-2xl flex flex-col xl:flex-row gap-4 mb-6 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800 group-hover:bg-[#39FF14] transition-colors duration-500"></div>
        <div className="flex-1 relative pl-2">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="BUSCAR OPERACIÓN..." 
            className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-xs font-mono tracking-wider px-12 py-3.5 rounded-xl focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] outline-none transition-all placeholder-zinc-600 shadow-inner"
          />
        </div>
      </div>

      {/* Tabla de Base de Datos */}
      <div className="bg-[#09090b] border border-zinc-800/50 rounded-2xl overflow-hidden shadow-2xl relative min-h-[300px] flex flex-col">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/30 to-transparent"></div>
        
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4 text-[#39FF14]">
            <div className="relative">
              <ArrowLeftRight size={32} className="animate-spin text-zinc-800" />
              <div className="absolute inset-0 border-t-2 border-[#39FF14] rounded-full animate-spin" style={{ animationDuration: '0.8s' }}></div>
            </div>
            <span className="font-mono text-[10px] tracking-widest uppercase animate-pulse">Desencriptando Módulo...</span>
          </div>
        ) : movimientos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20 gap-2 text-zinc-500 bg-zinc-900/10">
            <span className="font-mono text-sm tracking-widest uppercase text-zinc-600">No hay registros activos</span>
            <span className="font-mono text-[9px] tracking-widest">Inyecta un nuevo registro para iniciar estadística</span>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase font-bold tracking-widest bg-zinc-900/30">
                  <th className="p-4 pl-6 w-32">Fecha</th>
                  <th className="p-4 min-w-[200px]">Detalle / Categoría</th>
                  <th className="p-4 w-40">Método / Ref</th>
                  <th className="p-4 text-right pr-6 w-40">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mov) => {
                  const fecha = new Date(mov.fecha_operacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                  const isIngreso = mov.id_tipo === 1;
                  const catNombre = mov.categorias?.nombre_categoria || "Sin categoría";

                  return (
                    <tr key={mov.id_movimiento} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors group">
                      <td className="p-4 pl-6 font-mono text-xs text-zinc-500 uppercase">{fecha}</td>
                      <td className="p-4 text-sm text-zinc-300 font-medium">
                        <div className="flex items-center gap-3">
                          {isIngreso ? <TrendingUp size={16} className="text-[#39FF14] shrink-0" /> : <TrendingDown size={16} className="text-[#ff3939] shrink-0" />}
                          <div className="flex flex-col">
                            <span className="flex items-center gap-2">
                              {mov.descripcion_detalle || 'Operación'}
                              {/* ⚡ Rayo si el registro nació de la máquina automática */}
                              {mov.es_automatico && <Zap size={12} className="text-[#39FF14] fill-[#39FF14]" title="Generado por el sistema de forma automática" />}
                            </span>
                            <span className="text-[9px] text-zinc-500 font-mono tracking-widest">{catNombre}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-[10px] text-zinc-400">
                        {mov.metodo_pago || 'Desconocido'}
                      </td>
                      <td className={`p-4 pr-6 text-right font-mono font-bold tracking-tight text-lg ${isIngreso ? 'text-[#39FF14]' : 'text-white'}`}>
                        {isIngreso ? '+' : '-'}${mov.monto_transaccion.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🚀 Modal / Ventana Flotante Avanzada para Nuevo Registro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#09090b] border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(57,255,20,0.1)] relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-zinc-800 pb-4">
              NUEVA OPERACIÓN
            </h2>

            <form onSubmit={handleGuardar} className="flex flex-col gap-4">
              
              {/* Selector de Tipo */}
              <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800 gap-1">
                <button type="button" onClick={() => setTipoMovimiento("1")} 
                  className={`flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase rounded-lg transition-all ${tipoMovimiento === "1" ? "bg-[#39FF14] text-black shadow-[0_0_15px_rgba(57,255,20,0.2)]" : "text-zinc-500 hover:text-zinc-300"}`}>
                  Ingreso (+)
                </button>
                <button type="button" onClick={() => setTipoMovimiento("2")} 
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${tipoMovimiento === "2" ? "bg-[#ff3939] text-white shadow-[0_0_15px_rgba(255,57,57,0.2)]" : "text-zinc-500 hover:text-zinc-300"}`}>
                  Egreso (-)
                </button>
              </div>

               {/* Monto */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Monto Transado</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                  <input type="number" step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-10 py-3 text-white focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] outline-none transition-all font-mono font-bold"
                    placeholder="0.00" />
                </div>
              </div>

               {/* Método de Pago y Categoría */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1">
                    <CreditCard size={12} /> Método
                  </label>
                  <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-white focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] outline-none transition-all text-xs">
                    <option value="Efectivo">Efectivo 💵</option>
                    <option value="Transferencia">Transferencia 🏦</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1">
                    <Layers size={12} /> Categoría
                  </label>
                  <input
                    type="text"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    list="categorias-list"
                    placeholder="Ej: Mesada"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-white focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] outline-none transition-all text-xs"
                  />
                  <datalist id="categorias-list">
                    {categoriasLista.map(cat => (
                      <option key={cat.id_categoria} value={cat.nombre_categoria} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Descripción Breve</label>
                <input type="text" required value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-zinc-500 transition-all font-medium text-sm placeholder-zinc-600"
                  placeholder="Ej: Salario Quincena" />
              </div>

              {/* Automátización / Recurrencia */}
              <div className="mt-2 border border-zinc-800 rounded-xl p-4 bg-zinc-900/50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={isRecurrente} onChange={(e) => setIsRecurrente(e.target.checked)} className="peer sr-only" />
                  <div className="w-10 h-5 bg-zinc-800 rounded-full peer-checked:bg-[#39FF14] relative transition-colors">
                    <div className="absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                  </div>
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <Repeat size={14} className={isRecurrente ? "text-[#39FF14]" : "text-zinc-600"} />
                    ¿Automatizar Operación?
                  </span>
                </label>

                {isRecurrente && (
                  <div className="mt-4 pt-4 border-t border-zinc-800/50 animate-in fade-in slide-in-from-top-2 flex flex-col gap-3">
                    
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Frecuencia de Repetición</label>
                      <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none transition-all text-xs">
                        <option value="Diario">Diario</option>
                        <option value="Semanal">Semanal</option>
                        <option value="Mensual">Mensual</option>
                        <option value="Anual">Anual</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Calendar size={12}/> Día del mes
                        </label>
                        <input type="number" min="1" max="31" required value={diaEjecucion} onChange={(e) => setDiaEjecucion(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none text-xs"
                          placeholder="1-31" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Fecha Fin (Opcional)</label>
                        <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-400 outline-none text-xs [color-scheme:dark]" />
                      </div>
                    </div>

                    <p className="text-[9px] text-zinc-500 font-mono mt-1 tracking-widest leading-relaxed">
                      Se programará en tu <span className="text-[#39FF14]">config_recurrencias</span>. El sistema insertará estas copias a futuro marcadas como automáticas <Zap size={8} className="inline text-[#39FF14] fill-[#39FF14] mb-0.5" />.
                    </p>
                  </div>
                )}
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-white text-black font-black uppercase tracking-widest text-[11px] py-4 mt-2 rounded-xl hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                {isSubmitting ? "PROCESANDO..." : "GRABAR EN BITÁCORA"}
              </button>
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
}
