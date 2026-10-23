import type { Metadata } from 'next';
import BudgetPreview from '@/components/budget-preview/BudgetPreview';
import { civilToday } from '@/lib/finance';

export const metadata: Metadata = {
  title: 'Flux · Propuesta de Presupuestos',
  description: 'Propuesta interactiva de diseño con datos de ejemplo.',
  robots: { index: false, follow: false },
};

export default function BudgetPreviewPage() {
  return <BudgetPreview initialPeriod={civilToday().slice(0, 7)} />;
}
