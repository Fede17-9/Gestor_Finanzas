import Link from 'next/link';
import SiteFooter from './SiteFooter';
export const authInput='field';
export default function AuthPanel({title,children}:{title:string;children:React.ReactNode}){
  return <main className="auth-page grid place-items-center p-5"><section className="panel w-full max-w-md space-y-5 p-7"><Link href="/login" className="app-brand auth-brand"><span aria-hidden="true">f.</span>flux</Link><h1 className="text-2xl font-semibold text-ink">{title}</h1>{children}<SiteFooter compact /></section></main>;
}
