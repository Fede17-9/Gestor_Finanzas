import DashboardHeader from '@/components/DashboardHeader';

export default function DashboardPage() {
  // Simulación de datos (Luego vendrán de Supabase)
  const userData = {
    nickname: "Alex El Grande",
    saldo: 2500000,
    moneda: "COP"
  };

  return (
    <div>
      <DashboardHeader 
        nickname={userData.nickname} 
        saldo={userData.saldo} 
        moneda={userData.moneda} 
      />
      
      {/* Aquí irán los gráficos de la Fase 3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="h-64 bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-center justify-center text-slate-400">
          Próximamente: Gráfico de Gastos 📊
        </div>
        <div className="h-64 bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-center justify-center text-slate-400">
          Próximamente: Metas de Ahorro 🎯
        </div>
      </div>
    </div>
  );
}
