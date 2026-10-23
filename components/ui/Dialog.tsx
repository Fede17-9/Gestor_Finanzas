'use client';
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
export default function Dialog({ title, description, children, onClose, busy = false, open = true }: {
  title: string; description?: string; children: React.ReactNode; onClose: () => void; busy?: boolean; open?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current, trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = 'hidden';
    dialog?.querySelector<HTMLElement>('[autofocus], input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)')?.focus();
    return () => { dialog?.close(); document.body.style.overflow = overflow;
      if (trigger?.isConnected && !trigger.matches(':disabled')) trigger.focus({ preventScroll: true });
      else document.getElementById('main-content')?.focus({ preventScroll: true });
    };
  }, [open]);
  return <dialog ref={ref} className="app-dialog" aria-labelledby={id} aria-describedby={description ? id + '-description' : undefined}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="dialog-heading"><div><h2 id={id}>{title}</h2>{description && <p id={id + '-description'}>{description}</p>}</div>
      <button className="icon-button" type="button" aria-label="Cerrar ventana" disabled={busy} onClick={onClose}><X size={20} /></button>
    </header>{children}
  </dialog>;
}
