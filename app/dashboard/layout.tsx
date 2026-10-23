import AppShell from '@/components/AppShell';
import ProtectedDashboard from '@/components/ProtectedDashboard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedDashboard><AppShell>{children}</AppShell></ProtectedDashboard>
  );
}
