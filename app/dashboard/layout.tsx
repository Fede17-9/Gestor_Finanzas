import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex bg-[#000000] min-h-screen font-sans selection:bg-[#39FF14] selection:text-black">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 overflow-y-auto relative min-h-screen">
        {/* Glow de fondo para ambientación */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#39FF14]/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
        {children}
      </main>
    </div>
  );
}
