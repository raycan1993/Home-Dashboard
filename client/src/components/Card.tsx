import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={'min-h-0 overflow-hidden bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-3 ' + className}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
      {children}
    </h2>
  );
}
