'use client';
import {AlertTriangle,CheckCircle2} from 'lucide-react';
import Dialog from './ui/Dialog';
interface Props{open:boolean;title:string;message:string;confirmText?:string;cancelText?:string;confirmVariant?:'danger'|'success';busy?:boolean;error?:string;onConfirm:()=>void;onCancel:()=>void;}
export default function ConfirmModal({open,title,message,confirmText='Confirmar',cancelText='Cancelar',confirmVariant='danger',busy=false,error,onConfirm,onCancel}:Props){
  if(!open)return null;
  return <Dialog title={title} description={message} onClose={onCancel} busy={busy}>
    <div className={confirmVariant==='danger'?'confirmation-icon danger':'confirmation-icon'}>{confirmVariant==='danger'?<AlertTriangle size={24}/>:<CheckCircle2 size={24}/>}</div>
    {error&&<p role="alert" className="feedback error">{error}</p>}
    <div className="dialog-actions"><button autoFocus type="button" className="button-secondary" disabled={busy} onClick={onCancel}>{cancelText}</button><button type="button" className={confirmVariant==='danger'?'button-danger':'button-primary'} disabled={busy} onClick={onConfirm}>{busy?'Guardando…':confirmText}</button></div>
  </Dialog>;
}
