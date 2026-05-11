// Training KPI grid. Static for now; replace this import with a backend hook
// when training data becomes a dashboard feature.
import { Card, SectionTitle } from './Card';
import { kpis } from '../mockData';

function trendColor(trend: 'up' | 'down' | 'neutral'): string {
  if (trend === 'up') return 'text-emerald-400';
  if (trend === 'down') return 'text-rose-400';
  return 'text-slate-500';
}

export function TrainingKPIs() {
  return (
    <div>
      <SectionTitle>Training KPIs</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="flex flex-col gap-1">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
              {k.label}
            </div>
            <div className="text-2xl font-semibold text-white">{k.value}</div>
            <div className={'text-[11px] font-medium ' + trendColor(k.trend)}>{k.sub}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
