"use client";

import { useEffect, useState } from 'react';
import DashboardHeader from '@/components/DashboardHeader';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [userData, setUserData] = useState({
    nickname: "Cargando...",
    saldo: 0,
    moneda: "...",
    avatarUrl: ""
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      // 1. Obtener la sesión actual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        router.push("/login"); // Si no está logueado, protegemos la ruta mandándolo al login
        return;
      }

      // 2. Buscar el perfil en la tabla "usuarios"
      const { data: profileData, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id_usuario', session.user.id)
        .single();

      if (profileData && !error) {
        setUserData({
          // Ahora le damos prioridad al username, ya que ahí se guarda su "Apodo"
          nickname: profileData.username || profileData.nombre_completo,
          saldo: 0, // Aún no tenemos tabla de movimientos, empezamos en saldo 0 inicial.
          moneda: profileData.codigo_moneda,
          avatarUrl: profileData.url_avatar
        });
      }
      setLoading(false);
    };

    fetchUserData();
  }, [router]);

  if (loading) {
    return <div className="flex items-center justify-center h-full min-h-[50vh] text-slate-400">Cargando tu información financiera...</div>;
  }

  return (
    <div>
      <DashboardHeader 
        nickname={userData.nickname} 
        saldo={userData.saldo} 
        moneda={userData.moneda} 
        avatarUrl={userData.avatarUrl}
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
