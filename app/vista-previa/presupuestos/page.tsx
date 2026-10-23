import type { Metadata } from 'next';
import BudgetPreview from '@/components/budget-preview/BudgetPreview';

export const metadata: Metadata = {
  title: 'Flux · Propuesta de Presupuestos',
  description: 'Propuesta interactiva de diseño con datos de ejemplo.',
  robots: { index: false, follow: false },
};

export default function BudgetPreviewPage() {
  return <BudgetPreview />;
}
