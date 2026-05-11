import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={'min-h-0 overflow-hidden bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 ' + className}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
      {children}
    </h2>
  );
}
