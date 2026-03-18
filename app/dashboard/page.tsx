export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Resumen General</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-slate-500 text-sm font-medium">Saldo Total</span>
          <span className="text-2xl font-bold text-gray-800 mt-1">$12,450.00</span>
          <span className="text-emerald-500 text-xs font-medium mt-2">+2.5% este mes</span>
        </div>
        
        {/* Card 2 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-slate-500 text-sm font-medium">Gastos del Mes</span>
          <span className="text-2xl font-bold text-gray-800 mt-1">$3,240.00</span>
          <span className="text-red-500 text-xs font-medium mt-2">+12% vs mes anterior</span>
        </div>
        
        {/* Card 3 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-slate-500 text-sm font-medium">Ahorros</span>
          <span className="text-2xl font-bold text-gray-800 mt-1">$9,210.00</span>
          <span className="text-emerald-500 text-xs font-medium mt-2">Vas por buen camino</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-8 min-h-[300px]">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Últimos Movimientos</h2>
        <div className="text-slate-500 text-sm text-center py-10">Aquí irá la tabla o lista de transacciones...</div>
      </div>
    </div>
  );
}
