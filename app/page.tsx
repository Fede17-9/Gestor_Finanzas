"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const isAuthLink = url.searchParams.has('code') || url.searchParams.has('error') || hash.has('access_token') || hash.has('error');
    router.replace(isAuthLink ? '/auth/callback' + url.search + url.hash : '/login');
  }, [router]);
  return <main className="min-h-screen bg-paper text-muted grid place-items-center">Abriendo tu registro financiero…</main>;
}
