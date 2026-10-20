import Link from 'next/link';

export const authInput = 'w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-emerald-400';

export default function AuthPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-black text-white grid place-items-center p-5">
    <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-7 space-y-5">
      <Link href="/login" className="text-sm text-emerald-400 font-bold">Flux</Link>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </section>
  </main>;
}
