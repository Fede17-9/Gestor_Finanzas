"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { formatAmount } from '@/lib/finance';
import type { CategoryTotal } from '@/lib/finance';

interface Props {
  title: string;
  data: CategoryTotal[];
  color: string;
  currency: string;
  emptyMessage: string;
}

export default function CategoryChart({ title, data, color, currency, emptyMessage }: Props) {
  return (
    <section className="bg-[#09090b] border border-zinc-800/50 rounded-3xl p-6 flex flex-col gap-4">
      <h3 className="text-sm font-black text-white uppercase tracking-widest">{title}</h3>
      {data.length === 0 ? <p className="text-zinc-500 text-xs py-10 text-center">{emptyMessage}</p> : (
        <>
          <div className="w-full" style={{ height: Math.max(120, data.length * 44) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 35, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={95} axisLine={false} tickLine={false}
                  tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <Tooltip formatter={value => formatAmount(Number(value), currency)}
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: 12 }} />
                <Bar dataKey="value" name={currency} radius={[0, 6, 6, 0]} maxBarSize={20}>
                  {data.map(item => <Cell key={item.name} fill={color} />)}
                  <LabelList dataKey="pct" position="right" fill={color} fontSize={10}
                    formatter={value => String(value ?? 0) + '%'} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2">
            {data.map(item => (
              <li key={item.name} className="flex justify-between gap-3 text-xs text-zinc-400 border-b border-zinc-800/40 py-1">
                <span className="truncate">{item.name}</span>
                <span className="text-white shrink-0">{formatAmount(item.value, currency)} · {item.pct}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
